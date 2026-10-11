// WhatsApp click-to-chat. Opens the WhatsApp app (or WhatsApp Web on a computer) with a
// ready-written message to one number. The shop owner taps Send themselves.
// No API key, account or cost. A real WhatsApp Business API would be needed to send
// messages automatically, and it is paid and needs Meta approval.
import { Linking, Platform } from 'react-native';

// Turns '082 345 6712', '+27 82 345 6712', '0027823456712' or '823456712' into '27823456712'.
// Returns '' when the number can't be used.
export function normalizePhoneZA(raw) {
  let digits = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `27${digits.slice(1)}`;
  else if (digits.length === 9) digits = `27${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : '';
}

export function whatsappUrl(phone, message) {
  const number = normalizePhoneZA(phone);
  if (!number) return '';
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// Call this straight from a button press. On web the tab is opened before any await,
// otherwise the browser blocks it as a pop-up.
export async function openWhatsApp(phone, message) {
  const url = whatsappUrl(phone, message);
  if (!url) {
    return { ok: false, error: 'That phone number does not look right. Use the full number, for example 082 123 4567.' };
  }
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      await Linking.openURL(url);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'Could not open WhatsApp. Check that it is installed on this device.' };
  }
}

const formatRand = (value) => `R${Number(value || 0).toFixed(2)}`;
const firstName = (name) => String(name || '').trim().split(' ')[0];

export function creditReminderMessage({ customerName, balance, dueDate, overdue, shopName }) {
  const intro = `Hi ${firstName(customerName) || 'there'}${shopName ? `, this is ${shopName}` : ''}.`;
  const amount = formatRand(balance);
  if (overdue && dueDate) {
    return `${intro} Your credit balance of ${amount} was due on ${dueDate}. Please pay when you can. Thank you!`;
  }
  if (dueDate) {
    return `${intro} A friendly reminder that your credit balance of ${amount} is due on ${dueDate}. Thank you!`;
  }
  return `${intro} A friendly reminder that your credit balance of ${amount} is still outstanding. Please pay when you can. Thank you!`;
}

export function supplierOrderMessage({ supplierName, items, shopName }) {
  const lines = (items || []).map((item) => `• ${item.name} × ${item.qty}`);
  const intro = `Hi ${firstName(supplierName) || 'there'}${shopName ? `, this is ${shopName}` : ''}.`;
  if (!lines.length) return `${intro} I'd like to place an order. Please let me know what is available.`;
  return `${intro} I'd like to order:\n${lines.join('\n')}\nPlease confirm the total and delivery time. Thank you!`;
}