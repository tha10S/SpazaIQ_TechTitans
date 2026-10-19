// Admin-side Firestore access. Everything here is allowed by the Firestore rules only for an admin
// account (a signed-in user with a document at admins/{uid}). It reads two things about a shop:
//   shopStats/{storeId}      anonymous totals published by the shop
//   subscriptions/{storeId}  billing status, written only by the admin
// There is deliberately no function here that reads a shop's sales, customers or credit records.
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
import { DEFAULT_FEE, DEFAULT_PLAN, cycleDates } from './billing';

const DAY_MS = 24 * 60 * 60 * 1000;

// True when this user has a document in the admins collection.
// Only the Firebase console can create that document. The rules refuse every app write to it.
export async function isAdminUser(uid) {
  if (!uid) return false;
  try {
    const snapshot = await getDoc(doc(db, 'admins', uid));
    return snapshot.exists();
  } catch (error) {
    return false;
  }
}

export function subscribeShopStats(onData, onError) {
  return onSnapshot(
    collection(db, 'shopStats'),
    (snapshot) => onData(snapshot.docs.map((item) => ({ storeId: item.id, ...item.data() }))),
    onError
  );
}

// Calls onData with an object keyed by storeId.
export function subscribeSubscriptions(onData, onError) {
  return onSnapshot(
    collection(db, 'subscriptions'),
    (snapshot) => {
      const byStore = {};
      snapshot.docs.forEach((item) => {
        byStore[item.id] = { id: item.id, ...item.data() };
      });
      onData(byStore);
    },
    onError
  );
}

export function subscribePayments(storeId, onData, onError) {
  return onSnapshot(
    query(collection(db, 'subscriptions', storeId, 'payments'), orderBy('paidAt', 'desc'), limit(12)),
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

function planFields(existing, plan, monthlyFee) {
  return {
    plan: String(plan || existing?.plan || DEFAULT_PLAN).slice(0, 40),
    monthlyFee: Number(monthlyFee ?? existing?.monthlyFee ?? DEFAULT_FEE),
  };
}

// Records a payment and moves the shop's dates on. One batch, so the payment and the new dates
// are saved together or not at all.
export async function recordPayment(storeId, { amount, coveredMonth, plan, monthlyFee, note }, adminUid, existing) {
  const paid = Number(amount);
  if (!Number.isFinite(paid) || paid < 0) throw new Error('Enter the amount that was paid.');
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
  batch.set(doc(collection(db, 'subscriptions', storeId, 'payments')), {
    amount: paid,
    coveredMonth,
    paidAt: serverTimestamp(),
    note: String(note || '').trim().slice(0, 200),
    recordedBy: adminUid,
  });
  await batch.commit();
}

// Starts a subscription without a payment (a trial or a free month).
export async function startSubscription(storeId, { plan, monthlyFee, coveredMonth }) {
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

export async function deactivateShop(storeId, reason, existing) {
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

// Switches a shop back on and gives it `days` more days to pay.
export async function reactivateShop(storeId, existing, days = 7) {
  await setDoc(
    doc(db, 'subscriptions', storeId),
    {
      storeId,
      ...planFields(existing),
      status: 'active',
      accessUntil: Timestamp.fromDate(new Date(Date.now() + days * DAY_MS)),
      deactivatedReason: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// rows: [{ storeId, sub }]. Marks each one deactivated in a single batch.
export async function deactivateMany(rows, reason = 'Unpaid') {
  for (let start = 0; start < rows.length; start += 400) {
    const batch = writeBatch(db);
    rows.slice(start, start + 400).forEach(({ storeId, sub }) => {
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
    });
    await batch.commit();
  }
}
