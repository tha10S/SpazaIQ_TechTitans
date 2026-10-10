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

function customersCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'customers'));
}

function ledgerCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'creditTransactions'));
}

function operationRef(storeId, key) {
  return doc(db, ...storeCollectionPath(storeId, 'operations'), key);
}

export async function fetchCustomerBalances(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const snapshot = await getDocs(query(customersCollection(authenticatedStoreId), orderBy('name')));
  return snapshot.docs.map(mapCustomer);
}

export function subscribeCustomerBalances(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  return onSnapshot(query(customersCollection(authenticatedStoreId), orderBy('name')), (snapshot) => {
    onData(snapshot.docs.map(mapCustomer));
  }, onError);
}

export async function fetchLedgerEntries(storeId, customerId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const ledgerQuery = query(
    ledgerCollection(authenticatedStoreId),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(ledgerQuery);
  return snapshot.docs.map(mapLedgerEntry);
}

export async function fetchRepaymentTrackerData(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const [customersSnapshot, schedulesSnapshot, ledgerSnapshot] = await Promise.all([
    getDocs(query(customersCollection(authenticatedStoreId), orderBy('name'))),
    getDocs(collection(db, ...storeCollectionPath(authenticatedStoreId, 'repaymentSchedules'))),
    getDocs(query(ledgerCollection(authenticatedStoreId), orderBy('createdAt', 'desc'))),
  ]);

  return {
    customers: customersSnapshot.docs.map(mapCustomer),
    schedules: schedulesSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    ledgerEntries: ledgerSnapshot.docs.map(mapLedgerEntry),
  };
}

export async function makePayment({ storeId, customerId, amount, idempotencyKey, note = '', paymentMethod = 'Cash', paymentDate }) {
  const authenticatedStoreId = assertStoreId(storeId);
  const numericAmount = Number(amount);
  if (!customerId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Enter a valid customer and payment amount.');
  }

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

export async function addCreditTransaction({ storeId, customerId, customerName, amount, dueDate, idempotencyKey, schedule }) {
  const authenticatedStoreId = assertStoreId(storeId);
  const numericAmount = Number(amount);
  if (!customerId || !Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Enter a valid credit amount.');
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

  return runTransaction(db, async (transaction) => {
    const operation = await transaction.get(operationRef(authenticatedStoreId, idempotencyKey));
    if (operation.exists()) return operation.data().result;

    const customer = customerId === 'new'
      ? doc(customersCollection(authenticatedStoreId))
      : doc(db, ...storeCollectionPath(authenticatedStoreId, 'customers'), customerId);
    const customerSnapshot = await transaction.get(customer);
    if (customerId !== 'new' && !customerSnapshot.exists()) throw new Error('Customer account not found.');
    const customerData = customerSnapshot.exists() ? customerSnapshot.data() : { balance: 0, creditLimit: 0 };
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
      name: customerId === 'new' ? customerName || 'New Customer' : customerData.name,
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
