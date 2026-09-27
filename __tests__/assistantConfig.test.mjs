import test from 'node:test';
import assert from 'node:assert/strict';

const { hasSharedChatbotApiKey, SHARED_CHATBOT_API_KEY } = await import('../services/assistant/apiConfig.js');
const { answerSpazaIQQuestion } = await import('../services/assistant/assistantService.js');
const { getState, resetMockData } = await import('../services/mock/mockData.js');

test('shared chatbot api config exposes one central key source', () => {
  assert.ok(typeof SHARED_CHATBOT_API_KEY === 'string');
  assert.ok(typeof hasSharedChatbotApiKey === 'function');
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
