// SIMULATED subscription payment. There is no payment server yet, so the shop's own app marks its
// subscription as paid after the (fake) card step. The Firestore rules only allow this from the 28th
// (or when the shop is overdue or deactivated), only for the exact monthly fee, and only moving the
// dates forward by about a month. This trusts the app, so replace it with a server-confirmed payment
// (for example a Paystack webhook) before any real money is involved.
import { Timestamp, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { cycleDates, defaultCoveredMonth, subscriptionState } from '../admin/billing';

export async function paySubscription(storeId, sub, now = new Date()) {
  if (!storeId || !sub) throw new Error('There is no subscription to pay yet.');

  // Payment opens on the due date (the 28th), or at any time once the shop is overdue or deactivated
  const state = subscriptionState(sub, now);
  if (state.key !== 'overdue' && state.key !== 'deactivated') {
    throw new Error('Payment is not open yet. It opens on the due date.');
  }

  const coveredMonth = defaultCoveredMonth(now);
  const { dueDate, accessUntil } = cycleDates(coveredMonth);
  const amount = Number(sub.monthlyFee || 0);

  await updateDoc(doc(db, 'subscriptions', storeId), {
    status: 'active',
    coveredMonth,
    dueDate: Timestamp.fromDate(dueDate),
    accessUntil: Timestamp.fromDate(accessUntil),
    lastPaymentAt: serverTimestamp(),
    lastPaymentAmount: amount,
    deactivatedReason: '',
    updatedAt: serverTimestamp(),
  });

  return { amount, coveredMonth, dueDate, accessUntil };
}
