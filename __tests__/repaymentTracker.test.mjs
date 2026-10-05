import test from 'node:test';
import assert from 'node:assert/strict';

const { buildRepaymentTracker } = await import('../services/repaymentTracker.js');

test('repayment tracker calculates monthly collection, paid amounts, and schedule status', () => {
  const tracker = buildRepaymentTracker([
    { id: 'c1', name: 'Amina', balance: 600 },
    { id: 'c2', name: 'Sizwe', balance: 0 },
  ], [
    { id: 's1', customerId: 'c1', totalAmount: 1200, remainingAmount: 600, durationMonths: 6, frequency: 'monthly', dueDate: '2026-10-20', status: 'active' },
  ], [
    { id: 'l1', customerId: 'c1', type: 'credit', amount: 1200, createdAt: '2026-09-01T10:00:00.000Z' },
    { id: 'l2', customerId: 'c1', type: 'payment', amount: -600, paymentDate: '2026-10-02', scheduleAllocations: [{ scheduleId: 's1', amount: 600 }], createdAt: '2026-10-02T10:00:00.000Z' },
    { id: 'l3', customerId: 'c2', type: 'payment', amount: -125, paymentDate: '2026-09-30', createdAt: '2026-09-30T10:00:00.000Z' },
  ], new Date('2026-10-04T12:00:00.000Z'));

  assert.equal(tracker.monthlyCollection, 600);
  assert.equal(tracker.outstandingAmount, 600);
  assert.equal(tracker.totalCredit, 1200);
  assert.equal(tracker.customers[0].durationMonths, 6);
  assert.equal(tracker.customers[0].monthlyAmount, 200);
  assert.equal(tracker.customers[0].repaymentType, 'Monthly');
  assert.equal(tracker.customers[0].paymentsMade, 1);
  assert.equal(tracker.customers[0].periodsRemaining, 5);
  assert.equal(tracker.customers[0].paidAmount, 600);
  assert.equal(tracker.customers[0].status, 'In progress');
  assert.equal(tracker.customers[1].status, 'Cleared');
});

test('repayment tracker marks customers behind when an active schedule is overdue', () => {
  const tracker = buildRepaymentTracker([
    { id: 'c1', name: 'Amina', balance: 200 },
  ], [
    { id: 's1', customerId: 'c1', totalAmount: 500, durationMonths: 5, frequency: 'monthly', dueDate: '2026-09-20', status: 'active' },
  ], [], new Date('2026-10-04T12:00:00.000Z'));

  assert.equal(tracker.customers[0].status, 'Behind');
  assert.equal(tracker.customers[0].paidAmount, 300);
});

test('repayment tracker exposes weekly periods and one-time repayment type', () => {
  const tracker = buildRepaymentTracker([
    { id: 'c1', name: 'Amina', balance: 300 },
    { id: 'c2', name: 'Sizwe', balance: 250 },
  ], [
    { id: 'weekly', customerId: 'c1', totalAmount: 500, remainingAmount: 300, durationWeeks: 5, totalPayments: 5, installmentAmount: 100, frequency: 'weekly', status: 'active' },
    { id: 'once', customerId: 'c2', totalAmount: 250, remainingAmount: 250, frequency: 'one_time', status: 'active' },
  ], [
    { id: 'p1', customerId: 'c1', type: 'payment', amount: -100, scheduleAllocations: [{ scheduleId: 'weekly', amount: 100 }] },
    { id: 'p2', customerId: 'c1', type: 'payment', amount: -100, scheduleAllocations: [{ scheduleId: 'weekly', amount: 100 }] },
  ], new Date('2026-10-04T12:00:00.000Z'));

  assert.equal(tracker.customers[0].repaymentType, 'Weekly');
  assert.equal(tracker.customers[0].weeklyAmount, 100);
  assert.equal(tracker.customers[0].paymentsMade, 2);
  assert.equal(tracker.customers[0].periodsRemaining, 3);
  assert.equal(tracker.customers[1].repaymentType, 'Once');
  assert.equal(tracker.customers[1].periodUnit, 'payment');
  assert.equal(tracker.customers[1].periodsRemaining, 1);
});

test('repayment tracker leaves type unset when historical customer has no schedule', () => {
  const tracker = buildRepaymentTracker([
    { id: 'c1', name: 'Amina', balance: 100 },
  ], [], [], new Date('2026-10-04T12:00:00.000Z'));

  assert.equal(tracker.customers[0].repaymentType, 'Not set');
});