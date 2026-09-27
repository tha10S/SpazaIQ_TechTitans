import { fetchSpazaIQData } from './assistantDataService.js';
import { SHARED_CHATBOT_API_KEY, hasSharedChatbotApiKey } from './apiConfig.js';
import { INTENT_CATALOG, INTENT_KEYWORDS } from './intentCatalog.js';

const money = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAssistantContext(data) {
  const products = (data.products ?? []).map((product) => ({
    name: product.name,
    price: Number(product.unit_price ?? product.unitPrice ?? 0),
  }));
  const sales = (data.sales ?? []).slice(-25).map((sale) => ({
    date: sale.created_at,
    total: Number(sale.total ?? 0),
    items: (sale.items ?? []).map((item) => ({
      name: item.name,
      quantity: Number(item.qty ?? item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0),
    })),
  }));
  const customers = (data.customers ?? []).map((customer) => {
    const balance = (data.creditTransactions ?? [])
      .filter((transaction) => transaction.customer_id === customer.id)
      .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0);
    return { name: customer.name, balance };
  });

  return JSON.stringify({
    products,
    recentSales: sales,
    customerBalances: customers,
    inventory: data.inventory ?? 'not connected',
    expenses: data.expenses ?? 'not connected',
    suppliers: data.suppliers ?? 'not connected',
  });
}

async function callSharedChatbotApi(question, data) {
  if (!hasSharedChatbotApiKey()) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SHARED_CHATBOT_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              `You are SpazaIQ, a helpful assistant for a South African spaza shop. Keep answers brief, practical, and grounded only in the app context below. If the context does not contain the requested data, say that it is not connected yet. Never invent sales, stock, prices, balances, or customer details. Context: ${buildAssistantContext(data)}`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.warn('Shared chatbot API failed, falling back to local assistant.', error);
    return null;
  }
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
    current.quantity += Number(item.qty || 0);
    current.revenue += Number(item.qty || 0) * Number(item.unitPrice ?? item.unit_price ?? 0);
    totals.set(productId, current);
  }
  return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
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
    if (!sale.created_at) return false;
    const createdAt = new Date(sale.created_at);
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
    topCustomer,
    topProducts,
  };
}

function generateGeneralResponse(data, question) {
  const summary = buildBusinessSummary(data);
  const text = normalizeText(question);

  if (/\b(what can you do|what are you|who are you|your purpose)\b/.test(text)) {
    return 'I am SpazaIQ, your retail operations assistant. I can track sales, identify your best sellers, highlight who owes money, flag overdue credit, and suggest what to restock next.';
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

  return `I can help with the numbers behind your shop. Right now, sales total ${money(summary.totalSales)}, outstanding credit is ${money(summary.outstanding)}, and the top product signal is ${summary.topProducts.length ? summary.topProducts[0].name : 'not available yet'}.`;
}

function generateAnswer(intent, data, question) {
  const balances = positiveBalances(data);
  const totalOutstanding = balances.reduce((sum, customer) => sum + customer.balance, 0);

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
    if ((data.sales ?? []).length === 0) actions.push('record sales consistently so trends can be measured');
    if (!data.inventory) actions.push('connect inventory levels to receive restock recommendations');
    return actions.length ? `Based on the data available, focus on: ${actions.join('; ')}.` : 'I need more connected business data before making recommendations.';
  }

  const catalogExample = findCatalogExample(intent);
  return catalogExample?.exampleResponse || generateGeneralResponse(data, question);
}

export async function answerSpazaIQQuestion({ message, storeId }) {
  const question = String(message || '').trim();
  if (!question) throw new Error('Enter a question first.');

  const data = await fetchSpazaIQData(storeId);
  const sharedResponse = await callSharedChatbotApi(question, data);
  if (sharedResponse) {
    return {
      intent: 'AI_ASSISTANT',
      response: sharedResponse,
      dataUsed: ['chatbot_api'],
      confidence: 0.96,
    };
  }

  const detected = detectIntent(question);
  const response = generateAnswer(detected.intent, data, question);
  const catalogExample = findCatalogExample(detected.intent);

  return {
    intent: detected.intent,
    response,
    dataUsed: catalogExample?.requiredData ?? [],
    confidence: detected.confidence,
  };
}
