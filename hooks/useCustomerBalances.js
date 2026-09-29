import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addCreditTransaction,
  makePayment,
  subscribeCustomerBalances,
} from '../services/creditService';

function explainLedgerError(error) {
  if (error?.code === 'permission-denied') {
    return new Error('Firestore denied access to this store. Deploy firestore.rules and sign in again.');
  }
  if (error?.code === 'failed-precondition') {
    return new Error('Firestore needs its customer index. Deploy firestore.indexes.json.');
  }
  if (error?.code === 'unavailable') {
    return new Error('Credit ledger is offline. Reconnect and try again.');
  }
  return error;
}

export function useCustomerBalances(storeId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pendingCredit = useRef(null);
  const pendingPayment = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsubscribe;
    try {
      unsubscribe = subscribeCustomerBalances(
        storeId,
        (data) => {
          setCustomers(data);
          setLoading(false);
        },
        (err) => {
          setError(explainLedgerError(err));
          setLoading(false);
        }
      );
    } catch (err) {
      setError(explainLedgerError(err));
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, [storeId]);

  const confirmCredit = async ({ customer, amount, dueDate, schedule }) => {
    const signature = JSON.stringify({ customerId: customer.id, amount, dueDate, schedule });
    if (!pendingCredit.current || pendingCredit.current.signature !== signature) {
      pendingCredit.current = {
        signature,
        idempotencyKey: `credit-${storeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    }
    try {
      const result = await addCreditTransaction({
        storeId,
        customerId: customer.id,
        customerName: customer.name,
        amount,
        dueDate,
        schedule,
        idempotencyKey: pendingCredit.current.idempotencyKey,
      });
      pendingCredit.current = null;
      return result;
    } catch (error) {
      throw error;
    }
  };

  const recordPayment = useCallback(async ({ customerId, amount, note }) => {
    const signature = JSON.stringify({ customerId, amount, note });
    if (!pendingPayment.current || pendingPayment.current.signature !== signature) {
      pendingPayment.current = {
        signature,
        idempotencyKey: `payment-${storeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
    }
    try {
      const result = await makePayment({
        storeId,
        customerId,
        amount,
        note,
        idempotencyKey: pendingPayment.current.idempotencyKey,
      });
      pendingPayment.current = null;
      return result;
    } catch (error) {
      throw error;
    }
  }, [storeId]);

  return { customers, loading, error, confirmCredit, recordPayment };
}