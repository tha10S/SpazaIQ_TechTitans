export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function normalizePhoneNumber(value, { required = false } = {}) {
  const phone = String(value ?? '').trim();
  if (!phone) {
    if (required) throw new Error('Enter a 10-digit phone number.');
    return '';
  }
  if (!/^[\d\s()+.-]+$/.test(phone)) {
    throw new Error('Phone number can contain only digits and common phone separators.');
  }

  const digits = phone.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) throw new Error('Phone number must contain exactly 10 digits.');
  return digits;
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateIsoDate(value, label, { required = true, min, max } = {}) {
  const date = String(value ?? '').trim();
  if (!date && !required) return '';
  if (!isValidIsoDate(date)) throw new Error(`Enter a valid ${label} in YYYY-MM-DD format.`);
  if (min && date < min) throw new Error(`${label} cannot be earlier than ${min}.`);
  if (max && date > max) throw new Error(`${label} cannot be later than ${max}.`);
  return date;
}

export function isValidDecimalInput(value) {
  return /^\d*\.?\d{0,2}$/.test(value);
}

export function parseNonNegativeNumber(value, label, { required = true, integer = false } = {}) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      throw new Error(`Enter a valid non-negative ${integer ? 'whole number' : 'amount'} for ${label}.`);
    }
    if (!integer && Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      throw new Error(`Enter no more than 2 decimal places for ${label}.`);
    }
    return integer ? value : Math.round(value * 100) / 100;
  }
  const input = String(value ?? '').trim();
  if (!input && !required) return 0;
  const pattern = integer ? /^\d+$/ : /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
  const number = Number(input);
  if (!pattern.test(input) || !Number.isFinite(number) || number < 0) {
    throw new Error(`Enter a valid non-negative ${integer ? 'whole number' : 'amount'} for ${label}.`);
  }
  return number;
}

// ---- Passwords (sign up and password change) ----
export const PASSWORD_RULES = { minLength: 6, maxLength: 12 };

// A special character is anything that isn't a letter, a digit or whitespace.
const SPECIAL_CHARACTER = /[^A-Za-z0-9\s]/;

// One entry per rule, so the sign up screen can tick them off as the user types.
export function getPasswordChecks(password) {
  const value = String(password ?? '');
  const { minLength, maxLength } = PASSWORD_RULES;
  return [
    { key: 'length', label: `${minLength} to ${maxLength} characters`, met: value.length >= minLength && value.length <= maxLength },
    { key: 'lowercase', label: 'One lowercase letter (a-z)', met: /[a-z]/.test(value) },
    { key: 'number', label: 'One number (0-9)', met: /[0-9]/.test(value) },
    { key: 'special', label: 'One special character, for example ! @ # $ %', met: SPECIAL_CHARACTER.test(value) },
  ];
}

// Returns '' when the password is fine, otherwise the first problem in plain words.
export function getPasswordError(password) {
  const value = String(password ?? '');
  const { minLength, maxLength } = PASSWORD_RULES;
  if (!value) return 'Enter a password.';
  if (value.length < minLength) return `Password must be at least ${minLength} characters.`;
  if (value.length > maxLength) return `Password must be no more than ${maxLength} characters.`;
  if (!/[a-z]/.test(value)) return 'Password needs at least one lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password needs at least one number.';
  if (!SPECIAL_CHARACTER.test(value)) return 'Password needs at least one special character, for example ! @ # $ %.';
  return '';
}

export function assertValidPassword(password) {
  const message = getPasswordError(password);
  if (message) throw new Error(message);
}
