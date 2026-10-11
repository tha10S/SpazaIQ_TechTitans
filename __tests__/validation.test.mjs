import test from 'node:test';
import assert from 'node:assert/strict';

const {
  isValidEmail,
  isValidIsoDate,
  normalizeEmail,
  normalizePhoneNumber,
  parseNonNegativeNumber,
  validateIsoDate,
} = await import('../services/validation.js');

test('email validation normalizes case and whitespace and rejects malformed addresses', () => {
  assert.equal(normalizeEmail('  Sipho@Example.com '), 'sipho@example.com');
  assert.equal(isValidEmail(' Sipho@Example.com '), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('missing-domain@'), false);
});

test('phone validation stores exactly ten digits while allowing common separators', () => {
  assert.equal(normalizePhoneNumber('082 123 4567'), '0821234567');
  assert.equal(normalizePhoneNumber('(082) 123-4567'), '0821234567');
  assert.throws(() => normalizePhoneNumber('821234567', { required: true }), /exactly 10 digits/);
  assert.throws(() => normalizePhoneNumber('+27821234567'), /exactly 10 digits/);
  assert.throws(() => normalizePhoneNumber('082ABC4567'), /only digits/);
});

test('ISO date validation rejects impossible dates and enforces date bounds', () => {
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2025-02-29'), false);
  assert.equal(isValidIsoDate('2025-13-01'), false);
  assert.throws(() => validateIsoDate('2025-02-30', 'due date'), /valid due date/);
  assert.throws(() => validateIsoDate('2026-01-01', 'due date', { min: '2026-02-01' }), /cannot be earlier/);
});

test('numeric validation rejects negative, malformed, and over-precision values', () => {
  assert.equal(parseNonNegativeNumber('12.50', 'price'), 12.5);
  assert.equal(parseNonNegativeNumber(0.1 + 0.2, 'total'), 0.3);
  assert.equal(parseNonNegativeNumber('12', 'quantity', { integer: true }), 12);
  assert.throws(() => parseNonNegativeNumber('-1', 'price'), /non-negative/);
  assert.throws(() => parseNonNegativeNumber('1.234', 'price'), /non-negative/);
  assert.throws(() => parseNonNegativeNumber('1.5', 'quantity', { integer: true }), /whole number/);
});
