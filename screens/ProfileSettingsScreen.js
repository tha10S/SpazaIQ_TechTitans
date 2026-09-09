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

const DEFAULT_PROFILE = {
  name: 'Thabo Dlamini',
  shopName: "Thabo's Mini Mart",
  phone: '+268 7612 3456',
  email: 'thabo@spazaliq.co.sz',
};

const FIELDS = [
  { key: 'name', label: 'Full Name', icon: 'person-outline' },
  { key: 'shopName', label: 'Shop Name', icon: 'storefront-outline' },
  { key: 'phone', label: 'Phone Number', icon: 'call-outline', keyboardType: 'phone-pad' },
  { key: 'email', label: 'Email', icon: 'mail-outline', keyboardType: 'email-address' },
];

export default function ProfileSettingsScreen() {
  const navigation = useNavigation();
  const { colors, spacing, radius, typography, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [draft, setDraft] = useState(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
      { text: 'Log Out', style: 'destructive', onPress: () => {} },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile card — Read/Update */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-circle" size={72} color={colors.primary} />
            <TouchableOpacity
              style={styles.avatarEditBadge}
              onPress={() =>
                Alert.alert('Change photo', "Photo upload isn't wired up in this prototype yet.")
              }
            >
              <Ionicons name="camera" size={14} color={colors.card} />
            </TouchableOpacity>
          </View>

          {FIELDS.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <View style={styles.fieldIconWrap}>
                <Ionicons name={field.icon} size={16} color={colors.textMuted} />
              </View>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={draft[field.key]}
                  onChangeText={(v) => updateDraft(field.key, v)}
                  placeholder={field.label}
                  placeholderTextColor={colors.textMuted}
                  keyboardType={field.keyboardType}
                />
              ) : (
                <View style={styles.fieldValueWrap}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue}>{profile[field.key]}</Text>
                </View>
              )}
            </View>
          ))}

          {isEditing ? (
            <View style={styles.editActionsRow}>
              <TouchableOpacity style={[styles.editActionBtn, styles.cancelBtn]} onPress={cancelEditing}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editActionBtn, styles.saveBtn]} onPress={saveEditing}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
              <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preferences — includes the dark mode toggle */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>Dark Mode</Text>
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
              <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={notificationsEnabled ? colors.primary : colors.card}
            />
          </View>
        </View>

        {/* Account — Delete rounds out the CRUD set */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <Ionicons name="log-out-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.settingLabel}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.settingDivider} />
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.settingLabel, { color: colors.danger }]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>SpazalIQ v1.0.0</Text>
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
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    avatarWrap: { marginBottom: spacing.md, position: 'relative' },
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    fieldIconWrap: { width: 24, alignItems: 'center' },
    fieldValueWrap: { flex: 1 },
    fieldLabel: { ...typography.small },
    fieldValue: { ...typography.body, marginTop: 2 },
    fieldInput: {
      flex: 1,
      ...typography.body,
      paddingVertical: 4,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryLight,
    },
    editBtnText: { ...typography.body, color: colors.primaryDark, fontWeight: '700' },
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
    sectionTitle: { ...typography.h2, fontSize: 16, marginBottom: spacing.sm },
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
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    settingLabel: { ...typography.body },
    settingDivider: { height: 1, backgroundColor: colors.border },
    versionText: {
      ...typography.small,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
  });
}