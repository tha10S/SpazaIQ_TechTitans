import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapCustomer } from './mappers';
import {
  getOfflineOperations,
  isNetworkError,
  readPosCreditSnapshot,
  savePosCreditSnapshot,
  subscribeOfflineOperations,
} from '../offline/posCreditQueue';

function customersCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'customers'));
}

function applyPendingBalances(customers, operations) {
  return customers.map((customer) => {
    const change = operations.reduce((total, operation) => {
      if (operation.status === 'failed') return total;
      const payload = operation.payload;
      if (payload.customerId !== customer.id) return total;
      if (operation.type === 'makePayment') return total - Number(payload.amount);
      if (operation.type === 'addCreditTransaction') return total + Number(payload.amount);
      if (operation.type === 'recordSale') return total + Number(payload.creditAmount || 0);
      return total;
    }, 0);
    return change ? { ...customer, balance: Number(customer.balance || 0) + change, pendingSync: true } : customer;
  });
}

export async function fetchCustomers(storeId) {
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

export function subscribeCustomers(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  let active = true;
  let cachedCustomers = null;
  let queuedOperations = [];
  let unsubscribe = () => {};
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
      if (active && cachedCustomers) publishCustomers(cachedCustomers);
    }, onError);
    unsubscribe = onSnapshot(query(customersCollection(authenticatedStoreId), orderBy('name')), (snapshot) => {
      if (snapshot.metadata.fromCache && cachedCustomers?.length) return;
      const customers = snapshot.docs.map(mapCustomer);
      if (!snapshot.metadata.fromCache) {
        cachedCustomers = customers;
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
    unsubscribe();
    unsubscribeQueue();
  };
}

export function customerRef(storeId, customerId) {
  return doc(db, ...storeCollectionPath(storeId, 'customers'), customerId);
}

export async function createCustomer(storeId, input) {
  const authenticatedStoreId = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  const creditLimit = Number(input.creditLimit || 0);
  if (!name || !Number.isFinite(creditLimit) || creditLimit < 0) {
    throw new Error('Enter a customer name and a valid non-negative credit limit.');
  }

  const reference = doc(customersCollection(authenticatedStoreId));
  await setDoc(reference, {
    storeId: authenticatedStoreId,
    name,
    phone: String(input.phone || '').trim(),
    creditLimit,
    balance: 0,
    overdue: false,
    overdueBalance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}
