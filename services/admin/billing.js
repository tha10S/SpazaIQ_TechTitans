// Subscription billing rules. Pure functions with no Firebase imports.
//
// A shop pays monthly. The fee for a month is due on the 28th of the month before it, and access
// stops on the 1st of that month if it is still unpaid.
// Example: the December fee is due on 28 November. If it is unpaid on 1 December, the shop is cut off.
//
// "coveredMonth" is the month a payment pays for, written 'YYYY-MM'. Paying for November gives:
//   dueDate     = 28 November  (the next payment, for December, is due then)
//   accessUntil = 1 December   (access ends here if that payment never arrives)
// The Firestore rules compare accessUntil with the server time, so no scheduled job is needed.

export const DUE_DAY = 28;
export const DUE_SOON_DAYS = 5;
export const DEFAULT_PLAN = 'Standard';
export const DEFAULT_FEE = 99; // rand per month. Change this to your real price.

const DAY_MS = 24 * 60 * 60 * 1000;

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

export function shiftMonth(key, delta) {
  const parsed = parseMonthKey(key);
  if (!parsed) throw new Error('Month must look like 2026-11.');
  return monthKey(new Date(parsed.year, parsed.month - 1 + delta, 1));
}

export function monthLabel(key) {
  const parsed = parseMonthKey(key);
  if (!parsed) return String(key || '');
  return new Date(parsed.year, parsed.month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export function cycleDates(coveredMonth) {
  const parsed = parseMonthKey(coveredMonth);
  if (!parsed) throw new Error('Month must look like 2026-11.');
  return {
    dueDate: new Date(parsed.year, parsed.month - 1, DUE_DAY),
    accessUntil: new Date(parsed.year, parsed.month, 1),
  };
}

// Which month a payment recorded today most likely covers: from the 20th on it is next month's fee.
export function defaultCoveredMonth(now = new Date()) {
  return now.getDate() >= 20 ? shiftMonth(monthKey(now), 1) : monthKey(now);
}

// Accepts a Firestore Timestamp, a Date, an ISO string or a number.
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// The reference a shop uses when it pays, so the admin can match the payment to the shop.
// The shop sees it on its payment banner and the admin sees the same text on the shop's panel.
export function paymentReference(storeId) {
  return `SPZ-${String(storeId || '').slice(0, 6).toUpperCase()}`;
}

export function formatDay(date) {
  const value = toDate(date);
  return value ? value.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '-';
}

// { key, label, tone, dueDate, accessUntil, daysToCutoff }
// key: 'none' | 'paid' | 'due-soon' | 'overdue' | 'deactivated'
export function subscriptionState(sub, now = new Date()) {
  if (!sub) return { key: 'none', label: 'No subscription', tone: 'muted', dueDate: null, accessUntil: null, daysToCutoff: null };
  const dueDate = toDate(sub.dueDate);
  const accessUntil = toDate(sub.accessUntil);
  const daysToCutoff = accessUntil ? Math.ceil((accessUntil - now) / DAY_MS) : null;
  const base = { dueDate, accessUntil, daysToCutoff };

  if (sub.status === 'deactivated') return { key: 'deactivated', label: 'Deactivated', tone: 'bad', ...base };
  if (accessUntil && now >= accessUntil) return { key: 'deactivated', label: 'Deactivated (unpaid)', tone: 'bad', ...base };
  if (dueDate && now >= dueDate) return { key: 'overdue', label: 'Overdue', tone: 'warn', ...base };
  if (dueDate && dueDate - now <= DUE_SOON_DAYS * DAY_MS) return { key: 'due-soon', label: 'Due soon', tone: 'warn', ...base };
  return { key: 'paid', label: 'Paid', tone: 'good', ...base };
}

export function paymentReminderMessage({ shopName, fee, dueDate, accessUntil }) {
  const name = String(shopName || '').trim() || 'there';
  const amount = `R${Number(fee || 0).toFixed(2)}`;
  const due = formatDay(dueDate);
  const cutoff = formatDay(accessUntil);
  return `Hi ${name}, this is the SpazaIQ team. Your subscription of ${amount} was due on ${due}. `
    + `Please pay by ${cutoff} so your account stays active. Thank you!`;
}
