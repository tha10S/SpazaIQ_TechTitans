import { auth } from '../firebase/firebaseConfig';

export function getAuthenticatedStoreId() {
  const storeId = auth.currentUser?.uid;
  if (!storeId) throw new Error('You must be signed in to access store data.');
  return storeId;
}

export function assertStoreId(storeId) {
  const authenticatedStoreId = getAuthenticatedStoreId();
  if (storeId && storeId !== authenticatedStoreId) {
    throw new Error('Store access does not match the signed-in account.');
  }
  return authenticatedStoreId;
}

export const storePath = (storeId) => ['stores', assertStoreId(storeId)];
export const storeCollectionPath = (storeId, collectionName) => [...storePath(storeId), collectionName];
export const storeDocPath = (storeId, collectionName, documentId) => [...storeCollectionPath(storeId, collectionName), documentId];
