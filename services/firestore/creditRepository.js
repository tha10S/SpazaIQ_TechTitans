import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapCustomer, mapLedgerEntry } from './mappers';
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

function customersCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'customers'));
}

function ledgerCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'creditTransactions'));
}

function operationRef(storeId, key) {
  return doc(db, ...storeCollectionPath(storeId, 'operations'), key);
}

function pendingBalanceChange(operation, customerId) {
  if (operation.status === 'failed') return 0;
  const payload = operation.payload;
  if (operation.type === 'makePayment' && payload.customerId === customerId) return -Number(payload.amount);
  if (operation.type === 'addCreditTransaction' && payload.customerId === customerId) return Number(payload.amount);
  if (operation.type === 'recordSale' && payload.customerId === customerId) return Number(payload.creditAmount || 0);
  return 0;
}

function applyPendingBalances(customers, operations) {
  return customers.map((customer) => {
    const change = operations.reduce((total, operation) =>
      total + pendingBalanceChange(operation, customer.id), 0);
    return change ? { ...customer, balance: Number(customer.balance || 0) + change, pendingSync: true } : customer;
  });
}

function pendingLedgerEntries(operations) {
  return operations
    .filter((operation) => operation.status !== 'failed')
    .flatMap((operation) => {
      const payload = operation.payload;
      if (operation.type === 'makePayment') {
        return [{
          id: operation.id,
          customerId: payload.customerId,
          type: 'payment',
          amount: -Number(payload.amount),
          paymentMethod: payload.paymentMethod || 'Cash',
          paymentDate: payload.paymentDate || operation.createdAt.slice(0, 10),
          idempotencyKey: operation.id,
          createdAt: operation.createdAt,
          pendingSync: true,
        }];
      }
      if (operation.type === 'addCreditTransaction') {
        return [{
          id: operation.id,
          customerId: payload.customerId,
          type: 'credit',
          amount: Number(payload.amount),
          dueDate: payload.dueDate || null,
          idempotencyKey: operation.id,
          createdAt: operation.createdAt,
          pendingSync: true,
        }];
      }
      if (operation.type === 'recordSale' && Number(payload.creditAmount) > 0) {
        return [{
          id: operation.id,
          customerId: payload.customerId,
          type: 'credit',
          amount: Number(payload.creditAmount),
          dueDate: payload.dueDate || null,
          idempotencyKey: operation.id,
          createdAt: operation.createdAt,
          pendingSync: true,
        }];
      }
      return [];
    });
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export async function fetchCustomerBalances(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  try {
    const snapshot = await getDocs(query(customersCollection(authenticatedStoreId), orderBy('name')));
    const customers = snapshot.docs.map(mapCustomer);
    await savePosCreditSnapshot(authenticatedStoreId, 'customers', customers);
    return applyPendingBalances(customers, await getOfflineOperations(authenticatedStoreId));
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const customers = await readPosCreditSnapshot(authenticatedStoreId, 'customers');
    if (!Array.isArray(customers)) throw error;
    return applyPendingBalances(customers, await getOfflineOperations(authenticatedStoreId));
  }
}

export function subscribeCustomerBalances(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  let active = true;
  let cachedCustomers = null;
  let queuedOperations = [];
  let unsubscribeSnapshot = () => {};
  let unsubscribeQueue = () => {};
  const publishCustomers = (customers) => onData(applyPendingBalances(customers, queuedOperations));
  const start = async () => {
    try {
      cachedCustomers = await readPosCreditSnapshot(authenticatedStoreId, 'customers');
      if (cachedCustomers !== null && !Array.isArray(cachedCustomers)) {
        throw new Error('The saved offline customer list is invalid.');
      }
      if (active && cachedCustomers) publishCustomers(cachedCustomers);
    } catch (error) {
      if (active) onError(error);
    }
    if (!active) return;
    unsubscribeQueue = subscribeOfflineOperations(authenticatedStoreId, (operations) => {
      queuedOperations = operations;
      if (cachedCustomers && active) publishCustomers(cachedCustomers);
    }, onError);
    unsubscribeSnapshot = onSnapshot(query(customersCollection(authenticatedStoreId), orderBy('name')), (snapshot) => {
      if (snapshot.metadata.fromCache && cachedCustomers?.length) return;
      const customers = snapshot.docs.map(mapCustomer);
      if (!snapshot.metadata.fromCache) {
        savePosCreditSnapshot(authenticatedStoreId, 'customers', customers).catch(onError);
      }
      cachedCustomers = customers;
      publishCustomers(customers);
    }, (error) => {
      if (cachedCustomers) publishCustomers(cachedCustomers);
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

export async function fetchLedgerEntries(storeId, customerId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const ledgerQuery = query(
    ledgerCollection(authenticatedStoreId),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  try {
    const snapshot = await getDocs(ledgerQuery);
    const entries = snapshot.docs.map(mapLedgerEntry);
    await savePosCreditSnapshot(authenticatedStoreId, `ledger:${customerId}`, entries);
    return [...pendingLedgerEntries(await getOfflineOperations(authenticatedStoreId))
      .filter((entry) => entry.customerId === customerId), ...entries];
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const entries = await readPosCreditSnapshot(authenticatedStoreId, `ledger:${customerId}`);
    if (!Array.isArray(entries)) throw error;
    return [...pendingLedgerEntries(await getOfflineOperations(authenticatedStoreId))
      .filter((entry) => entry.customerId === customerId), ...entries];
  }
}

export async function fetchRepaymentTrackerData(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  try {
    const [customersSnapshot, schedulesSnapshot, ledgerSnapshot] = await Promise.all([
      getDocs(query(customersCollection(authenticatedStoreId), orderBy('name'))),
      getDocs(collection(db, ...storeCollectionPath(authenticatedStoreId, 'repaymentSchedules'))),
      getDocs(query(ledgerCollection(authenticatedStoreId), orderBy('createdAt', 'desc'))),
    ]);
    const data = {
      customers: customersSnapshot.docs.map(mapCustomer),
      schedules: schedulesSnapshot.docs.map((snapshot) => {
        const schedule = snapshot.data();
        return {
          id: snapshot.id,
          ...schedule,
          createdAt: timestampToIso(schedule.createdAt),
          dueDate: timestampToIso(schedule.dueDate),
        };
      }),
      ledgerEntries: ledgerSnapshot.docs.map(mapLedgerEntry),
    };
    await savePosCreditSnapshot(authenticatedStoreId, 'repaymentData', data);
    const operations = await getOfflineOperations(authenticatedStoreId);
    return {
      ...data,
      customers: applyPendingBalances(data.customers, operations),
      ledgerEntries: [...pendingLedgerEntries(operations), ...data.ledgerEntries],
    };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const data = await readPosCreditSnapshot(authenticatedStoreId, 'repaymentData');
    if (!data || !Array.isArray(data.customers) || !Array.isArray(data.schedules) || !Array.isArray(data.ledgerEntries)) {
      throw error;
    }
    const operations = await getOfflineOperations(authenticatedStoreId);
    return {
      ...data,
      customers: applyPendingBalances(data.customers, operations),
      ledgerEntries: [...pendingLedgerEntries(operations), ...data.ledgerEntries],
    };
  }
}

function validatePaymentInput({ customerId, amount, idempotencyKey }) {
  const numericAmount = Number(amount);
  if (!customerId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Enter a valid customer and payment amount.');
  }
  if (!idempotencyKey) throw new Error('A payment idempotency key is required.');
  return numericAmount;
}

async function makePaymentOnline({ storeId, customerId, amount, idempotencyKey, note = '', paymentMethod = 'Cash', paymentDate }) {
  const authenticatedStoreId = assertStoreId(storeId);
  const numericAmount = validatePaymentInput({ customerId, amount, idempotencyKey });

  return runTransaction(db, async (transaction) => {
    const operation = await transaction.get(operationRef(authenticatedStoreId, idempotencyKey));
    if (operation.exists()) return operation.data().result;

    const customer = doc(db, ...storeCollectionPath(authenticatedStoreId, 'customers'), customerId);
    const customerSnapshot = await transaction.get(customer);
    if (!customerSnapshot.exists()) throw new Error('Customer account not found.');
    const currentBalance = Number(customerSnapshot.data().balance ?? 0);
    if (numericAmount > currentBalance) throw new Error('Payment cannot exceed the customer balance.');
    const schedulesQuery = query(
      collection(db, ...storeCollectionPath(authenticatedStoreId, 'repaymentSchedules')),
      where('customerId', '==', customerId)
    );
    const schedulesSnapshot = await transaction.get(schedulesQuery);
    let unappliedPayment = numericAmount;
    const scheduleUpdates = [];
    schedulesSnapshot.docs
      .filter((scheduleSnapshot) => scheduleSnapshot.data().status === 'active')
      .sort((left, right) => String(left.data().dueDate || '').localeCompare(String(right.data().dueDate || '')))
      .forEach((scheduleSnapshot) => {
        if (unappliedPayment <= 0) return;
        const remainingAmount = Number(scheduleSnapshot.data().remainingAmount ?? 0);
        if (remainingAmount <= 0) return;
        const appliedAmount = Math.min(unappliedPayment, remainingAmount);
        unappliedPayment -= appliedAmount;
        scheduleUpdates.push({
          reference: scheduleSnapshot.ref,
          remainingAmount: remainingAmount - appliedAmount,
          appliedAmount,
        });
      });

    const ledger = doc(ledgerCollection(authenticatedStoreId));
    const result = { id: ledger.id, customerId, amount: -numericAmount };
    transaction.set(ledger, {
      storeId: authenticatedStoreId,
      customerId,
      type: 'payment',
      amount: -numericAmount,
      scheduleAllocations: scheduleUpdates.map(({ reference, appliedAmount }) => ({
        scheduleId: reference.id,
        amount: appliedAmount,
      })),
      note,
      paymentMethod,
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      idempotencyKey,
      createdAt: serverTimestamp(),
    });
    transaction.update(customer, {
      balance: currentBalance - numericAmount,
        overdue: false,
        overdueBalance: 0,
        nextDueDate: currentBalance - numericAmount <= 0 ? null : customerSnapshot.data().nextDueDate ?? null,
      updatedAt: serverTimestamp(),
    });
    scheduleUpdates.forEach(({ reference, remainingAmount }) => {
      transaction.update(reference, {
        remainingAmount,
        status: remainingAmount <= 0 ? 'paid' : 'active',
        updatedAt: serverTimestamp(),
      });
    });
    transaction.set(operationRef(authenticatedStoreId, idempotencyKey), {
      type: 'makePayment',
      result,
      createdAt: serverTimestamp(),
        storeId: authenticatedStoreId,
    });
    return result;
  });
}

export async function makePayment(input) {
  const authenticatedStoreId = assertStoreId(input.storeId);
  const payload = { ...input, storeId: authenticatedStoreId };
  const numericAmount = validatePaymentInput(payload);
  const result = { id: payload.idempotencyKey, customerId: payload.customerId, amount: -numericAmount };
  if (await isDeviceOffline()) {
    await enqueueOfflineOperation(authenticatedStoreId, 'makePayment', payload);
    return { ...result, pendingSync: true };
  }

  try {
    return await makePaymentOnline(payload);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueueOfflineOperation(authenticatedStoreId, 'makePayment', payload);
    return { ...result, pendingSync: true };
  }
}

function validateCreditInput({ customerId, customerName, newCustomer, amount, idempotencyKey, schedule }) {
  const numericAmount = Number(amount);
  if (!customerId || !Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Enter a valid credit amount.');
  if (!idempotencyKey) throw new Error('A credit idempotency key is required.');
  const newCustomerData = customerId === 'new'
    ? {
        name: String(newCustomer?.name || customerName || '').trim(),
        phone: String(newCustomer?.phone || '').trim(),
        creditLimit: Number(newCustomer?.creditLimit || 0),
      }
    : null;
  if (newCustomerData && (
    !newCustomerData.name ||
    !Number.isFinite(newCustomerData.creditLimit) ||
    newCustomerData.creditLimit < 0
  )) {
    throw new Error('Enter a customer name and a valid non-negative credit limit.');
  }
  const frequency = schedule?.frequency ?? 'one_time';
  const periodCount = frequency === 'monthly'
    ? Number(schedule.durationMonths ?? schedule.totalPayments)
    : frequency === 'weekly'
      ? Number(schedule.durationWeeks ?? schedule.totalPayments)
      : 1;
  if (!['one_time', 'monthly', 'weekly'].includes(frequency)) throw new Error('Choose a valid repayment frequency.');
  if (frequency !== 'one_time' && (!Number.isInteger(periodCount) || periodCount < 1)) {
    throw new Error(`Enter a whole number of ${frequency === 'monthly' ? 'months' : 'weeks'} greater than zero.`);
  }
  if (frequency === 'monthly' && periodCount > 12) throw new Error('Monthly repayment plans cannot exceed 12 months.');
  const repaymentSchedule = schedule ? {
    ...schedule,
    frequency,
    totalPayments: periodCount,
    installmentAmount: Number((numericAmount / periodCount).toFixed(2)),
  } : null;
  return { numericAmount, repaymentSchedule, newCustomerData };
}

async function addCreditTransactionOnline(input) {
  const { storeId, customerId, customerName, newCustomer, amount, dueDate, idempotencyKey, schedule } = input;
  const authenticatedStoreId = assertStoreId(storeId);
  const { numericAmount, repaymentSchedule, newCustomerData } = validateCreditInput(input);

  return runTransaction(db, async (transaction) => {
    const operation = await transaction.get(operationRef(authenticatedStoreId, idempotencyKey));
    if (operation.exists()) return operation.data().result;

    const customer = customerId === 'new'
      ? doc(customersCollection(authenticatedStoreId))
      : doc(db, ...storeCollectionPath(authenticatedStoreId, 'customers'), customerId);
    const customerSnapshot = await transaction.get(customer);
    if (customerId !== 'new' && !customerSnapshot.exists()) throw new Error('Customer account not found.');
    const customerData = customerSnapshot.exists()
      ? customerSnapshot.data()
      : { ...newCustomerData, balance: 0, creditLimit: newCustomerData?.creditLimit ?? 0 };
    const balance = Number(customerData.balance ?? 0);
    const creditLimit = Number(customerData.creditLimit ?? 0);
    const overdueByDate = customerData.nextDueDate && new Date(customerData.nextDueDate) < new Date() && balance > 0;
    if (customerData.overdue || Number(customerData.overdueBalance ?? 0) > 0 || overdueByDate) throw new Error('This customer has overdue credit and is blocked from new credit.');
    if (creditLimit > 0 && balance + numericAmount > creditLimit) throw new Error(`Credit limit exceeded. Available: R ${(creditLimit - balance).toFixed(2)}.`);

    const ledger = doc(ledgerCollection(authenticatedStoreId));
    const scheduleReference = repaymentSchedule
      ? doc(collection(db, ...storeCollectionPath(authenticatedStoreId, 'repaymentSchedules')))
      : null;
    const result = { id: ledger.id, customerId: customer.id, amount: numericAmount };
    transaction.set(ledger, {
      storeId: authenticatedStoreId,
      customerId: customer.id,
      type: 'credit',
      amount: numericAmount,
      dueDate: dueDate || null,
      schedule: repaymentSchedule,
      scheduleId: scheduleReference?.id ?? null,
      idempotencyKey,
      createdAt: serverTimestamp(),
    });
    transaction.set(customer, {
      storeId: authenticatedStoreId,
      name: customerData.name,
      ...(newCustomerData ? { phone: newCustomerData.phone } : {}),
      creditLimit: Number(customerData.creditLimit ?? 0),
      overdue: false,
      overdueBalance: 0,
      balance: balance + numericAmount,
      nextDueDate: dueDate || null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (scheduleReference) {
      transaction.set(scheduleReference, {
        ...repaymentSchedule,
        storeId: authenticatedStoreId,
        customerId: customer.id,
        ledgerId: ledger.id,
        totalAmount: numericAmount,
        remainingAmount: numericAmount,
        dueDate: dueDate || null,
        status: 'active',
        createdAt: serverTimestamp(),
      });
    }
    transaction.set(operationRef(authenticatedStoreId, idempotencyKey), {
      type: 'addCreditTransaction',
      storeId: authenticatedStoreId,
      result,
      createdAt: serverTimestamp(),
    });
    return result;
  });
}

export async function addCreditTransaction(input) {
  const authenticatedStoreId = assertStoreId(input.storeId);
  const payload = { ...input, storeId: authenticatedStoreId };
  const { numericAmount, repaymentSchedule } = validateCreditInput(payload);
  payload.schedule = repaymentSchedule;
  const result = {
    id: payload.idempotencyKey,
    customerId: payload.customerId,
    amount: numericAmount,
  };
  if (await isDeviceOffline()) {
    await enqueueOfflineOperation(authenticatedStoreId, 'addCreditTransaction', payload);
    return { ...result, pendingSync: true };
  }

  try {
    return await addCreditTransactionOnline(payload);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await enqueueOfflineOperation(authenticatedStoreId, 'addCreditTransaction', payload);
    return { ...result, pendingSync: true };
  }
}

registerOfflineOperationHandler('makePayment', makePaymentOnline);
registerOfflineOperationHandler('addCreditTransaction', addCreditTransactionOnline);
