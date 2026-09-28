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

function salesCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'sales'));
}

function operationRef(storeId, key) {
  return doc(db, ...storeCollectionPath(storeId, 'operations'), key);
}

export async function fetchSales(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const snapshot = await getDocs(query(salesCollection(authenticatedStoreId), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(mapSale);
}

export function subscribeSales(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  return onSnapshot(query(salesCollection(authenticatedStoreId), orderBy('createdAt', 'desc')), (snapshot) => {
    onData(snapshot.docs.map(mapSale));
  }, onError);
}

export async function recordSale({ storeId, cart, paymentMethod, total, customerId, creditAmount = 0, paidAmount = total, dueDate, schedule, idempotencyKey }) {
  const authenticatedStoreId = assertStoreId(storeId);
  if (!cart?.length) throw new Error('Add at least one product to the cart.');
  const numericTotal = Number(total);
  const numericCredit = Number(creditAmount || 0);
  const numericPaid = Number(paidAmount || 0);
  if (Math.abs(numericPaid + numericCredit - numericTotal) > 0.01) throw new Error('Payment amounts must equal the sale total.');
  if (numericCredit > 0 && !customerId) throw new Error('Select a customer for credit payment.');

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
