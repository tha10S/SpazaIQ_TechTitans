import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchRepaymentTrackerData, makePayment } from '../services/creditService';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { buildRepaymentTracker } from '../services/repaymentTracker';
import { OfflineSyncNotice } from '../components/OfflineSyncNotice';
import { isValidDecimalInput, todayIsoDate, validateIsoDate } from '../services/validation';

import { KEYBOARD_BEHAVIOR } from '../components/keyboard';
const PAYMENT_METHODS = ['Cash', 'EFT', 'Card'];
const STATUS_STYLES = {
  Cleared: { color: '#047857', backgroundColor: '#D1FAE5', icon: 'checkmark-circle' },
  'In progress': { color: '#B45309', backgroundColor: '#FEF3C7', icon: 'time' },
  Behind: { color: '#B91C1C', backgroundColor: '#FEE2E2', icon: 'alert-circle' },
};

const formatR = (value) => `R ${Number(value || 0).toFixed(2)}`;
const todayString = todayIsoDate;

// The tracker rows use outstandingAmount; fall back to balance in case a row only has that
const outstandingOf = (customer) => Number(customer?.outstandingAmount ?? customer?.balance ?? 0);
const toCents = (value) => Math.round(Number(value || 0) * 100);

function formatDate(value) {
  if (!value) return 'No payments yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RepaymentTrackerScreen({ route, navigation }) {
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();
  const [data, setData] = useState({ customers: [], schedules: [], ledgerEntries: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(todayString());
  const [paymentError, setPaymentError] = useState('');
  // Inline messages. Alert.alert shows nothing on web, so the screen shows its own.
  const [notice, setNotice] = useState(null); // { ok, text }
  const [saving, setSaving] = useState(false);

  // The stack header is hidden for this screen, so it has its own back button
  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate('MainTabs', { screen: 'Credit' });
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setData(await fetchRepaymentTrackerData(storeId));
    } catch (error) {
      setLoadError(error?.message || 'Could not load repayment data.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    fetchRepaymentTrackerData(storeId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setLoadError(error?.message || 'Could not load repayment data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [storeId]));

  const tracker = useMemo(
    () => buildRepaymentTracker(data.customers, data.schedules, data.ledgerEntries),
    [data]
  );

  const openPayment = (customer) => {
    setActiveCustomer(customer);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentDate(todayString());
    setPaymentError('');
    setNotice(null);
  };

  const savePayment = async () => {
    const amount = Number(paymentAmount);
    const outstanding = outstandingOf(activeCustomer);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a payment amount greater than zero.');
      return;
    }
    // Compare in cents so R8.00 against a balance of R8 is never rejected by a rounding error
    if (toCents(amount) > toCents(outstanding)) {
      setPaymentError(`The payment cannot be more than the outstanding ${formatR(outstanding)}.`);
      return;
    }
    try {
      validateIsoDate(paymentDate, 'payment date', { max: todayIsoDate() });
    } catch (error) {
      setPaymentError(error.message);
      return;
    }

    setSaving(true);
    setPaymentError('');
    try {
      const result = await makePayment({
        storeId,
        customerId: activeCustomer.id,
        amount,
        paymentMethod,
        paymentDate,
        note: `Repayment Tracker payment (${paymentMethod})`,
        idempotencyKey: `payment-${storeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      const customerName = activeCustomer.name || 'the customer';
      setActiveCustomer(null);
      setNotice({
        ok: true,
        text: result?.pendingSync
          ? `Payment of ${formatR(amount)} from ${customerName} is saved on this device and will sync when the connection returns.`
          : `Payment of ${formatR(amount)} from ${customerName} was recorded.`,
      });
      await refresh();
    } catch (error) {
      setPaymentError(error?.message || 'Could not record the payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && data.customers.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['top']}>
        <ActivityIndicator size="large" color={COLORS.emerald} />
      </SafeAreaView>
    );
  }

  if (loadError && data.customers.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]} edges={['top']}>
        <TouchableOpacity
          style={styles.errorBack}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.emerald} />
          <Text style={styles.errorBackText}>Back</Text>
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.danger} />
        <Text style={styles.errorTitle}>Could not load repayments</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <OfflineSyncNotice storeId={storeId} />
        <View style={styles.headingRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back to Credit Ledger"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.emerald} />
          </TouchableOpacity>
          <View style={styles.headingText}>
            <Text style={styles.title}>Repayment Tracker</Text>
            <Text style={styles.subtitle}>Monthly collections and customer plans</Text>
          </View>
          {loading ? <ActivityIndicator size="small" color={COLORS.emerald} /> : null}
        </View>

        {loadError ? <Text style={styles.inlineError}>{loadError}</Text> : null}

        {notice ? (
          <TouchableOpacity
            style={[styles.noticeCard, notice.ok ? styles.noticeOk : styles.noticeBad]}
            onPress={() => setNotice(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
          >
            <Ionicons
              name={notice.ok ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={notice.ok ? COLORS.emerald : COLORS.danger}
            />
            <Text style={[styles.noticeText, { color: notice.ok ? COLORS.emerald : COLORS.danger }]}>{notice.text}</Text>
            <Ionicons name="close" size={16} color={notice.ok ? COLORS.emerald : COLORS.danger} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>THIS MONTH</Text>
          <View style={styles.collectionRow}>
            <View>
              <Text style={styles.collectionLabel}>Total monthly collection</Text>
              <Text style={styles.collectionValue}>{formatR(tracker.monthlyCollection)}</Text>
            </View>
            <View style={styles.collectionIcon}>
              <Ionicons name="trending-up" size={21} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotals}>
            <View style={styles.summaryTotalItem}>
              <Text style={styles.summaryTotalLabel}>Outstanding</Text>
              <Text style={styles.summaryTotalValue}>{formatR(tracker.outstandingAmount)}</Text>
            </View>
            <View style={styles.summaryTotalItem}>
              <Text style={styles.summaryTotalLabel}>Total credit</Text>
              <Text style={styles.summaryTotalValue}>{formatR(tracker.totalCredit)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>CUSTOMER PLANS</Text>
          <Text style={styles.customerCount}>{tracker.customers.length}</Text>
        </View>

        {tracker.customers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No repayment accounts yet</Text>
            <Text style={styles.emptyText}>Customers with credit will appear here.</Text>
          </View>
        ) : tracker.customers.map((customer) => {
          const status = STATUS_STYLES[customer.status] || STATUS_STYLES['In progress'];
          return (
            <View key={customer.id} style={styles.customerCard}>
              <View style={styles.customerTopRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{customer.name?.trim()?.[0]?.toUpperCase() || 'C'}</Text>
                </View>
                <View style={styles.customerIdentity}>
                  <Text style={styles.customerName}>{customer.name || 'Unnamed customer'}</Text>
                  <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
                    <Ionicons name={status.icon} size={13} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{customer.status}</Text>
                  </View>
                </View>
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceLabel}>OUTSTANDING</Text>
                  <Text style={styles.balanceValue}>{formatR(customer.outstandingAmount)}</Text>
                </View>
              </View>

              <View style={styles.planGrid}>
                <PlanValue label="Repayment type" value={customer.repaymentType} />
                <PlanValue
                  label={customer.repaymentType === 'Monthly' ? 'Monthly amount' : customer.repaymentType === 'Weekly' ? 'Weekly amount' : 'Payment amount'}
                  value={customer.installmentAmount > 0 ? formatR(customer.installmentAmount) : 'Not set'}
                />
                <PlanValue
                  label="Plan duration"
                  value={customer.repaymentType === 'Once' ? 'One time' : customer.periodCount ? `${customer.periodCount} ${customer.periodUnit}` : 'Not set'}
                />
                <PlanValue label="Payments made" value={`${customer.paymentsMade}`} />
                <PlanValue
                  label={customer.repaymentType === 'Monthly' ? 'Months remaining' : customer.repaymentType === 'Weekly' ? 'Weeks remaining' : customer.repaymentType === 'Once' ? 'Payments remaining' : 'Periods remaining'}
                  value={`${customer.periodsRemaining} ${customer.periodUnit}`}
                />
                <PlanValue label="Paid amount" value={formatR(customer.paidAmount)} />
                <PlanValue label="Total credit" value={formatR(customer.totalCredit)} />
              </View>

              <View style={styles.historyRow}>
                <Ionicons name="time-outline" size={15} color={COLORS.textMuted} />
                <Text style={styles.historyText}>Last payment: {formatDate(customer.lastPaymentDate)}</Text>
                {customer.payments.length > 0 ? (
                  <Text style={styles.historyAmount}>{formatR(Math.abs(customer.payments[0].amount))}</Text>
                ) : null}
              </View>

              {customer.payments.slice(0, 3).map((payment) => (
                <View key={payment.id} style={styles.paymentHistoryRow}>
                  <Text style={styles.paymentHistoryDate}>{formatDate(payment.paymentDate ?? payment.createdAt)}</Text>
                  <Text style={styles.paymentHistoryMethod}>{payment.paymentMethod || 'Payment'}</Text>
                  <Text style={styles.paymentHistoryAmount}>{formatR(Math.abs(payment.amount))}</Text>
                </View>
              ))}

              {customer.outstandingAmount > 0 ? (
                <TouchableOpacity style={styles.recordButton} onPress={() => openPayment(customer)} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.recordButtonText}>Record payment</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(activeCustomer)} transparent animationType="slide" onRequestClose={() => !saving && setActiveCustomer(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={KEYBOARD_BEHAVIOR}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Ionicons name="wallet-outline" size={20} color={COLORS.emerald} />
                <Text style={styles.modalTitle}>Record payment</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveCustomer(null)} disabled={saving} accessibilityLabel="Close payment form">
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCustomer}>{activeCustomer?.name}</Text>
            <Text style={styles.modalBalance}>Outstanding: {formatR(outstandingOf(activeCustomer))}</Text>

            <Text style={styles.inputLabel}>PAYMENT AMOUNT</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>R</Text>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={(value) => {
                  if (isValidDecimalInput(value)) {
                    setPaymentAmount(value);
                    if (paymentError) setPaymentError('');
                  }
                }}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                editable={!saving}
              />
            </View>

            <Text style={styles.inputLabel}>PAYMENT METHOD</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodOption, paymentMethod === method && styles.methodOptionSelected]}
                  onPress={() => setPaymentMethod(method)}
                  disabled={saving}
                >
                  <Text style={[styles.methodText, paymentMethod === method && styles.methodTextSelected]}>{method}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>PAYMENT DATE</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={17} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                value={paymentDate}
                onChangeText={(value) => {
                  setPaymentDate(value);
                  if (paymentError) setPaymentError('');
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numbers-and-punctuation"
                editable={!saving}
              />
            </View>

            {paymentError ? (
              <Text style={styles.paymentError} accessibilityRole="alert">{paymentError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setActiveCustomer(null)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={savePayment} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveText}>Save payment</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function PlanValue({ label, value }) {
  return (
    <View style={styles.planValue}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={styles.planAmount}>{value}</Text>
    </View>
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
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.emeraldBg },
  headingText: { flex: 1 },
  title: { color: COLORS.textDark, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  inlineError: { color: COLORS.danger, fontSize: 12, marginBottom: 10 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  noticeOk: { backgroundColor: COLORS.emeraldBg, borderColor: COLORS.emerald },
  noticeBad: { backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: 'rgba(220, 38, 38, 0.4)' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  summaryCard: { backgroundColor: COLORS.emeraldDark, borderRadius: 12, padding: 18, marginBottom: 24 },
  summaryEyebrow: { color: '#A7C9C7', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  collectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collectionLabel: { color: '#D1E8E6', fontSize: 12, fontWeight: '600' },
  collectionValue: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', marginTop: 4 },
  collectionIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 15 },
  summaryTotals: { flexDirection: 'row', gap: 18 },
  summaryTotalItem: { flex: 1 },
  summaryTotalLabel: { color: '#A7C9C7', fontSize: 11, fontWeight: '600' },
  summaryTotalValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 5 },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 11 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  customerCount: { color: COLORS.emerald, backgroundColor: COLORS.emeraldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 11, fontWeight: '800' },
  customerCard: { backgroundColor: COLORS.cardBg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 11, ...Platform.select({ android: { elevation: 1 }, ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 } }) },
  customerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.emeraldBg, marginRight: 10 },
  avatarText: { color: COLORS.emerald, fontSize: 16, fontWeight: '800' },
  customerIdentity: { flex: 1, gap: 5 },
  customerName: { color: COLORS.textDark, fontSize: 15, fontWeight: '800' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '800' },
  balanceBlock: { alignItems: 'flex-end', marginLeft: 8 },
  balanceLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800' },
  balanceValue: { color: COLORS.textDark, fontSize: 15, fontWeight: '800', marginTop: 4 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 11, rowGap: 12 },
  planValue: { width: '50%' },
  planLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  planAmount: { color: COLORS.textDark, fontSize: 13, fontWeight: '700', marginTop: 3 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: COLORS.border, marginTop: 12, paddingTop: 10 },
  historyText: { flex: 1, color: COLORS.textMuted, fontSize: 11 },
  historyAmount: { color: COLORS.textDark, fontSize: 11, fontWeight: '700' },
  paymentHistoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 21 },
  paymentHistoryDate: { flex: 1, color: COLORS.textMuted, fontSize: 10 },
  paymentHistoryMethod: { width: 54, color: COLORS.textMuted, fontSize: 10, textAlign: 'center' },
  paymentHistoryAmount: { width: 88, color: COLORS.textDark, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  recordButton: { height: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.emerald, borderRadius: 8, marginTop: 11 },
  recordButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  emptyState: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, alignItems: 'center', padding: 26 },
  emptyTitle: { color: COLORS.textDark, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  errorBack: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorBackText: { color: COLORS.emerald, fontSize: 14, fontWeight: '700' },
  errorTitle: { color: COLORS.textDark, fontSize: 16, fontWeight: '800', marginTop: 10 },
  errorMessage: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 5 },
  retryButton: { backgroundColor: COLORS.emerald, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' },
  modalCard: { backgroundColor: COLORS.cardBg, padding: 20, paddingBottom: 28, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: '800' },
  modalCustomer: { color: COLORS.textDark, fontSize: 14, fontWeight: '700', marginTop: 14 },
  modalBalance: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, marginBottom: 15 },
  inputLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 6, marginTop: 9 },
  inputWrapper: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 11 },
  currencyPrefix: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },
  input: { flex: 1, color: COLORS.textDark, fontSize: 14, paddingVertical: 9 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodOption: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  methodOptionSelected: { backgroundColor: COLORS.emeraldBg, borderColor: COLORS.emerald },
  methodText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  methodTextSelected: { color: COLORS.emerald },
  paymentError: { color: COLORS.danger, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  cancelText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  saveButton: { flex: 1.4, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.emerald, borderRadius: 8 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});