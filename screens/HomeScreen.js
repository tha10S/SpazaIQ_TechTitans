import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../config/ThemeContext';
import { subscribeCustomers } from '../services/firestore/customersRepository';
import { getAuthenticatedStoreId } from '../services/firestore/paths';
import { subscribeProducts } from '../services/firestore/productsRepository';
import { subscribeSales } from '../services/firestore/salesRepository';
import { buildHomeFeed, countNeedsAttention } from '../services/feed/homeFeed';
import { OfflineSyncNotice } from '../components/OfflineSyncNotice';
import SubscriptionBanner from '../components/SubscriptionBanner';

// Shop location isn't stored yet, so weather is for Johannesburg.
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-26.2041&longitude=28.0473&current=temperature_2m,weather_code&timezone=auto';

const MAX_NEWS_ITEMS = 5;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// WMO weather codes from Open-Meteo
function describeWeather(code) {
  if (code === 0) return { icon: 'sunny-outline', label: 'Clear' };
  if (code <= 3) return { icon: 'partly-sunny-outline', label: 'Partly cloudy' };
  if (code <= 48) return { icon: 'cloud-outline', label: 'Fog' };
  if (code <= 67) return { icon: 'rainy-outline', label: 'Rain' };
  if (code <= 77) return { icon: 'snow-outline', label: 'Snow' };
  if (code <= 82) return { icon: 'rainy-outline', label: 'Showers' };
  if (code <= 86) return { icon: 'snow-outline', label: 'Snow showers' };
  return { icon: 'thunderstorm-outline', label: 'Storm' };
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
  const [weather, setWeather] = useState(null);
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();

  // Real-time clock trigger
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live weather. If it fails (offline), the chip just shows "--".
  useEffect(() => {
    let active = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    fetch(WEATHER_URL, { signal: controller?.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Weather unavailable'))))
      .then((data) => {
        if (!active || !data?.current) return;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          ...describeWeather(data.current.weather_code),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
      controller?.abort();
    };
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

  // Shop news. Recomputed when data changes or the day rolls over, not every clock tick.
  const dayKey = now.toDateString();
  const feed = useMemo(
    () => buildHomeFeed({ products, customers, sales, now: new Date() }),
    [products, customers, sales, dayKey]
  );
  const attentionCount = countNeedsAttention(feed);

  const feedTones = {
    danger: { color: colors.danger, bg: 'rgba(220,38,38,0.15)' },
    warning: { color: colors.warning, bg: 'rgba(245,158,11,0.15)' },
    info: { color: colors.primary, bg: colors.primaryLight },
  };

  const openFeedItem = (item) => {
    if (item.target) navigation.navigate(item.target);
  };

  // Opens the scanner; the scanned code is handed to Sell, which adds the product to the cart.
  const openScanner = () => navigation.navigate('Scanner', { returnTo: 'Sell' });

  const userName = route?.params?.userName;
  const shopName = route?.params?.shopName;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <OfflineSyncNotice storeId={storeId} />

        {/* Subscription status: only shows when a payment is due soon, overdue, or the shop is deactivated */}
        <SubscriptionBanner storeId={storeId} />

        {/* Header with Greeting, Shop Name, Real-time Clock, Weather and Profile */}
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.greeting}>
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </Text>
            {shopName ? (
              <View style={styles.shopBadge}>
                <Text style={styles.shopBadgeText}>{shopName}</Text>
              </View>
            ) : null}
            <View style={styles.clockRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.clockText}>{formattedDateTime}</Text>
            </View>
          </View>

          <View style={styles.headerRightCol}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open profile and settings"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="person-circle" size={36} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.weatherChip}>
              <View style={styles.weatherRow}>
                <Ionicons name={weather?.icon || 'cloud-outline'} size={15} color={colors.warning} />
                <Text style={styles.weatherText}>{weather ? `${weather.temp}°C` : '--'}</Text>
              </View>
              <Text style={styles.locationText}>{weather ? `${weather.label} • Joburg` : 'Joburg'}</Text>
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

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.quickSellBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Sell')}
            >
              <Ionicons name="flash" size={18} color="#004B49" style={{ marginRight: 6 }} />
              <Text style={styles.quickSellText}>Open POS / Start Sale</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanBtn}
              activeOpacity={0.85}
              onPress={openScanner}
              accessibilityRole="button"
              accessibilityLabel="Scan a product barcode"
            >
              <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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

        {/* Shop news: important info pulled from Stock, Credit and Insights */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shop News</Text>
          {attentionCount > 0 ? (
            <View style={styles.newsBadge}>
              <Text style={styles.newsBadgeText}>{attentionCount} need attention</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.feedList}>
          {feed.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Ionicons name="newspaper-outline" size={30} color={colors.textMuted} />
              <Text style={styles.feedEmptyTitle}>Nothing to report yet</Text>
              <Text style={styles.feedEmptyText}>
                Record a sale or add stock, and updates about your shop will show up here.
              </Text>
            </View>
          ) : (
            feed.slice(0, MAX_NEWS_ITEMS).map((item) => {
              const tone = feedTones[item.severity] || feedTones.info;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.feedRow}
                  activeOpacity={0.75}
                  onPress={() => openFeedItem(item)}
                >
                  <View style={[styles.feedIcon, { backgroundColor: tone.bg }]}>
                    <Ionicons name={item.icon} size={18} color={tone.color} />
                  </View>
                  <View style={styles.feedTextWrap}>
                    <Text style={styles.feedTitle}>{item.title}</Text>
                    <Text style={styles.feedDetail}>{item.detail}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Today's Sales Performance Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Sales Trend</Text>
          <Text style={styles.subBadge}>Hourly</Text>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartSubtext}>
            {peakHour.value > 0 ? (
              <>Peak trade time: <Text style={styles.boldText}>{peakHour.time} (R {peakHour.value})</Text></>
            ) : (
              'No sales yet today. Your busiest hour will show here.'
            )}
          </Text>
          <View style={styles.chartRow}>
            {todayHourlySales.map((d) => {
              const isPeak = peakHour.value > 0 && d.time === peakHour.time;
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
          {lowStockItems.length === 0 && (
            <Text style={styles.emptyNote}>
              {products.length === 0
                ? 'Add products in Stock and low stock alerts will show here.'
                : 'Nothing is running low.'}
            </Text>
          )}
          {lowStockItems.map((item) => {
            const stockRatio = (item.remaining / item.total) * 100;
            return (
              <View key={item.key} style={styles.stockCard}>
                <View style={styles.stockInfo}>
                  <View style={styles.stockNameRow}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                    <Text style={styles.stockName} numberOfLines={1}>{item.name}</Text>
                  </View>
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
    clockRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    clockText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
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
    weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
    heroActions: { flexDirection: 'row', gap: 10, marginTop: spacing.xs },
    quickSellBtn: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      paddingVertical: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickSellText: { color: brandGreen, fontWeight: '800', fontSize: 14 },
    scanBtn: {
      width: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      backgroundColor: 'rgba(255,255,255,0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },

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

    /* Section headers */
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

    /* Shop news */
    newsBadge: {
      backgroundColor: 'rgba(220,38,38,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    newsBadgeText: { fontSize: 11, fontWeight: '800', color: colors.danger },
    feedList: { gap: spacing.sm, marginBottom: spacing.lg },
    feedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    feedIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    feedTextWrap: { flex: 1 },
    feedTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    feedDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
    feedEmpty: {
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    feedEmptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
    feedEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

    /* Today's Hourly Chart Section */
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
    emptyNote: { fontSize: 13, color: colors.textMuted, paddingVertical: spacing.sm },
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
    stockNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    stockName: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
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