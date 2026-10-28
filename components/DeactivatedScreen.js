import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../config/ThemeContext';
import { formatDay, paymentReference } from '../services/admin/billing';
import { openWhatsApp } from '../services/whatsapp';
import { PAYMENT_DETAILS, SUPPORT_WHATSAPP } from './SubscriptionBanner';

// Same tabs and icons as the real bottom navigation, shown greyed out and not tappable
const TABS = [
  ['Home', 'home'],
  ['Stock', 'cube'],
  ['Sell', 'cart'],
  ['Credit', 'card'],
  ['Suppliers', 'people'],
  ['Insights', 'stats-chart'],
];

function GreyedTabBar({ colors }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      accessibilityState={{ disabled: true }}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        opacity: 0.4,
      }}
    >
      {TABS.map(([label, icon]) => (
        <View key={label} style={{ flex: 1, alignItems: 'center' }}>
          <Ionicons name={icon} size={24} color={colors.textMuted} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// Shown instead of the app when the shop is deactivated (by the admin, or because the subscription
// ran out). The shop owner can log in, but can only read this message or sign out.
export default function DeactivatedScreen({ storeId, sub, state, shopName, onSignOut }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fee = Number(sub?.monthlyFee || 0);
  const reference = paymentReference(storeId);
  const reason = String(sub?.deactivatedReason || '').trim();
  const detailLines = [
    ['Bank', PAYMENT_DETAILS.bank],
    ['Account name', PAYMENT_DETAILS.accountName],
    ['Account number', PAYMENT_DETAILS.accountNumber],
    ['Branch code', PAYMENT_DETAILS.branchCode],
  ].filter(([, value]) => value);

  const explanation = sub?.status === 'deactivated'
    ? 'Your shop has been deactivated, so you cannot record sales or use SpazaIQ until it is switched back on.'
    : `Your subscription payment was not received by ${formatDay(state?.accessUntil)}, so your shop has been switched off until you pay.`;

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.tint} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconCircle}>
            <Ionicons name="alert-circle" size={56} color={colors.danger} />
          </View>
          {shopName ? <Text style={styles.shopName}>{shopName}</Text> : null}
          <Text style={styles.title}>Shop deactivated</Text>
          <Text style={styles.message}>{explanation}</Text>
          {reason && sub?.status === 'deactivated' ? <Text style={styles.reason}>Reason: {reason}</Text> : null}

          <View style={styles.payBox}>
            <Text style={styles.payTitle}>How to switch your shop back on</Text>
            <Text style={styles.payText}>
              Pay {fee > 0 ? `R${fee.toFixed(2)}` : 'your subscription'} by EFT. Use this reference so we can match your payment to your shop:
            </Text>
            <Text style={styles.payRef} selectable>{reference}</Text>
            {detailLines.map(([label, value]) => (
              <Text key={label} style={styles.payText}>{label}: <Text style={styles.payValue} selectable>{value}</Text></Text>
            ))}
            <Text style={styles.payText}>
              Once you have paid, send your proof of payment. Your shop is switched back on when we confirm it, and this screen goes away by itself.
            </Text>
            {SUPPORT_WHATSAPP ? (
              <Pressable
                style={styles.whatsappButton}
                onPress={() => openWhatsApp(
                  SUPPORT_WHATSAPP,
                  `Hi, I've paid${fee > 0 ? ` R${fee.toFixed(2)}` : ''} for my SpazaIQ subscription. My payment reference is ${reference}.`
                )}
                accessibilityRole="button"
              >
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={styles.whatsappText}>Send proof of payment on WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable style={styles.signOutButton} onPress={onSignOut} accessibilityRole="button">
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <GreyedTabBar colors={colors} />
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    // Red wash over the whole screen
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(220, 38, 38, 0.12)' },
    safeArea: { flex: 1 },
    content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(220, 38, 38, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    shopName: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
    title: { fontSize: 28, fontWeight: '800', color: colors.danger, textAlign: 'center' },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 10,
      maxWidth: 420,
    },
    reason: { fontSize: 13, fontWeight: '700', color: colors.danger, marginTop: 8 },
    payBox: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.danger,
      borderRadius: 14,
      padding: 16,
      marginTop: 22,
      gap: 6,
    },
    payTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    payText: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
    payRef: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1 },
    payValue: { color: colors.textPrimary, fontWeight: '700' },
    whatsappButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: '#25D366',
      borderRadius: 10,
    },
    whatsappText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 22,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
    },
    signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  });
