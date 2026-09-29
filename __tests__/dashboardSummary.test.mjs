import test from 'node:test';
import assert from 'node:assert/strict';

const { buildDashboardSummary } = await import('../services/assistant/dashboardSummary.js');

test('dashboard summary uses current-month sales and ranks live credit and product data', () => {
  const summary = buildDashboardSummary({
    sales: [
      { created_at: '2026-09-26T10:00:00.000Z', total: 320, items: [] },
      { created_at: '2026-09-25T12:00:00.000Z', total: 410, items: [] },
      { created_at: '2026-08-31T12:00:00.000Z', total: 900, items: [] },
    ],
    saleItems: [
      { product_id: 'p1', name: 'Bread', qty: 4 },
      { product_id: 'p2', name: 'Milk', qty: 7 },
    ],
    customers: [
      { id: 'c1', name: 'Amina' },
      { id: 'c2', name: 'Sizwe' },
    ],
    creditTransactions: [
      { customer_id: 'c1', amount: 350 },
      { customer_id: 'c2', amount: 800 },
      { customer_id: 'c2', amount: -100 },
    ],
  }, new Date('2026-09-27T12:00:00.000Z'));

  assert.equal(summary.monthSalesTotal, 730);
  assert.equal(summary.monthSalesCount, 2);
  assert.equal(summary.outstandingCredit, 1050);
  assert.equal(summary.creditAccountCount, 2);
  assert.equal(summary.priorityCustomer.name, 'Sizwe');
  assert.equal(summary.priorityCustomer.balance, 700);
  assert.deepEqual(summary.bestSeller, { name: 'Milk', quantity: 7 });
});

test('dashboard summary handles empty store records without invented metrics', () => {
  const summary = buildDashboardSummary({ sales: [], saleItems: [], customers: [], creditTransactions: [] });

  assert.equal(summary.monthSalesTotal, 0);
  assert.equal(summary.monthSalesCount, 0);
  assert.equal(summary.outstandingCredit, 0);
  assert.equal(summary.creditAccountCount, 0);
  assert.equal(summary.priorityCustomer, null);
  assert.equal(summary.bestSeller, null);
});