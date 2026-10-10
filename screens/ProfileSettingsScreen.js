import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../config/ThemeContext';
import { logOut } from '../services/auth/firebaseAuth';
import { auth } from '../services/firebase/firebaseConfig';
import { deleteCurrentAccount } from '../services/auth/accountDeletionService';
import { subscribeUserProfile, updateUserProfile } from '../services/firestore/usersRepository';

const DEFAULT_PROFILE = {
  name: '',
  shopName: '',
  phone: '',
  email: '',
  location: '',
  shopRegistration: '',
};

const FIELDS = [
  { key: 'name', label: 'Full Name', keyboardType: 'default' },
  { key: 'shopName', label: 'Shop Name', keyboardType: 'default' },
  { key: 'phone', label: 'Phone', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', keyboardType: 'email-address' },
  { key: 'location', label: 'Location', keyboardType: 'default' },
  { key: 'shopRegistration', label: 'Shop Registration', keyboardType: 'default' },
];

const getInitials = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const { colors, spacing, radius, typography, isDark, toggleTheme } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, spacing, radius),
    [colors, typography, spacing, radius]
  );

  const [profile, setProfile] = useState({
    ...DEFAULT_PROFILE,
    name: auth.currentUser?.displayName || '',
    email: auth.currentUser?.email || '',
  });
  const [draft, setDraft] = useState(profile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Keep a ref so the subscription doesn't restart every time editing toggles
  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return undefined;
    return subscribeUserProfile(
      userId,
      (data) => {
        if (!data) return;
        const nextProfile = {
          name: data.fullName || data.displayName || auth.currentUser?.displayName || '',
          shopName: data.shopName || '',
          phone: data.mobile || '',
          email: data.email || auth.currentUser?.email || '',
          location: data.location || '',
          shopRegistration: data.shopRegistration || '',
        };
        setProfile(nextProfile);
        if (!isEditingRef.current) setDraft(nextProfile);
      },
      (error) => console.warn('Profile subscription failed', error?.code, error?.message)
    );
  }, []);

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const saveEditing = async () => {
    if (!draft.name.trim() || !draft.shopName.trim()) {
      Alert.alert('Missing info', 'Name and shop name cannot be empty.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await updateUserProfile(auth.currentUser.uid, {
        fullName: draft.name,
        shopName: draft.shopName,
        mobile: draft.phone,
        location: draft.location,
        shopRegistration: draft.shopRegistration,
      });
      setProfile(draft);
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Could not save profile', error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updateDraft = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const handleDeleteAccount = () => {
    setDeletePassword('');
    setDeleteConfirmation('');
    setDeleteError('');
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Type DELETE exactly to confirm permanent account deletion.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError('');
    try {
      await deleteCurrentAccount(deletePassword);
      setDeleteModalVisible(false);
    } catch (error) {
      const code = error?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setDeleteError('The password is incorrect. Your account has not been deleted.');
      } else if (code === 'auth/requires-recent-login') {
        setDeleteError('Please sign in again, then retry account deletion.');
      } else if (code === 'permission-denied') {
        setDeleteError('Firestore denied the deletion. Check your account permissions and try again.');
      } else if (code === 'failed-precondition') {
        setDeleteError('The store setup is invalid for this account. Please contact support.');
      } else {
        setDeleteError(error?.message || 'Account deletion failed. Your account may still exist.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;
    setLogoutError('');
    setIsLoggingOut(true);
    logOut()
      .catch((error) => {
        setLogoutError(error.message || 'Firebase could not sign you out.');
      })
      .finally(() => setIsLoggingOut(false));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <TouchableOpacity
          onPress={() => Alert.alert('Help', "Support isn't wired up in this prototype yet.")}
        >
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Identity row */}
        <View style={styles.identityRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{getInitials(profile.name)}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName}>{profile.name}</Text>
            <Text style={styles.identitySub}>{profile.shopName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarEditBadge}
            onPress={() =>
              Alert.alert('Change photo', "Photo upload isn't wired up in this prototype yet.")
            }
          >
            <Ionicons name="pencil" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Shop Information */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>SHOP INFORMATION</Text>
          {isEditing ? null : (
            <TouchableOpacity style={styles.sectionEditLink} onPress={startEditing}>
              <Text style={styles.sectionEditLinkText}>Edit</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.settingsCard}>
          {FIELDS.map((field, idx) => (
            <View key={field.key}>
              <View style={styles.fieldRow}>
                {isEditing ? (
                  <View style={styles.fieldValueWrap}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={draft[field.key]}
                      onChangeText={(v) => updateDraft(field.key, v)}
                      placeholder={field.label}
                      placeholderTextColor={colors.textMuted}
                      keyboardType={field.keyboardType}
                    />
                  </View>
                ) : (
                  <View style={styles.fieldValueWrap}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldValue}>{profile[field.key]}</Text>
                  </View>
                )}
              </View>
              {idx < FIELDS.length - 1 && <View style={styles.settingDivider} />}
            </View>
          ))}

          {isEditing && (
            <View style={styles.editActionsRow}>
              <TouchableOpacity
                style={[styles.editActionBtn, styles.cancelBtn]}
                onPress={cancelEditing}
                disabled={isSavingProfile}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editActionBtn, styles.saveBtn]}
                onPress={saveEditing}
                disabled={isSavingProfile}
              >
                <Text style={styles.saveBtnText}>{isSavingProfile ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* App Preferences */}
        <Text style={styles.sectionTitle}>APP PREFERENCES</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingSubLabel}>Switch to dark theme</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isDark ? colors.primary : colors.card}
            />
          </View>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Notifications</Text>
                <Text style={styles.settingSubLabel}>Order and stock alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={notificationsEnabled ? colors.primary : colors.card}
            />
          </View>
          <View style={styles.settingDivider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() =>
              Alert.alert('Language', "Language selection isn't wired up in this prototype yet.")
            }
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Language</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValueText}>English</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Security */}
        <Text style={styles.sectionTitle}>SECURITY</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() =>
              Alert.alert('Change PIN', "PIN management isn't wired up in this prototype yet.")
            }
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Change PIN</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.settingDivider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Biometric Login</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={biometricEnabled ? colors.primary : colors.card}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.firebaseTestButton}
          onPress={() => navigation.navigate('FirebaseTest')}
        >
          <Text style={styles.firebaseTestButtonText}>Open Firebase Test</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={isLoggingOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutBtnText}>{isLoggingOut ? 'Signing out...' : 'Log Out'}</Text>
        </TouchableOpacity>
        {logoutError ? <Text style={styles.logoutErrorText}>{logoutError}</Text> : null}

        <TouchableOpacity onPress={handleDeleteAccount} disabled={isDeletingAccount}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SpazalIQ v1.0.2</Text>
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeletingAccount && setDeleteModalVisible(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>Permanently delete account?</Text>
            <Text style={styles.deleteDescription}>
              This deletes the signed-in Firebase account, its user profile, store, products,
              customers, sales, credit records, repayment schedules, and operation records. The
              temporary top-level test collection is not deleted.
            </Text>
            <Text style={styles.deleteLabel}>CURRENT PASSWORD</Text>
            <TextInput
              style={styles.deleteInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              editable={!isDeletingAccount}
            />
            <Text style={styles.deleteLabel}>TYPE DELETE TO CONFIRM</Text>
            <TextInput
              style={styles.deleteInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              editable={!isDeletingAccount}
            />
            {deleteError ? (
              <Text accessibilityRole="alert" style={styles.deleteError}>
                {deleteError}
              </Text>
            ) : null}
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeletingAccount}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccount || !deletePassword || deleteConfirmation !== 'DELETE'}
              >
                <Text style={styles.deleteConfirmText}>
                  {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    backButton: { padding: spacing.xs },
    headerTitle: { ...typography.h2, color: colors.textPrimary },
    helpText: { ...typography.body, color: colors.primary, fontWeight: '600' },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },

    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    identityText: { flex: 1 },
    identityName: { ...typography.h2, color: colors.textPrimary },
    identitySub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
    avatarEditBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionEditLink: { flexDirection: 'row', alignItems: 'center' },
    sectionEditLinkText: { ...typography.small, color: colors.primary, fontWeight: '700' },

    fieldRow: {
      width: '100%',
      paddingVertical: spacing.sm,
    },
    fieldValueWrap: { flex: 1 },
    fieldLabel: { ...typography.small, color: colors.textMuted },
    fieldValue: { ...typography.body, color: colors.textPrimary, marginTop: 2, fontWeight: '600' },
    fieldInput: {
      ...typography.body,
      color: colors.textPrimary,
      marginTop: 2,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    editActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      width: '100%',
    },
    editActionBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    cancelBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
    saveBtn: { backgroundColor: colors.primary },
    saveBtnText: { ...typography.body, fontWeight: '700', color: '#FFFFFF' },

    sectionTitle: {
      ...typography.small,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.textMuted,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    settingsCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    settingTextCol: {},
    settingLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
    settingSubLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    settingValueText: { ...typography.body, color: colors.textMuted },
    settingDivider: { height: 1, backgroundColor: colors.border },

    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    firebaseTestButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    firebaseTestButtonText: {
      ...typography.small,
      color: colors.primary,
      fontWeight: '700',
    },
    logoutBtnText: { ...typography.body, color: colors.danger, fontWeight: '700' },
    logoutErrorText: {
      ...typography.small,
      color: colors.danger,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    deleteAccountText: {
      ...typography.small,
      color: colors.danger,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    deleteOverlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(17, 24, 39, 0.58)',
      padding: spacing.lg,
    },
    deleteCard: {
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.lg,
    },
    deleteTitle: { ...typography.h2, color: colors.danger, marginBottom: spacing.sm },
    deleteDescription: {
      ...typography.small,
      color: colors.textMuted,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    deleteLabel: {
      ...typography.small,
      color: colors.textMuted,
      fontWeight: '700',
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    deleteInput: {
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
    },
    deleteError: { ...typography.small, color: colors.danger, marginTop: spacing.sm },
    deleteActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    deleteCancelButton: {
      minWidth: 90,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    deleteCancelText: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
    deleteConfirmButton: {
      minWidth: 130,
      paddingVertical: spacing.sm,
      backgroundColor: colors.danger,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    versionText: {
      ...typography.small,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
  });
}