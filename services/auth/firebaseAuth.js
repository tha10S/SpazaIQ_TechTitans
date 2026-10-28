import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";



import { auth } from "../firebase/firebaseConfig";
import { ensureStoreSeed } from '../firestore/seedRepository';

import {
  assertValidPassword,
  isValidEmail,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeProvince,
} from '../validation';

let accountCreationPending = false;

export function consumeAccountCreationPending() {
  if (!accountCreationPending) return false;
  accountCreationPending = false;
  return true;
}

export async function signUp(email, password, profile = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
  assertValidPassword(password);
  const fullName = String(profile.fullName || profile.displayName || '').trim();
  const shopName = String(profile.shopName || '').trim();
  if (!fullName || !shopName) throw new Error('Enter your full name and shop name.');
  const normalizedProfile = {
    ...profile,
    fullName,
    shopName,
    province: normalizeProvince(profile.province),
    mobile: normalizePhoneNumber(profile.mobile, { required: true }),
  };
  accountCreationPending = true;
  let accountCreated = false;
  try {
    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    accountCreated = true;
    const displayName = fullName;
    try {
      await updateProfile(cred.user, { displayName });
      await ensureStoreSeed(cred.user.uid, {
        ...normalizedProfile,
        email: cred.user.email,
        displayName: cred.user.displayName || displayName,
      });
    } catch (error) {
      console.warn(
        'The account was created, but shop profile setup failed. The user will remain signed in.',
        error
      );
    }
    return cred.user;
  } finally {
    if (!accountCreated) accountCreationPending = false;
  }
}

export const logIn = (email, password) =>
  isValidEmail(email)
    ? signInWithEmailAndPassword(auth, normalizeEmail(email), password)
    : Promise.reject(new Error('Enter a valid email address.'));

export const logOut = () => signOut(auth);

export const watchAuth = (callback) => onAuthStateChanged(auth, callback);

export function getAuthErrorMessage(error) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address, for example name@example.com.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Choose a stronger password: 6 to 12 characters with a lowercase letter, a number and a special character.';
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is not enabled in Firebase Console.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}