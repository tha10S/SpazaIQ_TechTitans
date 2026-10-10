import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../config/ThemeContext';
import { subscribeCustomers } from '../services/firestore/customersRepository';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { subscribeProducts } from '../services/firestore/productsRepository';
import { subscribeSales } from '../services/firestore/salesRepository';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation, route }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, spacing, radius),
    [colors, typography, spacing, radius]
  );
  const [now, setNow] = useState(new Date());
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();

  // Weather state placeholder (ready for your weather API fetch)
  const [weather, setWeather] = useState({ temp: '18°C', condition: '☀️' });

  // Real-time clock trigger
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscriptions = [
      subscribeSales(storeId, setSales, (error) => console.warn('Sales subscription failed', error?.code)),
      subscribeProducts(storeId, '', setProducts, (error) => console.warn('Products subscription failed', error?.code)),
      subscribeCustomers(storeId, setCustomers, (error) => console.warn('Customers subscription failed', error?.code)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [storeId]);

  const formattedDateTime = now.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' • ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todaySales = sales.filter((sale) => sale.createdAt && new Date(sale.createdAt) >= todayStart);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const todayProfit = todaySales.reduce((sum, sale) => sum + (sale.items || []).reduce((itemSum, item) => {
    const cost = Number(item.costPrice);
    return Number.isFinite(cost)
      ? itemSum + (Number(item.unitPrice || 0) - cost) * Number(item.qty || 0)
      : itemSum;
  }, 0), 0);
  const stockValue = products.reduce((sum, product) => sum + product.quantity * product.cost_price, 0);
  const creditOutstanding = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const todayHourlySales = Array.from({ length: 6 }, (_, index) => {
    const hour = 8 + index * 2;
    const value = todaySales
      .filter((sale) => new Date(sale.createdAt).getHours() >= hour && new Date(sale.createdAt).getHours() < hour + 2)
      .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    return { time: `${String(hour).padStart(2, '0')}:00`, value };
  });

  // Icon badge backgrounds are translucent so they look right in light and dark mode
  const secondaryStats = [
    { key: 'profit', label: 'Profit', value: `R ${todayProfit.toFixed(2)}`, icon: 'trending-up', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    { key: 'stock', label: 'Stock Value', value: `R ${stockValue.toFixed(2)}`, icon: 'cube', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    { key: 'credit', label: 'Credit Out', value: `R ${creditOutstanding.toFixed(2)}`, icon: 'card', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  ];
  const lowStockItems = products
    .filter((product) => product.quantity <= product.reorder_level)
    .slice(0, 3)
    .map((product) => ({
      key: product.id,
      name: product.name,
      remaining: product.quantity,
      total: Math.max(product.quantity, product.reorder_level, 1),
      supplier: product.category,
    }));
  const maxHourlySale = Math.max(1, ...todayHourlySales.map((d) => d.value));
  const peakHour = todayHourlySales.reduce((prev, current) => (prev.value > current.value ? prev : current));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header with Greeting, Shop Name, Real-time Clock & Weather API Chip */}
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.greeting}>
              {getGreeting()}, {route?.params?.userName || 'Thabo'} 👋
            </Text>
            <View style={styles.shopBadge}>
              <Text style={styles.shopBadgeText}>
                {route?.params?.shopName || "Thabo's Mini Mart"}
              </Text>
            </View>
            <Text style={styles.clockText}>🕒 {formattedDateTime}</Text>
          </View>

          <View style={styles.headerRightCol}>
            <View style={styles.weatherChip}>
              <Text style={styles.weatherText}>{weather.condition} {weather.temp}</Text>
              <Text style={styles.locationText}>Joburg</Text>
            </View>
          </View>
        </View>

        {/* Hero Card: Dominant Sales Metric + Fast POS Trigger */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Today's sales</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.heroBadge}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.heroValue}>R {todayRevenue.toFixed(2)}</Text>

          <TouchableOpacity
            style={styles.quickSellBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Sell')}
          >
            <Ionicons name="flash" size={18} color="#004B49" style={{ marginRight: 6 }} />
            <Text style={styles.quickSellText}>Open POS / Start Sale</Text>
          </TouchableOpacity>
        </View>

        {/* Visual Stats Cards (Profit, Stock Value, Credit Out) */}
        <View style={styles.statsRow}>
          {secondaryStats.map((stat) => (
            <View key={stat.key} style={styles.statCard}>
              <View style={[styles.statIconBadge, { backgroundColor: stat.bg }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Today's Sales Performance Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Sales Trend</Text>
          <Text style={styles.subBadge}>Hourly</Text>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartSubtext}>Peak trade time: <Text style={styles.boldText}>{peakHour.time} (R {peakHour.value})</Text></Text>
          <View style={styles.chartRow}>
            {todayHourlySales.map((d) => {
              const isPeak = d.time === peakHour.time;
              return (
                <View key={d.time} style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: Math.max(16, (d.value / maxHourlySale) * 85) },
                      isPeak && styles.chartBarPeak,
                    ]}
                  />
                  <Text style={[styles.chartTimeLabel, isPeak && styles.chartTimePeak]}>{d.time}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Actionable Low Stock Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Stock')}>
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stockList}>
          {lowStockItems.map((item) => {
            const stockRatio = (item.remaining / item.total) * 100;
            return (
              <View key={item.key} style={styles.stockCard}>
                <View style={styles.stockInfo}>
                  <Text style={styles.stockName}>‼️ {item.name}</Text>
                  <Text style={styles.supplierText}>{item.supplier}</Text>

                  <View style={styles.progressTrack}>
                    <View style={[styles.fillBar, { width: `${stockRatio}%` }]} />
                  </View>
                </View>

                <View style={styles.stockActionCol}>
                  <View style={styles.badgeAmber}>
                    <Text style={styles.badgeAmberText}>{item.remaining} left</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reorderBtn}
                    onPress={() => navigation.navigate('Suppliers', { screen: 'Reorder', item: item.name })}
                  >
                    <Text style={styles.reorderText}>Reorder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing, radius) {
  const brandGreen = '#004B49'; // hero card stays brand green in both themes

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

    /* Header */
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
    headerMain: { flex: 1 },
    headerRightCol: { alignItems: 'flex-end', gap: 6 },
    greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
    shopBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginBottom: 4,
    },
    shopBadgeText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
    clockText: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
    weatherChip: {
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    weatherText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    locationText: { fontSize: 10, color: colors.textMuted },

    /* Hero Sales Card */
    heroCard: {
      backgroundColor: brandGreen,
      borderRadius: 18,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      elevation: 4,
    },
    heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroLabel: { fontSize: 14, color: '#A7F3D0', fontWeight: '600' },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 5 },
    heroBadge: { fontSize: 10, color: '#FFFFFF', fontWeight: '800' },
    heroValue: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', marginVertical: 6 },
    quickSellBtn: {
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    quickSellText: { color: brandGreen, fontWeight: '800', fontSize: 14 },

    /* Stat Cards */
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 1,
    },
    statIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
    statValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },

    /* Today's Hourly Chart Section */
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    subBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
    },
    linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    chartSubtext: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
    boldText: { color: colors.textPrimary, fontWeight: '700' },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 95 },
    chartBarWrap: { alignItems: 'center', flex: 1 },
    chartBar: { width: 24, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: colors.border },
    chartBarPeak: { backgroundColor: colors.primary },
    chartTimeLabel: { fontSize: 11, marginTop: 6, color: colors.textMuted, fontWeight: '600' },
    chartTimePeak: { color: colors.primary, fontWeight: '800' },

    /* Low Stock List */
    stockList: { gap: spacing.sm },
    stockCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stockInfo: { flex: 1, marginRight: spacing.md },
    stockName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    supplierText: { fontSize: 11, color: colors.textMuted, marginBottom: 6, marginTop: 2 },
    progressTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, width: '100%', overflow: 'hidden' },
    fillBar: { height: '100%', backgroundColor: colors.danger, borderRadius: 3 },
    stockActionCol: { alignItems: 'flex-end', gap: 6 },
    badgeAmber: { backgroundColor: 'rgba(220,38,38,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeAmberText: { fontSize: 12, color: colors.danger, fontWeight: '900' },
    reorderBtn: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
    },
    reorderText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
  });
}