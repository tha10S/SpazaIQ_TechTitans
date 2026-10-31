
// Admin-side Firestore access.
// Only authenticated users with a document in admins/{uid}
// can perform admin operations.

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import { db } from '../firebase/firebaseConfig';

import {
  DEFAULT_FEE,
  DEFAULT_PLAN,
  cycleDates,
} from './billing';

const DAY_MS = 24 * 60 * 60 * 1000;

// True when this user has a document in the admins collection.
export async function isAdminUser(uid) {
  if (!uid) return false;

  try {
    const snapshot = await getDoc(doc(db, 'admins', uid));
    return snapshot.exists();
  } catch (error) {
    console.error('Admin verification failed:', error);
    return false;
  }
}

// Subscribe to shop statistics.
export function subscribeShopStats(onData, onError) {
  return onSnapshot(
    collection(db, 'shopStats'),
    (snapshot) =>
      onData(
        snapshot.docs.map((item) => {
          const stats = { ...item.data() };

          delete stats.contactEmail;
          delete stats.contactPhone;

          return {
            storeId: item.id,
            ...stats,
          };
        })
      ),
    onError
  );
}

// Subscribe to all shop subscriptions.
export function subscribeSubscriptions(onData, onError) {
  return onSnapshot(
    collection(db, 'subscriptions'),
    (snapshot) => {
      const byStore = {};

      snapshot.docs.forEach((item) => {
        byStore[item.id] = {
          id: item.id,
          ...item.data(),
        };
      });

      onData(byStore);
    },
    onError
  );
}

// Subscribe to a shop's payment history.
export function subscribePayments(storeId, onData, onError) {
  return onSnapshot(
    query(
      collection(db, 'subscriptions', storeId, 'payments'),
      orderBy('paidAt', 'desc'),
      limit(12)
    ),
    (snapshot) =>
      onData(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      ),
    onError
  );
}

// Subscription plan fields.
function planFields(existing, plan, monthlyFee) {
  return {
    plan: String(
      plan || existing?.plan || DEFAULT_PLAN
    ).slice(0, 40),

    monthlyFee: Number(
      monthlyFee ?? existing?.monthlyFee ?? DEFAULT_FEE
    ),
  };
}

// Record a payment and update subscription dates.
export async function recordPayment(
  storeId,
  { amount, coveredMonth, plan, monthlyFee, note },
  adminUid,
  existing
) {
  if (!storeId) {
    throw new Error('A valid shop ID is required.');
  }

  if (!adminUid) {
    throw new Error('Admin authentication is required.');
  }

  const authorized = await isAdminUser(adminUid);

  if (!authorized) {
    throw new Error('Unauthorized. Admin access required.');
  }

  const paid = Number(amount);

  if (!Number.isFinite(paid) || paid < 0) {
    throw new Error('Enter the amount that was paid.');
  }

  const { dueDate, accessUntil } = cycleDates(coveredMonth);

  const batch = writeBatch(db);

  batch.set(
    doc(db, 'subscriptions', storeId),
    {
      storeId,
      ...planFields(existing, plan, monthlyFee),
      status: 'active',
      coveredMonth,
      dueDate: Timestamp.fromDate(dueDate),
      accessUntil: Timestamp.fromDate(accessUntil),
      lastPaymentAt: serverTimestamp(),
      lastPaymentAmount: paid,
      deactivatedReason: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    doc(collection(db, 'subscriptions', storeId, 'payments')),
    {
      amount: paid,
      coveredMonth,
      paidAt: serverTimestamp(),
      note: String(note || '').trim().slice(0, 200),
      recordedBy: adminUid,
    }
  );

  await batch.commit();
}

// Start a subscription without payment.
export async function startSubscription(
  storeId,
  { plan, monthlyFee, coveredMonth }
) {
  if (!storeId) {
    throw new Error('A valid shop ID is required.');
  }

  const { dueDate, accessUntil } = cycleDates(coveredMonth);

  await setDoc(
    doc(db, 'subscriptions', storeId),
    {
      storeId,
      ...planFields(null, plan, monthlyFee),
      status: 'active',
      coveredMonth,
      dueDate: Timestamp.fromDate(dueDate),
      accessUntil: Timestamp.fromDate(accessUntil),
      deactivatedReason: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Deactivate a shop.
export async function deactivateShop(
  storeId,
  reason,
  existing
) {
  if (!storeId) {
    throw new Error('A valid shop ID is required.');
  }

  await setDoc(
    doc(db, 'subscriptions', storeId),
    {
      storeId,
      ...planFields(existing),
      status: 'deactivated',
      deactivatedReason: String(reason || 'Unpaid').slice(0, 120),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Reactivate a shop.
export async function reactivateShop(
  storeId,
  existing,
  days = 7
) {
  if (!storeId) {
    throw new Error('A valid shop ID is required.');
  }

  await setDoc(
    doc(db, 'subscriptions', storeId),
    {
      storeId,
      ...planFields(existing),
      status: 'active',
      accessUntil: Timestamp.fromDate(
        new Date(Date.now() + days * DAY_MS)
      ),
      deactivatedReason: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Publish shop performance scores.
export async function publishShopScores(rows) {
  for (let start = 0; start < rows.length; start += 400) {
    const batch = writeBatch(db);

    rows.slice(start, start + 400).forEach(
      ({ storeId, score, tier }) => {
        batch.set(
          doc(db, 'shopScores', storeId),
          {
            storeId,
            score,
            tier,
            updatedAt: serverTimestamp(),
          }
        );
      }
    );

    await batch.commit();
  }
}

// Deactivate multiple shops.
export async function deactivateMany(
  rows,
  reason = 'Unpaid'
) {
  for (let start = 0; start < rows.length; start += 400) {
    const batch = writeBatch(db);

    rows.slice(start, start + 400).forEach(
      ({ storeId, sub }) => {
        batch.set(
          doc(db, 'subscriptions', storeId),
          {
            storeId,
            ...planFields(sub),
            status: 'deactivated',
            deactivatedReason: reason,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    );

    await batch.commit();
  }
}

// REMOVE A SHOP FROM THE ADMIN DASHBOARD.
//
// Deletes:
// shopStats/{storeId}
// shopScores/{storeId}
//
// Preserves:
// subscriptions/{storeId}
// subscriptions/{storeId}/payments/{paymentId}
//
// Does NOT delete:
// Firebase Authentication accounts
// Shop products
// Sales
// Customer records
// Credit records
// Shop documents or other shop-owned data.

export async function deleteShop(storeId, adminUid) {
  if (!storeId) {
    throw new Error('Invalid shop ID.');
  }

  if (!adminUid) {
    throw new Error('Admin authentication is required.');
  }

  // Verify admin privileges.
  const authorized = await isAdminUser(adminUid);

  if (!authorized) {
    throw new Error(
      'Unauthorized. Admin access required.'
    );
  }

  // Delete only the admin dashboard records.
  // Payment history and subscription records are preserved.
  const batch = writeBatch(db);

  batch.delete(doc(db, 'shopStats', storeId));
  batch.delete(doc(db, 'shopScores', storeId));

  await batch.commit();

  return true;
}
