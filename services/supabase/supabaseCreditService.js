import { supabase } from './supabaseClient';

/**
 * Fetch every customer's current balance for a store.
 * Reads from the `customer_balances` view (see supabaseClient.js for schema).
 */
export async function fetchCustomerBalances(storeId) {
  const { data, error } = await supabase
    .from('customer_balances')
    .select('*')
    .eq('store_id', storeId)
    .order('balance', { ascending: false });

  if (error) throw error;

  // Map DB rows -> the shape the screen expects
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    balance: row.balance,
    dueBy: row.next_due_date,
    status: classifyStatus(row.balance, row.next_due_date),
  }));
}

// Simple status classification — tune thresholds to your business rules
function classifyStatus(balance, dueDate) {
  if (!dueDate) return 'good';
  const daysUntilDue = (new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue < 0) return 'at_risk';
  if (daysUntilDue < 7) return 'fair';
  return 'good';
}

/**
 * Verify the logged-in store owner's session is valid before letting them
 * log a credit sale. Supabase Auth already knows who's signed in — this
 * re-checks their ID/password (or just confirms an active session,
 * depending on how strict you want re-auth to be per sale).
 */
export async function verifyStoreOwner(idNumber) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not signed in');

  // If you store the owner's ID number as user metadata at signup:
  if (user.user_metadata?.id_number !== idNumber) {
    throw new Error('ID number does not match this account');
  }
  return user;
}

/**
 * Append a credit transaction for a customer (creates the customer first
 * if this is a brand-new one from "Record New Credit").
 */
export async function addCreditTransaction({ storeId, customerId, customerName, amount, dueDate }) {
  let resolvedCustomerId = customerId;

  if (!resolvedCustomerId || resolvedCustomerId === 'new') {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({ store_id: storeId, name: customerName })
      .select()
      .single();
    if (customerError) throw customerError;
    resolvedCustomerId = newCustomer.id;
  }

  const { data, error } = await supabase
    .from('credit_transactions')
    .insert({
      customer_id: resolvedCustomerId,
      store_id: storeId,
      amount,
      due_date: dueDate ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Triggers the WhatsApp balance reminder. The actual WhatsApp Business API
 * call must happen server-side (it needs your business token), so this
 * invokes a Supabase Edge Function that does the send.
 */
export async function sendWhatsAppReminder({ customerId, newBalance }) {
  const { error } = await supabase.functions.invoke('send-whatsapp-reminder', {
    body: { customerId, newBalance },
  });
  if (error) throw error;
}