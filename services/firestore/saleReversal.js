import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath, storeDocPath } from './paths';

// Reverses a sale made TODAY, as if the customer handed the goods back.
// In one transaction it:
//   1. puts the sold quantities back into Stock
//   2. for a credit sale, takes the credit off the customer's balance and removes the credit ledger entry
//      and repayment schedule that the sale created (the mirror image of recordSaleOnline)
//   3. keeps a record in stores/{storeId}/saleReversals/{saleId} (what was sold, the total, why)
//   4. removes the sale itself, so Home, Insights and the shop's totals all drop it straight away
// Because it is one transaction, either everything is reversed or nothing is.
// It refuses when a repayment has already been recorded against the credit, because undoing that
// would corrupt the customer's balance. It needs an internet connection.

const MONEY_TOLERANCE = 0.01;

export async function reverseSale(storeId, saleId, { reason = '' } = {}) {
  const sid = assertStoreId(storeId);
  if (!saleId) throw new Error('Choose a sale to reverse.');

  // Ledger entries linked to this sale. Found before the transaction, because a transaction can't run queries.
  const linked = await getDocs(
    query(collection(db, ...storeCollectionPath(sid, 'creditTransactions')), where('saleId', '==', saleId))
  );
  const ledgerIds = linked.docs.map((entry) => entry.id);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return runTransaction(db, async (transaction) => {
    // ---- Reads (a transaction must read everything before it writes anything) ----
    const saleReference = doc(db, ...storeDocPath(sid, 'sales', saleId));
    const saleSnapshot = await transaction.get(saleReference);
    if (!saleSnapshot.exists()) throw new Error('This sale was already reversed or no longer exists.');
    const sale = saleSnapshot.data();

    const createdAt = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
    if (!createdAt || createdAt < startOfToday) throw new Error('Only sales made today can be reversed.');

    const items = (Array.isArray(sale.items) ? sale.items : []).filter(
      (item) => item && item.id && Number(item.qty) > 0
    );
    const productIds = [...new Set(items.map((item) => item.id))];
    const productReferences = productIds.map((id) => doc(db, ...storeDocPath(sid, 'products', id)));
    const productSnapshots = await Promise.all(productReferences.map((reference) => transaction.get(reference)));

    const ledgerReferences = ledgerIds.map((id) => doc(db, ...storeDocPath(sid, 'creditTransactions', id)));
    const ledgerSnapshots = (await Promise.all(ledgerReferences.map((reference) => transaction.get(reference))))
      .filter((snapshot) => snapshot.exists());
    const isSaleCredit = (snapshot) => snapshot.data().type === 'credit' && snapshot.data().source === 'sale';
    if (ledgerSnapshots.some((snapshot) => !isSaleCredit(snapshot))) {
      throw new Error('A repayment is linked to this sale, so it can\'t be reversed. Adjust it on the Credit screen instead.');
    }

    const creditAmount = Number(sale.creditAmount || 0);
    let customerReference = null;
    let customerSnapshot = null;
    const scheduleReferences = [];
    const scheduleSnapshots = [];
    if (creditAmount > 0) {
      if (!sale.customerId) throw new Error('This credit sale has no customer, so it can\'t be reversed safely.');
      customerReference = doc(db, ...storeDocPath(sid, 'customers', sale.customerId));
      customerSnapshot = await transaction.get(customerReference);
      if (!customerSnapshot.exists()) throw new Error('The customer on this credit sale no longer exists.');

      const scheduleIds = [...new Set(ledgerSnapshots.map((snapshot) => snapshot.data().scheduleId).filter(Boolean))];
      for (const id of scheduleIds) {
        const reference = doc(db, ...storeDocPath(sid, 'repaymentSchedules', id));
        const snapshot = await transaction.get(reference);
        if (snapshot.exists()) {
          scheduleReferences.push(reference);
          scheduleSnapshots.push(snapshot);
        }
      }
    }

    // ---- Checks that protect the customer's balance ----
    if (creditAmount > 0) {
      const balance = Number(customerSnapshot.data().balance ?? 0);
      if (balance + MONEY_TOLERANCE < creditAmount) {
        throw new Error('The customer has already paid some of this credit, so the sale can\'t be reversed.');
      }
      const repaid = scheduleSnapshots.some((snapshot) => {
        const data = snapshot.data();
        return Math.abs(Number(data.remainingAmount) - Number(data.totalAmount)) > MONEY_TOLERANCE;
      });
      if (repaid) {
        throw new Error('A repayment was already recorded on this credit sale, so it can\'t be reversed.');
      }
    }

    // ---- Writes ----
    const skipped = [];
    const returned = new Map();
    items.forEach((item) => returned.set(item.id, (returned.get(item.id) || 0) + Number(item.qty)));
    productSnapshots.forEach((snapshot, index) => {
      const productId = productIds[index];
      if (!snapshot.exists()) {
        skipped.push(items.find((item) => item.id === productId)?.name || 'Unknown item');
        return;
      }
      transaction.update(productReferences[index], {
        quantity: Number(snapshot.data().quantity ?? 0) + returned.get(productId),
        updatedAt: serverTimestamp(),
      });
    });

    if (creditAmount > 0) {
      const newBalance = Math.max(0, Number(customerSnapshot.data().balance ?? 0) - creditAmount);
      const update = { balance: newBalance, updatedAt: serverTimestamp() };
      if (newBalance <= MONEY_TOLERANCE) update.nextDueDate = null;
      transaction.update(customerReference, update);
      ledgerSnapshots.forEach((snapshot) => transaction.delete(snapshot.ref));
      scheduleReferences.forEach((reference) => transaction.delete(reference));
    }

    transaction.set(doc(db, ...storeDocPath(sid, 'saleReversals', saleId)), {
      storeId: sid,
      saleId,
      reason: String(reason || '').trim().slice(0, 200),
      reversedAt: serverTimestamp(),
      originalCreatedAt: sale.createdAt,
      total: Number(sale.total || 0),
      paymentMethod: sale.paymentMethod || '',
      creditAmount,
      customerId: sale.customerId || null,
      items: items.map((item) => ({
        id: item.id,
        name: String(item.name || ''),
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice || 0),
      })),
    });
    transaction.delete(saleReference);

    return { restored: returned.size - skipped.length, skipped, creditReversed: creditAmount };
  });
}
