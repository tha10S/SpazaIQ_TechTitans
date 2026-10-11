// Rule-based shop advice from the weather forecast, today's date, and the shop's own stock,
// sales and credit. Pure functions with no Firebase imports, so Insights, Home and the
// chatbot can all use the same advice.
//
// Each item: { id, priority, severity: 'danger' | 'warning' | 'info', icon, title, detail,
//              target?, targetLabel? }
// `target` is the tab the item's button opens.

// ---- Things you may want to tune ----
export const PAYDAYS = [15, 25, 28];
// Assumption: grant money is spent in the first week of the month. SASSA's exact pay dates
// change from month to month, so adjust this window if you want it tighter.
export const GRANT_WEEK = { from: 1, to: 7 };
const COLD = { lowAtOrBelow: 8, highAtOrBelow: 15 }; // degrees C, over the next 3 days
const HOT_AT_OR_ABOVE = 30;
const RAIN_AT_OR_ABOVE = 60; // percent chance
const TREND_DAYS = 14; // "best sellers" look at this many days
const SLOW_STOCK_DAYS = 30;
const LOW_MARGIN = 0.1; // keeping under 10% of the price is thin
const MAX_ITEMS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function daysBetween(from, to) {
  return Math.round((to - from) / DAY_MS);
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

function formatRand(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function nameList(names, max = 3) {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} and ${names.length - max} more` : shown;
}

function dayLabel(dateString, now) {
  const date = parseDay(dateString);
  if (!date) return 'soon';
  const diff = daysBetween(startOfDay(now), date);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return date.toLocaleDateString('en-ZA', { weekday: 'long' });
}

function inDaysLabel(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// Lows, highs and rain over the next 3 days. Returns null when there is no forecast.
export function summariseWeather(weather, now = new Date()) {
  if (!weather?.days?.length) return null;
  const today = startOfDay(now);
  const upcoming = weather.days
    .filter((day) => {
      const date = parseDay(day.date);
      return date && date >= today && Number.isFinite(day.min) && Number.isFinite(day.max);
    })
    .slice(0, 3);
  if (!upcoming.length) return null;
  const wettest = upcoming.reduce((best, day) => (day.rainChance > best.rainChance ? day : best));
  return {
    days: upcoming.length,
    min: Math.min(...upcoming.map((day) => day.min)),
    max: Math.max(...upcoming.map((day) => day.max)),
    rain: wettest.rainChance,
    rainDate: wettest.date,
  };
}

function calendarContext(now) {
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const inGrantWeek = day >= GRANT_WEEK.from && day <= GRANT_WEEK.to;
  const daysToGrantWeek = day < GRANT_WEEK.from
    ? GRANT_WEEK.from - day
    : day > GRANT_WEEK.to
      ? daysInMonth - day + GRANT_WEEK.from
      : 0;

  let nextPayday = null;
  PAYDAYS.forEach((payday) => {
    const inDays = payday >= day ? payday - day : daysInMonth - day + PAYDAYS[0];
    if (!nextPayday || inDays < nextPayday.inDays) nextPayday = { day: payday, inDays };
  });

  const paidRecently = PAYDAYS
    .map((payday) => ({ day: payday, daysAgo: day - payday }))
    .find((payday) => payday.daysAgo >= 1 && payday.daysAgo <= 2) || null;

  return { inGrantWeek, daysToGrantWeek, nextPayday, paidRecently };
}

function soldItems(sales) {
  const totals = new Map();
  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const name = item.name || item.productName || 'Product';
      const key = item.id || name;
      const entry = totals.get(key) || { id: item.id, name, sold: 0 };
      entry.sold += Number(item.qty ?? item.quantity ?? 0);
      totals.set(key, entry);
    });
  });
  return [...totals.values()].sort((a, b) => b.sold - a.sold);
}

function findProduct(products, sold) {
  return products.find((product) => sold.id && product.id === sold.id)
    || products.find((product) => String(product.name).toLowerCase() === String(sold.name).toLowerCase());
}

function saleDate(sale) {
  const date = sale.createdAt ? new Date(sale.createdAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function buildShopAdvice({ now = new Date(), weather = null, products = [], sales = [], customers = [] } = {}) {
  const items = [];
  const weatherSummary = summariseWeather(weather, now);
  const calendar = calendarContext(now);

  const cold = Boolean(weatherSummary)
    && (weatherSummary.min <= COLD.lowAtOrBelow || weatherSummary.max <= COLD.highAtOrBelow);
  const hot = Boolean(weatherSummary) && weatherSummary.max >= HOT_AT_OR_ABOVE;
  const rainy = Boolean(weatherSummary) && weatherSummary.rain >= RAIN_AT_OR_ABOVE;
  const grantNow = calendar.inGrantWeek;
  const grantSoon = !grantNow && calendar.daysToGrantWeek <= 2;

  const owing = customers.filter((customer) => Number(customer.balance) > 0);
  const overdue = owing.filter((customer) => customer.overdue);

  // ---- Weather and date ----
  if (cold && (grantNow || grantSoon)) {
    items.push({
      id: 'cold-grant',
      priority: 90,
      severity: 'info',
      icon: 'snow',
      title: grantNow ? 'Cold weather in grant week' : `Cold weather, and grant week starts ${inDaysLabel(calendar.daysToGrantWeek)}`,
      detail: `Lows of ${weatherSummary.min}°C while grant money is being spent. Stock up on soup packs, vegetables, bread and bulk meat${grantSoon ? ', and order now so it arrives in time' : ''}.`,
      target: 'Suppliers',
      targetLabel: 'Order stock',
    });
  } else {
    if (cold) {
      items.push({
        id: 'cold',
        priority: 60,
        severity: 'info',
        icon: 'snow',
        title: 'Cold days ahead',
        detail: `Lows of ${weatherSummary.min}°C in the next ${weatherSummary.days} days. Soup packs, hot drinks, bread and vegetables sell faster in the cold.`,
        target: 'Suppliers',
        targetLabel: 'Order stock',
      });
    }
    if (grantNow || grantSoon) {
      items.push({
        id: 'grant',
        priority: 70,
        severity: 'info',
        icon: 'calendar',
        title: grantNow ? 'Grant week' : `Grant week starts ${inDaysLabel(calendar.daysToGrantWeek)}`,
        detail: `Grant money is spent in the first week of the month. Make sure maize meal, sugar, cooking oil, rice and tinned food are well stocked.${grantSoon ? ' Order now so stock arrives in time.' : ''}`,
        target: 'Suppliers',
        targetLabel: 'Order stock',
      });
    }
  }

  if (hot) {
    items.push({
      id: 'hot',
      priority: 60,
      severity: 'info',
      icon: 'sunny',
      title: 'Hot days ahead',
      detail: `Highs of ${weatherSummary.max}°C. Stock cold drinks, bottled water and ice.`,
      target: 'Suppliers',
      targetLabel: 'Order stock',
    });
  }

  if (rainy) {
    items.push({
      id: 'rain',
      priority: 40,
      severity: 'info',
      icon: 'rainy',
      title: `Rain likely ${dayLabel(weatherSummary.rainDate, now)}`,
      detail: `${weatherSummary.rain}% chance of rain. Expect fewer walk-in customers. Keep bread and milk in stock, and avoid over-ordering fresh produce.`,
    });
  }

  if (calendar.nextPayday && calendar.nextPayday.inDays <= 2) {
    const { day, inDays } = calendar.nextPayday;
    items.push({
      id: 'payday-soon',
      priority: 75,
      severity: 'info',
      icon: 'cash',
      title: inDays === 0 ? `Payday today (the ${day}th)` : `Payday is ${inDaysLabel(inDays)} (the ${day}th)`,
      detail: `People spend more right after payday. Stock staples, airtime and cold drinks.${owing.length ? ' It is also a good time to ask for credit payments.' : ''}`,
      target: owing.length ? 'Credit' : 'Suppliers',
      targetLabel: owing.length ? 'Send reminders' : 'Order stock',
    });
  }

  // ---- Credit ----
  if (overdue.length) {
    const total = overdue.reduce((sum, customer) => sum + Number(customer.overdueBalance || customer.balance || 0), 0);
    items.push({
      id: 'overdue-credit',
      priority: 85,
      severity: 'danger',
      icon: 'alert-circle',
      title: `${formatRand(total)} overdue from ${overdue.length} ${plural(overdue.length, 'customer', 'customers')}`,
      detail: `${nameList(overdue.map((customer) => customer.name))}. Remind them on WhatsApp before giving more credit.`,
      target: 'Credit',
      targetLabel: 'Send reminders',
    });
  } else if (calendar.paidRecently && owing.length) {
    items.push({
      id: 'payday-collect',
      priority: 80,
      severity: 'info',
      icon: 'cash',
      title: 'Payday just passed',
      detail: `Customers have cash now, and ${owing.length} ${plural(owing.length, 'customer still owes', 'customers still owe')} you. Send a reminder today.`,
      target: 'Credit',
      targetLabel: 'Send reminders',
    });
  }

  // ---- Sales and stock ----
  const recentStart = new Date(now.getTime() - TREND_DAYS * DAY_MS);
  const recentSales = sales.filter((sale) => {
    const date = saleDate(sale);
    return date && date >= recentStart && date <= now;
  });
  const topSellers = soldItems(recentSales).filter((entry) => entry.sold > 0).slice(0, 3);

  topSellers.forEach((entry, index) => {
    const product = findProduct(products, entry);
    if (!product) return;
    const seller = index === 0 ? 'your best seller' : `your #${index + 1} seller`;

    if (product.quantity <= 0) {
      items.push({
        id: `restock-${product.id}`,
        priority: 95,
        severity: 'danger',
        icon: 'close-circle',
        title: `${product.name} is out of stock`,
        detail: `It is ${seller} (${entry.sold} sold in ${TREND_DAYS} days). Reorder now so you don't lose sales.`,
        target: 'Suppliers',
        targetLabel: 'Reorder',
      });
    } else if (product.quantity <= product.reorder_level) {
      items.push({
        id: `restock-${product.id}`,
        priority: 88,
        severity: 'warning',
        icon: 'alert-circle',
        title: `${product.name} is running low`,
        detail: `Only ${product.quantity} left and it is ${seller} (${entry.sold} sold in ${TREND_DAYS} days). Reorder soon.`,
        target: 'Suppliers',
        targetLabel: 'Reorder',
      });
    }
  });

  const thin = topSellers
    .map((entry) => findProduct(products, entry))
    .find((product) => product && product.cost_price > 0 && product.unit_price > 0
      && (product.unit_price - product.cost_price) / product.unit_price < LOW_MARGIN);
  if (thin) {
    const belowCost = thin.unit_price < thin.cost_price;
    const margin = Math.round(((thin.unit_price - thin.cost_price) / thin.unit_price) * 100);
    items.push({
      id: `margin-${thin.id}`,
      priority: belowCost ? 92 : 50,
      severity: belowCost ? 'danger' : 'warning',
      icon: 'pricetag',
      title: belowCost ? `${thin.name} sells below cost` : `Thin margin on ${thin.name}`,
      detail: belowCost
        ? `It costs you ${formatRand(thin.cost_price)} but sells for ${formatRand(thin.unit_price)}, so every sale loses money. Raise the price.`
        : `It sells well, but you keep only ${margin}% of the price (${formatRand(thin.unit_price - thin.cost_price)} each). Check the price, or ask your supplier for a better one.`,
      target: 'Stock',
      targetLabel: 'Edit price',
    });
  }

  // Only judge slow stock once there is a month of sales history
  const saleDates = sales.map(saleDate).filter(Boolean);
  const firstSale = saleDates.length ? Math.min(...saleDates.map((date) => date.getTime())) : null;
  if (firstSale !== null && now.getTime() - firstSale >= SLOW_STOCK_DAYS * DAY_MS) {
    const slowStart = new Date(now.getTime() - SLOW_STOCK_DAYS * DAY_MS);
    const sold = soldItems(sales.filter((sale) => {
      const date = saleDate(sale);
      return date && date >= slowStart;
    }));
    const soldIds = new Set(sold.map((entry) => entry.id).filter(Boolean));
    const soldNames = new Set(sold.map((entry) => String(entry.name).toLowerCase()));
    const slow = products.filter((product) => product.quantity > 0
      && !soldIds.has(product.id)
      && !soldNames.has(String(product.name).toLowerCase()));
    if (slow.length) {
      const tiedUp = slow.reduce((sum, product) => sum + product.quantity * (product.cost_price || 0), 0);
      items.push({
        id: 'slow-stock',
        priority: 30,
        severity: 'warning',
        icon: 'hourglass',
        title: `${slow.length} ${plural(slow.length, 'product hasn\'t', 'products haven\'t')} sold in ${SLOW_STOCK_DAYS} days`,
        detail: `${nameList(slow.map((product) => product.name))}. About ${formatRand(tiedUp)} of stock is sitting on the shelf. Hold off reordering these.`,
        target: 'Stock',
        targetLabel: 'View stock',
      });
    }
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, MAX_ITEMS);
}