import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCustomerBalances } from '../hooks/useCustomerBalances';

const STATUS_CONFIG = {
  good: { label: 'Good', color: '#004B49', bg: '#E6F4F1' },
  fair: { label: 'Fair', color: '#D97706', bg: '#FEF3C7' },
  at_risk: { label: 'At Risk', color: '#DC2626', bg: '#FEE2E2' },
};

const formatR = (n) => `R ${Number(n || 0).toFixed(2)}`;

export default function CreditLedgerScreen({ storeId }) {
  const { customers, loading, error, confirmCredit } = useCustomerBalances(storeId);

  const [idModalVisible, setIdModalVisible] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [pendingAmount, setPendingAmount] = useState('');
  const [pendingDueDate, setPendingDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const openIdVerification = (customer) => {
    setActiveCustomer(customer);
    setIdModalVisible(true);
  };

  const handleVerifyAndAppend = async () => {
    if (idNumber.trim().length < 6) {
      Alert.alert('Invalid ID', 'Please enter a valid store-linked ID number.');
      return;
    }
    const amount = parseFloat(pendingAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter the credit amount for this sale.');
      return;
    }
    if (!pendingDueDate.trim()) {
      Alert.alert('Due date required', 'Please enter when this credit should be paid.');
      return;
    }

    setSaving(true);
    try {
      await confirmCredit({
        idNumber,
        customer: activeCustomer,
        amount,
        dueDate: pendingDueDate.trim(),
      });
      setIdModalVisible(false);
      setIdNumber('');
      setPendingAmount('');
      setPendingDueDate('');
      setActiveCustomer(null);
    } catch (err) {
      Alert.alert('Could not log credit', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.emerald} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={42} color={COLORS.danger} style={{ marginBottom: 10 }} />
        <Text style={styles.errorText}>Couldn't load your credit ledger.</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Credit Ledger</Text>
            <Text style={styles.subtitle}>Track informal credit & customer logs</Text>
          </View>
          <View style={styles.badgeContainer}>
            <Ionicons name="people" size={14} color={COLORS.emerald} />
            <Text style={styles.badgeText}>
              {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
            </Text>
          </View>
        </View>

        {/* Emerald Hero Total Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>TOTAL OUTSTANDING CREDIT</Text>
            <View style={styles.heroBadge}>
              <Ionicons name="alert-circle" size={13} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>Active Ledger</Text>
            </View>
          </View>
          
          <Text style={styles.heroAmount}>{formatR(totalOutstanding)}</Text>
          
          <View style={styles.heroFooter}>
            <View style={styles.heroFooterIconWrap}>
              <Ionicons name="analytics" size={14} color={COLORS.emeraldLight} />
            </View>
            <Text style={styles.heroFooterText}>
              Spread across <Text style={styles.heroFooterHighlight}>{customers.length}</Text> active customer accounts
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>CUSTOMER BALANCES</Text>

        {customers.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="folder-open-outline" size={32} color={COLORS.emerald} />
            </View>
            <Text style={styles.emptyText}>No customers on credit yet</Text>
            <Text style={styles.emptySubtext}>Tap below to record your first credit sale</Text>
          </View>
        ) : (
          customers.map((customer) => {
            const status = STATUS_CONFIG[customer.status] ?? STATUS_CONFIG.good;
            return (
              <TouchableOpacity
                key={customer.id}
                style={styles.customerCard}
                activeOpacity={0.75}
                onPress={() => openIdVerification(customer)}
              >
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                  </Text>
                </View>

                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <View style={styles.dueRow}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                    <Text style={styles.customerDue}>
                      {customer.dueBy ? `Due by ${customer.dueBy}` : 'No due date set'}
                    </Text>
                  </View>
                </View>

                <View style={styles.customerRight}>
                  <Text style={styles.customerBalance}>{formatR(customer.balance)}</Text>
                  <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={styles.recordButton}
          activeOpacity={0.88}
          onPress={() => openIdVerification({ id: 'new', name: 'New Customer', balance: 0 })}
        >
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={styles.recordButtonText}>Record New Credit</Text>
        </TouchableOpacity>

        <View style={styles.complianceRow}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.emerald} />
          <Text style={styles.complianceText}>Complies with spaza privacy & consent laws</Text>
        </View>
      </ScrollView>

<<<<<<< HEAD
      {/* ID Verification / New Credit Modal */}
      <Modal visible={idModalVisible} transparent animationType="fade" onRequestClose={() => setIdModalVisible(false)}>
=======
      <Modal visible={idModalVisible} transparent animationType="fade">
>>>>>>> 5d0f884411c03a1c0e076f514903c3d6024851e5
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="card" size={18} color={COLORS.emerald} />
                </View>
                <Text style={styles.modalTitle}>Verify Credit Sale</Text>
              </View>
              <TouchableOpacity onPress={() => setIdModalVisible(false)} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter store owner credentials to authorize credit logging for{' '}
              <Text style={styles.modalCustomerHighlight}>{activeCustomer?.name}</Text>.
            </Text>

            <Text style={styles.inputLabel}>STORE OWNER ID NUMBER</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="id-card-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9001015800083"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                value={idNumber}
                onChangeText={setIdNumber}
                editable={!saving}
              />
            </View>

            <Text style={styles.inputLabel}>CREDIT AMOUNT (R)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>R</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                value={pendingAmount}
                onChangeText={setPendingAmount}
                editable={!saving}
              />
            </View>

            <Text style={styles.inputLabel}>DUE DATE</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                value={pendingDueDate}
                onChangeText={setPendingDueDate}
                editable={!saving}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setIdModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleVerifyAndAppend}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Confirm & Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
<<<<<<< HEAD
=======

>>>>>>> 5d0f884411c03a1c0e076f514903c3d6024851e5
    </SafeAreaView>
  );
}

const COLORS = {
  emerald: '#004B49',
  emeraldDark: '#003432',
  emeraldLight: '#A7C9C7',
  emeraldBg: '#E6F4F1',
  bg: '#F9FAFB',
  cardBg: '#FFFFFF',
  textDark: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emeraldBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.emeraldLight,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },

  /* Emerald Hero Total Card */
  heroCard: {
    backgroundColor: COLORS.emeraldDark,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.emerald,
    ...Platform.select({
      ios: { shadowColor: COLORS.emerald, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.emeraldLight,
    letterSpacing: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    gap: 8,
  },
  heroFooterIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooterText: {
    fontSize: 12,
    color: '#D1E8E6',
    fontWeight: '500',
  },
  heroFooterHighlight: {
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Section Header */
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.emeraldBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
  },

  /* Customer Card */
  customerCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.emeraldBg,
    borderWidth: 1,
    borderColor: COLORS.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  customerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: -0.2,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  customerDue: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  customerRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  customerBalance: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Action Buttons */
  recordButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: COLORS.emerald, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 6,
  },
  complianceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
      android: { elevation: 10 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.emeraldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 18,
    lineHeight: 18,
  },
  modalCustomerHighlight: {
    fontWeight: '700',
    color: COLORS.emerald,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.emerald,
    marginRight: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.emerald,
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});