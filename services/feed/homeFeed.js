// Builds the "Shop news" items shown on Home from live store data.
// Pure functions with no Firebase imports, so the chatbot can reuse them later.
//
// Each item: { id, severity: 'danger' | 'warning' | 'info', icon, title, detail, target }
// `target` is the tab the item opens when tapped.

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2 };

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Weeks start on Monday, same as the Insights screen.
function startOfWeek(date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

// 'YYYY-MM-DD' is read as a local date. new Date('YYYY-MM-DD') would be UTC and can shift a day.
function parseDay(value) {
  if (!value) return null;
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from, to) {
  return Math.round((to - from) / DAY_MS);
}

function formatRand(value) {
  return `R ${Number(value || 0).toFixed(2)}`;
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

function summarise(names, max = 3) {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} and ${names.length - max} more` : shown;
}

function inRange(sale, start, end) {
  const date = sale.createdAt ? new Date(sale.createdAt) : null;
  return Boolean(date) && !Number.isNaN(date.getTime()) && date >= start && date < end;
}

// Same revenue, profit and item maths as the Insights screen.
function summariseSales(sales) {
  const totals = new Map();
  let revenue = 0;
  let profit = 0;
  let itemsSold = 0;

  sales.forEach((sale) => {
    revenue += Number(sale.total || 0);
    (sale.items || []).forEach((item) => {
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      const name = item.name || item.productName || 'Product';
      const key = item.id || name;
      const entry = totals.get(key) || { name, sold: 0 };
      entry.sold += quantity;
      totals.set(key, entry);
      itemsSold += quantity;

      const cost = Number(item.costPrice ?? item.cost_price);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      if (Number.isFinite(cost) && Number.isFinite(unitPrice)) {
        profit += (unitPrice - cost) * quantity;
      }
    });
  });

  const top = [...totals.values()].sort((a, b) => b.sold - a.sold);
  return { revenue, profit, itemsSold, top };
}

export function buildHomeFeed({ products = [], customers = [], sales = [], now = new Date() } = {}) {
  const today = startOfDay(now);
  const items = [];

  // ---- Stock: out of stock and running low ----
  const outOfStock = products.filter((product) => product.quantity <= 0);
  const lowStock = products.filter(
    (product) => product.quantity > 0 && product.quantity <= product.reorder_level
  );

  if (outOfStock.length) {
    items.push({
      id: 'out-of-stock',
      severity: 'danger',
      icon: 'close-circle',
      title: `${outOfStock.length} ${plural(outOfStock.length, 'item is', 'items are')} out of stock`,
      detail: summarise(outOfStock.map((product) => product.name)),
      target: 'Stock',
    });
  }

  if (lowStock.length) {
    items.push({
      id: 'low-stock',
      severity: 'warning',
      icon: 'alert-circle',
      title: `${lowStock.length} ${plural(lowStock.length, 'item is', 'items are')} running low`,
      detail: summarise(lowStock.map((product) => `${product.name} (${product.quantity} left)`)),
      target: 'Stock',
    });
  }

  // ---- Stock: expiry ----
  const expired = [];
  const expiringSoon = [];
  products.forEach((product) => {
    const batches = Array.isArray(product.stock_batches)
      ? product.stock_batches
      : [{ quantity: product.quantity, expiry_date: product.expiry_date }];
    batches.forEach((batch) => {
      const expiry = parseDay(batch.expiry_date);
      if (!expiry || Number(batch.quantity) <= 0) return;
      const daysLeft = daysBetween(today, expiry);
      const trackedBatch = { ...product, quantity: Number(batch.quantity), daysLeft };
      if (daysLeft < 0) expired.push(trackedBatch);
      else if (daysLeft <= 7) expiringSoon.push(trackedBatch);
    });
  });

  if (expired.length) {
    items.push({
      id: 'expired',
      severity: 'danger',
      icon: 'time',
      title: `${expired.length} ${plural(expired.length, 'stock batch is', 'stock batches are')} past the expiry date`,
      detail: summarise(expired.map((product) => `${product.name} (${product.quantity} units)`)),
      target: 'Stock',
    });
  }

  if (expiringSoon.length) {
    items.push({
      id: 'expiring-soon',
      severity: 'warning',
      icon: 'time-outline',
      title: `${expiringSoon.length} ${plural(expiringSoon.length, 'stock batch expires', 'stock batches expire')} within 7 days`,
      detail: summarise(
        expiringSoon
          .sort((a, b) => a.daysLeft - b.daysLeft)
          .map((product) => `${product.name} (${product.quantity} units, ${product.daysLeft === 0 ? 'today' : `${product.daysLeft}d`})`)
      ),
      target: 'Stock',
    });
  }

  // ---- Credit: who owes and is overdue or due this week ----
  const owing = customers.filter((customer) => Number(customer.balance) > 0);
  const overdue = owing.filter((customer) => customer.overdue);
  const dueThisWeek = owing.filter((customer) => {
    if (customer.overdue) return false;
    const due = parseDay(customer.nextDueDate);
    if (!due) return false;
    const days = daysBetween(today, due);
    return days >= 0 && days <= 7;
  });
  const owes = (customer) => `${customer.name} (${formatRand(customer.balance)})`;

  if (overdue.length) {
    items.push({
      id: 'overdue-credit',
      severity: 'danger',
      icon: 'cash',
      title: `${overdue.length} ${plural(overdue.length, 'customer is', 'customers are')} overdue on credit`,
      detail: summarise(overdue.map(owes)),
      target: 'Credit',
    });
  }

  if (dueThisWeek.length) {
    items.push({
      id: 'credit-due-this-week',
      severity: 'warning',
      icon: 'calendar',
      title: `${dueThisWeek.length} ${plural(dueThisWeek.length, 'customer is', 'customers are')} due to pay this week`,
      detail: summarise(dueThisWeek.map(owes)),
      target: 'Credit',
    });
  }

  // ---- Insights: this week so far, and what is selling ----
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  // Compare against the same stretch of last week, so Monday isn't judged against a full week.
  const lastWeekSameSpanEnd = new Date(lastWeekStart.getTime() + (now - weekStart));

  const thisWeek = summariseSales(sales.filter((sale) => inRange(sale, weekStart, weekEnd)));
  const lastWeek = summariseSales(sales.filter((sale) => inRange(sale, lastWeekStart, lastWeekSameSpanEnd)));

  if (thisWeek.revenue > 0 || thisWeek.itemsSold > 0) {
    let detail = `${formatRand(thisWeek.profit)} profit from ${thisWeek.itemsSold} ${plural(thisWeek.itemsSold, 'item', 'items')} sold.`;
    if (lastWeek.revenue > 0) {
      const change = Math.round(((thisWeek.revenue - lastWeek.revenue) / lastWeek.revenue) * 100);
      detail += change === 0
        ? ' Level with the same days last week.'
        : ` ${Math.abs(change)}% ${change > 0 ? 'up' : 'down'} on the same days last week.`;
    }
    items.push({
      id: 'week-summary',
      severity: 'info',
      icon: 'stats-chart',
      title: `${formatRand(thisWeek.revenue)} in sales this week`,
      detail,
      target: 'Insights',
    });
  }

  const popular = thisWeek.top.filter((product) => product.sold > 0).slice(0, 3);
  if (popular.length) {
    items.push({
      id: 'popular-this-week',
      severity: 'info',
      icon: 'trending-up',
      title: 'Popular this week',
      detail: popular.map((product) => `${product.name} (${product.sold} sold)`).join(', '),
      target: 'Insights',
    });
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// How many items need action (red or amber). Drives the badge on the Home news button.
export function countNeedsAttention(items) {
  return items.filter((item) => item.severity !== 'info').length;
}