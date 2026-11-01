import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useTheme } from '../config/ThemeContext';
import { formatDay, subscriptionState } from '../services/admin/billing';
import { paySubscription } from '../services/firestore/subscriptionPayment';

// A card payment box for the "Shop deactivated" screen (and anywhere else a shop can pay).
// SIMULATED: no card is charged. It reads the shop's own subscription, shows nothing unless payment is
// open (overdue or deactivated), and on success writes the new dates through paySubscription().
// The app then switches the shop back on by itself, because the subscription is active again.
const TEST_CARD = { number: '4084 0840 8408 4081', expiry: '12/30', cvv: '408' };

export default function PayByCard({ storeId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sub, setSub] = useState(null);
  const [card, setCard] = useState(TEST_CARD);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!storeId) return undefined;
    return onSnapshot(
      doc(db, 'subscriptions', storeId),
      (snapshot) => setSub(snapshot.exists() ? snapshot.data() : null),
      () => setSub(null)
    );
  }, [storeId]);

  const pay = async () => {
    setError('');
    const digits = card.number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return setError('Enter a valid card number.');
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setError('Enter the expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(card.cvv)) return setError('Enter the 3 or 4 digit security code.');

    setPaying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // pretend to talk to the card network
      setReceipt(await paySubscription(storeId, sub));
    } catch (paymentError) {
      setError(
        paymentError?.code === 'permission-denied'
          ? 'The payment could not be saved. The security rules may not be updated yet.'
          : paymentError?.message || 'The payment could not be completed. Try again.'
      );
    } finally {
      setPaying(false);
    }
  };

  if (receipt) {
    return (
      <View style={[styles.card, { borderColor: colors.primary }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Payment received</Text>
        <Text style={styles.text}>
          R{receipt.amount.toFixed(2)} paid. Your next payment opens on {formatDay(receipt.dueDate)}. Switching your shop back on...
        </Text>
        <Text style={styles.text}>This was a simulated payment. No money was taken.</Text>
      </View>
    );
  }

  const state = subscriptionState(sub, new Date());
  if (state.key !== 'overdue' && state.key !== 'deactivated') return null;
  const fee = Number(sub?.monthlyFee || 0);
  const label = `Pay ${fee > 0 ? `R${fee.toFixed(2)}` : 'now'}`;

  return (
    <View style={[styles.card, { borderColor: colors.danger }]}>
      <Text style={styles.title}>Pay by card</Text>
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

      {error ? <Text style={[styles.text, { color: colors.danger }]}>{error}</Text> : null}

      <Pressable
        style={[styles.payBtn, { backgroundColor: colors.danger }, paying && { opacity: 0.7 }]}
        onPress={pay}
        disabled={paying}
        accessibilityRole="button"
      >
        {paying ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.payBtnText}>{label}</Text>}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    card: { backgroundColor: colors.card, borderWidth: 1.5, borderRadius: 14, padding: 16, marginTop: 16, alignSelf: 'stretch', gap: 2 },
    title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    text: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 8 },
    input: { height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary },
    row: { flexDirection: 'row', gap: 10 },
    payBtn: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  });
