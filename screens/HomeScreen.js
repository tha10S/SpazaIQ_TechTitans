import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';


const STAT_DEFS = [
  { key: 'sales', label: "Today's Sales", value: 'E 2,450', icon: 'cash-outline', tintKey: 'primary' },
  { key: 'profit', label: 'Profit', value: 'E 680', icon: 'trending-up-outline', tintKey: 'success' },
  { key: 'stock', label: 'Stock Value', value: 'E 18,300', icon: 'cube-outline', tintKey: 'warning' },
  { key: 'credit', label: 'Credit Out', value: 'E 1,120', icon: 'people-outline', tintKey: 'danger' },
];

const quickActions = [
  { key: 'suppliers', label: 'Suppliers', icon: 'business-outline', target: 'SuppliersOrders', params: { initialTab: 'suppliers' } },
  { key: 'reorders', label: 'Reorders', icon: 'repeat-outline', target: 'SuppliersOrders', params: { initialTab: 'orders' } },
  { key: 'addSale', label: 'Add Sale', icon: 'add-circle-outline' },
  { key: 'addStock', label: 'Add Stock', icon: 'archive-outline' },
];

const weeklySales = [
  { day: 'Mon', value: 1800 },
  { day: 'Tue', value: 2100 },
  { day: 'Wed', value: 1600 },
  { day: 'Thu', value: 2400 },
  { day: 'Fri', value: 2900 },
  { day: 'Sat', value: 3200 },
  { day: 'Sun', value: 2450 },
];

const lowStockItems = [
  { key: '1', name: 'Cooking Oil 2L', remaining: 3 },
  { key: '2', name: 'Maize Meal 5kg', remaining: 5 },
  { key: '3', name: 'White Bread', remaining: 4 },
];

export default function HomeScreen({ navigation }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);
  const maxSale = Math.max(...weeklySales.map((d) => d.value));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Thabo's Mini Mart</Text>
            <Text style={styles.subGreeting}>Here's how your shop is doing today</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileSettings')}
            style={styles.profileButton}
          >
            <Ionicons name="person-circle" size={36} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {STAT_DEFS.map((stat) => {
            const tint = colors[stat.tintKey];
            return (
              <View key={stat.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: tint + '22' }]}>
                  <Ionicons name={stat.icon} size={18} color={tint} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.quickActionPill}
              activeOpacity={0.7}
              onPress={() => action.target && navigation.navigate(action.target, action.params)}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name={action.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly sales chart */}
        <Text style={styles.sectionTitle}>This Week's Sales</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {weeklySales.map((d) => (
              <View key={d.day} style={styles.chartBarWrap}>
                <View
                  style={[
                    styles.chartBar,
                    { height: Math.max(8, (d.value / maxSale) * 90) },
                  ]}
                />
                <Text style={styles.chartDayLabel}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Low stock alert */}
        <Text style={styles.sectionTitle}>Low Stock Alert</Text>
        <View style={styles.alertCard}>
          {lowStockItems.map((item, idx) => (
            <View
              key={item.key}
              style={[
                styles.alertRow,
                idx !== lowStockItems.length - 1 && styles.alertRowBorder,
              ]}
            >
              <View style={styles.alertLeft}>
                <Ionicons name="alert-circle" size={18} color={colors.warning} />
                <Text style={styles.alertName}>{item.name}</Text>
              </View>
              <Text style={styles.alertQty}>{item.remaining} left</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    },
    greeting: { ...typography.h1 },
    subGreeting: { ...typography.label, marginTop: spacing.xs },
    profileButton: { padding: 2 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    statValue: { ...typography.statValue },
    statLabel: { ...typography.label, marginTop: spacing.xs },
    sectionTitle: { ...typography.h2, marginTop: spacing.sm, marginBottom: spacing.md },
    quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    quickActionPill: {
      flexBasis: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    quickActionIconWrap: { marginRight: spacing.sm },
    quickActionLabel: { ...typography.body, fontWeight: '600', color: colors.primaryDark },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
    chartBarWrap: { alignItems: 'center', flex: 1 },
    chartBar: { width: 14, borderRadius: radius.sm, backgroundColor: colors.primary },
    chartDayLabel: { ...typography.small, marginTop: spacing.xs },
    alertCard: {
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warningBorder,
      paddingHorizontal: spacing.md,
    },
    alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
    alertRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.warningBorder },
    alertLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    alertName: { ...typography.body },
    alertQty: { ...typography.label, color: colors.warning, fontWeight: '700' },
  });
}