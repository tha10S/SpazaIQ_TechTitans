import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../config/ThemeContext";
import { getAuthenticatedStoreId } from '../../services/firestore/paths';
import { subscribeSales } from '../../services/firestore/salesRepository';
import { subscribeProducts } from '../../services/firestore/productsRepository';
import { subscribeCustomers } from '../../services/firestore/customersRepository';
import { getForecast } from '../../services/weather/weatherService';
import { buildShopAdvice, summariseWeather } from '../../services/advice/shopAdvice';

function getPeriodData(sales, period) {
  const allSales = Array.isArray(sales) ? sales : [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (period === "Week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "Month") {
    start.setDate(1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const filteredSales = allSales.filter((sale) => {
    if (!sale.createdAt) return false;
    const createdAt = toDate(sale.createdAt);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
  });
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

  const buckets = period === "Week"
    ? Array.from({ length: 7 }, (_, index) => ({ day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index], value: 0 }))
    : Array.from({ length: Math.ceil(now.getDate() / 7) }, (_, index) => ({ day: `Week ${index + 1}`, value: 0 }));
  filteredSales.forEach((sale) => {
    const date = toDate(sale.createdAt);
    const index =
      period === "Week"
        ? (date.getDay() + 6) % 7
        : Math.floor((date.getDate() - 1) / 7);

    if (buckets[index]) {
      buckets[index].value += Number(sale.total || 0);
    }
  });

  return {
    stats: {
      revenue: `R${filteredSales
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0)
        .toFixed(2)}`,
      profit: `R${profit.toFixed(2)}`,
      itemsSold,
    },
    salesByDay: buckets,
    topProducts,
    filteredSales,
  };
}

function toDate(value) {
  return value?.toDate ? value.toDate() : new Date(value);
}

export default function Insights({ route, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState("Today");
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salesError, setSalesError] = useState(null);
  const storeId = route?.params?.storeId || getAuthenticatedStoreId();

  useEffect(() => {
    setSales([]);
    setLoading(true);
    setSalesError(null);
    if (!storeId) {
      setLoading(false);
      return undefined;
    }

    return subscribeSales(
      storeId,
      (nextSales) => {
        setSales(nextSales);
        setLoading(false);
        setSalesError(null);
      },
      (error) => {
        console.warn("Insights sales subscription failed", error);
        setLoading(false);
        setSalesError(error?.message || "Sales data could not be loaded.");
      }
    );
  }, [storeId]);

  // Stock and credit feed the advice, so Insights reads them too
  useEffect(() => {
    if (!storeId) return undefined;
    const subscriptions = [
      subscribeProducts(storeId, '', setProducts, (error) => console.warn('Insights products subscription failed', error?.code)),
      subscribeCustomers(storeId, setCustomers, (error) => console.warn('Insights customers subscription failed', error?.code)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [storeId]);

  useEffect(() => {
    let active = true;
    getForecast()
      .then((forecast) => active && setWeather(forecast))
      .catch(() => active && setWeatherFailed(true));
    return () => {
      active = false;
    };
  }, []);

  // Advice is recalculated when the data changes or the day rolls over
  const dayKey = new Date().toDateString();
  const advice = useMemo(
    () => buildShopAdvice({ now: new Date(), weather, products, sales, customers }),
    [weather, products, sales, customers, dayKey]
  );
  const weatherSummary = useMemo(() => summariseWeather(weather, new Date()), [weather, dayKey]);

  const adviceTones = {
    danger: { color: colors.danger, bg: "rgba(220, 38, 38, 0.15)" },
    warning: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)" },
    info: { color: colors.primary, bg: colors.primaryLight },
  };

  const data = getPeriodData(sales, period);
  const recentlyPurchased = data.filteredSales
    .sort((left, right) => toDate(right.createdAt) - toDate(left.createdAt))
    .flatMap((sale) => (sale.items || []).map((item) => ({
      name: item.name || 'Product',
      qty: item.qty,
      time: toDate(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })))
    .slice(0, 4);

  // Scale chart bars so large rand values don't overflow the chart area
  const maxBarValue = Math.max(1, ...data.salesByDay.map((d) => d.value));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Text style={styles.header}>Analytics & Forecasts</Text>
      {salesError ? (
        <Text style={styles.errorText}>Could not load sales: {salesError}</Text>
      ) : null}

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
          <Text style={styles.cardTitle}>Sales by Day of Week</Text>
          <View style={styles.chartRow}>
            {data.salesByDay.map((d) => (
              <View key={d.day} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(4, (d.value / maxBarValue) * 76) },
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
          <Text style={styles.sectionLabel}>RECENTLY SOLD</Text>
          <View style={styles.card}>
            {loading ? (
              <Text style={styles.recentTime}>Loading sales...</Text>
            ) : recentlyPurchased.length === 0 ? (
              <Text style={styles.recentTime}>No sales recorded today.</Text>
            ) : (
              recentlyPurchased.map((item, index) => (
                <View
                  key={`${item.name}-${item.time}-${index}`}
                  style={[
                    styles.recentRow,
                    index === recentlyPurchased.length - 1 && {
                      marginBottom: 0,
                      paddingBottom: 0,
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View>
                    <Text style={styles.recentName}>{item.name}</Text>
                    <Text style={styles.recentTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.recentQty}>×{item.qty}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {/* Advice from the weather, the date, and the shop's own stock, sales and credit */}
      <Text style={styles.sectionLabel}>SHOP ADVICE</Text>

      {weatherSummary ? (
        <View style={styles.weatherStrip}>
          <Ionicons name="partly-sunny-outline" size={18} color={colors.primary} />
          <Text style={styles.weatherStripText}>
            Next {weatherSummary.days} days in Johannesburg: low {weatherSummary.min}°C, high {weatherSummary.max}°C, {weatherSummary.rain}% chance of rain
          </Text>
        </View>
      ) : weatherFailed ? (
        <Text style={[styles.recentTime, styles.weatherNote]}>
          Weather is unavailable, so this advice uses the date and your shop data only.
        </Text>
      ) : null}

      {advice.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.recentTime}>
            {loading
              ? "Loading your shop data..."
              : "No advice yet. Add products and record sales, and tips about what to restock will show up here."}
          </Text>
        </View>
      ) : (
        advice.map((item) => {
          const tone = adviceTones[item.severity] || adviceTones.info;
          return (
            <View key={item.id} style={styles.adviceCard}>
              <View style={[styles.adviceIcon, { backgroundColor: tone.bg }]}>
                <Ionicons name={item.icon} size={18} color={tone.color} />
              </View>
              <View style={styles.adviceBody}>
                <Text style={styles.adviceTitle}>{item.title}</Text>
                <Text style={styles.adviceDetail}>{item.detail}</Text>
                {item.target ? (
                  <Pressable
                    style={styles.adviceAction}
                    onPress={() => navigation?.navigate(item.target)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.adviceActionText}>{item.targetLabel || "Open"}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
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
            <View style={[styles.progressFill, { width: `${p.fill * 100}%` }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const GREEN = "#004B49";

function makeStyles(colors) {
  return StyleSheet.create({
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
    backgroundColor: GREEN,
  },
  segmentText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
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
    color: colors.textSecondary,
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
    height: 100,
  },
  barColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  bar: {
    width: 10,
    backgroundColor: GREEN,
    borderRadius: 4,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  recentName: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.textPrimary,
  },
  recentTime: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  recentQty: {
    fontWeight: "700",
    color: GREEN,
    fontSize: 14,
  },
  forecastCard: {
    backgroundColor: "#E6F4F1",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  forecastTitle: {
    color: GREEN,
    fontWeight: "800",
    marginBottom: 8,
  },
  forecastText: {
    color: "#374151",
    lineHeight: 20,
  },
  bold: {
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    color: "#6B7280",
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
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#E6F4F1",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: GREEN,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 12,
  },
  weatherStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  weatherStripText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  weatherNote: {
    marginBottom: 12,
  },
  adviceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  adviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  adviceBody: {
    flex: 1,
  },
  adviceTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  adviceDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  adviceAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  adviceActionText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  });
}