import { useEffect, useState } from 'react';
import { subscribeProducts } from '../services/salesService';

export function useProducts(storeId, search = '') {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsubscribe;
    try {
      unsubscribe = subscribeProducts(
        storeId,
        search,
        (data) => {
          setProducts(data);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, [storeId, search]);

  return { products, loading, error };
}
