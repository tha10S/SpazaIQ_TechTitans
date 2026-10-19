import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../services/firebase/firebaseConfig';
import { isAdminUser } from '../../services/admin/adminRepository';
import { useTheme } from '../../config/ThemeContext';

const BRAND_GREEN = '#004B49';

// Admin sign-in. It uses the same Firebase sign-in as the shops, then checks the admins collection.
// A normal shop account that signs in here is signed straight back out. The real protection is not
// this screen: it is the Firestore rules, which refuse admin data to anyone not in the admins collection.
export default function AdminLoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter the admin email and password.');
      return;
    }
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const allowed = await isAdminUser(credential.user.uid);
      if (!allowed) {
        await signOut(auth);
        setError('This account is not an admin account.');
      }
      // When it is an admin, App.js notices the sign-in and shows the Admin area.
    } catch (err) {
      const code = err?.code || '';
      setError(
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Email or password is incorrect.'
          : code.includes('too-many-requests')
            ? 'Too many attempts. Wait a minute and try again.'
            : err?.message || 'Could not sign in.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Admin login</Text>
          <Text style={styles.subtitle}>For the SpazaIQ team only. Shop owners sign in on the normal login screen.</Text>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            onSubmitEditing={submit}
          />

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.button, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in as admin</Text>}
          </Pressable>

          <Pressable onPress={() => navigation?.goBack()} style={styles.back}>
            <Text style={styles.backText}>Back to shop login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48 },
    iconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 24, lineHeight: 19 },
    label: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginBottom: 6, marginTop: 4 },
    input: {
      height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary, marginBottom: 12,
    },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 },
    button: { height: 50, borderRadius: 14, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    back: { alignItems: 'center', marginTop: 18, padding: 8 },
    backText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  });
