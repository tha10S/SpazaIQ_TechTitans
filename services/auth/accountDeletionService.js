import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase/firebaseConfig';

const functions = getFunctions(app, 'us-central1');
const deleteMyAccountCallable = httpsCallable(functions, 'deleteMyAccount');

export async function deleteCurrentAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  if (!user.email) throw new Error('This account does not have an email/password credential.');
  if (!password) throw new Error('Enter your password to confirm account deletion.');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  await deleteMyAccountCallable();
  await signOut(auth);
}
