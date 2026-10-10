/**
 * scripts/parseCsvToInsights.js
 *
 * Reads data/sales_history.csv and produces data/insightsData.json,
 * shaped exactly the way insights.js expects (Today / Week / Month).
 *
 * Run it from the project root with:
 *   node scripts/parseCsvToInsights.js
 *
 * Re-run any time you replace/append to data/sales_history.csv.
 *
 * Expected CSV columns (rename the CONFIG.fields map below if yours differ):
 *   Date, Product line, Quantity, Sales, gross income
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  csvPath: path.join(__dirname, "..", "data", "sales_history.csv"),
  outPath: path.join(__dirname, "..", "data", "insightsData.json"),
  currencyPrefix: "R",
  fields: {
    date: "Date",
    product: "Product line",
    qty: "Quantity",
    sales: "Sales",
    profit: "gross income",
    time: "Time",
  },
};

// ---------- CSV parsing (no external deps; handles simple, unquoted CSVs) ----------
function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, ""); // strip BOM
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function parseUsDate(str) {
  // "1/5/2019" -> Date
  const [m, d, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCurrency(n) {
  return CONFIG.currencyPrefix + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function daysBetween(a, b) {
  return Math.round((a - b) / 86400000);
}

// ---------- Load + normalize records ----------
const raw = fs.readFileSync(CONFIG.csvPath, "utf8");
const rows = parseCsv(raw);
const f = CONFIG.fields;

const records = rows.map((r) => ({
  date: parseUsDate(r[f.date]),
  product: r[f.product],
  qty: Number(r[f.qty]) || 0,
  sales: Number(r[f.sales]) || 0,
  profit: Number(r[f.profit]) || 0,
  time: r[f.time] || "",
}));

const maxDate = records.reduce((max, rec) => (rec.date > max ? rec.date : max), records[0].date);

// ---------- Aggregation helpers ----------
function aggregate(recs) {
  const revenue = recs.reduce((s, r) => s + r.sales, 0);
  const profit = recs.reduce((s, r) => s + r.profit, 0);
  const itemsSold = recs.reduce((s, r) => s + r.qty, 0);
  return {
    stats: {
      revenue: formatCurrency(revenue),
      profit: formatCurrency(profit),
      itemsSold: Math.round(itemsSold),
    },
    revenueRaw: revenue,
  };
}

function topProducts(recs, count = 3) {
  const byProduct = {};
  recs.forEach((r) => {
    byProduct[r.product] = (byProduct[r.product] || 0) + r.qty;
  });
  const sorted = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, count);
  const max = sorted.length ? sorted[0][1] : 1;
  return sorted.map(([name, sold]) => ({
    name,
    sold: Math.round(sold),
    fill: Math.max(0.15, Math.round((sold / max) * 100) / 100),
  }));
}

// ---------- Today ----------
const todayRecs = records.filter((r) => isoDay(r.date) === isoDay(maxDate));
const todayAgg = aggregate(todayRecs);

// ---------- Week (last 7 calendar days ending at maxDate) ----------
const weekRecs = records.filter((r) => {
  const diff = daysBetween(maxDate, r.date);
  return diff >= 0 && diff < 7;
});
const weekAgg = aggregate(weekRecs);
const weekByDay = {};
for (let i = 6; i >= 0; i--) {
  const d = new Date(maxDate);
  d.setDate(d.getDate() - i);
  weekByDay[isoDay(d)] = { label: WEEKDAY[d.getDay()], total: 0 };
}
weekRecs.forEach((r) => {
  const key = isoDay(r.date);
  if (weekByDay[key]) weekByDay[key].total += r.sales;
});
const weekValues = Object.values(weekByDay);
const weekMax = Math.max(1, ...weekValues.map((d) => d.total));
const weekSalesByDay = weekValues.map((d) => ({
  day: d.label,
  value: Math.round((d.total / weekMax) * 100),
}));

// ---------- Month (last 4 weeks ending at maxDate, bucketed) ----------
const monthRecs = records.filter((r) => {
  const diff = daysBetween(maxDate, r.date);
  return diff >= 0 && diff < 28;
});
const monthAgg = aggregate(monthRecs);
const weekBuckets = [0, 0, 0, 0]; // Week 4 = most recent
monthRecs.forEach((r) => {
  const diff = daysBetween(maxDate, r.date);
  const bucket = 3 - Math.floor(diff / 7); // 0..3
  if (bucket >= 0 && bucket <= 3) weekBuckets[bucket] += r.sales;
});
const monthMax = Math.max(1, ...weekBuckets);
const monthSalesByDay = weekBuckets.map((total, i) => ({
  day: `Week ${i + 1}`,
  value: Math.round((total / monthMax) * 100),
}));

// ---------- Recently purchased (most recent transactions on file) ----------
const recentlyPurchased = [...records]
  .sort((a, b) => b.date - a.date || b.time.localeCompare(a.time))
  .slice(0, 4)
  .map((r) => ({
    name: r.product,
    qty: r.qty,
    time: `${r.time || ""} · ${r.date.toLocaleDateString("en-ZA")}`.trim(),
  }));

// ---------- Demand forecast: top 2 products by sales in the most recent week ----------
const forecastProducts = topProducts(weekRecs, 2).map((p) => p.name);

// ---------- Assemble output ----------
const output = {
  generatedAt: new Date().toISOString(),
  anchorDate: isoDay(maxDate),
  periodData: {
    Today: {
      stats: todayAgg.stats,
      salesByDay: [{ day: "Today", value: 100 }],
      topProducts: topProducts(todayRecs),
    },
    Week: {
      stats: weekAgg.stats,
      salesByDay: weekSalesByDay,
      topProducts: topProducts(weekRecs),
    },
    Month: {
      stats: monthAgg.stats,
      salesByDay: monthSalesByDay,
      topProducts: topProducts(monthRecs),
    },
  },
  recentlyPurchased,
  forecastProducts,
};

fs.writeFileSync(CONFIG.outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${CONFIG.outPath}`);
console.log(`Anchor date (treated as "Today"): ${output.anchorDate}`);
