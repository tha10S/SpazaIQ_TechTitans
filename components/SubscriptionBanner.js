import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useTheme } from '../config/ThemeContext';
import { formatDay, paymentReference, subscriptionState } from '../services/admin/billing';
import { openWhatsApp } from '../services/whatsapp';

// Where shop owners pay. Fill these in with your real details. Anything left empty is simply not shown.
// Support WhatsApp number, for example '082 123 4567': the shop sends its proof of payment here.
export const SUPPORT_WHATSAPP = '';
// Bank details for EFT payments.
export const PAYMENT_DETAILS = { bank: '', accountName: '', accountNumber: '', branchCode: '' };

// Tells a shop owner about their own subscription. It shows nothing while the shop is paid up or has no
// subscription yet. A shop can read only its own subscription document (see firestore.rules).
export default function SubscriptionBanner({ storeId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!storeId) return undefined;
    return onSnapshot(
      doc(db, 'subscriptions', storeId),
      (snapshot) => setSub(snapshot.exists() ? snapshot.data() : null),
      () => setSub(null)
    );
  }, [storeId]);

  const state = subscriptionState(sub, new Date());
  if (state.key === 'none' || state.key === 'paid') return null;

  const suspended = state.key === 'deactivated';
  const fee = Number(sub?.monthlyFee || 0);
  const reference = paymentReference(storeId);
  const detailLines = [
    ['Bank', PAYMENT_DETAILS.bank],
    ['Account name', PAYMENT_DETAILS.accountName],
    ['Account number', PAYMENT_DETAILS.accountNumber],
    ['Branch code', PAYMENT_DETAILS.branchCode],
  ].filter(([, value]) => value);
  const color = suspended ? colors.danger : '#F59E0B';
  const text = suspended
    ? 'Your subscription is not active, so new sales are blocked. You can still view your records. Pay to switch your shop back on.'
    : state.key === 'overdue'
      ? `Your subscription payment was due on ${formatDay(state.dueDate)}. Pay before ${formatDay(state.accessUntil)} to keep recording sales.`
      : `Your subscription payment is due on ${formatDay(state.dueDate)}. Pay on time so your shop stays active.`;

  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <Ionicons name={suspended ? 'alert-circle' : 'time-outline'} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color }]}>{suspended ? 'Shop deactivated' : 'Subscription payment due'}</Text>
        <Text style={styles.text}>{text}</Text>

        <View style={styles.payBox}>
          <Text style={styles.payTitle}>How to pay</Text>
          <Text style={styles.text}>
            Pay {fee > 0 ? `R${fee.toFixed(2)}` : 'your subscription'} by EFT. Use this reference so we can match your payment to your shop:
          </Text>
          <Text style={styles.payRef} selectable>{reference}</Text>
          {detailLines.map(([label, value]) => (
            <Text key={label} style={styles.text}>{label}: <Text style={styles.payValue} selectable>{value}</Text></Text>
          ))}
          <Text style={styles.text}>
            Once you have paid, send your proof of payment. Your shop is switched back on when we confirm it.
          </Text>
          {SUPPORT_WHATSAPP ? (
            <Pressable
              onPress={() => openWhatsApp(
                SUPPORT_WHATSAPP,
                `Hi, I've paid${fee > 0 ? ` R${fee.toFixed(2)}` : ''} for my SpazaIQ subscription. My payment reference is ${reference}.`
              )}
            >
              <Text style={[styles.link, { color }]}>Send proof of payment on WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    banner: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 14 },
    title: { fontSize: 14, fontWeight: '800' },
    text: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
    link: { fontSize: 13, fontWeight: '700', marginTop: 8 },
    payBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
    payTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
    payRef: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1 },
    payValue: { color: colors.textPrimary, fontWeight: '700' },
  });