import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useTheme } from '../config/ThemeContext';
import { formatDay, subscriptionState } from '../services/admin/billing';
import { openWhatsApp } from '../services/whatsapp';

// Put your support WhatsApp number here, for example '082 123 4567'. Leave it empty to hide the button.
const SUPPORT_WHATSAPP = '';

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
        {SUPPORT_WHATSAPP ? (
          <Pressable onPress={() => openWhatsApp(SUPPORT_WHATSAPP, 'Hi, I would like to pay my SpazaIQ subscription.')}>
            <Text style={[styles.link, { color }]}>Message us on WhatsApp</Text>
          </Pressable>
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
  });
