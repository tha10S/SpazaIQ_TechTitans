import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath, storeDocPath } from './paths';

// Data shape (all inside the signed-in shop's own store):
//   stores/{storeId}/suppliers/{id}  { storeId, name, category, phone, items: [{ productId, name, qty, unitCost, selected }] }
//   stores/{storeId}/orders/{id}     { storeId, supplierId, supplierName, supplierPhone, orderNumber,
//                                      items: [{ productId, name, qty, unitCost }], total,
//                                      status: 'pending' | 'delivered', createdAt, deliveredAt }
// Both collections are covered by the existing store rules, so no rules change is needed.

const suppliersCollection = (storeId) => collection(db, ...storeCollectionPath(storeId, 'suppliers'));
const ordersCollection = (storeId) => collection(db, ...storeCollectionPath(storeId, 'orders'));

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function mapSupplier(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name || 'Supplier',
    category: data.category || 'Groceries',
    phone: data.phone || '',
    items: Array.isArray(data.items) ? data.items : [],
  };
}

function mapOrder(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    orderNumber: data.orderNumber || snapshot.id.slice(0, 6).toUpperCase(),
    supplierId: data.supplierId || null,
    supplier: data.supplierName || 'Supplier',
    supplierPhone: data.supplierPhone || '',
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total || 0),
    status: data.status === 'delivered' ? 'Delivered' : 'Pending',
    date: formatDate(data.createdAt),
  };
}

function cleanItems(items) {
  return (items || [])
    .map((item) => ({
      productId: String(item.productId || ''),
      name: String(item.name || '').trim(),
      qty: Number(item.qty),
      unitCost: Number(item.unitCost || 0),
    }))
    .filter((item) => item.productId && item.name && Number.isInteger(item.qty) && item.qty > 0);
}

export function subscribeSuppliers(storeId, onData, onError) {
  const sid = assertStoreId(storeId);
  return onSnapshot(
    query(suppliersCollection(sid), orderBy('name')),
    (snapshot) => onData(snapshot.docs.map(mapSupplier)),
    onError
  );
}

export function subscribeOrders(storeId, onData, onError) {
  const sid = assertStoreId(storeId);
  return onSnapshot(
    query(ordersCollection(sid), orderBy('createdAt', 'desc')),
    (snapshot) => onData(snapshot.docs.map(mapOrder)),
    onError
  );
}

export async function createSupplier(storeId, input) {
  const sid = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Enter the supplier name.');
  const reference = await addDoc(suppliersCollection(sid), {
    storeId: sid,
    name,
    category: String(input.category || 'Groceries'),
    phone: String(input.phone || '').trim(),
    items: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateSupplierItems(storeId, supplierId, items) {
  const sid = assertStoreId(storeId);
  await updateDoc(doc(db, ...storeDocPath(sid, 'suppliers', supplierId)), {
    items: (items || []).map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: Number(item.qty),
      unitCost: Number(item.unitCost || 0),
      selected: item.selected !== false,
    })),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSupplier(storeId, supplierId) {
  const sid = assertStoreId(storeId);
  await deleteDoc(doc(db, ...storeDocPath(sid, 'suppliers', supplierId)));
}

// Creates a pending order. `supplier` needs { id, name, phone }.
export async function createOrder(storeId, supplier, items) {
  const sid = assertStoreId(storeId);
  const lines = cleanItems(items);
  if (!lines.length) throw new Error('Choose at least one item to order.');
  const total = lines.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  const orderNumber = `ORD-${String(Date.now()).slice(-6)}`;
  const reference = await addDoc(ordersCollection(sid), {
    storeId: sid,
    supplierId: supplier.id || null,
    supplierName: supplier.name,
    supplierPhone: supplier.phone || '',
    orderNumber,
    items: lines,
    total: Number(total.toFixed(2)),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: reference.id, orderNumber };
}

// Works out the new stock level for each product on an order.
// `stock` maps productId -> current quantity, or null when the product no longer exists.
export function planDelivery(items, stock) {
  const wanted = new Map();
  const skipped = [];
  (items || []).forEach((item) => {
    if (!item.productId || stock.get(item.productId) == null) {
      skipped.push(item.name || 'Unknown item');
      return;
    }
    wanted.set(item.productId, (wanted.get(item.productId) || 0) + Number(item.qty || 0));
  });
  const updates = [...wanted.entries()].map(([productId, qty]) => ({
    productId,
    added: qty,
    newQuantity: Number(stock.get(productId)) + qty,
  }));
  return { updates, skipped };
}

// Marks an order delivered and adds its items to Stock. One transaction, so the order can't be
// counted twice and stock never changes without the order changing. Needs an internet connection.
export async function markOrderDelivered(storeId, orderId) {
  const sid = assertStoreId(storeId);
  const orderReference = doc(db, ...storeDocPath(sid, 'orders', orderId));

  return runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderReference);
    if (!orderSnapshot.exists()) throw new Error('This order no longer exists.');
    const order = orderSnapshot.data();
    if (order.status === 'delivered') throw new Error('This order is already marked as delivered.');

    const items = Array.isArray(order.items) ? order.items : [];
    const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
    const productReferences = productIds.map((id) => doc(db, ...storeDocPath(sid, 'products', id)));
    const productSnapshots = await Promise.all(productReferences.map((reference) => transaction.get(reference)));
    const stock = new Map(productSnapshots.map((snapshot, index) => [
      productIds[index],
      snapshot.exists() ? Number(snapshot.data().quantity || 0) : null,
    ]));

    const plan = planDelivery(items, stock);
    plan.updates.forEach((update) => {
      transaction.update(doc(db, ...storeDocPath(sid, 'products', update.productId)), {
        quantity: update.newQuantity,
        updatedAt: serverTimestamp(),
      });
    });
    transaction.update(orderReference, {
      status: 'delivered',
      deliveredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { updated: plan.updates.length, skipped: plan.skipped };
  });
}