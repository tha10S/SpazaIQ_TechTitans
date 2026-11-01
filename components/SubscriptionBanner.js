import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useTheme } from '../config/ThemeContext';
import { formatDay, subscriptionState } from '../services/admin/billing';
import { paySubscription } from '../services/firestore/subscriptionPayment';

// Kept so other files that import them keep working. The EFT and proof-of-payment steps are no longer
// shown, because shops now pay in the app and the admin does not track payments.
export const SUPPORT_WHATSAPP = '';
export const PAYMENT_DETAILS = { bank: '', accountName: '', accountNumber: '', branchCode: '' };

// A card that always works in the simulation (Paystack's published test card)
const TEST_CARD = { number: '4084 0840 8408 4081', expiry: '12/30', cvv: '408' };

// Tells a shop owner about their own subscription. It shows nothing while the shop is paid up or has no
// subscription yet. The pay button appears only from the due date (the 28th), or at any time once the shop
// is overdue or deactivated. This payment is SIMULATED: no card is charged. A shop can read only its own
// subscription document (see firestore.rules).
export default function SubscriptionBanner({ storeId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sub, setSub] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [card, setCard] = useState(TEST_CARD);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [receipt, setReceipt] = useState(null); // shown after paying, even though the shop is then "paid"

  useEffect(() => {
    if (!storeId) return undefined;
    return onSnapshot(
      doc(db, 'subscriptions', storeId),
      (snapshot) => setSub(snapshot.exists() ? snapshot.data() : null),
      () => setSub(null)
    );
  }, [storeId]);

  const pay = async () => {
    setPayError('');
    const digits = card.number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return setPayError('Enter a valid card number.');
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setPayError('Enter the expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(card.cvv)) return setPayError('Enter the 3 or 4 digit security code.');

    setPaying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // pretend to talk to the card network
      const result = await paySubscription(storeId, sub);
      setReceipt(result);
      setFormOpen(false);
    } catch (error) {
      setPayError(
        error?.code === 'permission-denied'
          ? 'The payment could not be saved. Payment may not be open yet, or the security rules have not been updated.'
          : error?.message || 'The payment could not be completed. Try again.'
      );
    } finally {
      setPaying(false);
    }
  };

  if (receipt) {
    return (
      <View style={[styles.banner, { borderColor: colors.primary }]}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.primary }]}>Payment received</Text>
          <Text style={styles.text}>
            R{receipt.amount.toFixed(2)} paid. Your shop is active and your next payment opens on {formatDay(receipt.dueDate)}.
          </Text>
          <Text style={styles.text}>This was a simulated payment. No money was taken.</Text>
          <Pressable onPress={() => setReceipt(null)}>
            <Text style={[styles.link, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const state = subscriptionState(sub, new Date());
  if (state.key === 'none' || state.key === 'paid') return null;

  const suspended = state.key === 'deactivated';
  const canPay = state.key === 'overdue' || suspended;
  const fee = Number(sub?.monthlyFee || 0);
  const color = suspended ? colors.danger : '#F59E0B';
  const text = suspended
    ? 'Your subscription is not active, so new sales are blocked. You can still view your records. Pay to switch your shop back on.'
    : state.key === 'overdue'
      ? `Your subscription payment was due on ${formatDay(state.dueDate)}. Pay before ${formatDay(state.accessUntil)} to keep recording sales.`
      : `Your next subscription payment opens on ${formatDay(state.dueDate)}. You will be able to pay here from that day.`;

  return (
    <View style={[styles.banner, { borderColor: color }]}>
      <Ionicons name={suspended ? 'alert-circle' : 'time-outline'} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color }]}>
          {suspended ? 'Shop deactivated' : canPay ? 'Subscription payment due' : 'Payment opens soon'}
        </Text>
        <Text style={styles.text}>{text}</Text>

        {canPay && !formOpen ? (
          <Pressable style={[styles.payBtn, { backgroundColor: color }]} onPress={() => setFormOpen(true)} accessibilityRole="button">
            <Text style={styles.payBtnText}>Pay {fee > 0 ? `R${fee.toFixed(2)}` : 'now'}</Text>
          </Pressable>
        ) : null}

        {canPay && formOpen ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>Pay by card</Text>
            <Text style={styles.text}>Simulated payment. The test card is filled in and no money is taken.</Text>

            <Text style={styles.fieldLabel}>Card number</Text>
            <TextInput
              style={styles.input}
              value={card.number}
              onChangeText={(value) => setCard((previous) => ({ ...previous, number: value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim() }))}
              keyboardType="number-pad"
              placeholder="0000 0000 0000 0000"
              placeholderTextColor={colors.textMuted}
              editable={!paying}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Expiry</Text>
                <TextInput
                  style={styles.input}
                  value={card.expiry}
                  onChangeText={(value) => setCard((previous) => ({ ...previous, expiry: value }))}
                  placeholder="MM/YY"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                  editable={!paying}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Security code</Text>
                <TextInput
                  style={styles.input}
                  value={card.cvv}
                  onChangeText={(value) => setCard((previous) => ({ ...previous, cvv: value.replace(/\D/g, '').slice(0, 4) }))}
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholder="CVV"
                  placeholderTextColor={colors.textMuted}
                  editable={!paying}
                />
              </View>
            </View>

            {payError ? <Text style={[styles.text, { color: colors.danger }]}>{payError}</Text> : null}

            <Pressable
              style={[styles.payBtn, { backgroundColor: color }, paying && { opacity: 0.7 }]}
              onPress={pay}
              disabled={paying}
              accessibilityRole="button"
            >
              {paying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.payBtnText}>Pay {fee > 0 ? `R${fee.toFixed(2)}` : 'now'}</Text>}
            </Pressable>
            <Pressable onPress={() => { setFormOpen(false); setPayError(''); }} disabled={paying}>
              <Text style={[styles.link, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
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
    payBtn: { height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    payBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    payBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
    payTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 6 },
    input: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary },
    row: { flexDirection: 'row', gap: 10 },
  });
