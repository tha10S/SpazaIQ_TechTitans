// Turns a shop's own products, sales, customers and repayment history into shop-level TOTALS.
// Only these totals are ever sent to the admin area. No customer name, phone number or individual
// sale leaves the shop's own data. Pure functions, no Firebase imports.
import { toDate } from './billing.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Stock that expires within this many days counts as "expiring soon"
export const EXPIRY_SOON_DAYS = 7;
// Credit that fell due in the last this-many days counts towards "paid on time"
export const CREDIT_WINDOW_DAYS = 90;

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (value) => Math.round(num(value) * 100) / 100;
const round4 = (value) => Math.round(num(value) * 10000) / 10000;
const clamp01 = (value) => Math.min(1, Math.max(0, num(value)));

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// 'YYYY-MM-DD' (or an ISO date) -> local midnight of that day
function localDay(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = toDate(value);
  return date ? startOfDay(date) : null;
}

// How the shop's money and credit behaved. Everything is measured in whole calendar days, so a window
// of "30 days" always means today plus the 29 days before it (never 31 different days).
export function buildShopStats({ products = [], sales = [], customers = [], repayments = null, now = new Date() } = {}) {
  const today = startOfDay(now);
  const daysAgoOf = (date) => Math.round((today - startOfDay(date)) / DAY_MS);

  let revenue30d = 0;
  let revenuePrev30d = 0;
  let profit30d = 0;
  let salesCount30d = 0;
  let itemsSold30d = 0;
  let creditSales30d = 0;
  let lastSaleAt = null;
  let firstSaleAt = null;
  const tradingDays = new Set();
  // Revenue for each of the last 4 weeks. weekRevenue[0] is the most recent 7 days (today and the 6 before).
  const weekRevenue = [0, 0, 0, 0];
  // Revenue per product over the last 30 days, used to see which stock-outs would really hurt
  const revenueByProduct = new Map();
  let itemRevenue30d = 0;

  sales.forEach((sale) => {
    const date = toDate(sale.createdAt);
    if (!date) return;
    const ago = daysAgoOf(date);
    if (ago < 0) return; // dated in the future, ignore
    if (!lastSaleAt || date > lastSaleAt) lastSaleAt = date;
    if (!firstSaleAt || date < firstSaleAt) firstSaleAt = date;
    const total = num(sale.total);

    if (ago < 28) weekRevenue[Math.floor(ago / 7)] += total;

    if (ago < 30) {
      revenue30d += total;
      salesCount30d += 1;
      creditSales30d += num(sale.creditAmount);
      tradingDays.add(dayKey(date));
      (sale.items || []).forEach((item) => {
        const quantity = num(item.qty ?? item.quantity);
        const price = num(item.unitPrice ?? item.unit_price);
        itemsSold30d += quantity;
        const cost = Number(item.costPrice ?? item.cost_price);
        if (Number.isFinite(cost)) profit30d += (price - cost) * quantity;
        const key = item.id || String(item.name || item.productName || '').toLowerCase();
        if (key) {
          revenueByProduct.set(key, (revenueByProduct.get(key) || 0) + price * quantity);
          itemRevenue30d += price * quantity;
        }
      });
    } else if (ago < 60) {
      revenuePrev30d += total;
    }
  });

  // ---- Stock: gaps, value and expiry ----
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let stockCostValue = 0;
  let gapSalesShare = 0;
  let expiredUnits = 0;
  let expiredValue = 0;
  let soonUnits = 0;
  let soonValue = 0;
  let expiryTrackedValue = 0;

  products.forEach((product) => {
    const quantity = Math.max(0, num(product.quantity));
    const reorder = num(product.reorder_level ?? product.reorderLevel);
    const cost = num(product.cost_price ?? product.costPrice);
    const out = quantity <= 0;
    const low = !out && quantity <= reorder;
    if (out) outOfStockCount += 1;
    else if (low) lowStockCount += 1;
    stockCostValue += quantity * cost;

    // A stock-out only costs money if the product actually sells. Weight each gap by its share of sales.
    if (itemRevenue30d > 0 && (out || low)) {
      const sold = revenueByProduct.get(product.id) ?? revenueByProduct.get(String(product.name || '').toLowerCase()) ?? 0;
      gapSalesShare += (sold / itemRevenue30d) * (out ? 1 : 0.5);
    }

    const batches = Array.isArray(product.stock_batches) && product.stock_batches.length
      ? product.stock_batches
      : product.expiry_date ? [{ quantity, expiry_date: product.expiry_date }] : [];
    batches.forEach((batch) => {
      const batchQuantity = Math.max(0, num(batch.quantity));
      const expiry = localDay(batch.expiry_date ?? batch.expiryDate);
      if (!batchQuantity || !expiry) return;
      const value = batchQuantity * cost;
      expiryTrackedValue += value;
      const daysLeft = Math.round((expiry - today) / DAY_MS);
      if (daysLeft < 0) {
        expiredUnits += batchQuantity;
        expiredValue += value;
      } else if (daysLeft <= EXPIRY_SOON_DAYS) {
        soonUnits += batchQuantity;
        soonValue += value;
      }
    });
  });

  // ---- Credit: who owes and what is overdue right now ----
  let creditCustomers = 0;
  let creditOutstanding = 0;
  let creditOverdue = 0;
  customers.forEach((customer) => {
    const balance = num(customer.balance);
    if (balance <= 0) return;
    creditCustomers += 1;
    creditOutstanding += balance;
    if (customer.overdue || num(customer.overdueBalance) > 0) {
      creditOverdue += num(customer.overdueBalance) || balance;
    }
  });

  return {
    revenue30d: round2(revenue30d),
    revenuePrev30d: round2(revenuePrev30d),
    profit30d: round2(profit30d),
    salesCount30d,
    itemsSold30d: Math.round(itemsSold30d),
    activeDays30d: tradingDays.size,
    creditSales30d: round2(creditSales30d),
    lastSaleAt,
    firstSaleAt,
    weekRevenue1: round2(weekRevenue[0]),
    weekRevenue2: round2(weekRevenue[1]),
    weekRevenue3: round2(weekRevenue[2]),
    weekRevenue4: round2(weekRevenue[3]),
    productCount: products.length,
    lowStockCount,
    outOfStockCount,
    stockCostValue: round2(stockCostValue),
    stockGapSalesShare: round4(clamp01(gapSalesShare)),
    expiredCount: Math.round(expiredUnits),
    expiringSoonCount: Math.round(soonUnits),
    expiredValue: round2(expiredValue),
    expiringSoonValue: round2(soonValue),
    expiryTrackedShare: stockCostValue > 0 ? round4(clamp01(expiryTrackedValue / stockCostValue)) : 0,
    creditCustomers,
    creditOutstanding: round2(creditOutstanding),
    creditOverdue: round2(Math.min(creditOverdue, creditOutstanding)),
    // Only present when the shop's repayment history was supplied
    ...(repayments ? computeCreditBehaviour({ ...repayments, now }) : {}),
  };
}

// How well customers paid on time. A credit "falls due" on its schedule's due date. It was paid on time if
// the payments made on or before that date add up to what was owed. Looks at credit that fell due in the
// last 90 days. Credit that was paid off but whose payment dates can't be seen is left out, not guessed.
export function computeCreditBehaviour({ schedules = [], ledgerEntries = [], now = new Date(), windowDays = CREDIT_WINDOW_DAYS } = {}) {
  const today = startOfDay(now);
  const windowStart = new Date(today.getTime() - windowDays * DAY_MS);

  const paymentsBySchedule = new Map();
  ledgerEntries.forEach((entry) => {
    if (entry.type !== 'payment') return;
    const day = localDay(entry.paymentDate) || localDay(entry.createdAt);
    if (!day) return;
    (entry.scheduleAllocations || []).forEach((allocation) => {
      const amount = num(allocation.amount ?? allocation.appliedAmount);
      if (!allocation.scheduleId || amount <= 0) return;
      if (!paymentsBySchedule.has(allocation.scheduleId)) paymentsBySchedule.set(allocation.scheduleId, []);
      paymentsBySchedule.get(allocation.scheduleId).push({ day, amount });
    });
  });

  let dueCount = 0;
  let onTimeCount = 0;
  let dueAmount = 0;
  let onTimeAmount = 0;

  schedules.forEach((schedule) => {
    const due = localDay(schedule.dueDate);
    const owed = num(schedule.totalAmount);
    if (!due || owed <= 0) return;
    if (due >= today || due < windowStart) return; // not due yet, or too long ago to count

    const payments = paymentsBySchedule.get(schedule.id) || [];
    const paidTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidTotal <= 0 && num(schedule.remainingAmount) <= 0.5) return; // settled, but no dates to judge by

    const paidByDue = payments
      .filter((payment) => payment.day <= due)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const onTimePaid = Math.min(paidByDue, owed);

    dueCount += 1;
    dueAmount += owed;
    onTimeAmount += onTimePaid;
    if (onTimePaid >= owed - 0.5) onTimeCount += 1;
  });

  return {
    creditDueCount90d: dueCount,
    creditOnTimeCount90d: onTimeCount,
    creditDueAmount90d: round2(dueAmount),
    creditOnTimeAmount90d: round2(onTimeAmount),
  };
}
