const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') value = value.toDate();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function getOverduePolicy({ dueDate, balance, interestAppliedAt, now = new Date() }) {
  const isoDueDate = toIsoDate(dueDate);
  const numericBalance = Number(balance);
  if (!isoDueDate || !Number.isFinite(numericBalance) || numericBalance <= 0) {
    return { overdueDays: 0, applyInterest: false, blacklist: false };
  }

  const due = Date.parse(`${isoDueDate}T00:00:00.000Z`);
  const today = Date.parse(`${toIsoDate(now)}T00:00:00.000Z`);
  if (!Number.isFinite(due) || !Number.isFinite(today)) {
    return { overdueDays: 0, applyInterest: false, blacklist: false };
  }

  const overdueDays = Math.max(0, Math.floor((today - due) / DAY_MS));
  return {
    overdueDays,
    applyInterest: overdueDays > 0 && !interestAppliedAt,
    blacklist: overdueDays >= 60,
  };
}

function calculateOverdueInterest(balance) {
  return Math.round(Number(balance) * 0.05 * 100) / 100;
}

module.exports = { calculateOverdueInterest, getOverduePolicy };
