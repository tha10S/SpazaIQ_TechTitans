import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

const STORE_COLLECTIONS = [
  'products',
  'customers',
  'sales',
  'creditTransactions',
  'operations',
  'repaymentSchedules',
];

async function deleteCollectionDocs(storeId, collectionName) {
  const collectionRef = collection(db, 'stores', storeId, collectionName);
  const snapshot = await getDocs(collectionRef);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });
  await batch.commit();
}

async function deleteUserOwnedTestDocs(userId) {
  const testQuery = query(collection(db, 'test'), where('ownerUid', '==', userId));
  const snapshot = await getDocs(testQuery);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });
  await batch.commit();
}

async function deleteOwnedStoreData(userId) {
  const profileRef = doc(db, 'users', userId);
  const profileSnapshot = await getDoc(profileRef);
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const storeId = profile.defaultStoreId || userId;

  if (storeId !== userId) {
    throw new Error('This account is not configured for the current one-user, one-store setup.');
  }

  for (const collectionName of STORE_COLLECTIONS) {
    await deleteCollectionDocs(storeId, collectionName);
  }

  await deleteUserOwnedTestDocs(userId);
  await deleteDoc(doc(db, 'stores', storeId));
  await deleteDoc(profileRef);
}

export async function deleteCurrentAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  if (!user.email) throw new Error('This account does not have an email/password credential.');
  if (!password) throw new Error('Enter your password to confirm account deletion.');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  await deleteOwnedStoreData(user.uid);
  await deleteUser(user);
  await signOut(auth);
}
