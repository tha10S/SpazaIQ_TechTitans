// Shop performance scoring and root-cause analysis. Pure functions with no Firebase imports.
// It only ever sees shop-level totals (the shopStats document), never sales or customer records.
//
// SCORE = 0-100, made of twelve parts in three groups. Every part is measured against a FIXED benchmark,
// never against other shops, so a shop's score does not change because another shop joined or left, and
// the shop's own screen and the admin screen always show the same number.
//
//   SALES AND TRADING (62)   Revenue 17 . Profit 14 . Items sold 6 . Days trading 9 . Steady week to week 8 . Growth 8
//   STOCK (20)               Products in stock 9 . Stock level vs sales 5 . Expiry risk 6
//   CREDIT (18)              Paid on time 8 . Overdue credit 6 . Reliance on credit 4
//
// A part that does not apply to a shop (for example credit parts for a shop that never gives credit, or growth
// for a shop that is only two weeks old) is LEFT OUT and the remaining weights are scaled back up to 100.
// It is never counted as zero and never as full marks.
//
// Tiers: high >= 70, mid >= 40, low below that. A shop can only be HIGH if it also trades on enough days,
// in enough weeks, has enough revenue and enough history. A shop with no sales is always LOW.
import { toDate } from './billing.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Benchmarks you may want to tune ----
export const BENCHMARK = {
  // Revenue over 30 days that earns full marks for the revenue part.
  // Basis: Ask Afrika's 2021 survey of 201 spaza shops found median weekly sales of about R10,000
  // (about R43,000 per 30 days) and an average of about R21,000 a week. R80,000 is well above the
  // median, so a High performer has to beat the typical spaza.
  // FOR A DEMO with small test shops, lower this (for example to 3000) so the tiers spread out.
  revenue30d: 80000,
  // Profit that earns full marks is this share of the revenue benchmark (a typical gross margin for a spaza)
  margin: 0.2,
  // Items sold in 30 days that earn full marks (R80,000 at roughly R25 an item is about 3,200)
  itemsSold30d: 3500,
  // Days with a recorded sale, out of 30, that earn full marks (a spaza trading about 6 days a week)
  fullTradingDays: 24,
  // A shop with fewer tracked days than this is judged cautiously and can't be High yet
  minHistoryDays: 14,
  // To be High, 30-day revenue must be at least this share of the revenue benchmark
  highMinRevenueShare: 0.6,
  // Month-on-month growth is only trusted once the shop is old enough for the earlier month to be complete
  growthMinAgeDays: 50,
  // Days of sales the stock on the shelf covers. Spazas restock often, so about 1 to 4 weeks is healthy.
  cover: { tooLow: 3, healthyFrom: 7, healthyTo: 30, tooMuch: 60, dead: 120 },
  // Expiry: stock value that is expired (full weight) or expiring soon (half weight), as a share of the stock
  // that has an expiry date, that scores zero. Needs at least this share of stock to have an expiry date.
  expiry: { fullRiskShare: 0.15, minTrackedShare: 0.1 },
  // Credit
  credit: {
    dependenceFree: 0.15, // credit up to this share of sales is normal for a spaza
    dependenceFull: 0.6, // at this share the reliance score is zero
    overdueShareFull: 0.5, // half of the money owed being overdue scores zero
    overdueRevenueFull: 0.2, // overdue money equal to a fifth of a month's sales scores zero
    priorMean: 0.7, // with only a few credits, nudge the paid-on-time rate towards this so one customer
    priorWeight: 2, // can't swing the part from 0 to 100
  },
};
export const TIER_LIMITS = { high: 70, mid: 40 };

// Weights as whole points. They add up to 100.
const POINTS = {
  revenue: 17, profit: 14, volume: 6, activity: 9, steadiness: 8, growth: 8,
  availability: 9, cover: 5, expiry: 6,
  collection: 8, overdue: 6, dependence: 4,
};
export const WEIGHTS = Object.fromEntries(Object.entries(POINTS).map(([key, points]) => [key, points / 100]));
export const PART_LABELS = {
  revenue: 'Revenue vs benchmark',
  profit: 'Profit vs benchmark',
  volume: 'Items sold',
  activity: 'Days trading',
  steadiness: 'Steady week to week',
  growth: 'Growth',
  availability: 'Products in stock',
  cover: 'Stock level vs sales',
  expiry: 'Expiry risk',
  collection: 'Credit paid on time',
  overdue: 'Overdue credit',
  dependence: 'Reliance on credit',
};
export const PART_GROUPS = [
  { key: 'trading', label: 'Sales and trading', parts: ['revenue', 'profit', 'volume', 'activity', 'steadiness', 'growth'] },
  { key: 'stock', label: 'Stock', parts: ['availability', 'cover', 'expiry'] },
  { key: 'credit', label: 'Credit', parts: ['collection', 'overdue', 'dependence'] },
];
const SMALL_RANGE = 15; // fewer products than this looks like an unfinished catalogue

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const formatRand = (value) => `R${Math.round(num(value)).toLocaleString('en-ZA')}`;
const pct = (value) => `${Math.round(num(value) * 100)}%`;

export function formatValue(kind, value) {
  if (value === null || value === undefined) return '-';
  if (kind === 'pct') return pct(value);
  if (kind === 'rand') return formatRand(value);
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
  const firstSale = toDate(stats.firstSaleAt);
  const seen = toDate(stats.updatedAt);

  // How old the shop's sales history is. Records without a first-sale date count as old if they had sales.
  const ageDays = firstSale
    ? Math.max(1, Math.round((startOfDay(now) - startOfDay(firstSale)) / DAY_MS) + 1)
    : sales > 0 ? (previous > 0 ? 60 : 30) : 0;
  // Days of history inside the 30-day window
  const trackedDays = clamp(ageDays, 0, 30);
  const effectiveDays = Math.max(trackedDays, BENCHMARK.minHistoryDays);
  const scale = effectiveDays / 30; // a young shop is judged against a proportionally smaller target

  // Weekly revenue, most recent first. Missing on records published by an older version of the app.
  // Only COMPLETE weeks since the shop started are used, so a shop that began mid-week isn't marked uneven.
  const weeklyRaw = [1, 2, 3, 4].map((week) => stats[`weekRevenue${week}`]);
  const hasWeekly = weeklyRaw.every((value) => value !== undefined && value !== null && Number.isFinite(Number(value)));
  const weeksTracked = hasWeekly ? Math.min(4, Math.floor(trackedDays / 7)) : 0;
  const weeks = hasWeekly ? weeklyRaw.map(Number).slice(0, weeksTracked) : null;
  const weekMean = weeks && weeks.length ? weeks.reduce((sum, value) => sum + value, 0) / weeks.length : 0;
  const weekSpread = weeks && weeks.length
    ? Math.sqrt(weeks.reduce((sum, value) => sum + (value - weekMean) ** 2, 0) / weeks.length)
    : 0;
  let trend = null; // last 2 weeks against the 2 weeks before, needs 4 full weeks of history
  if (weeks && weeksTracked === 4) {
    const recent = weeks[0] + weeks[1];
    const earlier = weeks[2] + weeks[3];
    trend = earlier > 0 ? (recent - earlier) / earlier : null;
  }

  // Stock level against sales: how many days the stock on the shelf would last at the current rate of sales
  const stockValue = num(stats.stockCostValue);
  const cogs = Math.max(0, revenue - num(stats.profit30d)); // cost of the goods sold
  const cogsPerDay = cogs / Math.max(1, Math.min(30, trackedDays || 30));
  const coverDays = cogsPerDay > 0 ? stockValue / cogsPerDay : null;

  // Expiry: how much of the stock that HAS an expiry date is expired or about to be
  const trackedShare = clamp(num(stats.expiryTrackedShare));
  const trackedValue = trackedShare * stockValue;
  const expiredValue = num(stats.expiredValue);
  const expiringSoonValue = num(stats.expiringSoonValue);
  const expiryRiskShare = stockValue > 0 && trackedShare >= BENCHMARK.expiry.minTrackedShare && trackedValue > 0
    ? (expiredValue + 0.5 * expiringSoonValue) / trackedValue
    : null;

  // Credit paid on time (credit that fell due in the last 90 days)
  const dueCount = num(stats.creditDueCount90d);
  const onTimeCount = num(stats.creditOnTimeCount90d);
  const dueAmount = num(stats.creditDueAmount90d);
  const onTimeAmount = num(stats.creditOnTimeAmount90d);
  const byCount = dueCount > 0 ? clamp(onTimeCount / dueCount) : null;
  const byAmount = dueAmount > 0 ? clamp(onTimeAmount / dueAmount) : byCount;
  const onTimeRate = byCount === null ? null : 0.5 * byCount + 0.5 * byAmount;

  const gapSalesShare = stats.stockGapSalesShare === undefined || stats.stockGapSalesShare === null
    ? null
    : clamp(num(stats.stockGapSalesShare));

  return {
    revenue,
    previous,
    sales,
    items: num(stats.itemsSold30d),
    products,
    ageDays,
    trackedDays,
    effectiveDays,
    scale,
    weeks,
    weeksTracked,
    activeWeeks: weeks ? weeks.filter((value) => value > 0).length : 0,
    cv: weekMean > 0 ? weekSpread / weekMean : 0,
    trend,
    activeDays: num(stats.activeDays30d),
    out: num(stats.outOfStockCount),
    low: num(stats.lowStockCount),
    basket: sales > 0 ? revenue / sales : 0,
    margin: revenue > 0 ? num(stats.profit30d) / revenue : 0,
    growth: previous > 0 && ageDays >= BENCHMARK.growthMinAgeDays ? (revenue - previous) / previous : null,
    creditShare: revenue > 0 ? num(stats.creditSales30d) / revenue : 0,
    overdueShare: outstanding > 0 ? num(stats.creditOverdue) / outstanding : 0,
    overdueOfRevenue: revenue > 0 ? num(stats.creditOverdue) / revenue : 0,
    outstanding,
    overdue: num(stats.creditOverdue),
    creditSales: num(stats.creditSales30d),
    stockGap: products > 0 ? (num(stats.outOfStockCount) + num(stats.lowStockCount)) / products : 0,
    gapSalesShare,
    stockValue,
    coverDays,
    expiredCount: num(stats.expiredCount),
    expiringSoonCount: num(stats.expiringSoonCount),
    expiredValue,
    expiringSoonValue,
    expiryTrackedShare: trackedShare,
    expiryRiskShare,
    dueCount,
    onTimeCount,
    dueAmount,
    onTimeAmount,
    onTimeRate,
    daysSinceLastSale: lastSale ? Math.max(0, Math.floor((now - lastSale) / DAY_MS)) : null,
    daysSinceSeen: seen ? Math.max(0, Math.floor((now - seen) / DAY_MS)) : null,
  };
}

// 0..1 for "days of sales on the shelf": too little stock means lost sales, too much means cash sitting on shelves
export function coverScore(days) {
  const c = BENCHMARK.cover;
  if (days <= 0) return 0;
  if (days < c.tooLow) return 0.5 * (days / c.tooLow);
  if (days < c.healthyFrom) return 0.5 + 0.5 * ((days - c.tooLow) / (c.healthyFrom - c.tooLow));
  if (days <= c.healthyTo) return 1;
  if (days <= c.tooMuch) return 1 - 0.6 * ((days - c.healthyTo) / (c.tooMuch - c.healthyTo));
  if (days <= c.dead) return 0.4 * (1 - (days - c.tooMuch) / (c.dead - c.tooMuch));
  return 0;
}

export function scoreShop(stats, { now = new Date() } = {}) {
  const d = derive(stats, now);
  const targetRevenue = BENCHMARK.revenue30d * d.scale;
  const targetProfit = targetRevenue * BENCHMARK.margin;
  const targetItems = BENCHMARK.itemsSold30d * d.scale;
  const fullDays = BENCHMARK.fullTradingDays * d.scale;
  const credit = BENCHMARK.credit;

  // Stock parts only count for a shop that is actually trading: full shelves with no sales earn nothing
  const trading = clamp(d.activeDays / 10);

  // null means "does not apply to this shop"
  const parts = {};
  parts.revenue = targetRevenue > 0 ? clamp(d.revenue / targetRevenue) : 0;
  parts.profit = targetProfit > 0 ? clamp(num(stats.profit30d) / targetProfit) : 0;
  parts.volume = targetItems > 0 ? clamp(d.items / targetItems) : 0;
  parts.activity = fullDays > 0 ? clamp(d.activeDays / fullDays) : 0;

  // Steady: how many of the complete weeks had sales, reduced when sales jump around a lot between weeks.
  // Swings of up to 15% are normal and cost nothing. 80% or more swing scores zero.
  if (d.weeks && d.weeksTracked >= 2) {
    const share = d.activeWeeks / d.weeksTracked;
    const evenness = 1 - clamp((d.cv - 0.15) / 0.65);
    parts.steadiness = share * evenness;
  } else {
    parts.steadiness = null;
  }

  // Growth: month on month when the earlier month is complete, otherwise the last 2 weeks against the 2 before,
  // otherwise it does not apply. Flat sales score 0.6, +50% scores full marks, -75% scores zero.
  const change = d.growth !== null ? d.growth : d.trend;
  parts.growth = change === null ? null : clamp(0.6 + 0.8 * clamp(change, -1, 1));

  // Products in stock: out-of-stock counts fully and running low counts half. Gaps on products that really sell
  // count more than gaps on slow ones. A quarter of the shelf out is already a poor score, 40% scores zero.
  if (d.products === 0) {
    parts.availability = 0;
  } else {
    const countGap = (d.out + 0.5 * d.low) / d.products;
    const gap = d.gapSalesShare !== null && d.sales > 0 ? 0.6 * d.gapSalesShare + 0.4 * countGap : countGap;
    parts.availability = (1 - clamp(gap / 0.4)) * trading;
  }

  // Stock level vs sales: needs about a week of history to judge
  if (d.products === 0) {
    parts.cover = 0;
  } else if (d.trackedDays < 7) {
    parts.cover = null;
  } else if (d.coverDays === null) {
    parts.cover = (d.stockValue > 0 ? 0.2 : 0) * trading; // stock but nothing selling
  } else {
    parts.cover = coverScore(d.coverDays) * trading;
  }

  // Expiry risk: only judged when enough of the stock has an expiry date
  parts.expiry = d.expiryRiskShare === null
    ? null
    : (1 - clamp(d.expiryRiskShare / BENCHMARK.expiry.fullRiskShare)) * trading;

  // Credit paid on time, nudged towards a prior when there are only a few credits
  if (d.dueCount > 0 && d.onTimeRate !== null) {
    const adjusted = (d.onTimeRate * d.dueCount + credit.priorMean * credit.priorWeight) / (d.dueCount + credit.priorWeight);
    parts.collection = clamp(adjusted);
  } else {
    parts.collection = null;
  }

  // Overdue credit: the share of what is owed that is overdue, and how big that is next to a month of sales
  if (d.outstanding > 0) {
    const shareScore = 1 - clamp(d.overdueShare / credit.overdueShareFull);
    const sizeScore = d.revenue > 0 ? 1 - clamp(d.overdueOfRevenue / credit.overdueRevenueFull) : shareScore;
    parts.overdue = 0.6 * shareScore + 0.4 * sizeScore;
  } else {
    parts.overdue = null;
  }

  // Reliance on credit: some credit is normal for a spaza, a shop that lives on credit is exposed
  parts.dependence = d.revenue > 0 && (d.creditSales > 0 || d.outstanding > 0 || d.dueCount > 0)
    ? 1 - clamp((d.creditShare - credit.dependenceFree) / (credit.dependenceFull - credit.dependenceFree))
    : null;

  // Add up only the parts that apply, then scale the weights back up to 100
  let usedWeight = 0;
  let earned = 0;
  Object.keys(WEIGHTS).forEach((key) => {
    if (parts[key] === null) return;
    usedWeight += WEIGHTS[key];
    earned += WEIGHTS[key] * parts[key];
  });
  const weights = {};
  Object.keys(WEIGHTS).forEach((key) => {
    weights[key] = parts[key] === null || usedWeight === 0 ? 0 : WEIGHTS[key] / usedWeight;
  });
  let score = usedWeight > 0 ? Math.round((100 * earned) / usedWeight) : 0;

  // Score of each group out of 100, and how much of the total it carries
  const pillars = PART_GROUPS.map((group) => {
    const keys = group.parts.filter((key) => parts[key] !== null);
    const weight = keys.reduce((sum, key) => sum + weights[key], 0);
    const pillarScore = keys.length
      ? (100 * keys.reduce((sum, key) => sum + weights[key] * parts[key], 0)) / weight
      : null;
    return { key: group.key, label: group.label, score: pillarScore === null ? null : Math.round(pillarScore), weight };
  });

  let tier = score >= TIER_LIMITS.high ? 'high' : score >= TIER_LIMITS.mid ? 'mid' : 'low';
  if (d.sales === 0) {
    tier = 'low';
    score = Math.min(score, TIER_LIMITS.mid - 1);
  }
  // High has to be earned with real, steady trading. A shop that doesn't meet these is held at Mid,
  // and its score is held just under the High line so the number and the tier always agree.
  if (tier === 'high') {
    const enoughDays = d.activeDays >= 0.5 * d.effectiveDays;
    const enoughWeeks = !d.weeks || d.activeWeeks >= Math.min(3, d.weeksTracked);
    const enoughRevenue = d.revenue >= BENCHMARK.highMinRevenueShare * targetRevenue;
    const enoughHistory = d.trackedDays >= BENCHMARK.minHistoryDays;
    if (!(enoughDays && enoughWeeks && enoughRevenue && enoughHistory)) {
      tier = 'mid';
      score = Math.min(score, TIER_LIMITS.high - 1);
    }
  }

  return {
    score,
    parts,
    weights,
    applicable: Object.fromEntries(Object.keys(parts).map((key) => [key, parts[key] !== null])),
    pillars,
    tier,
    confidence: d.trackedDays < BENCHMARK.minHistoryDays ? 'building' : 'established',
    d,
    benchmark: { revenue: targetRevenue, profit: targetProfit, items: targetItems },
  };
}

export function scoreAll(shops, now = new Date()) {
  return shops.map((shop) => ({ ...shop, ...scoreShop(shop, { now }) }));
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
  const benchmark = shop.benchmark || null;
  const causes = [];
  const strengths = [];
  const fullDays = BENCHMARK.fullTradingDays * d.scale;
  const change = d.growth !== null ? d.growth : d.trend;

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
  if (d.sales > 0 && benchmark && d.revenue < 0.25 * benchmark.revenue) {
    causes.push({
      id: 'low-revenue', severity: 'warning', title: 'Sales are well below the benchmark',
      detail: `${formatRand(d.revenue)} in ${d.trackedDays} days is ${pct(d.revenue / benchmark.revenue)} of the ${formatRand(benchmark.revenue)} benchmark for a strong spaza.`,
      tip: 'Record every sale, keep your popular items in stock, and push staples around payday and grant week.',
      adminAction: 'Find out whether sales are not all being recorded, or whether the shop is simply small.',
    });
  }
  if (d.sales > 0 && d.activeDays < 0.4 * fullDays) {
    causes.push({
      id: 'low-activity', severity: 'warning', title: 'Records sales on few days',
      detail: `Only ${d.activeDays} of the last ${d.trackedDays} days had a recorded sale.`,
      tip: 'Record sales every trading day so your numbers and advice stay accurate.',
      adminAction: 'The owner may only record sales some days. Offer a short refresher on the Sell screen.',
    });
  }
  if (d.weeks && d.weeksTracked >= 3 && (d.activeWeeks < d.weeksTracked || d.cv > 0.75)) {
    causes.push({
      id: 'uneven-trading', severity: 'warning', title: 'Sales are uneven from week to week',
      detail: `Weekly sales, oldest to newest: ${[...d.weeks].reverse().map(formatRand).join(', ')}.`,
      tip: 'Steady trading builds regular customers. Try to open and record sales at the same times each week.',
      adminAction: 'Check for closed weeks, stock-outs, or weeks when sales were not recorded.',
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
  if (d.products > 0 && (d.stockGap >= 0.25 || d.out >= 3 || (d.gapSalesShare !== null && d.gapSalesShare >= 0.25))) {
    const weighted = d.gapSalesShare !== null && d.gapSalesShare >= 0.15
      ? ` About ${pct(d.gapSalesShare)} of your sales come from products that are out or low.`
      : '';
    causes.push({
      id: 'stock-gaps', severity: d.out >= 3 || (d.gapSalesShare !== null && d.gapSalesShare >= 0.25) ? 'danger' : 'warning',
      title: 'Stock gaps are costing sales',
      detail: `${d.out} out of stock and ${d.low} running low, which is ${pct(d.stockGap)} of ${d.products} products.${weighted}`,
      tip: 'Reorder from the Suppliers tab before items run out. An empty shelf is a lost sale.',
      adminAction: 'Check reorder levels are realistic and that the owner uses Suppliers > Reorder.',
    });
  }
  if (d.expiredValue > 0) {
    causes.push({
      id: 'expired-stock', severity: 'danger', title: 'Expired stock is still on the shelf',
      detail: `${d.expiredCount} ${d.expiredCount === 1 ? 'item' : 'items'} worth ${formatRand(d.expiredValue)} (at cost) ${d.expiredCount === 1 ? 'is' : 'are'} past the expiry date.`,
      tip: 'Take expired items off the shelf and update Stock. Selling them is a health risk and a lost sale you cannot get back.',
      adminAction: 'A food-safety and loss risk. Remind the owner to check dates every week.',
    });
  }
  if (d.expiryRiskShare !== null && d.expiringSoonValue > 0 && d.expiringSoonValue / (d.expiryTrackedShare * d.stockValue) >= 0.05) {
    causes.push({
      id: 'expiring-soon', severity: 'warning', title: 'Stock is close to expiring',
      detail: `${d.expiringSoonCount} ${d.expiringSoonCount === 1 ? 'item' : 'items'} worth ${formatRand(d.expiringSoonValue)} (at cost) expire within a week.`,
      tip: 'Move them to the front, put them on special, or use the Shop News to see what to sell first.',
      adminAction: 'Suggest first-expiry-first-out and smaller, more frequent orders for short-life items.',
    });
  }
  if (d.coverDays !== null && d.trackedDays >= BENCHMARK.minHistoryDays && d.coverDays > BENCHMARK.cover.tooMuch) {
    causes.push({
      id: 'overstocked', severity: 'warning', title: 'More stock than the shop sells',
      detail: `The stock on the shelf (${formatRand(d.stockValue)} at cost) would last about ${Math.round(d.coverDays)} days at the current rate of sales.`,
      tip: 'Hold off reordering slow items so your cash is not tied up on shelves.',
      adminAction: 'Cash is stuck in stock. Suggest ordering smaller quantities and clearing slow items.',
    });
  }
  if (d.sales > 0 && d.coverDays !== null && d.trackedDays >= BENCHMARK.minHistoryDays && d.coverDays < BENCHMARK.cover.tooLow) {
    causes.push({
      id: 'understocked', severity: 'warning', title: 'Stock runs out within days',
      detail: `The stock on the shelf would last only about ${Math.max(0, Math.round(d.coverDays))} days at the current rate of sales.`,
      tip: 'Restock your best sellers before the shelf empties, especially before payday and grant week.',
      adminAction: 'The shop is selling faster than it restocks. Suggest higher reorder levels.',
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
  if (d.dueCount >= 3 && d.onTimeRate !== null && d.onTimeRate < 0.6) {
    causes.push({
      id: 'late-payers', severity: 'warning', title: 'Customers often pay late',
      detail: `Only ${d.onTimeCount} of ${d.dueCount} credits that fell due in the last 90 days were paid by their due date.`,
      tip: 'Send a WhatsApp reminder a few days before the due date, and ask for part-payment up front.',
      adminAction: 'Weak collection habits. Suggest reminders before the due date and shorter repayment plans.',
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
  if (change !== null && change <= -0.2) {
    causes.push({
      id: 'declining', severity: 'warning', title: 'Revenue is falling',
      detail: `Revenue is down ${pct(Math.abs(change))} compared with ${d.growth !== null ? 'the previous 30 days' : 'the 2 weeks before'}.`,
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
  if (d.trackedDays > 0 && d.trackedDays < BENCHMARK.minHistoryDays) {
    causes.push({
      id: 'limited-history', severity: 'info', title: 'Not enough history yet',
      detail: `Sales have only been recorded for ${d.trackedDays} days, so the score is cautious and can't reach High yet.`,
      tip: 'Keep recording sales. Your score becomes more accurate as history builds.',
      adminAction: 'A new shop. Judge it again once it has two weeks of sales.',
    });
  }

  if (d.activeDays >= fullDays && d.activeDays > 0) {
    strengths.push({ id: 'consistent', title: 'Trades almost every day', detail: `A sale was recorded on ${d.activeDays} of the last ${d.trackedDays} days.` });
  }
  if (d.weeks && d.weeksTracked >= 3 && d.activeWeeks === d.weeksTracked && d.cv <= 0.4) {
    strengths.push({ id: 'steady', title: 'Steady week to week', detail: 'Sales were recorded in every recent week, with no big swings.' });
  }
  if (change !== null && change >= 0.2) {
    strengths.push({ id: 'growing', title: 'Revenue is growing', detail: `Up ${pct(change)} on ${d.growth !== null ? 'the previous 30 days' : 'the 2 weeks before'}.` });
  }
  if (d.items >= BENCHMARK.itemsSold30d * d.scale) {
    strengths.push({ id: 'busy', title: 'A busy shop', detail: `${Math.round(d.items).toLocaleString('en-ZA')} items were sold in the last ${d.trackedDays} days.` });
  }
  if (d.products >= SMALL_RANGE && d.stockGap < 0.1) {
    strengths.push({ id: 'stocked', title: 'Shelves are well stocked', detail: `Only ${d.out + d.low} of ${d.products} products are out or low.` });
  }
  if (d.sales > 0 && d.gapSalesShare !== null && d.gapSalesShare < 0.05 && d.products >= SMALL_RANGE) {
    strengths.push({ id: 'best-sellers-in-stock', title: 'Best sellers are in stock', detail: 'Almost nothing that sells well is out or running low.' });
  }
  if (d.coverDays !== null && d.trackedDays >= BENCHMARK.minHistoryDays
    && d.coverDays >= BENCHMARK.cover.healthyFrom && d.coverDays <= BENCHMARK.cover.healthyTo) {
    strengths.push({ id: 'right-stock', title: 'The right amount of stock', detail: `The shelf holds about ${Math.round(d.coverDays)} days of sales.` });
  }
  if (d.expiryRiskShare !== null && d.expiredValue === 0 && d.expiryRiskShare < 0.02) {
    strengths.push({ id: 'fresh-stock', title: 'Stock is fresh', detail: 'Nothing on the shelf is expired or about to expire.' });
  }
  if (d.products >= 40) {
    strengths.push({ id: 'range', title: 'Wide product range', detail: `${d.products} products are loaded, so most items can be scanned.` });
  }
  if (d.revenue > 0 && d.margin >= 0.2) {
    strengths.push({ id: 'margin', title: 'Healthy margins', detail: `Profit is ${pct(d.margin)} of revenue.` });
  }
  if (d.dueCount >= 3 && d.onTimeRate !== null && d.onTimeRate >= 0.85) {
    strengths.push({ id: 'pays-on-time', title: 'Customers pay on time', detail: `${d.onTimeCount} of ${d.dueCount} credits that fell due in the last 90 days were paid by their due date.` });
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
  { key: 'revenue', label: 'Revenue (30 days)', kind: 'rand' },
  { key: 'items', label: 'Items sold (30 days)', kind: 'count' },
  { key: 'activeDays', label: 'Days with a sale (of 30)', kind: 'days' },
  { key: 'growth', label: 'Revenue growth', kind: 'pct' },
  { key: 'stockGap', label: 'Products out or low', kind: 'pct' },
  { key: 'gapSalesShare', label: 'Sales at risk from stock gaps', kind: 'pct' },
  { key: 'coverDays', label: 'Days of stock on the shelf', kind: 'days' },
  { key: 'expiryRiskShare', label: 'Stock expired or expiring', kind: 'pct' },
  { key: 'onTimeRate', label: 'Credit paid on time', kind: 'pct' },
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
  const expired = scored.filter((shop) => shop.d.expiredValue > 0);
  if (expired.length) {
    items.push({
      id: 'expired', severity: 'warning', title: `${expired.length} ${expired.length === 1 ? 'shop has' : 'shops have'} expired stock on the shelf`,
      detail: 'A reminder to check dates weekly would help these shops.',
    });
  }
  const stockTrouble = scored.filter((shop) => shop.d.products > 0 && (shop.d.stockGap >= 0.25 || (shop.d.gapSalesShare !== null && shop.d.gapSalesShare >= 0.25)));
  if (stockTrouble.length) {
    items.push({
      id: 'stock', severity: 'warning', title: `${stockTrouble.length} ${stockTrouble.length === 1 ? 'shop has' : 'shops have'} serious stock gaps`,
      detail: 'A quarter or more of their products, or of what they sell, is out or low. A reorder prompt could help them.',
    });
  }
  const creditRisk = scored.filter((shop) => shop.d.overdue > 0 && shop.d.overdueShare >= 0.4);
  if (creditRisk.length) {
    items.push({
      id: 'credit', severity: 'info', title: `${creditRisk.length} ${creditRisk.length === 1 ? 'shop has' : 'shops have'} mostly overdue credit`,
      detail: 'Promote the WhatsApp reminder feature to these shops.',
    });
  }
  const latePayers = scored.filter((shop) => shop.d.dueCount >= 3 && shop.d.onTimeRate !== null && shop.d.onTimeRate < 0.6);
  if (latePayers.length) {
    items.push({
      id: 'late-payers', severity: 'info', title: `${latePayers.length} ${latePayers.length === 1 ? 'shop has' : 'shops have'} customers who often pay late`,
      detail: 'Reminders sent a few days before the due date work better than reminders after it.',
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
