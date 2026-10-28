// Writes aggregate shop activity to shopStats/{storeId}; individual sales and customer details
// remain private to the shop. The shop name is used only to identify the summary.
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const clip = (value, max) => String(value || '').trim().slice(0, max);
// The Firestore rules only accept totals of 0 or more, so a negative figure (for example after a
// reversed sale) is sent as 0 instead of making the whole write fail.
const nonNegative = (value) => Math.max(0, Number(value) || 0);

// fallbackName is used when neither the shop's profile nor its store record has a name, so every shop
// can still be listed on the admin side.
export async function publishShopStats(storeId, stats, fallbackName = '') {
  if (!storeId || !stats) {
    throw new Error('A shop and its activity totals are required.');
  }

  try {
    let storeName = '';
    try {
      const snapshot = await getDoc(doc(db, 'stores', storeId));
      if (snapshot.exists()) storeName = clip(snapshot.data().name, 80);
    } catch (storeError) {
      // Carry on with the other name sources.
    }

    let profile = {};
    try {
      const userSnapshot = await getDoc(doc(db, 'users', storeId));
      if (userSnapshot.exists()) {
        profile = userSnapshot.data();
      }
    } catch (profileError) {
      // The profile data is optional. Carry on without it.
    }

    await setDoc(doc(db, 'shopStats', storeId), {
      storeId,
      shopName: clip(profile.shopName, 80) || storeName || clip(fallbackName, 80) || 'Unnamed shop',
      contactEmail: clip(profile.email, 120),
      contactPhone: clip(profile.mobile, 30),
      revenue30d: nonNegative(stats.revenue30d),
      revenuePrev30d: nonNegative(stats.revenuePrev30d),
      profit30d: Number(stats.profit30d) || 0,
      salesCount30d: nonNegative(stats.salesCount30d),
      itemsSold30d: nonNegative(stats.itemsSold30d),
      activeDays30d: Math.min(31, nonNegative(stats.activeDays30d)),
      creditSales30d: nonNegative(stats.creditSales30d),
      lastSaleAt: stats.lastSaleAt ? Timestamp.fromDate(stats.lastSaleAt) : null,
      firstSaleAt: stats.firstSaleAt ? Timestamp.fromDate(stats.firstSaleAt) : null,
      weekRevenue1: nonNegative(stats.weekRevenue1),
      weekRevenue2: nonNegative(stats.weekRevenue2),
      weekRevenue3: nonNegative(stats.weekRevenue3),
      weekRevenue4: nonNegative(stats.weekRevenue4),
      productCount: nonNegative(stats.productCount),
      lowStockCount: nonNegative(stats.lowStockCount),
      outOfStockCount: nonNegative(stats.outOfStockCount),
      stockCostValue: nonNegative(stats.stockCostValue),
      creditCustomers: nonNegative(stats.creditCustomers),
      creditOutstanding: nonNegative(stats.creditOutstanding),
      creditOverdue: nonNegative(stats.creditOverdue),
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.warn('Could not publish shop stats', error?.code || error?.message);
    return false;
  }
}
