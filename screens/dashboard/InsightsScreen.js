import {useEffect, useState} from "react";
import {Pressable, ScrollView, StyleSheet, Text, View,} from "react-native";
import { getAuthenticatedStoreId } from '../../services/firestore/paths';
import { subscribeSales } from '../../services/firestore/salesRepository';

function getPeriodData(sales, period) {
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

  const filteredSales = sales.filter(
    (sale) => {
      const createdAt = sale.createdAt ? new Date(sale.createdAt) : null;
      return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
    }
  );

  const productTotals = new Map();
  let itemsSold = 0;
  let profit = 0;

  filteredSales.forEach((sale) =>
    (sale.items || []).forEach((item) => {
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      const name = item.name || item.productName || "Product";
      const key = item.id || name;
      const total = productTotals.get(key) || {
        name,
        sold: 0,
      };

      total.sold += quantity;
      productTotals.set(key, total);
      itemsSold += quantity;

      const cost = Number(item.costPrice ?? item.cost_price);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      if (Number.isFinite(cost) && Number.isFinite(unitPrice)) {
        profit += (unitPrice - cost) * quantity;
      }
    })
  );

  const topProducts = [...productTotals.values()]
    .sort((left, right) => right.sold - left.sold)
    .slice(0, 3);

  if (topProducts.length) {
    const maxProductSales = Math.max(1, ...topProducts.map((item) => item.sold));
    topProducts.forEach((item) => {
      item.fill = item.sold / maxProductSales;
    });
  }

  const buckets = period === "Week"
    ? Array.from({ length: 7 }, (_, index) => ({
        day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
        value: 0,
      }))
    : period === "Month"
      ? Array.from({ length: Math.ceil(now.getDate() / 7) }, (_, index) => ({
          day: `Week ${index + 1}`,
          value: 0,
        }))
      : [{ day: "Today", value: 0 }];

  filteredSales.forEach((sale) => {
    const date = new Date(sale.createdAt);
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

export default function Insights({ route }) {
  const [period, setPeriod] = useState("Today");
  const [sales, setSales] = useState([]);
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

  const data = getPeriodData(sales, period);
  const recentlyPurchased = [...data.filteredSales]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .flatMap((sale) =>
      (sale.items || []).map((item) => ({
        name: item.name || item.productName || "Product",
        qty: item.qty ?? item.quantity ?? 0,
        time: new Date(sale.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }))
    )
    .slice(0, 4);

  // Scale chart bars so large rand values don't overflow the chart area
  const maxBarValue = Math.max(1, ...data.salesByDay.map((d) => d.value));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
          <Text style={styles.cardTitle}>
            {period === "Week" ? "Sales by Day" : "Sales by Week"}
          </Text>
          <View style={styles.chartRow}>
            {data.salesByDay.map((day) => (
              <View key={day.day} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: day.value ? Math.max(4, (day.value / maxBarValue) * 80) : 0 },
                  ]}
                />
                <Text style={styles.barLabel}>{day.day}</Text>
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


      <View style={styles.forecastCard}>
        <Text style={styles.forecastTitle}>Sales insight</Text>
        <Text style={styles.forecastText}>
          {data.topProducts.length ? (
            `Most sold in this period: ${data.topProducts.map((product) => product.name).join(", ")}.`
          ) : (
            loading ? "Loading sales data..." : "Record sales to see which products sell best in this period."
          )}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>TOP 3 BEST SELLING PRODUCTS</Text>
      {data.topProducts.length === 0 && !loading ? (
        <Text style={styles.recentTime}>No products sold in this period.</Text>
      ) : data.topProducts.map((p, i) => (
        <View key={`${p.name}-${i}`} style={styles.productCard}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
    color: "#111827",
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    color: "#6B7280",
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontWeight: "800",
    marginBottom: 16,
    color: "#111827",
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
    color: "#6B7280",
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
    color: "#111827",
  },
  recentTime: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 2,
  },
  errorText: {
    color: "#B91C1C",
    marginBottom: 12,
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productName: {
    fontWeight: "700",
    marginBottom: 2,
    color: "#111827",
  },
  productSold: {
    color: "#6B7280",
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
  recentRight: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
reverseBtn: {
  borderWidth: 1,
  borderColor: "#DC2626",
  borderRadius: 8,
  paddingVertical: 4,
  paddingHorizontal: 10,
},
reverseBtnText: {
  color: "#DC2626",
  fontSize: 11,
  fontWeight: "700",
},
});