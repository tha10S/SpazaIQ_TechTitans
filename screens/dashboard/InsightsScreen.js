import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from '../../config/ThemeContext';
import { getAuthenticatedStoreId } from '../../services/firestore/paths';
import { subscribeSales } from '../../services/firestore/salesRepository';

const BRAND_GREEN = "#004B49"; // active segment keeps brand green in both themes

function getPeriodData(sales, period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'Week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'Month') {
    start.setDate(1);
  }
  const filteredSales = sales.filter((sale) => sale.createdAt && new Date(sale.createdAt) >= start);
  const productTotals = new Map();
  let itemsSold = 0;
  let profit = 0;
  filteredSales.forEach((sale) => (sale.items || []).forEach((item) => {
    const quantity = Number(item.qty || 0);
    const key = item.id || item.name;
    const total = productTotals.get(key) || { name: item.name || 'Product', sold: 0 };
    total.sold += quantity;
    productTotals.set(key, total);
    itemsSold += quantity;
    const cost = Number(item.costPrice);
    if (Number.isFinite(cost)) profit += (Number(item.unitPrice || 0) - cost) * quantity;
  }));
  const topProducts = [...productTotals.values()].sort((left, right) => right.sold - left.sold).slice(0, 3);
  const maxProductSales = Math.max(1, ...topProducts.map((item) => item.sold));
  topProducts.forEach((item) => { item.fill = item.sold / maxProductSales; });

  const buckets = period === 'Week'
    ? Array.from({ length: 7 }, (_, index) => ({ day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], value: 0 }))
    : Array.from({ length: Math.ceil(now.getDate() / 7) }, (_, index) => ({ day: `Week ${index + 1}`, value: 0 }));
  filteredSales.forEach((sale) => {
    const date = new Date(sale.createdAt);
    const index = period === 'Week' ? (date.getDay() + 6) % 7 : Math.floor((date.getDate() - 1) / 7);
    if (buckets[index]) buckets[index].value += Number(sale.total || 0);
  });

  return {
    stats: {
      revenue: `R${filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0).toFixed(2)}`,
      profit: `R${profit.toFixed(2)}`,
      itemsSold,
    },
    salesByDay: buckets,
    topProducts,
    filteredSales,
  };
}

export default function Insights({ route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState("Today");
  const [sales, setSales] = useState([]);
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();

  useEffect(() => subscribeSales(
    storeId,
    setSales,
    (error) => console.warn('Insights sales subscription failed', error?.code)
  ), [storeId]);

  const data = getPeriodData(sales, period);
  const recentlyPurchased = data.filteredSales
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .flatMap((sale) => (sale.items || []).map((item) => ({
      name: item.name || 'Product',
      qty: item.qty,
      time: new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })))
    .slice(0, 4);

  // Scale chart bars so large rand values don't overflow the chart area
  const maxBarValue = Math.max(1, ...data.salesByDay.map((d) => d.value));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Analytics & Forecasts</Text>

      <View style={styles.segmentWrap}>
        {["Today", "Week", "Month"].map((label) => (
          <Pressable
            key={label}
            onPress={() => setPeriod(label)}
            style={[styles.segment, period === label && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                period === label && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL REVENUE</Text>
          <Text style={styles.statValue}>{data.stats.revenue}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>NET PROFIT</Text>
          <Text style={styles.statValue}>{data.stats.profit}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>ITEMS SOLD</Text>
          <Text style={styles.statValue}>{data.stats.itemsSold}</Text>
        </View>
      </View>

      {period !== "Today" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {period === "Week" ? "Sales by Day of Week" : "Sales by Week"}
          </Text>
          <View style={styles.chartRow}>
            {data.salesByDay.map((d, i) => (
              <View key={i} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(4, (d.value / maxBarValue) * 80) },
                  ]}
                />
                <Text style={styles.barLabel}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {period === "Today" && (
        <>
          <Text style={styles.sectionLabel}>RECENTLY PURCHASED</Text>
          <View style={styles.card}>
            {recentlyPurchased.length === 0 ? (
              <Text style={styles.recentTime}>No sales recorded today.</Text>
            ) : (
              recentlyPurchased.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.recentRow,
                    i === recentlyPurchased.length - 1 && { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 },
                  ]}
                >
                  <View>
                    <Text style={styles.recentName}>{item.name}</Text>
                    <Text style={styles.recentTime}>{item.time}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={styles.recentQty}>×{item.qty}</Text>
                    <Text style={styles.recentTime}>{item.time}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <View style={styles.forecastCard}>
        <Text style={styles.forecastTitle}>Demand forecast</Text>
        <Text style={styles.forecastText}>
          {data.topProducts.length
            ? `Most sold in this period: ${data.topProducts.map((product) => product.name).join(', ')}.`
            : 'Record sales to see your best-selling products for this period.'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>TOP 3 BEST SELLING PRODUCTS</Text>
      {data.topProducts.map((p, i) => (
        <View key={i} style={styles.productCard}>
          <View>
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.productSold}>{p.sold} sold</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${p.fill * 100}%` }]}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 16,
      color: colors.textPrimary,
    },
    segmentWrap: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 20,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: BRAND_GREEN,
    },
    segmentText: {
      color: colors.textMuted,
      fontWeight: "600",
    },
    segmentTextActive: {
      color: "#FFFFFF",
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 4,
      fontWeight: "600",
    },
    statValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontWeight: "800",
      marginBottom: 16,
      color: colors.textPrimary,
    },
    chartRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      height: 110,
    },
    barColumn: {
      alignItems: "center",
      justifyContent: "flex-end",
      flex: 1,
    },
    bar: {
      width: 10,
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    barLabel: {
      marginTop: 6,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    recentRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 10,
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    recentName: {
      fontWeight: "700",
      fontSize: 13,
      color: colors.textPrimary,
    },
    recentTime: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    recentQty: {
      fontWeight: "700",
      color: colors.primary,
      fontSize: 14,
    },
    recentRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    forecastCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    forecastTitle: {
      color: colors.primary,
      fontWeight: "800",
      marginBottom: 8,
    },
    forecastText: {
      color: colors.textSecondary,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
      fontWeight: "700",
    },
    productCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    productName: {
      fontWeight: "700",
      marginBottom: 2,
      color: colors.textPrimary,
    },
    productSold: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 10,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.primary,
    },
  });