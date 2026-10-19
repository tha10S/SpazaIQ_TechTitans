// Writes a shop's anonymous totals to shopStats/{storeId}, which is what the admin area reads.
// Call it from a screen that already has the shop's products, sales and customers (Insights does).
// It is throttled, and it never throws, so a failure can't break the shop screen.
//
// Only these fields are written. The Firestore rules accept nothing else in this document:
//   the shop name and the owner's own contact details (needed to chase the subscription),
//   plus the totals from buildShopStats().
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const MIN_GAP_MS = 2 * 60 * 1000;
let last = { storeId: null, signature: '', at: 0 };

const clip = (value, max) => String(value || '').trim().slice(0, max);

export async function publishShopStats(storeId, stats) {
  try {
    if (!storeId || !stats) return false;
    const signature = JSON.stringify(stats);
    const now = Date.now();
    if (last.storeId === storeId && (signature === last.signature || now - last.at < MIN_GAP_MS)) return false;
    last = { storeId, signature, at: now };

    let profile = {};
    try {
      const snapshot = await getDoc(doc(db, 'users', storeId));
      if (snapshot.exists()) profile = snapshot.data();
    } catch (error) {
      // The shop name is only a label. Carry on without it.
    }

    await setDoc(doc(db, 'shopStats', storeId), {
      storeId,
      shopName: clip(profile.shopName, 80) || 'Shop',
      contactEmail: clip(profile.email, 120),
      contactPhone: clip(profile.mobile, 30),
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
    return true;
  } catch (error) {
    console.warn('Could not publish shop stats', error?.code || error?.message);
    return false;
  }
}
