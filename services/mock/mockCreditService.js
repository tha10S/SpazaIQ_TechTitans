import { getState, mutate, delay, generateId } from './mockData';

function classifyStatus(balance, dueDate) {
  if (balance <= 0) return 'good';
  if (!dueDate) return 'good';
  const daysUntilDue = (new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue < 0) return 'at_risk';
  if (daysUntilDue < 7) return 'fair';
  return 'good';
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export async function fetchCustomerBalances(_storeId) {
  await delay();
  const { customers, creditTransactions } = await getState();

  return customers.map((customer) => {
    const txns = creditTransactions.filter((t) => t.customer_id === customer.id);
    const balance = txns.reduce((sum, t) => sum + t.amount, 0);
    const nextDue = txns
      .filter((t) => t.amount > 0 && t.due_date)
      .map((t) => t.due_date)
      .sort()[0];

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      balance,
      dueBy: nextDue ? formatDate(nextDue) : null,
      status: classifyStatus(balance, nextDue),
    };
  });
}

// Mock "auth" — any ID number of 6+ digits passes. Swap for real auth later.
export async function verifyStoreOwner(idNumber) {
  await delay(200);
  if (!idNumber || idNumber.trim().length < 6) {
    throw new Error('ID number does not match this account');
  }
  return { id: 'mock-owner-id' };
}

export async function addCreditTransaction({ customerId, customerName, amount, dueDate }) {
  await delay();

  let resolvedCustomerId = customerId;
  let transaction;

  await mutate((state) => {
    if (!resolvedCustomerId || resolvedCustomerId === 'new') {
      const newCustomer = { id: generateId('c'), name: customerName, phone: null };
      state.customers.push(newCustomer);
      resolvedCustomerId = newCustomer.id;
    }

    transaction = {
      id: generateId('t'),
      customer_id: resolvedCustomerId,
      amount,
      due_date: dueDate ?? null,
    };
    state.creditTransactions.push(transaction);
  });

  return transaction;
}

export async function sendWhatsAppReminder({ customerId, newBalance }) {
  await delay(150);
  // No real backend yet — just log what WOULD be sent.
  console.log(`[mock] WhatsApp reminder → customer ${customerId}: new balance R${newBalance}`);
}