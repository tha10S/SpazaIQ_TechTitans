import test from 'node:test';
import assert from 'node:assert/strict';
import creditPolicy from '../functions/creditPolicy.js';

test('overdue policy applies one-time interest after the due date and blacklists at 60 days', () => {
  const policyAtDueDate = creditPolicy.getOverduePolicy({
    dueDate: '2026-01-01',
    balance: 100,
    now: new Date('2026-01-01T12:00:00.000Z'),
  });
  assert.deepEqual(policyAtDueDate, { overdueDays: 0, applyInterest: false, blacklist: false });

  const policyAfterDueDate = creditPolicy.getOverduePolicy({
    dueDate: '2026-01-01',
    balance: 100,
    now: new Date('2026-01-02T00:00:00.000Z'),
  });
  assert.equal(policyAfterDueDate.applyInterest, true);
  assert.equal(policyAfterDueDate.blacklist, false);

  const policyAtBlacklistThreshold = creditPolicy.getOverduePolicy({
    dueDate: '2026-01-01',
    balance: 100,
    interestAppliedAt: '2026-01-02T00:00:00.000Z',
    now: new Date('2026-03-02T00:00:00.000Z'),
  });
  assert.equal(policyAtBlacklistThreshold.overdueDays, 60);
  assert.equal(policyAtBlacklistThreshold.applyInterest, false);
  assert.equal(policyAtBlacklistThreshold.blacklist, true);
});

test('overdue policy leaves settled balances unchanged and rounds 5% interest to cents', () => {
  const settledPolicy = creditPolicy.getOverduePolicy({
    dueDate: '2026-01-01',
    balance: 0,
    now: new Date('2026-03-02T00:00:00.000Z'),
  });
  assert.deepEqual(settledPolicy, { overdueDays: 0, applyInterest: false, blacklist: false });
  assert.equal(creditPolicy.calculateOverdueInterest(10.11), 0.51);
});
