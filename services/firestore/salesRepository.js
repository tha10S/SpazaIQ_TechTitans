import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapSale } from './mappers';
import {
  enqueueOfflineOperation,
  getOfflineOperations,
  isDeviceOffline,
  isNetworkError,
  readPosCreditSnapshot,
  registerOfflineOperationHandler,
  savePosCreditSnapshot,
  subscribeOfflineOperations,
} from '../offline/posCreditQueue';

function salesCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'sales'));
}

function operationRef(storeId, key) {
  return doc(db, ...storeCollectionPath(storeId, 'operations'), key);
}

function mergePendingSales(sales, operations) {
  const pendingSales = operations
    .filter((operation) => operation.type === 'recordSale' && operation.status !== 'failed')
    .map((operation) => ({
      id: operation.id,
      paymentMethod: operation.payload.paymentMethod,
      total: Number(operation.payload.total),
      paidAmount: Number(operation.payload.paidAmount),
      creditAmount: Number(operation.payload.creditAmount),
      customerId: operation.payload.customerId || null,
      items: operation.payload.cart,
      createdAt: operation.createdAt,
      pendingSync: true,
    }));
  const knownIds = new Set(sales.map((sale) => sale.id));
  return [...pendingSales.filter((sale) => !knownIds.has(sale.id)), ...sales];
}

export async function fetchSales(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  let sales;
  try {
    const snapshot = await getDocs(query(salesCollection(authenticatedStoreId), orderBy('createdAt', 'desc')));
    sales = snapshot.docs.map(mapSale);
    await savePosCreditSnapshot(authenticatedStoreId, 'sales', sales);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    sales = await readPosCreditSnapshot(authenticatedStoreId, 'sales');
    if (!Array.isArray(sales)) throw error;
  }
  return mergePendingSales(sales, await getOfflineOperations(authenticatedStoreId));
}

export function subscribeSales(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  let active = true;
  let cachedSales = null;
  let queuedOperations = [];
  let unsubscribeSnapshot = () => {};
  let unsubscribeQueue = () => {};
  const publishSales = (sales, operations = []) => {
    onData(mergePendingSales(sales, operations));
  };
  const start = async () => {
    try {
      cachedSales = await readPosCreditSnapshot(authenticatedStoreId, 'sales');
      if (cachedSales !== null && !Array.isArray(cachedSales)) {
        throw new Error('The saved offline sales list is invalid.');
      }
      if (active && cachedSales) publishSales(cachedSales);
    } catch (error) {
      if (active) onError(error);
    }
    if (!active) return;
    unsubscribeQueue = subscribeOfflineOperations(authenticatedStoreId, (operations) => {
      queuedOperations = operations;
      if (active) publishSales(cachedSales || [], queuedOperations);
    }, onError);
    unsubscribeSnapshot = onSnapshot(query(salesCollection(authenticatedStoreId), orderBy('createdAt', 'desc')), (snapshot) => {
      if (snapshot.metadata.fromCache && cachedSales?.length) return;
      const sales = snapshot.docs.map(mapSale);
      if (!snapshot.metadata.fromCache) {
        cachedSales = sales;
        savePosCreditSnapshot(authenticatedStoreId, 'sales', sales).catch(onError);
      }
      cachedSales = sales;
      publishSales(sales, queuedOperations);
    }, (error) => {
      if (cachedSales) publishSales(cachedSales);
      onError(error);
    });
  };
  start();
  return () => {
    active = false;
    unsubscribeSnapshot();
    unsubscribeQueue();
  };
}

function validateSaleInput({ cart, total, creditAmount = 0, paidAmount = total, customerId, idempotencyKey }) {
  if (!cart?.length) throw new Error('Add at least one product to the cart.');
  if (!idempotencyKey) throw new Error('A sale idempotency key is required.');
  const numericTotal = Number(total);
  const numericCredit = Number(creditAmount || 0);
  const numericPaid = Number(paidAmount || 0);
  if (Math.abs(numericPaid + numericCredit - numericTotal) > 0.01) throw new Error('Payment amounts must equal the sale total.');
  if (numericCredit > 0 && !customerId) throw new Error('Select a customer for credit payment.');
  return { numericTotal, numericCredit, numericPaid };
}

async function recordSaleOnline({ storeId, cart, paymentMethod, total, customerId, creditAmount = 0, paidAmount = total, dueDate, schedule, idempotencyKey }) {
  const authenticatedStoreId = assertStoreId(storeId);
  const { numericTotal, numericCredit, numericPaid } = validateSaleInput({
    cart, total, creditAmount, paidAmount, customerId, idempotencyKey,
  });

  return runTransaction(db, async (transaction) => {
    const operation = await transaction.get(operationRef(authenticatedStoreId, idempotencyKey));
    if (operation.exists()) return operation.data().result;

    const productReferences = cart.map((item) => doc(db, ...storeCollectionPath(authenticatedStoreId, 'products'), item.id));
    const productSnapshots = [];
    for (const productReference of productReferences) productSnapshots.push(await transaction.get(productReference));
    productSnapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new Error(`Product ${cart[index].name} no longer exists.`);
      const available = Number(snapshot.data().quantity ?? 0);
      if (available < cart[index].qty) throw new Error(`${cart[index].name} has only ${available} in stock.`);
    });

    let customerSnapshot = null;
    let customerReference = null;
    if (numericCredit > 0) {
      customerReference = doc(db, ...storeCollectionPath(authenticatedStoreId, 'customers'), customerId);
      customerSnapshot = await transaction.get(customerReference);
      if (!customerSnapshot.exists()) throw new Error('Customer account not found.');
      const customerData = customerSnapshot.data();
      const balance = Number(customerData.balance ?? 0);
      const limit = Number(customerData.creditLimit ?? 0);
      const overdueByDate = customerData.nextDueDate && new Date(customerData.nextDueDate) < new Date() && balance > 0;
      if (customerData.overdue || Number(customerData.overdueBalance ?? 0) > 0 || overdueByDate) throw new Error('This customer has overdue credit and is blocked from new credit.');
      if (limit > 0 && balance + numericCredit > limit) throw new Error(`Credit limit exceeded. Available: R ${(limit - balance).toFixed(2)}.`);
    }

    const saleReference = doc(salesCollection(authenticatedStoreId));
    const scheduleReference = numericCredit > 0 && schedule
      ? doc(collection(db, ...storeCollectionPath(authenticatedStoreId, 'repaymentSchedules')))
      : null;
    const saleResult = { id: saleReference.id, total: numericTotal };
    transaction.set(saleReference, {
      storeId: authenticatedStoreId,
      paymentMethod,
      total: numericTotal,
      paidAmount: numericPaid,
      creditAmount: numericCredit,
      customerId: customerId || null,
      items: cart,
      idempotencyKey,
      createdAt: serverTimestamp(),
    });
    productSnapshots.forEach((snapshot, index) => {
      const product = cart[index];
      transaction.update(productReferences[index], {
        quantity: Number(snapshot.data().quantity ?? 0) - product.qty,
        updatedAt: serverTimestamp(),
      });
    });
    if (numericCredit > 0) {
      const ledger = doc(collection(db, ...storeCollectionPath(authenticatedStoreId, 'creditTransactions')));
      const balance = Number(customerSnapshot.data().balance ?? 0);
      transaction.set(ledger, {
        storeId: authenticatedStoreId,
        customerId,
        type: 'credit',
        source: 'sale',
        saleId: saleReference.id,
        amount: numericCredit,
        dueDate: dueDate || null,
        schedule: schedule || null,
        scheduleId: scheduleReference?.id ?? null,
        idempotencyKey,
        createdAt: serverTimestamp(),
      });
      transaction.update(customerReference, {
        balance: balance + numericCredit,
        nextDueDate: dueDate || null,
        updatedAt: serverTimestamp(),
      });
      if (scheduleReference) {
        transaction.set(scheduleReference, {
          ...schedule,
          storeId: authenticatedStoreId,
          customerId,
          ledgerId: ledger.id,
          saleId: saleReference.id,
          totalAmount: numericCredit,
          remainingAmount: numericCredit,
          dueDate: dueDate || null,
          status: 'active',
          createdAt: serverTimestamp(),
        });
      }
    }
    transaction.set(operationRef(authenticatedStoreId, idempotencyKey), {
      type: 'recordSale',
      result: saleResult,
      createdAt: serverTimestamp(),
        storeId: authenticatedStoreId,
    });
    return saleResult;
  });
}

export async function recordSale(input) {
  const authenticatedStoreId = assertStoreId(input.storeId);
  const payload = { ...input, storeId: authenticatedStoreId };
  const { numericTotal } = validateSaleInput(payload);
  if (await isDeviceOffline()) {
    await enqueueOfflineOperation(authenticatedStoreId, 'recordSale', payload);
    return { id: payload.idempotencyKey, total: numericTotal, pendingSync: true };
  }

  try {
    return await recordSaleOnline(payload);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueueOfflineOperation(authenticatedStoreId, 'recordSale', payload);
    return { id: payload.idempotencyKey, total: numericTotal, pendingSync: true };
  }
}

registerOfflineOperationHandler('recordSale', recordSaleOnline);
