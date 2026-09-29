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

function customersCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'customers'));
}

export async function fetchCustomers(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const snapshot = await getDocs(query(customersCollection(authenticatedStoreId), orderBy('name')));
  return snapshot.docs.map(mapCustomer);
}

export function subscribeCustomers(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  return onSnapshot(query(customersCollection(authenticatedStoreId), orderBy('name')), (snapshot) => {
    onData(snapshot.docs.map(mapCustomer));
  }, onError);
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
