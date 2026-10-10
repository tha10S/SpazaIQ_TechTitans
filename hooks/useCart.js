import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { recordSale, subscribeProducts } from '../services/salesService';

export function useCart(storeId) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // { id, name, unitPrice, qty }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingSale = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    let unsubscribe;
    try {
      unsubscribe = subscribeProducts(
        storeId,
        search,
        (data) => {
          if (active) {
            setProducts(data);
            setLoading(false);
          }
        },
        (subscriptionError) => {
          if (!active) return;
          setError(subscriptionError);
          setLoading(false);
        }
      );
    } catch (error) {
      if (active) {
        setError(error);
        setLoading(false);
      }
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [storeId, search]);

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        unitPrice: product.unit_price,
        costPrice: product.cost_price,
        qty: 1,
      }];
    });
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    [cart]
  );

  const completeSale = async (paymentDetails) => {
    setSubmitting(true);
    try {
      const details = typeof paymentDetails === 'string'
        ? { paymentMethod: paymentDetails, paidAmount: subtotal, creditAmount: 0 }
        : paymentDetails;
      const signature = JSON.stringify({
        cart: cart.map(({ id, unitPrice, qty }) => ({ id, unitPrice, qty })),
        details,
        total: subtotal,
      });
      if (!pendingSale.current || pendingSale.current.signature !== signature) {
        pendingSale.current = {
          signature,
          idempotencyKey: `sale-${storeId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      const result = await recordSale({
        storeId,
        cart,
        total: subtotal,
        ...details,
        idempotencyKey: details.idempotencyKey || pendingSale.current.idempotencyKey,
      });
      pendingSale.current = null;
      setCart([]);
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    search,
    setSearch,
    products,
    cart,
    addToCart,
    updateQty,
    subtotal,
    loading,
    error,
    submitting,
    completeSale,
  };
}