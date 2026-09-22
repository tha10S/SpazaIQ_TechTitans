import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const SECONDARY_STATS = [
  { key: 'profit', label: 'Profit', value: 'R 680', icon: 'trending-up', color: '#059669', bg: '#ECFDF5' },
  { key: 'stock', label: 'Stock Value', value: 'R 18,300', icon: 'cube', color: '#2563EB', bg: '#EFF6FF' },
  { key: 'credit', label: 'Credit Out', value: 'R 1,120', icon: 'card', color: '#D97706', bg: '#FFFBEB' },
];

// Today's intraday hourly sales data
const todayHourlySales = [
  { time: '08:00', value: 280 },
  { time: '10:00', value: 450 },
  { time: '12:00', value: 620 }, // Lunch rush
  { time: '14:00', value: 310 },
  { time: '16:00', value: 580 },
  { time: '18:00', value: 720 }, // Peak evening rush
];

const lowStockItems = [
  { key: '1', name: 'Cooking Oil 2L', emoji: '🛢️', remaining: 3, total: 20, supplier: 'Metro Cash & Carry' },
  { key: '2', name: 'Maize Meal 5kg', emoji: '🌽', remaining: 5, total: 25, supplier: 'Tiger Brands Direct' },
  { key: '3', name: 'White Bread', emoji: '🍞', remaining: 4, total: 30, supplier: 'Sasko Logistics' },
];

export default function HomeScreen({ navigation, route }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, typography, spacing, radius);
  const [now, setNow] = useState(new Date());

  // Weather state placeholder (ready for your weather API fetch)
  const [weather, setWeather] = useState({ temp: '18°C', condition: '☀️' });

  // Real-time clock trigger
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDateTime = now.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' • ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const maxHourlySale = Math.max(...todayHourlySales.map((d) => d.value));
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
          <Text style={styles.heroValue}>R 2,450</Text>
          
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
          {SECONDARY_STATS.map((stat) => (
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
                  <Text style={styles.stockName}>
                    ‼️ {item.emoji} {item.name}
                  </Text>
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
  const emeraldPrimary = '#004B49';
  
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

    /* Header */
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
    headerMain: { flex: 1 },
    headerRightCol: { alignItems: 'flex-end', gap: 6 },
    greeting: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 2 },
    shopBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#E5E7EB',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginBottom: 4,
    },
    shopBadgeText: { fontSize: 12, color: '#374151', fontWeight: '700' },
    clockText: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 2 },
    weatherChip: { alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    weatherText: { fontSize: 12, fontWeight: '700', color: '#111827' },
    locationText: { fontSize: 10, color: '#6B7280' },

    /* Hero Sales Card */
    heroCard: {
      backgroundColor: emeraldPrimary,
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
    quickSellText: { color: emeraldPrimary, fontWeight: '800', fontSize: 14 },

    /* Stat Cards */
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
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
    statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
    statValue: { fontSize: 15, fontWeight: '800', color: '#111827' },

    /* Today's Hourly Chart Section */
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
    subBadge: { fontSize: 11, fontWeight: '700', color: emeraldPrimary, backgroundColor: '#E6F4F1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    linkText: { color: emeraldPrimary, fontWeight: '700', fontSize: 13 },
    chartCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: spacing.lg },
    chartSubtext: { fontSize: 12, color: '#6B7280', marginBottom: spacing.sm },
    boldText: { color: '#111827', fontWeight: '700' },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 95 },
    chartBarWrap: { alignItems: 'center', flex: 1 },
    chartBar: { width: 24, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#E5E7EB' },
    chartBarPeak: { backgroundColor: emeraldPrimary },
    chartTimeLabel: { fontSize: 11, marginTop: 6, color: '#6B7280', fontWeight: '600' },
    chartTimePeak: { color: emeraldPrimary, fontWeight: '800' },

    /* Low Stock List */
    stockList: { gap: spacing.sm },
    stockCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    stockInfo: { flex: 1, marginRight: spacing.md },
    stockName: { fontSize: 14, fontWeight: '700', color: '#111827' },
    supplierText: { fontSize: 11, color: '#6B7280', marginBottom: 6, marginTop: 2 },
    progressTrack: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, width: '100%', overflow: 'hidden' },
    fillBar: { height: '100%', backgroundColor: '#DC2626', borderRadius: 3 },
    stockActionCol: { alignItems: 'flex-end', gap: 6 },
    badgeAmber: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeAmberText: { fontSize: 12, color: '#DC2626', fontWeight: '900' },
    reorderBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
    reorderText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  });
}