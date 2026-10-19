// Shop performance scoring and root-cause analysis. Pure functions with no Firebase imports.
// It only ever sees shop-level totals (the shopStats document), never sales or customer records.
//
// A shop's "stats" object comes from buildShopStats() in shopStats.js.
// Score = 0-100, made of six parts (see WEIGHTS). Tiers: high >= 70, mid >= 40, low below that.
import { toDate } from './billing';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Things you may want to tune ----
export const TIER_LIMITS = { high: 70, mid: 40 };
export const WEIGHTS = { activity: 0.3, revenue: 0.25, growth: 0.15, stock: 0.15, credit: 0.1, margin: 0.05 };
export const PART_LABELS = {
  activity: 'Days trading',
  revenue: 'Revenue vs other shops',
  growth: 'Growth',
  stock: 'Stock health',
  credit: 'Credit health',
  margin: 'Profit margin',
};
const FULL_TRADING_DAYS = 22; // selling on 22 of the last 30 days counts as fully active
const SMALL_RANGE = 15; // fewer products than this looks like an unfinished catalogue

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatRand = (value) => `R${Math.round(num(value)).toLocaleString('en-ZA')}`;
const pct = (value) => `${Math.round(num(value) * 100)}%`;

export function formatValue(kind, value) {
  if (value === null || value === undefined) return '-';
  if (kind === 'pct') return pct(value);
  if (kind === 'rand') return formatRand(value);
  if (kind === 'days') return `${Math.round(value)}`;
  return `${Math.round(value)}`;
}

// Turns raw totals into the ratios the scoring and advice use.
export function derive(stats = {}, now = new Date()) {
  const revenue = num(stats.revenue30d);
  const previous = num(stats.revenuePrev30d);
  const sales = num(stats.salesCount30d);
  const products = num(stats.productCount);
  const outstanding = num(stats.creditOutstanding);
  const lastSale = toDate(stats.lastSaleAt);
  const seen = toDate(stats.updatedAt);
  return {
    revenue,
    previous,
    sales,
    products,
    activeDays: num(stats.activeDays30d),
    out: num(stats.outOfStockCount),
    low: num(stats.lowStockCount),
    basket: sales > 0 ? revenue / sales : 0,
    margin: revenue > 0 ? num(stats.profit30d) / revenue : 0,
    growth: previous > 0 ? (revenue - previous) / previous : null,
    creditShare: revenue > 0 ? num(stats.creditSales30d) / revenue : 0,
    overdueShare: outstanding > 0 ? num(stats.creditOverdue) / outstanding : 0,
    outstanding,
    overdue: num(stats.creditOverdue),
    stockGap: products > 0 ? (num(stats.outOfStockCount) + num(stats.lowStockCount)) / products : 0,
    daysSinceLastSale: lastSale ? Math.max(0, Math.floor((now - lastSale) / DAY_MS)) : null,
    daysSinceSeen: seen ? Math.max(0, Math.floor((now - seen) / DAY_MS)) : null,
  };
}

// Where each shop's 30-day revenue sits among all shops: 0 (lowest) to 1 (highest).
export function revenueRanks(shops) {
  const sorted = [...shops].sort((a, b) => num(a.revenue30d) - num(b.revenue30d));
  const ranks = new Map();
  sorted.forEach((shop, index) => ranks.set(shop.storeId, sorted.length > 1 ? index / (sorted.length - 1) : 0.5));
  return ranks;
}

export function scoreShop(stats, { revenueRank = 0.5, now = new Date() } = {}) {
  const d = derive(stats, now);
  const parts = {
    activity: clamp(d.activeDays / FULL_TRADING_DAYS),
    revenue: d.revenue > 0 ? clamp(revenueRank) : 0,
    growth: d.growth === null ? (d.revenue > 0 ? 0.6 : 0) : clamp(0.5 + d.growth),
    stock: d.products > 0 ? 1 - clamp((d.out + 0.5 * d.low) / d.products) : 0,
    credit: (1 - clamp(d.overdueShare)) * (1 - 0.5 * clamp(d.creditShare / 0.7)),
    margin: clamp(d.margin / 0.25),
  };
  const score = Math.round(100 * Object.keys(WEIGHTS).reduce((sum, key) => sum + WEIGHTS[key] * parts[key], 0));
  const tier = d.sales === 0 ? 'low' : score >= TIER_LIMITS.high ? 'high' : score >= TIER_LIMITS.mid ? 'mid' : 'low';
  return { score, parts, tier, d };
}

export function scoreAll(shops, now = new Date()) {
  const ranks = revenueRanks(shops);
  return shops.map((shop) => ({ ...shop, ...scoreShop(shop, { revenueRank: ranks.get(shop.storeId), now }) }));
}

export function medianOf(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2 };

// Why a shop is doing badly (causes) and why it is doing well (strengths).
// Each item: { id, severity, title, detail, tip, adminAction }
//   tip         = advice written to the shop owner
//   adminAction = what the platform team could do about it
export function diagnose(shop, { medianBasket = 0 } = {}) {
  const d = shop.d || derive(shop);
  const causes = [];
  const strengths = [];

  if (d.products === 0) {
    causes.push({
      id: 'no-products', severity: 'danger', title: 'No products added',
      detail: 'The shop has no products, so nothing can be scanned or sold.',
      tip: 'Add your products with their barcodes on the Stock screen.',
      adminAction: 'Walk the owner through adding the first products. Likely stuck at onboarding.',
    });
  }
  if (d.sales === 0 && d.products > 0) {
    causes.push({
      id: 'no-sales', severity: 'danger', title: 'No sales recorded in 30 days',
      detail: d.daysSinceLastSale === null ? 'No sale has ever been recorded.' : `The last sale was ${d.daysSinceLastSale} days ago.`,
      tip: 'Record every sale in the app, even small ones. The advice only works when the app knows what you sell.',
      adminAction: 'Call the owner. Probably not using the app, which is a churn risk.',
    });
  }
  if (d.sales > 0 && d.activeDays < 10) {
    causes.push({
      id: 'low-activity', severity: 'warning', title: 'Records sales on few days',
      detail: `Only ${d.activeDays} of the last 30 days had a recorded sale.`,
      tip: 'Record sales every trading day so your numbers and advice stay accurate.',
      adminAction: 'The owner may only record sales some days. Offer a short refresher on the Sell screen.',
    });
  }
  if (d.sales > 0 && d.daysSinceLastSale !== null && d.daysSinceLastSale >= 7) {
    causes.push({
      id: 'gone-quiet', severity: 'warning', title: `No sales for ${d.daysSinceLastSale} days`,
      detail: 'Sales have stopped recently, although there were sales earlier this month.',
      tip: 'If the shop is still trading, record sales again. If it is closed, let us know.',
      adminAction: 'Check in with the owner. Recent silence usually comes before cancelling.',
    });
  }
  if (d.daysSinceSeen !== null && d.daysSinceSeen >= 7) {
    causes.push({
      id: 'not-seen', severity: 'warning', title: `App not opened for ${d.daysSinceSeen} days`,
      detail: 'These totals were last updated when the owner last opened the app.',
      tip: 'Open the app regularly so your insights stay current.',
      adminAction: 'Low engagement. Send a WhatsApp check-in.',
    });
  }
  if (d.products > 0 && (d.stockGap >= 0.25 || d.out >= 3)) {
    causes.push({
      id: 'stock-gaps', severity: d.out >= 3 ? 'danger' : 'warning', title: 'Stock gaps are costing sales',
      detail: `${d.out} out of stock and ${d.low} running low, which is ${pct(d.stockGap)} of ${d.products} products.`,
      tip: 'Reorder from the Suppliers tab before items run out. An empty shelf is a lost sale.',
      adminAction: 'Check reorder levels are realistic and that the owner uses Suppliers > Reorder.',
    });
  }
  if (d.products > 0 && d.products < SMALL_RANGE) {
    causes.push({
      id: 'small-range', severity: 'info', title: 'Small product range',
      detail: `Only ${d.products} products are loaded.`,
      tip: 'Add the rest of your range so every item can be scanned at the till.',
      adminAction: 'The catalogue is probably unfinished. Help the owner add products with barcodes.',
    });
  }
  if (d.overdue > 0 && d.overdueShare >= 0.4) {
    causes.push({
      id: 'credit-overdue', severity: 'warning', title: 'A lot of credit is overdue',
      detail: `${formatRand(d.overdue)} of ${formatRand(d.outstanding)} owed to the shop is overdue (${pct(d.overdueShare)}).`,
      tip: 'Send WhatsApp reminders from the Credit tab, especially just after payday.',
      adminAction: 'Cash-flow risk. Point the owner to the WhatsApp reminder feature.',
    });
  }
  if (d.creditShare >= 0.4) {
    causes.push({
      id: 'credit-heavy', severity: 'warning', title: 'Many sales are on credit',
      detail: `${pct(d.creditShare)} of sales in the last 30 days were on credit.`,
      tip: 'Set credit limits and ask for part-payment up front.',
      adminAction: 'High credit exposure ties up cash. Suggest limits and repayment schedules.',
    });
  }
  if (d.revenue > 0 && d.margin < 0.1) {
    causes.push({
      id: 'thin-margin', severity: d.margin < 0 ? 'danger' : 'warning', title: d.margin < 0 ? 'Selling below cost' : 'Thin profit margin',
      detail: `Profit is ${pct(d.margin)} of revenue.`,
      tip: 'Compare selling prices with cost prices, starting with your best sellers.',
      adminAction: 'Pricing problem. Suggest reviewing prices or asking suppliers for better ones.',
    });
  }
  if (d.growth !== null && d.growth <= -0.2) {
    causes.push({
      id: 'declining', severity: 'warning', title: 'Revenue is falling',
      detail: `Revenue is down ${pct(Math.abs(d.growth))} compared with the previous 30 days.`,
      tip: 'Check for empty shelves or price changes, and keep popular items in stock.',
      adminAction: 'Look for stock-outs, seasonality or a new competitor nearby.',
    });
  }
  if (medianBasket > 0 && d.basket > 0 && d.basket < 0.6 * medianBasket) {
    causes.push({
      id: 'small-basket', severity: 'info', title: 'Small average sale',
      detail: `The average sale is ${formatRand(d.basket)} against ${formatRand(medianBasket)} across shops.`,
      tip: 'Put add-ons near the till, such as airtime, bread and cold drinks, to raise the average sale.',
      adminAction: 'Basket-size coaching: bundles and add-ons.',
    });
  }

  if (d.activeDays >= FULL_TRADING_DAYS) {
    strengths.push({ id: 'consistent', title: 'Trades almost every day', detail: `A sale was recorded on ${d.activeDays} of the last 30 days.` });
  }
  if (d.growth !== null && d.growth >= 0.2) {
    strengths.push({ id: 'growing', title: 'Revenue is growing', detail: `Up ${pct(d.growth)} on the previous 30 days.` });
  }
  if (d.products >= SMALL_RANGE && d.stockGap < 0.1) {
    strengths.push({ id: 'stocked', title: 'Shelves are well stocked', detail: `Only ${d.out + d.low} of ${d.products} products are out or low.` });
  }
  if (d.products >= 40) {
    strengths.push({ id: 'range', title: 'Wide product range', detail: `${d.products} products are loaded, so most items can be scanned.` });
  }
  if (d.revenue > 0 && d.margin >= 0.2) {
    strengths.push({ id: 'margin', title: 'Healthy margins', detail: `Profit is ${pct(d.margin)} of revenue.` });
  }
  if (d.outstanding > 0 && d.overdueShare < 0.15) {
    strengths.push({ id: 'collects', title: 'Collects credit well', detail: `Only ${pct(d.overdueShare)} of credit owed is overdue.` });
  }
  if (medianBasket > 0 && d.basket >= 1.2 * medianBasket) {
    strengths.push({ id: 'basket', title: 'Bigger than average sales', detail: `The average sale is ${formatRand(d.basket)} against ${formatRand(medianBasket)} across shops.` });
  }

  causes.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { causes, strengths };
}

// What the high performers do differently: average of each measure in the high group against the low
// group (or the mid group when no shop is low), biggest differences first.
const COMPARE = [
  { key: 'activeDays', label: 'Days with a sale (of 30)', kind: 'days' },
  { key: 'growth', label: 'Revenue growth', kind: 'pct' },
  { key: 'stockGap', label: 'Products out or low', kind: 'pct' },
  { key: 'overdueShare', label: 'Credit that is overdue', kind: 'pct' },
  { key: 'creditShare', label: 'Sales made on credit', kind: 'pct' },
  { key: 'margin', label: 'Profit margin', kind: 'pct' },
  { key: 'basket', label: 'Average sale', kind: 'rand' },
  { key: 'products', label: 'Products loaded', kind: 'count' },
];

function average(shops, key) {
  const values = shops.map((shop) => shop.d[key]).filter((value) => value !== null && value !== undefined && Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function tierComparison(scored) {
  const high = scored.filter((shop) => shop.tier === 'high');
  const low = scored.filter((shop) => shop.tier === 'low');
  const mid = scored.filter((shop) => shop.tier === 'mid');
  const against = low.length ? low : mid;
  if (!high.length || !against.length) return { rows: [], againstLabel: '' };
  const rows = COMPARE.map((metric) => {
    const highValue = average(high, metric.key);
    const otherValue = average(against, metric.key);
    if (highValue === null || otherValue === null) return null;
    const scale = Math.max(Math.abs(highValue), Math.abs(otherValue), 0.0001);
    return { ...metric, high: highValue, other: otherValue, gap: Math.abs(highValue - otherValue) / scale };
  }).filter(Boolean);
  rows.sort((a, b) => b.gap - a.gap);
  return { rows: rows.slice(0, 6), againstLabel: low.length ? 'Low' : 'Mid' };
}

export function platformTotals(scored) {
  const count = scored.length;
  const sum = (key) => scored.reduce((total, shop) => total + num(shop[key]), 0);
  return {
    shops: count,
    revenue30d: sum('revenue30d'),
    sales30d: sum('salesCount30d'),
    items30d: sum('itemsSold30d'),
    activeShops: scored.filter((shop) => shop.d.sales > 0).length,
    avgScore: count ? Math.round(scored.reduce((total, shop) => total + shop.score, 0) / count) : 0,
    high: scored.filter((shop) => shop.tier === 'high').length,
    mid: scored.filter((shop) => shop.tier === 'mid').length,
    low: scored.filter((shop) => shop.tier === 'low').length,
  };
}

// Platform-wide findings. Scored shops may carry a `state` (from subscriptionState).
export function platformInsights(scored) {
  const items = [];
  if (!scored.length) return items;

  const unpaid = scored.filter((shop) => shop.state && (shop.state.key === 'overdue' || shop.state.key === 'deactivated'));
  if (unpaid.length) {
    items.push({
      id: 'unpaid', severity: 'danger', title: `${unpaid.length} ${unpaid.length === 1 ? 'shop has' : 'shops have'} not paid`,
      detail: 'These accounts are overdue or deactivated. Open the Billing tab to chase them.',
    });
  }
  const silent = scored.filter((shop) => shop.d.sales === 0);
  if (silent.length) {
    items.push({
      id: 'silent', severity: 'warning', title: `${silent.length} ${silent.length === 1 ? 'shop recorded' : 'shops recorded'} no sales in 30 days`,
      detail: 'Shops that do not use the app are the most likely to cancel.',
    });
  }
  const stockTrouble = scored.filter((shop) => shop.d.products > 0 && shop.d.stockGap >= 0.25);
  if (stockTrouble.length) {
    items.push({
      id: 'stock', severity: 'warning', title: `${stockTrouble.length} ${stockTrouble.length === 1 ? 'shop has' : 'shops have'} serious stock gaps`,
      detail: 'A quarter or more of their products are out or low. A reorder prompt could help them.',
    });
  }
  const creditRisk = scored.filter((shop) => shop.d.overdue > 0 && shop.d.overdueShare >= 0.4);
  if (creditRisk.length) {
    items.push({
      id: 'credit', severity: 'info', title: `${creditRisk.length} ${creditRisk.length === 1 ? 'shop has' : 'shops have'} mostly overdue credit`,
      detail: 'Promote the WhatsApp reminder feature to these shops.',
    });
  }

  // Most common root cause among the mid and low performers
  const medianBasket = medianOf(scored.map((shop) => shop.d.basket).filter((value) => value > 0));
  const tally = new Map();
  scored.filter((shop) => shop.tier !== 'high').forEach((shop) => {
    diagnose(shop, { medianBasket }).causes.forEach((cause) => {
      const entry = tally.get(cause.id) || { cause, shops: 0 };
      entry.shops += 1;
      tally.set(cause.id, entry);
    });
  });
  const top = [...tally.values()].sort((a, b) => b.shops - a.shops)[0];
  if (top && top.shops >= 2) {
    items.push({
      id: 'top-cause', severity: 'info', title: `Most common problem: ${top.cause.title.toLowerCase()}`,
      detail: `${top.shops} mid and low performers share it. ${top.cause.adminAction}`,
    });
  }
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
