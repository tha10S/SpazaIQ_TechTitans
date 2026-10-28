import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeSales } from '../services/firestore/salesRepository';
import { subscribeProducts } from '../services/firestore/productsRepository';
import { subscribeCustomers } from '../services/firestore/customersRepository';
import { buildShopStats } from '../services/admin/shopStats';
import { publishShopStats } from '../services/admin/shopStatsPublisher';

// Shows nothing. While a shop owner has the app open, this keeps the shop's TOTALS up to date in
// shopStats/{storeId}, which is the only place the admin dashboard lists shops from. A shop that never
// publishes never appears on the admin side. It runs from App.js so it does not depend on which tab the
// owner opens. Only totals are sent: no customer names, phone numbers or individual sales.
export default function ShopStatsSync({ storeId, shopName }) {
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [customers, setCustomers] = useState(null);
  const lastPublished = useRef('');

  useEffect(() => {
    setSales(null);
    setProducts(null);
    setCustomers(null);
    lastPublished.current = '';
    if (!storeId) return undefined;
    const warn = (what) => (error) => console.warn(`Shop stats: could not read ${what}`, error?.code || error?.message);
    const unsubscribes = [
      subscribeSales(storeId, setSales, warn('sales')),
      subscribeProducts(storeId, '', setProducts, warn('products')),
      subscribeCustomers(storeId, setCustomers, warn('customers')),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [storeId]);

  // Wait until sales, products and customers have all loaded, so zeros are never published by mistake
  const stats = useMemo(
    () => (sales && products && customers ? buildShopStats({ products, sales, customers, now: new Date() }) : null),
    [sales, products, customers]
  );

  useEffect(() => {
    if (!storeId || !stats) return undefined;
    const signature = JSON.stringify(stats);
    if (signature === lastPublished.current) return undefined;
    // Wait a few seconds so a burst of changes is sent as one write
    const timer = setTimeout(async () => {
      const ok = await publishShopStats(storeId, stats, shopName);
      if (ok) {
        lastPublished.current = signature;
        console.log('Shop stats published for', storeId);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [storeId, stats, shopName]);

  // If sales, products or customers never load, nothing can be published. Say which one is missing.
  useEffect(() => {
    if (!storeId || stats) return undefined;
    const timer = setTimeout(() => {
      console.warn('Shop stats: still waiting to load', { sales: Boolean(sales), products: Boolean(products), customers: Boolean(customers) });
    }, 15000);
    return () => clearTimeout(timer);
  }, [storeId, stats, sales, products, customers]);

  return null;
}