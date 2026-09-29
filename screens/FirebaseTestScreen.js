import React, { useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase/firebaseConfig';

function authErrorMessage(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'That test email already has an account. Use another test email.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Use a password that meets Firebase password requirements.';
    case 'auth/network-request-failed':
      return 'Firebase could not reach the network. Check your connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Enable it in Firebase Console under Build > Authentication > Sign-in method.';
    default:
      return error?.message || 'Firebase Authentication failed.';
  }
}

function firestoreErrorMessage(error) {
  switch (error?.code) {
    case 'permission-denied':
      return 'Firestore denied this write. Deploy the updated firestore.rules and confirm you are signed in.';
    case 'unavailable':
      return 'Firestore is unavailable. Check your internet connection and try again.';
    case 'failed-precondition':
      return 'Firestore is not ready for this write. Check that a Firestore database exists in this Firebase project.';
    default:
      return error?.message || 'Firestore write failed.';
  }
}

export default function FirebaseTestScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [firestoreMessage, setFirestoreMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const testSignup = async () => {
    setBusy(true);
    setAuthMessage('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      setAuthMessage(`Authentication succeeded. Test account created: ${credential.user.email}`);
      console.info('[Firebase test] Authentication succeeded', {
        uid: credential.user.uid,
        email: credential.user.email,
      });
    } catch (error) {
      setAuthMessage(authErrorMessage(error));
      console.error('[Firebase test] Authentication failed', {
        code: error?.code,
        message: error?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const testFirestore = async () => {
    setBusy(true);
    setFirestoreMessage('');
    try {
      if (!auth.currentUser) throw Object.assign(new Error('Sign in or create a test account before testing Firestore.'), { code: 'auth/unauthenticated' });
      const document = await addDoc(collection(db, 'test'), {
        message: 'SpazaIQ Firebase is working!',
        createdAt: serverTimestamp(),
        ownerUid: auth.currentUser.uid,
      });
      setFirestoreMessage(`Firestore write succeeded. Document ID: ${document.id}`);
      console.info('[Firebase test] Firestore write succeeded', { documentId: document.id });
    } catch (error) {
      const message = error?.code === 'auth/unauthenticated'
        ? error.message
        : firestoreErrorMessage(error);
      setFirestoreMessage(message);
      console.error('[Firebase test] Firestore write failed', {
        code: error?.code,
        message: error?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Firebase Connection Test</Text>
        <Text style={styles.caption}>Use a temporary email address. The password is never logged.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="firebase-test@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Temporary test password"
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
        />

        <View style={styles.button}>
          <Button title="Test Firebase Signup" onPress={testSignup} disabled={busy} />
        </View>
        {authMessage ? <Text accessibilityRole="alert" style={styles.message}>{authMessage}</Text> : null}

        <View style={styles.button}>
          <Button title="Test Firestore" onPress={testFirestore} disabled={busy} />
        </View>
        {firestoreMessage ? <Text accessibilityRole="alert" style={styles.message}>{firestoreMessage}</Text> : null}

        {busy ? <ActivityIndicator style={styles.loading} /> : null}
        <View style={styles.button}>
          <Button title="Back" onPress={() => navigation.goBack()} disabled={busy} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: 23, fontWeight: '800', color: '#111827', marginBottom: 8 },
  caption: { fontSize: 13, lineHeight: 19, color: '#6B7280', marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { height: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, backgroundColor: '#FFFFFF', color: '#111827' },
  button: { marginTop: 8, marginBottom: 8 },
  message: { color: '#374151', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  loading: { marginVertical: 8 },
});
