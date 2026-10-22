import test from 'node:test';
import assert from 'node:assert/strict';

const {
  getPasswordChecks,
  getPasswordError,
  assertValidPassword,
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

test('password rules: 6 to 12 characters with a lowercase letter, a number and a special character', () => {
  assert.equal(getPasswordError('abc1!x'), '');
  assert.equal(getPasswordError('spaza#2026'), '');
  assert.equal(getPasswordError('a1!bcdefghij'), ''); // exactly 12
  assert.match(getPasswordError(''), /Enter a password/);
  assert.match(getPasswordError('a1!bc'), /at least 6 characters/);
  assert.match(getPasswordError('a1!bcdefghijk'), /no more than 12 characters/); // 13
  assert.match(getPasswordError('ABC123!X'), /lowercase letter/);
  assert.match(getPasswordError('abcdef!x'), /one number/);
  assert.match(getPasswordError('abcdef12'), /special character/);
  assert.match(getPasswordError('abc 12 x'), /special character/); // a space is not special
  assert.throws(() => assertValidPassword('password'), /one number/);
  assert.doesNotThrow(() => assertValidPassword('abc1!x'));
});

test('password checklist reports each rule so the sign up screen can tick them off', () => {
  const met = (password) => Object.fromEntries(getPasswordChecks(password).map((check) => [check.key, check.met]));
  assert.deepEqual(met(''), { length: false, lowercase: false, number: false, special: false });
  assert.deepEqual(met('abc'), { length: false, lowercase: true, number: false, special: false });
  assert.deepEqual(met('abc12!'), { length: true, lowercase: true, number: true, special: true });
  assert.equal(met('a1!bcdefghijk').length, false);
});
