import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../config/ThemeContext';

// Same icons as the bottom tabs, so the steps match what the user will see in the app.
const STEPS = [
  {
    icon: 'cube',
    title: 'Add your stock',
    text: 'Open Stock and add your products with their prices and quantities. Scan a barcode to save time.',
  },
  {
    icon: 'cart',
    title: 'Make a sale',
    text: 'Open Sell, scan or search items, then take cash, card or credit. Your stock updates on its own.',
  },
  {
    icon: 'card',
    title: 'Keep track of credit',
    text: 'Credit shows who owes you, when they should pay, and their repayment plan.',
  },
  {
    icon: 'stats-chart',
    title: "Know how you're doing",
    text: 'Home and Insights show your sales, profit and best sellers, so you know what to restock.',
  },
];

function firstNameOf(userName) {
  const first = String(userName || '').trim().split(' ')[0];
  return first && !first.includes('@') ? first : '';
}

export default function WelcomeScreen({ userName, shopName, onStart }) {
  const { colors, spacing } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing), [colors, spacing]);
  const firstName = firstNameOf(userName);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logo}>
          <Ionicons name="storefront" size={32} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>
          Welcome to SpazaIQ{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={styles.intro}>
          We're excited to be working with you{shopName ? ` and ${shopName}` : ''}. SpazaIQ helps you
          see what's on your shelves, who owes you, and what's making you money, from your very first day.
        </Text>

        <Text style={styles.sectionTitle}>How to get going</Text>
        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="leaf-outline" size={18} color={colors.primary} />
          <Text style={styles.noteText}>
            Everything starts at zero. Your sales, profit, stock and credit fill in as you use the app.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={onStart}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.buttonText}>Get started</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors, spacing) {
  const brandGreen = '#004B49'; // solid buttons and logo stay brand green in both themes

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.xl, paddingTop: spacing.xxl * 1.5, paddingBottom: spacing.xl },

    logo: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
    intro: { fontSize: 15, lineHeight: 23, color: colors.textMuted, marginBottom: spacing.xl },

    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
    steps: { gap: spacing.md, marginBottom: spacing.lg },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    stepIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { flex: 1 },
    stepTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    stepBody: { fontSize: 13, lineHeight: 19, color: colors.textMuted },

    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: spacing.md,
    },
    noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.primary, fontWeight: '600' },

    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    button: {
      height: 52,
      borderRadius: 14,
      backgroundColor: brandGreen,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    buttonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  });
}