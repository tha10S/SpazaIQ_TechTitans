// Writes aggregate shop activity to shopStats/{storeId}; individual sales and customer details
// remain private to the shop. The shop name is used only to identify the summary.
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const clip = (value, max) => String(value || '').trim().slice(0, max);

export async function publishShopStats(storeId, stats) {
  if (!storeId || !stats) throw new Error('A shop and its activity totals are required.');
  const snapshot = await getDoc(doc(db, 'stores', storeId));
  const shopName = snapshot.exists() ? clip(snapshot.data().name, 80) : '';
  if (!shopName) throw new Error('The shop name is not available for its activity summary.');

  await setDoc(doc(db, 'shopStats', storeId), {
    storeId,
    shopName,
    revenue30d: stats.revenue30d,
    revenuePrev30d: stats.revenuePrev30d,
    profit30d: stats.profit30d,
    salesCount30d: stats.salesCount30d,
    itemsSold30d: stats.itemsSold30d,
    activeDays30d: stats.activeDays30d,
    creditSales30d: stats.creditSales30d,
    lastSaleAt: stats.lastSaleAt ? Timestamp.fromDate(stats.lastSaleAt) : null,
    productCount: stats.productCount,
    lowStockCount: stats.lowStockCount,
    outOfStockCount: stats.outOfStockCount,
    stockCostValue: stats.stockCostValue,
    creditCustomers: stats.creditCustomers,
    creditOutstanding: stats.creditOutstanding,
    creditOverdue: stats.creditOverdue,
    updatedAt: serverTimestamp(),
  });
}
