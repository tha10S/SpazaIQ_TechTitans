import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import { logOut } from '../services/auth/firebaseAuth';

const DEFAULT_PROFILE = {
  name: 'Thabo Nkosi',
  shopName: "Thabo's Mini Mart",
  phone: '+27 72 555 1234',
  email: 'thabo@minimart.co.za',
  location: 'Soweto, Johannesburg',
  shopRegistration: 'REG-2024-0847',
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
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const { colors, spacing, radius, typography, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [draft, setDraft] = useState(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const saveEditing = () => {
    if (!draft.name.trim() || !draft.shopName.trim()) {
      Alert.alert('Missing info', 'Name and shop name cannot be empty.');
      return;
    }
    setProfile(draft);
    setIsEditing(false);
  };

  const updateDraft = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your profile and shop data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setProfile(DEFAULT_PROFILE);
            setDraft(DEFAULT_PROFILE);
            setIsEditing(false);
            Alert.alert('Account deleted', 'Your profile has been reset.');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logOut();
          } catch (error) {
            Alert.alert('Could not log out', error.message);
          }
        },
      },
    ]);
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
            <Ionicons name="pencil" size={14} color={colors.card} />
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
              <TouchableOpacity style={[styles.editActionBtn, styles.cancelBtn]} onPress={cancelEditing}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editActionBtn, styles.saveBtn]} onPress={saveEditing}>
                <Text style={styles.saveBtnText}>Save</Text>
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
            onPress={() => Alert.alert('Language', "Language selection isn't wired up in this prototype yet.")}
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
            onPress={() => Alert.alert('Change PIN', "PIN management isn't wired up in this prototype yet.")}
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

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SpazalIQ v1.0.2</Text>
      </ScrollView>
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
    headerTitle: { ...typography.h2 },
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
    avatarInitials: { color: colors.card, fontSize: 20, fontWeight: '700' },
    identityText: { flex: 1 },
    identityName: { ...typography.h2 },
    identitySub: { ...typography.small, marginTop: 2 },
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
    fieldLabel: { ...typography.small },
    fieldValue: { ...typography.body, marginTop: 2, fontWeight: '600' },
    fieldInput: {
      ...typography.body,
      marginTop: 2,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    editActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      width: '100%',
    },
    editActionBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    cancelBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    cancelBtnText: { ...typography.body, fontWeight: '600', color: colors.textSecondary },
    saveBtn: { backgroundColor: colors.primary },
    saveBtnText: { ...typography.body, fontWeight: '700', color: colors.card },

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
    settingLabel: { ...typography.body, fontWeight: '600' },
    settingSubLabel: { ...typography.small, marginTop: 2 },
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
    logoutBtnText: { ...typography.body, color: colors.danger, fontWeight: '700' },
    deleteAccountText: {
      ...typography.small,
      color: colors.danger,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    versionText: {
      ...typography.small,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
  });
}