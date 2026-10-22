import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Bar, Pill, SEVERITY_COLOR, TIER_META, TONE_META, confirmAction } from './adminUi';
import { PART_LABELS, WEIGHTS, diagnose, formatRand } from '../../services/admin/performance';
import {
  DEFAULT_FEE,
  DEFAULT_PLAN,
  defaultCoveredMonth,
  formatDay,
  monthLabel,
  paymentReminderMessage,
  shiftMonth,
} from '../../services/admin/billing';
import {
  deactivateShop,
  reactivateShop,
  recordPayment,
  startSubscription,
  subscribePayments,
} from '../../services/admin/adminRepository';
import { openWhatsApp } from '../../services/whatsapp';

import { KEYBOARD_BEHAVIOR } from '../../components/keyboard';
const BRAND_GREEN = '#004B49';

// Everything shown here is a shop-level total. There are no individual sales and no customer names.
export default function AdminShopDetail({ shop, onClose, colors, adminUid, medianBasket }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(defaultCoveredMonth());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const storeId = shop?.storeId;
  useEffect(() => {
    if (!storeId) return undefined;
    setPayments([]);
    setMessage(null);
    setNote('');
    setMonth(defaultCoveredMonth());
    setAmount(String(shop?.sub?.monthlyFee ?? DEFAULT_FEE));
    return subscribePayments(storeId, setPayments, () => {});
  }, [storeId]);

  if (!shop) return null;

  const tier = TIER_META[shop.tier];
  const state = shop.state;
  const tone = TONE_META[state.tone];
  const { causes, strengths } = diagnose(shop, { medianBasket });
  const sub = shop.sub;
  const highPerformer = shop.tier === 'high';

  const run = async (action, success) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
    } catch (error) {
      setMessage({ ok: false, text: error?.code === 'permission-denied' ? 'Permission denied by the Firestore rules.' : error?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const sendReminder = async () => {
    const result = await openWhatsApp(
      shop.contactPhone,
      paymentReminderMessage({ shopName: shop.shopName, fee: sub?.monthlyFee ?? DEFAULT_FEE, dueDate: state.dueDate, accessUntil: state.accessUntil })
    );
    if (!result.ok) setMessage({ ok: false, text: result.error });
  };

  const totals = [
    ['Revenue (30 days)', formatRand(shop.revenue30d)],
    ['Profit (30 days)', formatRand(shop.profit30d)],
    ['Sales (30 days)', String(shop.salesCount30d ?? 0)],
    ['Items sold', String(shop.itemsSold30d ?? 0)],
    ['Days with a sale', `${shop.activeDays30d ?? 0} of 30`],
    ['Last sale', shop.lastSaleAt ? formatDay(shop.lastSaleAt) : 'Never'],
    ['Average sale', formatRand(shop.d.basket)],
    ['Profit margin', `${Math.round(shop.d.margin * 100)}%`],
    ['Products', String(shop.productCount ?? 0)],
    ['Out of stock', String(shop.outOfStockCount ?? 0)],
    ['Running low', String(shop.lowStockCount ?? 0)],
    ['Stock value (cost)', formatRand(shop.stockCostValue)],
    ['Credit owed (total)', formatRand(shop.creditOutstanding)],
    ['Credit overdue (total)', formatRand(shop.creditOverdue)],
  ];

  const renderCause = (item, index) => (
    <View key={item.id} style={[styles.finding, index > 0 && styles.findingDivider]}>
      <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[item.severity] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.findingTitle}>{item.title}</Text>
        <Text style={styles.findingDetail}>{item.detail}</Text>
        <Text style={styles.findingAction}>What we can do: {item.adminAction}</Text>
        <Text style={styles.findingTip}>Tip for the shop: {item.tip}</Text>
      </View>
    </View>
  );

  const renderStrength = (item, index) => (
    <View key={item.id} style={[styles.finding, index > 0 && styles.findingDivider]}>
      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
      <View style={{ flex: 1 }}>
        <Text style={styles.findingTitle}>{item.title}</Text>
        <Text style={styles.findingDetail}>{item.detail}</Text>
      </View>
    </View>
  );

  const causeBlock = causes.length ? (
    <>
      <Text style={styles.section}>{highPerformer ? 'WATCH-OUTS' : 'ROOT CAUSES AND HOW TO IMPROVE'}</Text>
      <View style={styles.card}>{causes.map(renderCause)}</View>
    </>
  ) : null;
  const strengthBlock = strengths.length ? (
    <>
      <Text style={styles.section}>{highPerformer ? 'WHY THIS SHOP PERFORMS WELL' : 'WHAT IS WORKING'}</Text>
      <View style={styles.card}>{strengths.map(renderStrength)}</View>
    </>
  ) : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Text style={styles.topTitle} numberOfLines={1}>{shop.shopName || 'Shop'}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pill label={`${tier.label} performer`} color={tier.color} bg={tier.bg} />
            <Pill label={state.label} color={tone.color} bg={tone.bg} />
          </View>
          <Text style={styles.score}>{shop.score}<Text style={styles.scoreOf}> / 100</Text></Text>

          {shop.contactPhone || shop.contactEmail ? (
            <Text style={styles.contact}>{[shop.contactEmail, shop.contactPhone].filter(Boolean).join('  ·  ')}</Text>
          ) : null}

          <Text style={styles.section}>SCORE BREAKDOWN</Text>
          <View style={styles.card}>
            {Object.keys(WEIGHTS).map((key) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.rowLabel}>{PART_LABELS[key]}</Text>
                  <Text style={styles.rowValue}>{Math.round(shop.parts[key] * 100)}%  ·  weight {Math.round(WEIGHTS[key] * 100)}%</Text>
                </View>
                <Bar colors={colors} value={shop.parts[key]} color={tier.color} />
              </View>
            ))}
          </View>

          <Text style={styles.section}>SHOP TOTALS</Text>
          <View style={styles.grid}>
            {totals.map(([label, value]) => (
              <View key={label} style={styles.gridCell}>
                <Text style={styles.gridLabel}>{label}</Text>
                <Text style={styles.gridValue}>{value}</Text>
              </View>
            ))}
          </View>

          {highPerformer ? strengthBlock : causeBlock}
          {highPerformer ? causeBlock : strengthBlock}

          <Text style={styles.section}>SUBSCRIPTION</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}><Text style={styles.rowLabel}>Plan</Text><Text style={styles.rowValue}>{sub ? `${sub.plan} · R${sub.monthlyFee}/month` : 'None yet'}</Text></View>
            <View style={styles.rowBetween}><Text style={styles.rowLabel}>Paid up to</Text><Text style={styles.rowValue}>{sub?.coveredMonth ? monthLabel(sub.coveredMonth) : '-'}</Text></View>
            <View style={styles.rowBetween}><Text style={styles.rowLabel}>Next payment due</Text><Text style={styles.rowValue}>{formatDay(state.dueDate)}</Text></View>
            <View style={styles.rowBetween}><Text style={styles.rowLabel}>Cut-off if unpaid</Text><Text style={styles.rowValue}>{formatDay(state.accessUntil)}</Text></View>
            {sub?.deactivatedReason ? <Text style={styles.findingDetail}>Reason: {sub.deactivatedReason}</Text> : null}

            <Text style={[styles.rowLabel, { marginTop: 14 }]}>Record a payment</Text>
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={amount}
                onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="Amount (R)"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.stepper}>
                <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8}><Ionicons name="chevron-back" size={20} color={colors.primary} /></Pressable>
                <Text style={styles.stepperText}>{monthLabel(month)}</Text>
                <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></Pressable>
              </View>
            </View>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional), for example EFT reference"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />
            <Pressable
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => run(() => recordPayment(storeId, { amount, coveredMonth: month, note, plan: sub?.plan, monthlyFee: sub?.monthlyFee }, adminUid, sub), `Payment recorded for ${monthLabel(month)}.`)}
            >
              <Text style={styles.primaryBtnText}>Record payment for {monthLabel(month)}</Text>
            </Pressable>

            <View style={styles.btnRow}>
              {!sub ? (
                <Pressable
                  style={styles.outlineBtn}
                  disabled={busy}
                  onPress={() => run(() => startSubscription(storeId, { plan: DEFAULT_PLAN, monthlyFee: Number(amount) || DEFAULT_FEE, coveredMonth: month }), 'Subscription started.')}
                >
                  <Text style={styles.outlineBtnText}>Start without payment</Text>
                </Pressable>
              ) : null}
              {state.key === 'deactivated' ? (
                <Pressable
                  style={styles.outlineBtn}
                  disabled={busy}
                  onPress={() => confirmAction('Reactivate this shop?', 'It gets 7 more days to pay before being cut off again.', () => run(() => reactivateShop(storeId, sub), 'Reactivated for 7 days.'))}
                >
                  <Text style={styles.outlineBtnText}>Reactivate (7 days)</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.outlineBtn, { borderColor: colors.danger }]}
                  disabled={busy}
                  onPress={() => confirmAction('Deactivate this shop?', 'The shop will no longer be able to record new sales until it pays.', () => run(() => deactivateShop(storeId, 'Unpaid', sub), 'Shop deactivated.'))}
                >
                  <Text style={[styles.outlineBtnText, { color: colors.danger }]}>Deactivate</Text>
                </Pressable>
              )}
              {shop.contactPhone ? (
                <Pressable style={styles.outlineBtn} onPress={sendReminder}>
                  <Text style={styles.outlineBtnText}>WhatsApp reminder</Text>
                </Pressable>
              ) : null}
            </View>
            {message ? <Text style={[styles.msg, { color: message.ok ? '#10B981' : colors.danger }]}>{message.text}</Text> : null}
          </View>

          <Text style={styles.section}>PAYMENT HISTORY</Text>
          <View style={styles.card}>
            {payments.length === 0 ? (
              <Text style={styles.findingDetail}>No payments recorded yet.</Text>
            ) : (
              payments.map((payment, index) => (
                <View key={payment.id} style={[styles.rowBetween, index > 0 && { marginTop: 8 }]}>
                  <Text style={styles.rowLabel}>{monthLabel(payment.coveredMonth)}{payment.note ? `  ·  ${payment.note}` : ''}</Text>
                  <Text style={styles.rowValue}>{formatRand(payment.amount)}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.privacy}>
            Admins see shop-level totals only. A shop's sales, customers and credit records can't be opened from the admin area,
            and the Firestore security rules enforce this, not just the screens.
          </Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 56 },
    topTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginRight: 12 },
    content: { padding: 20, paddingTop: 4, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', gap: 8 },
    score: { fontSize: 44, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
    scoreOf: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
    contact: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    section: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 },
    rowLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600', flexShrink: 1 },
    rowValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    gridCell: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
    gridLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
    gridValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '800', marginTop: 2 },
    finding: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
    findingDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    findingTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    findingDetail: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
    findingAction: { fontSize: 12, color: colors.textPrimary, marginTop: 6, lineHeight: 17 },
    findingTip: { fontSize: 12, color: colors.primary, marginTop: 3, lineHeight: 17 },
    formRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
    input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, marginTop: 8 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, marginTop: 8 },
    stepperText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, minWidth: 96, textAlign: 'center' },
    primaryBtn: { height: 46, borderRadius: 12, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
    btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    outlineBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    outlineBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    msg: { fontSize: 13, fontWeight: '600', marginTop: 10 },
    privacy: { fontSize: 11, color: colors.textMuted, marginTop: 20, lineHeight: 16 },
  });
