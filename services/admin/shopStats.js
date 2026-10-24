// Turns a shop's own products, sales and customers into shop-level TOTALS.
// Only these totals are ever sent to the admin area. No customer name, phone number or individual
// sale leaves the shop's own data. Pure function, no Firebase imports.
import { toDate } from './billing';

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (value) => Math.round(num(value) * 100) / 100;
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function buildShopStats({ products = [], sales = [], customers = [], now = new Date() } = {}) {
  const start30 = new Date(now.getTime() - 30 * DAY_MS);
  const start60 = new Date(now.getTime() - 60 * DAY_MS);

  let revenue30d = 0;
  let revenuePrev30d = 0;
  let profit30d = 0;
  let salesCount30d = 0;
  let itemsSold30d = 0;
  let creditSales30d = 0;
  let lastSaleAt = null;
  let firstSaleAt = null;
  const tradingDays = new Set();
  // Revenue for each of the last 4 weeks. weekRevenue[0] is the most recent 7 days.
  const weekRevenue = [0, 0, 0, 0];

  sales.forEach((sale) => {
    const date = toDate(sale.createdAt);
    if (!date) return;
    if (!lastSaleAt || date > lastSaleAt) lastSaleAt = date;
    if (!firstSaleAt || date < firstSaleAt) firstSaleAt = date;
    const total = num(sale.total);
    const weeksAgo = Math.floor((now - date) / (7 * DAY_MS));
    if (date <= now && weeksAgo >= 0 && weeksAgo < 4) weekRevenue[weeksAgo] += total;

    if (date >= start30 && date <= now) {
      revenue30d += total;
      salesCount30d += 1;
      creditSales30d += num(sale.creditAmount);
      tradingDays.add(dayKey(date));
      (sale.items || []).forEach((item) => {
        const quantity = num(item.qty ?? item.quantity);
        itemsSold30d += quantity;
        const cost = Number(item.costPrice ?? item.cost_price);
        const price = Number(item.unitPrice ?? item.unit_price ?? 0);
        if (Number.isFinite(cost) && Number.isFinite(price)) profit30d += (price - cost) * quantity;
      });
    } else if (date >= start60 && date < start30) {
      revenuePrev30d += total;
    }
  });

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let stockCostValue = 0;
  products.forEach((product) => {
    const quantity = num(product.quantity);
    const reorder = num(product.reorder_level ?? product.reorderLevel);
    if (quantity <= 0) outOfStockCount += 1;
    else if (quantity <= reorder) lowStockCount += 1;
    stockCostValue += Math.max(0, quantity) * num(product.cost_price ?? product.costPrice);
  });

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
    creditCustomers,
    creditOutstanding: round2(creditOutstanding),
    creditOverdue: round2(Math.min(creditOverdue, creditOutstanding)),
  };
}
