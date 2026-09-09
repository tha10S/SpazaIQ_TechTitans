import { useState, useEffect, useCallback } from 'react';
import {
  fetchCustomerBalances,
  verifyStoreOwner,
  addCreditTransaction,
  sendWhatsAppReminder,
} from '../services/creditService';

export function useCustomerBalances(storeId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerBalances(storeId);
      setCustomers(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const confirmCredit = async ({ idNumber, customer, amount, dueDate }) => {
    await verifyStoreOwner(idNumber);

    const transaction = await addCreditTransaction({
      storeId,
      customerId: customer.id === 'new' ? null : customer.id,
      customerName: customer.name,
      amount,
      dueDate,
    });

    await reload(); // refetch so balances stay in sync with the DB

    try {
      await sendWhatsAppReminder({
        customerId: transaction.customer_id,
        newBalance: (customer.balance || 0) + amount,
      });
    } catch (err) {
      // Don't fail the whole flow if the reminder send fails —
      // the credit is already logged. Just surface a soft warning.
      console.warn('WhatsApp reminder failed to send', err);
    }
  };

  return { customers, loading, error, reload, confirmCredit };
}