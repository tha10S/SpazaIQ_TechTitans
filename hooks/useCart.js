import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchProducts, recordSale } from '../services/salesService';

export function useCart(storeId) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]); // { id, name, unitPrice, qty }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProducts(storeId, search)
      .then((data) => {
        if (active) setProducts(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
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
      return [...prev, { id: product.id, name: product.name, unitPrice: product.unit_price, qty: 1 }];
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

  const completeSale = async (paymentMethod) => {
    setSubmitting(true);
    try {
      await recordSale({ storeId, cart, paymentMethod, total: subtotal });
      setCart([]);
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
    submitting,
    completeSale,
  };
}