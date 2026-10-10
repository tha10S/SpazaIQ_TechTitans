import { fetchSpazaIQData } from './assistantDataService.js';
import { INTENT_CATALOG, INTENT_KEYWORDS } from './intentCatalog.js';

const money = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectIntent(message) {
  const text = normalizeText(message);

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text) || /\b(how are you|who are you|what can you do)\b/.test(text)) {
    return { intent: 'GREETING', confidence: 0.95, matches: 1 };
  }

  if (/\b(best sales|best products|best selling|best-selling|top products|top sellers|most sales|sells the most|top 5)\b/.test(text)) {
    return { intent: 'TOP_SELLERS', confidence: 0.98, matches: 1 };
  }

  if (/\b(owes me the most|owes the most|largest balance|highest balance|who owes me money|who owes me the most)\b/.test(text)) {
    return { intent: 'LARGEST_BALANCE', confidence: 0.97, matches: 1 };
  }

  if (/\b(who are|list|which|name)\b/.test(text) && /\bsuppliers?\b/.test(text)) {
    return { intent: 'SUPPLIER_LIST', confidence: 0.96, matches: 1 };
  }

  if (/\b(where are|where can i find|open|go to|show me)\b/.test(text) && /\b(insights?|dashboard)\b/.test(text)) {
    return { intent: 'APP_HELP', confidence: 0.94, matches: 1 };
  }

  if (/\binsights?\b/.test(text)) {
    return { intent: 'BUSINESS_PERFORMANCE', confidence: 0.9, matches: 1 };
  }

  if (/\b(check|show|review|look at|see|summari[sz]e)\b/.test(text) && /\b(history|records|transactions)\b/.test(text)) {
    return { intent: 'BUSINESS_PERFORMANCE', confidence: 0.86, matches: 1 };
  }

  if (/\b(how do i|how can i|where do i|how to|can i|can you help me|please help me)\b/.test(text) && /\b(app|screen|scan|barcode|qr|add|create|record|sale|sell|customer|product|stock|credit|payment|supplier|reorder|report|insight)\b/.test(text)) {
    return { intent: 'APP_HELP', confidence: 0.9, matches: 1 };
  }

  if (/\b(advice|advise|suggest|recommend|help me|stand out|attract customers|grow)\b/.test(text)) {
    return { intent: 'BUSINESS_ADVICE', confidence: 0.84, matches: 1 };
  }

  if (/\b(what can i do|what should i do|how can i improve|how can i grow|i need help|can you help me|please help|i want to)\b/.test(text)) {
    return { intent: 'BUSINESS_ADVICE', confidence: 0.8, matches: 1 };
  }

  if (/\b(sales?|revenue|turnover|income|takings|sold|made)\b/.test(text) && /\b(today|this day|for today|so far today)\b/.test(text)) {
    return { intent: 'SALES_SUMMARY', confidence: 0.9, matches: 1 };
  }

  if (/\b(sales?|revenue|turnover|income|takings|sold|made)\b/.test(text) && /\b(currently|numbers?|amount|total|where are|how much|figure)\b/.test(text)) {
    return { intent: 'SALES_SUMMARY', confidence: 0.88, matches: 1 };
  }

  let best = { intent: 'BUSINESS_ADVICE', confidence: 0.25, matches: 0 };

  for (const [intent, phrases] of Object.entries(INTENT_KEYWORDS)) {
    const matches = phrases.filter((phrase) => text.includes(phrase)).length;
    if (matches > 0 && matches > best.matches) {
      best = { intent, confidence: Math.min(0.98, 0.55 + matches * 0.12), matches };
    }
  }

  return best;
}

function positiveBalances(data) {
  return data.customers
    .map((customer) => {
      const balance = (data.creditTransactions ?? [])
        .filter((transaction) => transaction.customer_id === customer.id)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const dueDates = (data.creditTransactions ?? [])
        .filter((transaction) => transaction.customer_id === customer.id && Number(transaction.amount) > 0 && transaction.due_date)
        .map((transaction) => new Date(transaction.due_date));
      return { ...customer, balance, dueDate: dueDates.sort((a, b) => a - b)[0] };
    })
    .filter((customer) => customer.balance > 0);
}

function salesTotal(sales) {
  return sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
}

function productSales(data) {
  const totals = new Map();
  for (const item of data.saleItems ?? []) {
    const productId = item.product_id || item.id;
    if (!productId) continue;
    const current = totals.get(productId) || {
      id: productId,
      name: item.name || item.products?.name || `Product ${productId}`,
      quantity: 0,
      revenue: 0,
    };
    const quantity = Number(item.qty ?? item.quantity ?? 0);
    current.quantity += quantity;
    current.revenue += quantity * Number(item.unitPrice ?? item.unit_price ?? 0);
    totals.set(productId, current);
  }
  return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
}

function inventoryRecords(data) {
  const records = Array.isArray(data.inventory) ? data.inventory : data.products;
  if (!Array.isArray(records) || !records.length) return [];
  return records.filter((product) => Number.isFinite(Number(product.quantity ?? product.stockQuantity)));
}

function lowStockRecords(data) {
  return inventoryRecords(data)
    .map((product) => ({
      ...product,
      quantity: Number(product.quantity ?? product.stockQuantity ?? 0),
      reorderLevel: Number(product.reorder_level ?? product.reorderLevel ?? 0),
    }))
    .filter((product) => product.quantity <= product.reorderLevel)
    .sort((a, b) => a.quantity - b.quantity);
}

function findProductMention(question, products) {
  const text = normalizeText(question);
  const exactMatch = products.find((product) => {
    const name = normalizeText(product.name);
    return name.length > 3 && text.includes(name);
  });
  if (exactMatch) return exactMatch;

  const ignored = new Set(['what', 'which', 'how', 'much', 'many', 'price', 'cost', 'stock', 'have', 'sell', 'selling', 'product', 'products', 'the', 'for', 'of', 'do', 'i', 'in', 'is', 'my', 'on', 'me', 'we', 'our']);
  const words = text.split(' ').filter((word) => word.length > 2 && !ignored.has(word));
  if (!words.length) return null;

  const ranked = products.map((product) => {
    const productWords = normalizeText(product.name).split(' ').filter((word) => word.length > 2);
    const matches = words.filter((word) => productWords.some((productWord) => productWord.includes(word) || word.includes(productWord)));
    return { product, matches: new Set(matches).size, productWordCount: productWords.length };
  }).sort((a, b) => b.matches - a.matches);

  return ranked[0]?.matches >= Math.min(2, ranked[0]?.productWordCount || 2) ? ranked[0].product : null;
}

function appHelpResponse(question) {
  const text = normalizeText(question);
  const asksHowTo = /\b(how do i|how can i|where do i|where can i|where are|where can i find|how to|how does|open|go to|navigate to|which screen|can i add|can i create|can i record|can you help me|please help me)\b/.test(text);
  if (!asksHowTo) return null;

  if (/\b(scan|barcode|qr code)\b/.test(text)) return 'To scan a product, open Stock and tap the scan icon beside the search bar. You can also add or edit products from Stock Management.';
  if (/\b(add|create|new)\b/.test(text) && /\b(product|item|stock)\b/.test(text)) return 'Open Stock Management, then tap the + button to add a product. Enter its name, selling price, cost price, quantity, and reorder level, then save.';
  if (/\b(add|create|new)\b/.test(text) && /\b(customer|client)\b/.test(text)) return 'Open Credit from the bottom navigation and tap Add Customer. Save the customer details, then select them to record credit or a payment.';
  if (/\b(sale|sell|checkout|pos|purchase)\b/.test(text)) return 'Open Sell from the bottom navigation to start a sale. Add products to the cart, review the total, choose the payment method, and complete the sale.';
  if (/\b(credit|payment|repay|repayment)\b/.test(text)) return 'Open Credit from the bottom navigation. Select a customer to record credit, or use Make Payment on an account to record a repayment.';
  if (/\b(supplier|reorder|order)\b/.test(text)) return 'Open Suppliers from the bottom navigation to view the supplier and order screens. Supplier prices and purchase history are not connected to the assistant’s store data yet.';
  if (/\b(report|insights?|dashboard|performance)\b/.test(text)) return 'Open Home for today’s dashboard, or Insights from the bottom navigation for business summaries. You can also ask me for sales, stock, and credit figures.';
  return null;
}

function profitForSales(sales, products) {
  const costs = new Map(products.map((product) => [String(product.id), Number(product.cost_price ?? product.costPrice)]));
  let total = 0;
  let itemCount = 0;
  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      const productId = item.product_id ?? item.productId ?? item.id;
      const cost = Number(item.cost_price ?? item.costPrice ?? costs.get(String(productId)));
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      const sellingPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
      if (!Number.isFinite(cost) || !Number.isFinite(sellingPrice) || quantity <= 0) continue;
      total += (sellingPrice - cost) * quantity;
      itemCount += 1;
    }
  }
  return { total, itemCount };
}

function productProfitTotals(sales, products) {
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const totals = new Map();
  for (const sale of sales) {
    for (const item of sale.items ?? []) {
      const productId = item.product_id ?? item.productId ?? item.id;
      const product = productsById.get(String(productId));
      const cost = Number(item.cost_price ?? item.costPrice ?? product?.cost_price ?? product?.costPrice);
      const unitPrice = Number(item.unitPrice ?? item.unit_price ?? product?.unit_price ?? product?.unitPrice);
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      if (!product || !Number.isFinite(cost) || !Number.isFinite(unitPrice) || quantity <= 0) continue;
      const current = totals.get(String(productId)) ?? { name: product.name, profit: 0, revenue: 0 };
      current.profit += (unitPrice - cost) * quantity;
      current.revenue += unitPrice * quantity;
      totals.set(String(productId), current);
    }
  }
  return [...totals.values()].map((product) => ({
    ...product,
    margin: product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0,
  }));
}

function salesForPeriod(sales, question, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const text = normalizeText(question);
  let end = new Date(start);

  if (text.includes('month')) {
    start.setDate(1);
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
  } else if (text.includes('week')) {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    end.setDate(end.getDate() + 1);
  }

  return sales.filter((sale) => {
    const timestamp = sale.created_at ?? sale.createdAt;
    if (!timestamp) return false;
    const createdAt = new Date(timestamp);
    return createdAt >= start && createdAt < end;
  });
}

function findCatalogExample(intent) {
  return INTENT_CATALOG.find((example) => example.intent === intent);
}

function buildBusinessSummary(data) {
  const customers = positiveBalances(data);
  const topProducts = productSales(data).slice(0, 3);
  const totalSales = salesTotal(data.sales ?? []);
  const outstanding = customers.reduce((sum, customer) => sum + customer.balance, 0);
  const topCustomer = [...customers].sort((a, b) => b.balance - a.balance)[0];

  return {
    totalSales,
    outstanding,
    totalCustomers: customers.length,
    totalProducts: data.products?.length ?? 0,
    topCustomer,
    topProducts,
  };
}

function generateGeneralResponse(data, question) {
  const summary = buildBusinessSummary(data);
  const text = normalizeText(question);

  if (/\b(what can you do|what are you|who are you|your purpose)\b/.test(text)) {
    return 'I’m SpazaIQ, your shop assistant. I can summarize recorded sales, rank best sellers, check customer balances, review stock and reorder levels, and guide you through app tasks. I’ll tell you when the required data is not connected.';
  }

  if (/\b(how are you|how are things)\b/.test(text)) {
    return `Hi! I’m sharp and ready to help. Right now your shop has ${summary.totalProducts ?? 0} tracked products, ${summary.totalSales ? money(summary.totalSales) : 'no recorded sales yet'}, and ${summary.totalCustomers} customer balances to follow up.`;
  }

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text)) {
    const greeting = summary.topCustomer
      ? `Your biggest outstanding balance is ${summary.topCustomer.name} at ${money(summary.topCustomer.balance)}.`
      : 'There are no overdue customer balances in the current data.';

    const productLine = summary.topProducts.length
      ? `Your strongest mover is ${summary.topProducts[0].name}.`
      : 'I need a little more sales history to identify your strongest product.';

    return `Hi! I’m SpazaIQ, ready to help your shop run smarter. ${productLine} ${greeting}`;
  }

  return 'That question is not related to the SpazaIQ business records and app guidance I was assigned to answer. I can help with recorded sales, stock, customer credit, product performance, business advice, and using the app. Try asking “How much did I sell today?”, “What stock is running low?”, or “Who owes me the most?”';
}

function generateAnswer(intent, data, question) {
  const balances = positiveBalances(data);
  const totalOutstanding = balances.reduce((sum, customer) => sum + customer.balance, 0);
  const products = data.products ?? [];
  const inventory = inventoryRecords(data);
  const lowStock = lowStockRecords(data);
  const helpResponse = appHelpResponse(question);
  const mentionedProduct = findProductMention(question, products);

  if (helpResponse) return helpResponse;

  if (mentionedProduct && /\b(price|cost|how much|in stock|stock|quantity|how many)\b/.test(normalizeText(question))) {
    if (/\b(price|cost|how much)\b/.test(normalizeText(question))) {
      const price = Number(mentionedProduct.unit_price ?? mentionedProduct.unitPrice);
      return Number.isFinite(price) && price > 0
        ? `${mentionedProduct.name} is priced at ${money(price)}.`
        : `I don’t have a selling price recorded for ${mentionedProduct.name}.`;
    }
    const stockRecord = inventory.find((product) => product.id === mentionedProduct.id);
    if (stockRecord) return `${mentionedProduct.name} has ${Number(stockRecord.quantity ?? stockRecord.stockQuantity ?? 0)} units recorded in stock.`;
    return `I can identify ${mentionedProduct.name}, but its stock quantity is not connected to the assistant yet.`;
  }

  if (intent === 'APP_HELP') {
    return helpResponse || 'Tell me what you are trying to do—such as record a sale, scan a product, add a customer, or check credit—and I’ll point you to the right screen.';
  }

  if (intent === 'GREETING') {
    return generateGeneralResponse(data, question);
  }

  if (intent === 'CUSTOMER_BALANCES') {
    if (!balances.length) return 'There are no outstanding customer balances in the connected data.';
    const names = balances.slice(0, 5).map((customer) => `${customer.name} (${money(customer.balance)})`).join(', ');
    return `${balances.length} customer${balances.length === 1 ? '' : 's'} owe you ${money(totalOutstanding)}. ${names}.`;
  }

  if (intent === 'LARGEST_BALANCE') {
    const largest = [...balances].sort((a, b) => b.balance - a.balance)[0];
    return largest ? `${largest.name} has the largest balance at ${money(largest.balance)}.` : 'There are no outstanding customer balances in the connected data.';
  }

  if (intent === 'SUPPLIER_LIST') {
    const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
    if (!suppliers.length) return 'No supplier records are available in the connected Suppliers & Orders data.';
    return `Your recorded suppliers are: ${suppliers.map((supplier) => `${supplier.name} (${supplier.category || 'General'}; ${supplier.phone || 'phone not recorded'})`).join('; ')}.`;
  }

  if (intent === 'OVERDUE_CREDIT') {
    const now = new Date();
    const overdue = balances.filter((customer) => customer.dueDate && customer.dueDate < now);
    if (!overdue.length) return 'There are no overdue balances in the connected data.';
    return `${overdue.length} account${overdue.length === 1 ? '' : 's'} may need a reminder: ${overdue.map((customer) => `${customer.name} (${money(customer.balance)})`).join(', ')}.`;
  }

  if (intent === 'CREDIT_GIVEN') {
    const month = new Date().toISOString().slice(0, 7);
    const total = (data.creditTransactions ?? [])
      .filter((transaction) => Number(transaction.amount) > 0 && String(transaction.created_at || '').slice(0, 7) === month)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    return total ? `You gave ${money(total)} in credit this month.` : 'I do not have enough dated credit transaction data for this month.';
  }

  if (intent === 'SALES_SUMMARY') {
    const sales = salesForPeriod(data.sales, question);
    const period = normalizeText(question).includes('month') ? 'this month' : normalizeText(question).includes('week') ? 'this week' : 'today';
    if (sales.length) return `For ${period}, you recorded ${sales.length} sale${sales.length === 1 ? '' : 's'} totalling ${money(salesTotal(sales))}.`;
    if (period === 'today') {
      const monthSales = salesForPeriod(data.sales, 'this month');
      return monthSales.length
        ? `No sales have been recorded today yet. Month-to-date, you have ${money(salesTotal(monthSales))} across ${monthSales.length} sales.`
        : 'No sales have been recorded today or so far this month.';
    }
    return `No sales have been recorded ${period} yet.`;
  }

  if (intent === 'INVENTORY_SUMMARY') {
    if (!inventory.length) return 'Stock quantities are not available in the assistant’s connected store data yet. Open Stock Management to review the product list.';
    const totalUnits = inventory.reduce((sum, product) => sum + Number(product.quantity ?? product.stockQuantity ?? 0), 0);
    const outOfStock = inventory.filter((product) => Number(product.quantity ?? product.stockQuantity ?? 0) <= 0).length;
    return `There are ${inventory.length} products with ${totalUnits} units recorded in stock. ${lowStock.length} ${lowStock.length === 1 ? 'product is' : 'products are'} at or below their reorder levels, including ${outOfStock} out of stock.`;
  }

  if (intent === 'LOW_STOCK' || intent === 'RESTOCK_RECOMMENDATION') {
    if (!inventory.length) return 'I can’t identify low stock because this store has no connected stock quantities yet. Open Stock Management to enter quantities and reorder levels.';
    if (!lowStock.length) return 'No products are at or below their recorded reorder levels right now.';
    const list = lowStock.slice(0, 5).map((product) => `${product.name} (${product.quantity} left; reorder level ${product.reorderLevel})`).join('; ');
    return `${intent === 'LOW_STOCK' ? 'Low-stock items' : 'Restock priorities'}: ${list}${lowStock.length > 5 ? `; and ${lowStock.length - 5} more` : ''}.`;
  }

  if (intent === 'SALES_TREND') {
    const now = new Date();
    const thisWeek = salesForPeriod(data.sales ?? [], 'this week', now);
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() || 7) - 1));
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeek = (data.sales ?? []).filter((sale) => {
      if (!sale.created_at) return false;
      const createdAt = new Date(sale.created_at);
      return createdAt >= previousWeekStart && createdAt < currentWeekStart;
    });
    if (!thisWeek.length || !previousWeek.length) return 'I need recorded sales in both this week and last week before I can say whether sales are increasing or decreasing.';
    const currentTotal = salesTotal(thisWeek);
    const previousTotal = salesTotal(previousWeek);
    if (previousTotal === 0) return `Sales this week total ${money(currentTotal)}. Last week had no sales to compare against.`;
    const change = ((currentTotal - previousTotal) / previousTotal) * 100;
    return `Sales this week are ${money(currentTotal)} versus ${money(previousTotal)} last week, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%.`;
  }

  if (intent === 'BUSIEST_DAYS') {
    const totalsByDay = new Map();
    for (const sale of data.sales ?? []) {
      if (!sale.created_at) continue;
      const day = new Date(sale.created_at).toLocaleDateString('en-ZA', { weekday: 'long' });
      totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + Number(sale.total ?? 0));
    }
    const busiest = [...totalsByDay].sort((a, b) => b[1] - a[1])[0];
    return busiest ? `${busiest[0]} has the highest recorded sales total so far, at ${money(busiest[1])}. This is based on ${(data.sales ?? []).length} available sales.` : 'I need dated sales records before I can compare your busiest days.';
  }

  if (intent === 'PROFIT_SUMMARY') {
    const requestedSales = salesForPeriod(data.sales ?? [], question);
    const profit = profitForSales(requestedSales, products);
    if (!profit.itemCount) return 'I can’t calculate profit yet because cost prices for sold items are not available in the connected records.';
    const period = normalizeText(question).includes('week') ? ' this week' : normalizeText(question).includes('month') ? ' this month' : ' today';
    return `Recorded gross profit${period} is ${money(profit.total)} from ${profit.itemCount} sold line items. This excludes expenses and supplier payments.`;
  }

  if (intent === 'TOP_PROFIT') {
    const rankings = productProfitTotals(data.sales ?? [], products).sort((a, b) => b.profit - a.profit).slice(0, 5);
    return rankings.length
      ? `Highest gross profit by product: ${rankings.map((product) => `${product.name} (${money(product.profit)})`).join('; ')}. This excludes expenses and supplier payments.`
      : 'I can’t rank product profit yet because cost prices for sold products are not available in the connected records.';
  }

  if (intent === 'PROFIT_MARGIN') {
    const margins = products
      .map((product) => {
        const price = Number(product.unit_price ?? product.unitPrice);
        const cost = Number(product.cost_price ?? product.costPrice);
        return { name: product.name, margin: price > 0 && Number.isFinite(cost) ? ((price - cost) / price) * 100 : null };
      })
      .filter((product) => product.margin !== null);
    if (!margins.length) return 'Cost and selling prices are not both recorded, so I can’t calculate product profit margins yet.';
    if (/\b(not profitable|negative margin|loss)\b/.test(normalizeText(question))) {
      const unprofitable = margins.filter((product) => product.margin <= 0);
      return unprofitable.length
        ? `Products with no positive gross margin: ${unprofitable.map((product) => product.name).join(', ')}.`
        : 'All products with recorded cost and selling prices have a positive gross margin.';
    }
    const ranked = margins.sort((a, b) => b.margin - a.margin).slice(0, 5);
    return `Highest recorded gross margins: ${ranked.map((product) => `${product.name} (${product.margin.toFixed(1)}%)`).join('; ')}. These figures exclude expenses.`;
  }

  if (intent === 'OVERSTOCK') return 'Maximum stock targets are not recorded, so I can’t reliably label items overstocked. You can review quantities and reorder levels in Stock Management.';
  if (intent === 'EXPIRY_TRACKING') return 'Expiry dates are not part of the connected product records yet, so I can’t identify items close to expiry.';
  if (intent === 'CASH_FLOW') return 'I can summarize sales, but business expenses and supplier payments are not connected to the assistant. I can’t calculate net cash flow without those records.';
  if (intent === 'SUPPLIER_COMPARISON') return 'Supplier contacts are visible in Suppliers & Orders, but supplier price comparisons are not connected to the assistant’s store data yet.';
  if (intent === 'DEMAND_FORECAST') return 'I need a longer history of dated sales before making a reliable demand forecast. I won’t invent a forecast from too little data.';
  if (intent === 'STOCK_SHRINKAGE') return 'Stock movement and adjustment history are not connected, so I can’t determine whether stock is missing.';
  if (intent === 'RESTOCK_QUANTITY') return inventory.length
    ? 'I can show which products are below reorder level, but I need reliable demand history to estimate order quantities.'
    : 'I need recorded stock quantities and reorder levels before I can recommend order quantities.';

  if (intent === 'TOP_SELLERS' || intent === 'BOTTOM_SELLERS') {
    const sellers = productSales(data);
    if (!sellers.length) return 'I do not have enough product-level sales data yet to answer that.';
    const ranked = intent === 'TOP_SELLERS' ? sellers.slice(0, 5) : [...sellers].reverse().slice(0, 5);
    const label = intent === 'TOP_SELLERS' ? 'Top sellers' : 'Lowest-selling products';
    return `${label}: ${ranked.map((product) => `${product.name} (${product.quantity} sold, ${money(product.revenue)})`).join('; ')}.`;
  }

  if (intent === 'BUSINESS_PERFORMANCE') {
    const sales = salesForPeriod(data.sales ?? [], 'today');
    const creditLine = balances.length ? `Outstanding credit is ${money(totalOutstanding)} across ${balances.length} customers.` : 'There are no outstanding customer balances.';
    const lowStockLine = inventory.length
      ? lowStock.length ? `${lowStock.length} products are at or below reorder level.` : 'No products are below their reorder level.'
      : 'Stock quantities are not connected.';
    const monthSales = salesForPeriod(data.sales ?? [], 'this month');
    return `Today: ${money(salesTotal(sales))} across ${sales.length} sales. Month to date: ${money(salesTotal(monthSales))}. ${creditLine} ${lowStockLine}`;
  }

  if (intent === 'BUSINESS_ADVICE') {
    if (/\b(stand out|market|attract|grow|customer)\b/.test(normalizeText(question))) {
      const stockAction = lowStock.length
        ? `Keep the ${lowStock.slice(0, 3).map((product) => product.name).join(', ')} stocked because they are at or below the reorder level.`
        : 'Keep your essential products and popular sellers consistently in stock.';
      return `To stand out in your market, use SpazaIQ to keep reliable prices, maintain stock on everyday essentials, and record every sale so you can identify what customers buy most. ${stockAction} Build repeat business by serving customers quickly, tracking credit responsibly, and using the sales and stock insights to make weekly improvements.`;
    }
    const actions = [];
    if (balances.length) actions.push(`follow up on ${balances.length} customer balance${balances.length === 1 ? '' : 's'} in Credit`);
    if ((data.sales ?? []).length === 0) actions.push('record each sale in Sell so the assistant can measure trends and identify your best sellers');
    if (!inventory.length) actions.push('enter stock quantities and reorder levels to get restock alerts');
    else if (lowStock.length) {
      const priority = lowStock.slice(0, 3).map((product) => `${product.name} (${product.quantity} left; reorder level ${product.reorderLevel})`).join(', ');
      actions.push(`open Stock Management and review ${priority}`);
    }
    return actions.length ? `Based on the data available, start with this plan: ${actions.join('. Then ')}.` : 'I need more connected business data before making recommendations.';
  }

  const catalogExample = findCatalogExample(intent);
  return catalogExample?.exampleResponse || generateGeneralResponse(data, question);
}

export async function answerSpazaIQQuestion({ message, storeId }) {
  const question = String(message || '').trim();
  if (!question) throw new Error('Enter a question first.');

  const detected = detectIntent(question);
  const staticResponse = detected.intent === 'APP_HELP' ? appHelpResponse(question) : null;
  if (staticResponse) {
    return {
      intent: detected.intent,
      response: staticResponse,
      dataUsed: [],
      confidence: detected.confidence,
    };
  }

  const data = await fetchSpazaIQData(storeId);
  const response = detected.matches === 0
    ? generateGeneralResponse(data, question)
    : generateAnswer(detected.intent, data, question);
  const catalogExample = findCatalogExample(detected.intent);

  return {
    intent: detected.intent,
    response,
    dataUsed: catalogExample?.requiredData ?? [],
    confidence: detected.confidence,
  };
}
