import {useState} from "react";
import {Pressable, ScrollView, StyleSheet, Text, View,} from "react-native";

// Each period has its own dataset — swapped based on the toggle
const periodData = {
  Today: {
    stats: { revenue: "R1,850", profit: "R480", itemsSold: 24 },
    salesByDay: [{ day: "Today", value: 85 }],
    topProducts: [
      { name: "Coca-Cola 500ml", sold: 14, fill: 0.9 },
      { name: "Simba Chips 120g", sold: 10, fill: 0.65 },
      { name: "Albany White Bread", sold: 8, fill: 0.5 },
    ],
  },
  Week: {
    // last 7 days, excluding today
    stats: { revenue: "R12,400", profit: "R3,200", itemsSold: 186 },
    salesByDay: [
      { day: "Mon", value: 30 },
      { day: "Tue", value: 55 },
      { day: "Wed", value: 30 },
      { day: "Thu", value: 70 },
      { day: "Fri", value: 95 },
      { day: "Sat", value: 75 },
      { day: "Sun", value: 60 },
    ],
    topProducts: [
      { name: "Simba Chips 120g", sold: 84, fill: 0.9 },
      { name: "Coca-Cola 500ml", sold: 72, fill: 0.75 },
      { name: "Albany White Bread", sold: 55, fill: 0.55 },
    ],
  },
  Month: {
    // last 30 days, excluding today
    stats: { revenue: "R48,900", profit: "R12,100", itemsSold: 742 },
    salesByDay: [
      { day: "Week 1", value: 60 },
      { day: "Week 2", value: 80 },
      { day: "Week 3", value: 45 },
      { day: "Week 4", value: 95 },
    ],
    topProducts: [
      { name: "Coca-Cola 500ml", sold: 310, fill: 0.95 },
      { name: "Simba Chips 120g", sold: 268, fill: 0.8 },
      { name: "Albany White Bread", sold: 190, fill: 0.6 },
    ],
  },
};

const recentlyPurchased = [
  { name: "Coca-Cola 500ml", qty: 2, time: "10 min ago" },
  { name: "Simba Chips 120g", qty: 1, time: "32 min ago" },
  { name: "Albany White Bread", qty: 3, time: "1 hr ago" },
  { name: "Long Life Milk 1L", qty: 1, time: "2 hr ago" },
];

export default function Insights() {
  const [period, setPeriod] = useState("Today");
  const data = periodData[period];

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
    <Text style={styles.cardTitle}>Sales by Day of Week</Text>
    <View style={styles.chartRow}>
      {data.salesByDay.map((d, i) => (
        <View key={i} style={styles.barColumn}>
          <View style={[styles.bar, { height: d.value }]} />
          <Text style={styles.barLabel}>{d.day}</Text>
        </View>
      ))}
    </View>
  </View>
)}

      {period === "Today" && (
      <><Text style={styles.sectionLabel}>RECENTLY PURCHASED</Text><View style={styles.card}>
          {recentlyPurchased.map((item, i) => (
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
                <Pressable
                  style={styles.reverseBtn}
                  onPress={() => console.log("Reverse purchase:", item.name)}
                >
                  <Text style={styles.reverseBtnText}>Reverse Purchase</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View></>

        
  ) }


      <View style={styles.forecastCard}>
        <Text style={styles.forecastTitle}>✨ AI Demand Forecast</Text>
        <Text style={styles.forecastText}>
          &ldquo;Based on previous week trends, consider ordering more{" "}
          <Text style={styles.bold}>white bread</Text> and{" "}
          <Text style={styles.bold}>cold drinks</Text> ahead of this upcoming
          weekend.&rdquo;
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

const GREEN = "#06ad40";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F2F2",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
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
    color: "#888",
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
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 10,
    color: "#999",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: 16,
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
    color: "#888",
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
  },
  recentTime: {
    color: "#999",
    fontSize: 11,
    marginTop: 2,
  },
  recentQty: {
    fontWeight: "700",
    color: GREEN,
    fontSize: 14,
  },
  forecastCard: {
    backgroundColor: "#E6F6ED",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  forecastTitle: {
    color: GREEN,
    fontWeight: "700",
    marginBottom: 8,
  },
  forecastText: {
    color: "#333",
    lineHeight: 20,
  },
  bold: {
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 10,
    fontWeight: "600",
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  productName: {
    fontWeight: "700",
    marginBottom: 2,
  },
  productSold: {
    color: "#888",
    fontSize: 12,
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#E5F5EC",
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
  borderColor: "#E5533D",
  borderRadius: 8,
  paddingVertical: 4,
  paddingHorizontal: 10,
},
reverseBtnText: {
  color: "#E5533D",
  fontSize: 11,
  fontWeight: "700",
},
});