import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { SEED_CUSTOMERS, SEED_PRODUCTS } from '../../data/seedData';
import { assertStoreId, storeCollectionPath, storePath } from './paths';

export async function ensureStoreSeed(storeId, profile = {}) {
  const authenticatedStoreId = assertStoreId(storeId);
  const userReference = doc(db, 'users', authenticatedStoreId);
  const storeReference = doc(db, ...storePath(authenticatedStoreId));
  return runTransaction(db, async (transaction) => {
    const [userSnapshot, storeSnapshot] = await Promise.all([
      transaction.get(userReference),
      transaction.get(storeReference),
    ]);
    const existingUser = userSnapshot.exists() ? userSnapshot.data() : {};
    const existingStore = storeSnapshot.exists() ? storeSnapshot.data() : {};
    const displayName = profile.fullName || profile.displayName || existingUser.displayName || '';
    const shopName = profile.shopName || existingUser.shopName || existingStore.name || displayName || 'My Shop';
    const shouldSeed = existingStore.seedVersion !== 1;

    transaction.set(userReference, {
      uid: authenticatedStoreId,
      email: profile.email || existingUser.email || '',
      displayName,
      mobile: profile.mobile || existingUser.mobile || '',
      shopName,
      defaultStoreId: authenticatedStoreId,
      createdAt: existingUser.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(storeReference, {
      ownerId: authenticatedStoreId,
      name: shopName,
      seedVersion: 1,
      createdAt: existingStore.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (shouldSeed) {
      SEED_PRODUCTS.forEach((product) => {
        transaction.set(doc(db, ...storeCollectionPath(authenticatedStoreId, 'products'), product.id), {
          ...product,
          storeId: authenticatedStoreId,
          quantity: Number(product.quantity),
          unitPrice: Number(product.unitPrice),
          costPrice: Number(product.costPrice),
          reorderLevel: Number(product.reorderLevel),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      SEED_CUSTOMERS.forEach((customer) => {
        transaction.set(doc(db, ...storeCollectionPath(authenticatedStoreId, 'customers'), customer.id), {
          ...customer,
          storeId: authenticatedStoreId,
          balance: 0,
          overdue: false,
          overdueBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
    }

    return shouldSeed;
  });
}
