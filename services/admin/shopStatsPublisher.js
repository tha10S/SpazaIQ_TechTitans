// Writes aggregate shop activity to shopStats/{storeId}; individual sales and customer details
// remain private to the shop. The shop name is used only to identify the summary.
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const clip = (value, max) => String(value || '').trim().slice(0, max);

export async function publishShopStats(storeId, stats) {
  if (!storeId || !stats) {
    throw new Error('A shop and its activity totals are required.');
  }

  try {
    const snapshot = await getDoc(doc(db, 'stores', storeId));
    const shopName = snapshot.exists() ? clip(snapshot.data().name, 80) : '';
    if (!shopName) {
      throw new Error('The shop name is not available for its activity summary.');
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
      shopName: clip(profile.shopName, 80) || shopName,
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
      firstSaleAt: stats.firstSaleAt ? Timestamp.fromDate(stats.firstSaleAt) : null,
      weekRevenue1: stats.weekRevenue1,
      weekRevenue2: stats.weekRevenue2,
      weekRevenue3: stats.weekRevenue3,
      weekRevenue4: stats.weekRevenue4,
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