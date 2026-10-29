// Writes aggregate shop activity to shopStats/{storeId}; individual sales and customer details
// remain private to the shop. The shop name is used only to identify the summary.
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { fetchRepaymentTrackerData } from '../firestore/creditRepository';
import { computeCreditBehaviour } from './shopStats';

const clip = (value, max) => String(value || '').trim().slice(0, max);

// ---- Credit paid on time ----
// This needs the shop's repayment history (credit schedules and payments), which is one extra read.
// It is worked out here on the phone, and only four totals are published. The result is kept for 30 minutes,
// so publishing after every sale does not re-read the whole ledger each time.
const BEHAVIOUR_CACHE_MS = 30 * 60 * 1000;
const behaviourCache = new Map(); // storeId -> { at, data }

export async function getCreditBehaviour(storeId, { force = false, now = new Date() } = {}) {
  if (!storeId) return null;
  const cached = behaviourCache.get(storeId);
  if (!force && cached && Date.now() - cached.at < BEHAVIOUR_CACHE_MS) return cached.data;
  try {
    const { schedules = [], ledgerEntries = [] } = await fetchRepaymentTrackerData(storeId);
    const data = computeCreditBehaviour({ schedules, ledgerEntries, now });
    behaviourCache.set(storeId, { at: Date.now(), data });
    return data;
  } catch (error) {
    // Offline or refused: keep using the last good numbers if there are any
    return cached ? cached.data : null;
  }
}

// Firestore rejects undefined, and the rules only accept numbers for these fields
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

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

    // Use the credit history the caller already worked out, otherwise read it
    const behaviour = stats.creditDueCount90d !== undefined ? stats : await getCreditBehaviour(storeId);

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
      // Stock quality
      stockGapSalesShare: number(stats.stockGapSalesShare),
      expiredCount: number(stats.expiredCount),
      expiringSoonCount: number(stats.expiringSoonCount),
      expiredValue: number(stats.expiredValue),
      expiringSoonValue: number(stats.expiringSoonValue),
      expiryTrackedShare: number(stats.expiryTrackedShare),
      // Credit
      creditCustomers: stats.creditCustomers,
      creditOutstanding: stats.creditOutstanding,
      creditOverdue: stats.creditOverdue,
      // Credit paid on time. Left out when the repayment history could not be read, so the last good
      // numbers stay on the document instead of being wiped to zero.
      ...(behaviour ? {
        creditDueCount90d: number(behaviour.creditDueCount90d),
        creditOnTimeCount90d: number(behaviour.creditOnTimeCount90d),
        creditDueAmount90d: number(behaviour.creditDueAmount90d),
        creditOnTimeAmount90d: number(behaviour.creditOnTimeAmount90d),
      } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.warn('Could not publish shop stats', error?.code || error?.message);
    return false;
  }
}
