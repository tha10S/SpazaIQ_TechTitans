
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from '../firebase/firebaseConfig';
import { assertValidPassword, isValidEmail, normalizeEmail, normalizePhoneNumber } from '../validation';


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

export async function updateLoginCredentials(userId, changes) {
  assertCurrentUser(userId);
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');

  const email = normalizeEmail(changes.email);
  const currentPassword = String(changes.currentPassword || '');
  const newPassword = String(changes.newPassword || '');
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.');

  const emailChanged = email !== normalizeEmail(user.email);
  if (!emailChanged && !newPassword) throw new Error('Enter a new email or password before saving.');
  if (!currentPassword) throw new Error('Enter your current password to change your login credentials.');
  if (newPassword) assertValidPassword(newPassword);
  if (!user.email) throw new Error('This account does not have an email/password credential.');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  if (emailChanged) await updateEmail(user, email);
  if (newPassword) await updatePassword(user, newPassword);
  await reload(user);
  await updateDoc(userReference(userId), {
    email,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserProfile(userId, changes) {
  assertCurrentUser(userId);
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');

  const fullName = String(changes.fullName || '').trim();
  const shopName = String(changes.shopName || '').trim();
  const email = normalizeEmail(changes.email);
  if (!fullName || !shopName) throw new Error('Name and shop name are required.');
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
  const mobile = normalizePhoneNumber(changes.mobile, { required: true });
  const province = normalizeProvince(changes.province, { required: true });

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
      email,
      mobile,
      province,
      updatedAt: serverTimestamp(),
    });
    transaction.update(storeRef, {
      name: shopName,
      updatedAt: serverTimestamp(),
    });
  });

  await updateProfile(user, { displayName: fullName });
}