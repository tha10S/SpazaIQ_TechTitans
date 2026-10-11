import test from 'node:test';
import assert from 'node:assert/strict';

const { answerSpazaIQQuestion } = await import('../services/assistant/assistantService.js');
const { fetchSpazaIQData } = await import('../services/assistant/assistantDataService.js');
const { getState, resetMockData } = await import('../services/mock/mockData.js');

test('assistant answers app guidance offline without a database or store id', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'How do I record a sale?',
  });

  assert.equal(result.intent, 'APP_HELP');
  assert.match(result.response, /Open Sell/);
  assert.doesNotMatch(result.response, /\n/);
});

test('assistant data service provides the local shop dataset without a store id', async () => {
  const data = await fetchSpazaIQData();

  assert.ok(data.products.length > 0);
  assert.ok(data.sales.length > 0);
  assert.ok(data.customers.length > 0);
});

test('assistant replies naturally to a greeting instead of generic fallback text', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'Hi there, how are you?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response.toLowerCase(), /spazaiq|hello|hey|hi/);
  assert.doesNotMatch(result.response.toLowerCase(), /i do not have enough connected data/i);
});

test('assistant summarises a natural history request from available store data', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'Please check my history',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'BUSINESS_PERFORMANCE');
  assert.match(result.response, /Today:/);
  assert.match(result.response, /Month to date:/);
  assert.doesNotMatch(result.response, /couldn’t match that question/i);
});

test('assistant gives practical advice for an unsupported market-growth wording', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'Please advise me on how to stand out on the market',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'BUSINESS_ADVICE');
  assert.match(result.response, /stand out|market|customers/i);
  assert.doesNotMatch(result.response, /couldn’t match that question/i);
});

test('assistant understands first-person business advice wording', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'What can I do to improve my business?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'BUSINESS_ADVICE');
  assert.match(result.response, /Based on the data available|stand out|sales|stock/i);
  assert.match(result.response, /Credit|reorder/i);
  assert.doesNotMatch(result.response, /couldn’t match that question/i);
});

test('assistant answers a real credit question with live mock data', async () => {
  const state = await getState();
  state.sales = [];
  state.creditTransactions = [
    { customer_id: 'c1', amount: 450, due_date: '2026-08-28' },
    { customer_id: 'c2', amount: 820, due_date: '2026-08-15' },
    { customer_id: 'c3', amount: 1200, due_date: '2026-08-10' },
  ];

  const result = await answerSpazaIQQuestion({
    message: 'Who owes me the most?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response.toLowerCase(), /john|moyo|r\s*1,200|r1,200|1200/);
});

test('assistant lists suppliers shown in the local Suppliers and Orders screen', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'Who are my suppliers?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SUPPLIER_LIST');
  assert.match(result.response, /Sizwe Wholesalers/);
  assert.match(result.response, /Cape Cold Drinks Co\./);
  assert.match(result.response, /Fresh Bake Distributors/);
});

test('assistant guides users to Insights when they ask where insights are', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'Where are my insights at?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'APP_HELP');
  assert.match(result.response, /Insights/i);
  assert.doesNotMatch(result.response, /not related to the SpazaIQ business records/i);
});

test('assistant summarises the business when asked for insights', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'Give me insights from my store',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'BUSINESS_PERFORMANCE');
  assert.match(result.response, /Today:|Month to date:/i);
});

test('assistant understands natural sales-today wording and gives a useful month-to-date fallback', async () => {
  await resetMockData();
  const state = await getState();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  state.sales = [{
    id: 'yesterday-sale',
    created_at: yesterday.toISOString(),
    total: 1015,
    items: [],
  }];

  const result = await answerSpazaIQQuestion({
    message: 'How much did I sell today?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SALES_SUMMARY');
  assert.match(result.response.toLowerCase(), /no sales have been recorded today/);
  assert.match(result.response, /1\s*015/);
  assert.doesNotMatch(result.response.toLowerCase(), /focus on/);
});

test('assistant includes a sale with the POS repository createdAt timestamp in today’s totals', async () => {
  await resetMockData();
  const state = await getState();
  state.sales = [{
    id: 'today-sale',
    createdAt: new Date().toISOString(),
    total: 125,
    items: [],
  }];

  const result = await answerSpazaIQQuestion({
    message: 'How much did I sell today?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SALES_SUMMARY');
  assert.match(result.response, /1 sale totalling R125/);
});

test('assistant understands sales wording with words between the topic and time period', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'What are my sales at for today?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SALES_SUMMARY');
  assert.match(result.response, /No sales have been recorded today|recorded .* sale/i);
  assert.doesNotMatch(result.response, /couldn’t match that question/i);
});

test('assistant recognises sales questions asking for current numbers', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'Where are my sales at currently in terms of numbers?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SALES_SUMMARY');
  assert.match(result.response, /sales|recorded|No sales/i);
  assert.doesNotMatch(result.response, /not related to the SpazaIQ business records/i);
});

test('assistant gives clear in-app guidance for recording a sale', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'How do I record a sale?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response, /Open Sell/);
  assert.match(result.response, /payment method/);
});

test('assistant reports low stock from quantities and reorder levels', async () => {
  await resetMockData();
  const state = await getState();
  state.products = [
    { id: 'p-low', name: 'Low Stock Bread', quantity: 2, reorder_level: 5 },
    { id: 'p-ok', name: 'Available Milk', quantity: 8, reorder_level: 3 },
  ];

  const result = await answerSpazaIQQuestion({
    message: 'What products are running low?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'LOW_STOCK');
  assert.match(result.response, /Low Stock Bread \(2 left; reorder level 5\)/);
  assert.doesNotMatch(result.response, /Available Milk/);
});

test('assistant does not claim it can see demo stock quantities that are not recorded', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'What stock is running low?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response, /no connected stock quantities/i);
  assert.match(result.response, /Stock Management/);
});

test('assistant gives a useful prompt when it cannot match a question', async () => {
  const result = await answerSpazaIQQuestion({
    message: 'Can the app make me a cup of tea?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response, /not related to the SpazaIQ business records/i);
  assert.match(result.response, /How much did I sell today/);
});
