import test from 'node:test';
import assert from 'node:assert/strict';

const { answerSpazaIQQuestion } = await import('../services/assistant/assistantService.js');
const { getState, resetMockData } = await import('../services/mock/mockData.js');

test('assistant replies naturally to a greeting instead of generic fallback text', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'Hi there, how are you?',
    storeId: 'mock-store-1',
  });

  assert.match(result.response.toLowerCase(), /spazaiq|hello|hey|hi/);
  assert.doesNotMatch(result.response.toLowerCase(), /i do not have enough connected data/i);
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

test('assistant understands natural sales-today wording and gives a useful month-to-date fallback', async () => {
  await resetMockData();

  const result = await answerSpazaIQQuestion({
    message: 'How much did I sell today?',
    storeId: 'mock-store-1',
  });

  assert.equal(result.intent, 'SALES_SUMMARY');
  assert.match(result.response.toLowerCase(), /no sales have been recorded today/);
  assert.match(result.response, /1\s*015/);
  assert.doesNotMatch(result.response.toLowerCase(), /focus on/);
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

  assert.match(result.response, /couldn’t match that question/i);
  assert.match(result.response, /How much did I sell today/);
});
