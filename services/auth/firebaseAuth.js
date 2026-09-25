import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export async function signUp(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

export const logIn = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

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
      return 'Choose a stronger password with at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is not enabled in Firebase Console.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}