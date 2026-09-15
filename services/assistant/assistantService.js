import { fetchSpazaIQData } from './assistantDataService';
import { INTENT_CATALOG, INTENT_KEYWORDS } from './intentCatalog';

const money = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;

function detectIntent(message) {
  const text = message.toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();

  if (
    /\b(best sales|best products|best selling|best-selling|top products|top sellers|most sales|sells the most)\b/.test(text)
  ) {
    return { intent: 'TOP_SELLERS', confidence: 0.98, matches: 1 };
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
      const balance = data.creditTransactions
        .filter((transaction) => transaction.customer_id === customer.id)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      const dueDates = data.creditTransactions
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
    current.quantity += Number(item.qty || 0);
    current.revenue += Number(item.qty || 0) * Number(item.unitPrice ?? item.unit_price ?? 0);
    totals.set(productId, current);
  }
  return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
}

function salesForPeriod(sales, question) {
  const now = new Date();
  const start = new Date(now);
  const text = question.toLowerCase();

  if (text.includes('month')) {
    start.setDate(1);
  } else if (text.includes('week')) {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }

  const startDate = start.toISOString().slice(0, 10);
  return sales.filter((sale) => String(sale.created_at || '').slice(0, 10) >= startDate);
}

function findCatalogExample(intent) {
  return INTENT_CATALOG.find((example) => example.intent === intent);
}

function generateAnswer(intent, data, question) {
  const balances = positiveBalances(data);
  const totalOutstanding = balances.reduce((sum, customer) => sum + customer.balance, 0);

  if (intent === 'CUSTOMER_BALANCES') {
    if (!balances.length) return 'There are no outstanding customer balances in the connected data.';
    const names = balances.slice(0, 5).map((customer) => `${customer.name} (${money(customer.balance)})`).join(', ');
    return `${balances.length} customer${balances.length === 1 ? '' : 's'} owe you ${money(totalOutstanding)}. ${names}.`;
  }

  if (intent === 'LARGEST_BALANCE') {
    const largest = [...balances].sort((a, b) => b.balance - a.balance)[0];
    return largest ? `${largest.name} has the largest balance at ${money(largest.balance)}.` : 'There are no outstanding customer balances in the connected data.';
  }

  if (intent === 'OVERDUE_CREDIT') {
    const now = new Date();
    const overdue = balances.filter((customer) => customer.dueDate && customer.dueDate < now);
    if (!overdue.length) return 'There are no overdue balances in the connected data.';
    return `${overdue.length} account${overdue.length === 1 ? '' : 's'} may need a reminder: ${overdue.map((customer) => `${customer.name} (${money(customer.balance)})`).join(', ')}.`;
  }

  if (intent === 'CREDIT_GIVEN') {
    const month = new Date().toISOString().slice(0, 7);
    const total = data.creditTransactions
      .filter((transaction) => Number(transaction.amount) > 0 && String(transaction.created_at || '').slice(0, 7) === month)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    return total ? `You gave ${money(total)} in credit this month.` : 'I do not have enough dated credit transaction data for this month.';
  }

  if (intent === 'SALES_SUMMARY') {
    const sales = salesForPeriod(data.sales, question);
    const period = question.toLowerCase().includes('month') ? 'this month' : question.toLowerCase().includes('week') ? 'this week' : 'today';
    return sales.length ? `For ${period}, you recorded ${sales.length} sale${sales.length === 1 ? '' : 's'} totalling ${money(salesTotal(sales))}.` : 'I do not have enough sales data yet to answer that.';
  }

  if (intent === 'TOP_SELLERS' || intent === 'BOTTOM_SELLERS') {
    const sellers = productSales(data);
    if (!sellers.length) return 'I do not have enough product-level sales data yet to answer that.';
    const ranked = intent === 'TOP_SELLERS' ? sellers.slice(0, 5) : [...sellers].reverse().slice(0, 5);
    const label = intent === 'TOP_SELLERS' ? 'Top sellers' : 'Lowest-selling products';
    return `${label}: ${ranked.map((product) => `${product.name} (${product.quantity} sold, ${money(product.revenue)})`).join('; ')}.`;
  }

  if (intent === 'BUSINESS_PERFORMANCE') {
    const sales = salesForPeriod(data.sales, 'today');
    const creditLine = balances.length ? `Outstanding credit is ${money(totalOutstanding)} across ${balances.length} customers.` : 'There are no outstanding customer balances.';
    return sales.length ? `Today\'s sales are ${money(salesTotal(sales))} across ${sales.length} sales. ${creditLine}` : `I do not have enough sales data for a full performance summary. ${creditLine}`;
  }

  if (intent === 'BUSINESS_ADVICE') {
    const actions = [];
    if (balances.length) actions.push(`follow up on ${balances.length} customer balance${balances.length === 1 ? '' : 's'}`);
    if (data.sales.length === 0) actions.push('record sales consistently so trends can be measured');
    if (!data.inventory) actions.push('connect inventory levels to receive restock recommendations');
    return actions.length ? `Based on the data available, focus on: ${actions.join('; ')}.` : 'I need more connected business data before making recommendations.';
  }

  const catalogExample = findCatalogExample(intent);
  return catalogExample?.exampleResponse || 'I do not have enough connected data to answer that yet.';
}

function buildBusinessContext(data, userName, shopName) {
  const balances = positiveBalances(data);
  const totalOutstanding = balances.reduce((sum, customer) => sum + customer.balance, 0);
  const salesTotalValue = salesTotal(data.sales);
  const productNames = data.products.slice(0, 12).map((product) => product.name);

  return {
    shopName: shopName || "Thabo's Mini Mart",
    ownerName: userName || 'shop owner',
    currency: 'ZAR (South African rand)',
    recordedSales: { count: data.sales.length, total: salesTotalValue },
    recordedExpenses: data.expenses ? data.expenses : { available: false },
    recordedSupplierPayments: data.suppliers ? data.suppliers : { available: false },
    outstandingCredit: {
      customerCount: balances.length,
      total: totalOutstanding,
      customers: balances.map((customer) => ({ name: customer.name, balance: customer.balance, dueDate: customer.dueDate })),
    },
    productCount: data.products.length,
    sampleProducts: productNames,
    inventoryDataAvailable: Boolean(data.inventory),
    salesHistoryAvailable: data.sales.length > 0,
  };
}

export async function answerSpazaIQQuestion({ message, storeId, userName, shopName, image }) {
  const question = message.trim();
  if (!question) throw new Error('Enter a question first.');

  const data = await fetchSpazaIQData(storeId);
  const businessContext = buildBusinessContext(data, userName, shopName);
  const proxyUrl = (process.env.EXPO_PUBLIC_ASSISTANT_API_URL || '').trim();
  if (!proxyUrl) {
    throw new Error('The assistant service is not configured. Add EXPO_PUBLIC_ASSISTANT_API_URL to .env.');
  }

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      userName,
      shopName,
      businessContext,
      image: image?.base64 ? {
        mimeType: image.mimeType || 'image/jpeg',
        base64: image.base64,
      } : null,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'The AI assistant could not answer right now.');
  }

  const answer = payload.response?.trim();
  if (!answer) throw new Error('The AI assistant returned an empty answer.');

  return {
    intent: 'AI_ASSISTANT',
    response: answer,
    dataUsed: Object.keys(data),
    confidence: 1,
  };
}
