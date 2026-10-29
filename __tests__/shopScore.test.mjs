import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildShopStats, computeCreditBehaviour } from '../services/admin/shopStats.js';
import { diagnose, scoreShop, WEIGHTS, TIER_LIMITS } from '../services/admin/performance.js';

// Saturday 24 October 2026, 14:00. Everything below is measured from this moment.
const NOW = new Date(2026, 9, 24, 14, 0, 0);
const at = (daysAgo, hour = 11) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, hour, 0, 0);
const ymd = (daysAgo) => {
  const date = at(daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// A small repeatable random number generator, so the fixtures never change between runs
function random(seed) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function products(count, { cost = 15, price = 20, qty = 30, reorder = 6, out = 0, low = 0, batches = null } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const quantity = index < out ? 0 : index < out + low ? Math.max(1, reorder - 1) : qty;
    const stockBatches = batches ? batches(index, quantity) : [];
    return {
      id: `p${index}`, name: `Product ${index}`, quantity, reorder_level: reorder,
      cost_price: cost, unit_price: price, stock_batches: stockBatches, expiry_date: stockBatches[0]?.expiry_date || '',
    };
  });
}

function sales({ days, perDay, basket, margin = 0.2, productCount = 20, seed = 1, creditShare = 0 }) {
  const next = random(seed);
  const list = [];
  days.forEach((ago) => {
    const count = Math.max(1, Math.round(perDay * (0.85 + next() * 0.3)));
    for (let k = 0; k < count; k += 1) {
      const total = Math.round(basket * (0.7 + next() * 0.6));
      const productIndex = Math.floor(next() * productCount);
      const qty = Math.max(1, Math.round(total / 22));
      const unitPrice = total / qty;
      list.push({
        id: `s${ago}-${k}`, createdAt: at(ago, 8 + Math.floor(next() * 11)), total,
        creditAmount: next() < creditShare ? total : 0,
        items: [{ id: `p${productIndex}`, name: `Product ${productIndex}`, qty, unitPrice, costPrice: unitPrice * (1 - margin) }],
      });
    }
  });
  return list;
}

// Each item: { due: days ago the credit fell due, owed, paidDaysAgo: when it was paid (null = not paid), paid }
function repayments(items) {
  const schedules = [];
  const ledgerEntries = [];
  items.forEach((item, index) => {
    const paid = item.paid ?? (item.paidDaysAgo === null ? 0 : item.owed);
    schedules.push({
      id: `sch${index}`, dueDate: ymd(item.due), totalAmount: item.owed,
      remainingAmount: Math.max(0, item.owed - paid), status: paid >= item.owed ? 'paid' : 'active',
    });
    if (paid > 0) {
      ledgerEntries.push({
        id: `pay${index}`, type: 'payment', amount: -paid, paymentDate: ymd(item.paidDaysAgo),
        scheduleAllocations: [{ scheduleId: `sch${index}`, amount: paid }],
      });
    }
  });
  return { schedules, ledgerEntries };
}

const fresh = (index, quantity) => [{ quantity, expiry_date: `2026-11-${String(10 + (index % 15)).padStart(2, '0')}` }];
const stats = (options) => buildShopStats({ now: NOW, ...options });
const score = (shopStats) => scoreShop(shopStats, { now: NOW });

// ---- Example shops ----
const strong = () => stats({
  products: products(60, { cost: 16, price: 21, qty: 22, reorder: 5, out: 1, low: 3, batches: fresh }),
  sales: [
    ...sales({ days: range(0, 29).filter((d) => d % 8 !== 7), perDay: 38, basket: 80, margin: 0.23, seed: 11, creditShare: 0.12 }),
    ...sales({ days: range(30, 59).filter((d) => d % 8 !== 7), perDay: 35, basket: 78, margin: 0.23, seed: 12, creditShare: 0.12 }),
    ...sales({ days: range(60, 89).filter((d) => d % 8 !== 7), perDay: 32, basket: 75, margin: 0.23, seed: 13 }),
  ],
  customers: [{ balance: 450 }, { balance: 300 }, { balance: 200, overdue: true, overdueBalance: 200 }],
  repayments: repayments([
    ...Array.from({ length: 11 }, (_, i) => ({ due: 8 + i * 6, owed: 300, paidDaysAgo: 9 + i * 6 })),
    { due: 12, owed: 400, paidDaysAgo: 3 },
  ]),
});
const typical = () => stats({
  products: products(28, { cost: 15, price: 19, qty: 14, reorder: 5, out: 2, low: 5 }),
  sales: [
    ...sales({ days: range(0, 29).filter((d) => d % 10 > 2 || d % 7 === 0).slice(0, 21), perDay: 22, basket: 62, margin: 0.17, seed: 21, creditShare: 0.2 }),
    ...sales({ days: range(30, 59).filter((d) => d % 10 > 2).slice(0, 21), perDay: 22, basket: 62, margin: 0.17, seed: 22, creditShare: 0.2 }),
  ],
  customers: [{ balance: 600, overdue: true, overdueBalance: 600 }, { balance: 400 }, { balance: 250 }],
  repayments: repayments([
    { due: 10, owed: 300, paidDaysAgo: 12 }, { due: 20, owed: 250, paidDaysAgo: 22 }, { due: 35, owed: 400, paidDaysAgo: 30 },
    { due: 40, owed: 300, paidDaysAgo: 42 }, { due: 50, owed: 350, paidDaysAgo: 49 }, { due: 14, owed: 600, paid: 0, paidDaysAgo: null },
  ]),
});
const weak = () => stats({
  products: products(12, { cost: 18, price: 19.5, qty: 40, reorder: 6, out: 4, low: 1, batches: (i, q) => [{ quantity: q, expiry_date: i < 6 ? '2026-10-01' : '2026-10-27' }] }),
  sales: [
    ...sales({ days: [70], perDay: 1, basket: 100, margin: 0.06, seed: 30, productCount: 5 }), // started a while ago
    ...sales({ days: [1, 3, 4, 8, 9, 11, 12, 13], perDay: 7, basket: 100, margin: 0.06, seed: 31, productCount: 5, creditShare: 0.5 }),
  ],
  customers: [{ balance: 900, overdue: true, overdueBalance: 900 }, { balance: 300, overdue: true, overdueBalance: 300 }],
  repayments: repayments([
    { due: 10, owed: 500, paid: 0, paidDaysAgo: null }, { due: 20, owed: 400, paidDaysAgo: 5 }, { due: 30, owed: 300, paid: 0, paidDaysAgo: null },
    { due: 40, owed: 200, paidDaysAgo: 20 }, { due: 5, owed: 400, paid: 0, paidDaysAgo: null },
  ]),
});
const newShop = () => stats({
  products: products(20, { cost: 15, price: 20, qty: 20, reorder: 4 }),
  sales: sales({ days: range(0, 9), perDay: 20, basket: 70, margin: 0.2, seed: 41 }),
});
const cashOnly = () => stats({
  products: products(60, { cost: 16, price: 21, qty: 22, reorder: 5, out: 1, low: 3, batches: fresh }),
  sales: [
    ...sales({ days: range(0, 29).filter((d) => d % 8 !== 7), perDay: 38, basket: 80, margin: 0.23, seed: 51 }),
    ...sales({ days: range(30, 59).filter((d) => d % 8 !== 7), perDay: 35, basket: 78, margin: 0.23, seed: 52 }),
  ],
});

// ---------------- Statistics ----------------

test('a 30-day window is 30 calendar days, so trading days never exceed 30', () => {
  const result = stats({ sales: sales({ days: range(0, 44), perDay: 2, basket: 50, seed: 3 }) });
  assert.equal(result.activeDays30d, 30);
  assert.ok(result.revenue30d > 0 && result.revenuePrev30d > 0);
});

test('weekly revenue is split into four rolling 7-day weeks ending today', () => {
  const list = [
    { id: 'a', createdAt: at(0), total: 100, items: [] }, { id: 'b', createdAt: at(6), total: 50, items: [] },
    { id: 'c', createdAt: at(7), total: 200, items: [] }, { id: 'd', createdAt: at(14), total: 300, items: [] },
    { id: 'e', createdAt: at(21), total: 400, items: [] }, { id: 'f', createdAt: at(28), total: 999, items: [] },
  ];
  const result = stats({ sales: list });
  assert.equal(result.weekRevenue1, 150);
  assert.equal(result.weekRevenue2, 200);
  assert.equal(result.weekRevenue3, 300);
  assert.equal(result.weekRevenue4, 400);
});

test('expired and expiring stock is valued at cost, and only stock with a date counts as tracked', () => {
  const list = [
    { id: 'p1', name: 'Milk', quantity: 10, reorder_level: 2, cost_price: 20, stock_batches: [{ quantity: 4, expiry_date: ymd(2) }, { quantity: 6, expiry_date: ymd(-3) }] },
    { id: 'p2', name: 'Bread', quantity: 5, reorder_level: 2, cost_price: 10, stock_batches: [{ quantity: 5, expiry_date: ymd(-30) }] },
    { id: 'p3', name: 'Rice', quantity: 10, reorder_level: 2, cost_price: 30, stock_batches: [] },
  ];
  const result = stats({ products: list });
  assert.equal(result.expiredCount, 4);
  assert.equal(result.expiredValue, 80);
  assert.equal(result.expiringSoonCount, 6);
  assert.equal(result.expiringSoonValue, 120);
  assert.equal(result.stockCostValue, 200 + 50 + 300);
  assert.equal(result.expiryTrackedShare, Math.round((250 / 550) * 10000) / 10000);
});

test('a stock-out on a best seller counts for much more than one on a product that never sells', () => {
  const list = products(4, { qty: 10 });
  list[0].quantity = 0; // best seller out
  const saleList = [
    { id: 's1', createdAt: at(1), total: 900, items: [{ id: 'p0', name: 'Product 0', qty: 9, unitPrice: 100, costPrice: 80 }] },
    { id: 's2', createdAt: at(2), total: 100, items: [{ id: 'p1', name: 'Product 1', qty: 1, unitPrice: 100, costPrice: 80 }] },
  ];
  assert.equal(stats({ products: list, sales: saleList }).stockGapSalesShare, 0.9);
  const slow = products(4, { qty: 10 });
  slow[3].quantity = 0; // a product that did not sell is out
  assert.equal(stats({ products: slow, sales: saleList }).stockGapSalesShare, 0);
});

// ---------------- Credit paid on time ----------------

test('credit is "on time" only when payments on or before the due date cover what was owed', () => {
  const result = computeCreditBehaviour({
    now: NOW,
    ...repayments([
      { due: 10, owed: 100, paidDaysAgo: 12 }, // paid 2 days early
      { due: 10, owed: 100, paidDaysAgo: 10 }, // paid on the due date
      { due: 10, owed: 100, paidDaysAgo: 4 }, // paid 6 days late
      { due: 10, owed: 100, paid: 0, paidDaysAgo: null }, // never paid
      { due: 10, owed: 100, paid: 60, paidDaysAgo: 12 }, // 60 paid in time, the rest never
      { due: -5, owed: 100, paid: 0, paidDaysAgo: null }, // not due yet, ignored
      { due: 200, owed: 100, paidDaysAgo: 201 }, // too long ago, ignored
    ]),
  });
  assert.equal(result.creditDueCount90d, 5);
  assert.equal(result.creditOnTimeCount90d, 2);
  assert.equal(result.creditDueAmount90d, 500);
  assert.equal(result.creditOnTimeAmount90d, 260);
});

test('a credit that was settled but has no payment record is left out instead of guessed', () => {
  const result = computeCreditBehaviour({
    now: NOW,
    schedules: [{ id: 'x', dueDate: ymd(10), totalAmount: 100, remainingAmount: 0, status: 'paid' }],
    ledgerEntries: [],
  });
  assert.equal(result.creditDueCount90d, 0);
});

// ---------------- Scoring ----------------

test('the twelve weights add up to exactly 100', () => {
  assert.equal(Math.round(Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0) * 1000) / 1000, 1);
  assert.equal(Object.keys(WEIGHTS).length, 12);
});

test('a strong, steady, well-run shop is High, a typical one Mid and a struggling one Low', () => {
  const a = score(strong());
  const b = score(typical());
  const c = score(weak());
  assert.equal(a.tier, 'high');
  assert.ok(a.score >= 80, `strong shop scored ${a.score}`);
  assert.equal(b.tier, 'mid');
  assert.ok(b.score >= TIER_LIMITS.mid + 5 && b.score < TIER_LIMITS.high, `typical shop scored ${b.score}`);
  assert.equal(c.tier, 'low');
  assert.ok(c.score < TIER_LIMITS.mid - 5, `weak shop scored ${c.score}`);
  assert.ok(a.score > b.score && b.score > c.score);
});

test('every part is between 0 and 1, or null when it does not apply, and the used weights add to 1', () => {
  [strong(), typical(), weak(), newShop(), cashOnly()].forEach((shop) => {
    const result = score(shop);
    Object.entries(result.parts).forEach(([key, value]) => {
      assert.ok(value === null || (value >= 0 && value <= 1), `${key} = ${value}`);
    });
    assert.ok(Math.abs(Object.values(result.weights).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-9);
  });
});

test('a shop that never gives credit is not marked down or up for it: the credit parts are left out', () => {
  const result = score(cashOnly());
  assert.equal(result.parts.collection, null);
  assert.equal(result.parts.overdue, null);
  assert.equal(result.parts.dependence, null);
  assert.equal(result.tier, 'high');
  assert.ok(result.score >= 85);
});

test('a brand-new shop is judged cautiously and cannot be High yet', () => {
  const result = score(newShop());
  assert.notEqual(result.tier, 'high');
  assert.equal(result.confidence, 'building');
  assert.equal(result.parts.growth, null); // no earlier month to compare with
  assert.equal(result.parts.steadiness, null); // fewer than two complete weeks
  assert.equal(result.parts.expiry, null); // no expiry dates entered
  assert.equal(result.parts.collection, null); // no credit yet
  const fiveDays = score(stats({
    products: products(20, { qty: 20 }),
    sales: sales({ days: range(0, 4), perDay: 20, basket: 70, seed: 42 }),
  }));
  assert.equal(fiveDays.parts.cover, null); // under a week of history is too little to judge stock level
});

test('a shop with no sales is always Low, however full its shelves are', () => {
  const result = score(stats({ products: products(40, { qty: 30 }) }));
  assert.equal(result.tier, 'low');
  assert.ok(result.score < TIER_LIMITS.mid);
});

test('revenue alone cannot make a shop High: it also needs history, trading days and steady weeks', () => {
  // R200,000 in 5 days, nothing before that
  const burst = stats({
    products: products(30, { qty: 30 }),
    sales: sales({ days: range(0, 4), perDay: 60, basket: 700, seed: 61 }),
  });
  const result = score(burst);
  assert.notEqual(result.tier, 'high');
  assert.ok(result.score < TIER_LIMITS.high);
});

test('each problem lowers the score: expired stock, late payers, overdue credit and stock-outs', () => {
  const base = strong();
  const baseScore = score(base).score;
  const worse = (changes) => score({ ...base, ...changes }).score;
  assert.ok(worse({ expiredValue: 1500, expiredCount: 80 }) < baseScore, 'expired stock');
  assert.ok(worse({ creditOnTimeCount90d: 3, creditOnTimeAmount90d: 900 }) < baseScore, 'late payers');
  assert.ok(worse({ creditOverdue: 900, creditOutstanding: 950 }) < baseScore, 'overdue credit');
  assert.ok(worse({ outOfStockCount: 20, stockGapSalesShare: 0.5 }) < baseScore, 'stock-outs');
  assert.ok(worse({ weekRevenue1: 60000, weekRevenue2: 1000, weekRevenue3: 55000, weekRevenue4: 500 }) < baseScore, 'uneven weeks');
});

test('too much stock and too little stock both score worse than a healthy amount', () => {
  const base = strong();
  const healthy = score(base).parts.cover;
  const heavy = score({ ...base, stockCostValue: base.stockCostValue * 12 }).parts.cover;
  const empty = score({ ...base, stockCostValue: base.stockCostValue / 40 }).parts.cover;
  assert.ok(heavy < healthy && empty < healthy, `empty ${empty}, healthy ${healthy}, heavy ${heavy}`);
});

test('scoring is deterministic and the shop and the admin screen get the same number', () => {
  const shop = typical();
  assert.equal(score(shop).score, score({ ...shop }).score);
  assert.equal(JSON.stringify(score(shop).parts), JSON.stringify(score(shop).parts));
});

test('the diagnosis names the new causes and strengths', () => {
  const bad = diagnose(score(weak()));
  const ids = bad.causes.map((cause) => cause.id);
  assert.ok(ids.includes('expired-stock'));
  assert.ok(ids.includes('stock-gaps'));
  assert.ok(ids.includes('credit-overdue'));
  assert.ok(ids.includes('thin-margin'));
  assert.equal(bad.causes[0].severity, 'danger'); // most serious first
  const good = diagnose(score(strong()));
  const strengthIds = good.strengths.map((item) => item.id);
  assert.ok(strengthIds.includes('pays-on-time'));
  assert.ok(strengthIds.includes('fresh-stock'));
  assert.ok(strengthIds.includes('consistent'));
});

// ---------------- Publishing ----------------

test('every total the app publishes is accepted by firestore.rules, and no rule field is left unused', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const publisher = readFileSync(new URL('../services/admin/shopStatsPublisher.js', import.meta.url), 'utf8');
  const allowedBlock = rules.match(/function validShopStats[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/)[1];
  const allowed = new Set([...allowedBlock.matchAll(/'(\w+)'/g)].map((match) => match[1]));
  const payload = publisher.slice(publisher.indexOf('await setDoc('), publisher.indexOf('{ merge: true }'));
  const sent = new Set([...payload.matchAll(/^\s+(\w+)(?::|,\s*$)/gm)].map((match) => match[1]));
  const refused = [...sent].filter((key) => !allowed.has(key));
  assert.deepEqual(refused, [], `the rules would refuse: ${refused.join(', ')}`);
  const unused = [...allowed].filter((key) => !sent.has(key));
  assert.deepEqual(unused, [], `allowed but never sent: ${unused.join(', ')}`);
});
