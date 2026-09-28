import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase/firebaseConfig';

function assertCurrentUser(userId) {
  const authenticatedUserId = auth.currentUser?.uid;
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    throw new Error('You can only access the profile for the signed-in user.');
  }
}

function userReference(userId) {
  return doc(db, 'users', userId);
}

export async function getUserProfile(userId) {
  assertCurrentUser(userId);
  const snapshot = await getDoc(userReference(userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeUserProfile(userId, onData, onError) {
  assertCurrentUser(userId);
  return onSnapshot(userReference(userId), (snapshot) => {
    onData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export async function updateUserProfile(userId, changes) {
  assertCurrentUser(userId);
  const fullName = String(changes.fullName || '').trim();
  const shopName = String(changes.shopName || '').trim();
  if (!fullName || !shopName) throw new Error('Name and shop name are required.');

  const profileRef = userReference(userId);
  const storeRef = doc(db, 'stores', userId);
  await runTransaction(db, async (transaction) => {
    const [profileSnapshot, storeSnapshot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(storeRef),
    ]);
    if (!profileSnapshot.exists()) throw new Error('User profile is not initialized yet.');
    if (!storeSnapshot.exists() || storeSnapshot.data().ownerId !== userId) {
      throw new Error('Your authenticated store could not be found.');
    }

    transaction.update(profileRef, {
      fullName,
      displayName: fullName,
      shopName,
      mobile: String(changes.mobile || '').trim(),
      location: String(changes.location || '').trim(),
      shopRegistration: String(changes.shopRegistration || '').trim(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(storeRef, {
      name: shopName,
      updatedAt: serverTimestamp(),
    });
  });

  await updateProfile(auth.currentUser, { displayName: fullName });
}
