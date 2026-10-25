import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath, storeDocPath } from './paths';
import { validateIsoDate } from '../validation';
import { addStockBatch, getEarliestStockExpiry, normalizeStockBatches } from './stockBatches';

// Data shape (all inside the signed-in shop's own store):
//   stores/{storeId}/suppliers/{id}  { storeId, name, category, phone,
//                                      items: [{ productId, name, qty, unitCost, sellingPrice, reorderLevel, selected }] }
//   stores/{storeId}/orders/{id}     { storeId, supplierId, supplierName, supplierPhone, orderNumber,
//                                      items: [{ productId, name, qty, unitCost, sellingPrice, reorderLevel }], total,
//                                      status: 'pending' | 'delivered', createdAt, deliveredAt }
// productId is '' for an item the shop typed in that is not in Stock yet. Such an item can be ordered.
// When the order is delivered it is linked to the Stock product with the same name, or, if there is
// none, a new Stock product is created for it from the item's name, quantity, cost price,
// selling price and low-stock threshold.
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

// An item needs a name and a whole-number quantity. A productId is optional: items typed in by hand
// (not in Stock) have an empty one.
const DEFAULT_REORDER_LEVEL = 10;

// A whole number of 0 or more, otherwise the default
function reorderLevelOf(value) {
  const number = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isInteger(number) && number >= 0
    ? number
    : DEFAULT_REORDER_LEVEL;
}

function cleanItems(items) {
  return (items || [])
    .map((item) => ({
      productId: String(item.productId || ''),
      name: String(item.name || '').trim(),
      qty: Number(item.qty),
      unitCost: Number(item.unitCost || 0),
      sellingPrice: Number(item.sellingPrice || 0),
      reorderLevel: reorderLevelOf(item.reorderLevel),
    }))
    .filter((item) => item.name && Number.isInteger(item.qty) && item.qty > 0);
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
      // '' (not undefined) for an item that is not in Stock, because Firestore rejects undefined
      productId: item.productId || '',
      name: item.name,
      qty: Number(item.qty),
      unitCost: Number(item.unitCost || 0),
      sellingPrice: Number(item.sellingPrice || 0),
      reorderLevel: reorderLevelOf(item.reorderLevel),
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
// Items without a productId are skipped here: markOrderDelivered links or creates them first.
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

const nameKey = (value) => String(value || '').trim().toLowerCase();

// Marks an order delivered and adds its items to Stock. One transaction, so the order can't be
// counted twice and stock never changes without the order changing. Needs an internet connection.
//   - An item linked to a Stock product that still exists adds to that product's quantity.
//   - Otherwise it is matched to a Stock product with the same name, if there is one.
//   - Otherwise a new Stock product is created from the item's name, quantity, cost price,
//     selling price and low-stock threshold.
export async function markOrderDelivered(storeId, orderId, deliveryExpiryDates = []) {
  const sid = assertStoreId(storeId);
  const orderReference = doc(db, ...storeDocPath(sid, 'orders', orderId));
  const productsCollection = collection(db, ...storeCollectionPath(sid, 'products'));

  // A transaction can't run a query, so look up the existing products first
  const existingProducts = await getDocs(productsCollection);
  const existingIds = new Set();
  const idByName = new Map();
  existingProducts.docs.forEach((snapshot) => {
    existingIds.add(snapshot.id);
    const key = nameKey(snapshot.data().name);
    if (key && !idByName.has(key)) idByName.set(key, snapshot.id);
  });
  // The product an item belongs to: its linked product if that still exists (it may have been
  // removed from Stock), else the product with the same name, else none yet.
  const resolveProductId = (item) => (
    item.productId && existingIds.has(item.productId)
      ? item.productId
      : idByName.get(nameKey(item.name)) || ''
  );

  return runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderReference);
    if (!orderSnapshot.exists()) throw new Error('This order no longer exists.');
    const order = orderSnapshot.data();
    if (order.status === 'delivered') throw new Error('This order is already marked as delivered.');

    const items = (Array.isArray(order.items) ? order.items : []).map((item, index) => ({
      ...item,
      expiryDate: validateIsoDate(deliveryExpiryDates[index] || '', 'expiry date', { required: false }) || null,
    }));
    const linkedItems = items.map((item) => ({ ...item, productId: resolveProductId(item) }));

    const productIds = [...new Set(linkedItems.map((item) => item.productId).filter(Boolean))];
    const productReferences = productIds.map((id) => doc(db, ...storeDocPath(sid, 'products', id)));
    const productSnapshots = await Promise.all(productReferences.map((reference) => transaction.get(reference)));
    const stock = new Map(productSnapshots.map((snapshot, index) => [
      productIds[index],
      snapshot.exists() ? Number(snapshot.data().quantity || 0) : null,
    ]));

    // All reads are done. Writes start here.
    const plan = planDelivery(linkedItems.filter((item) => item.productId), stock);
    plan.updates.forEach((update) => {
      const productIndex = productIds.indexOf(update.productId);
      const productData = productSnapshots[productIndex].data();
      const stockBatches = linkedItems
        .filter((item) => item.productId === update.productId)
        .reduce(
          (batches, item) => addStockBatch(batches, Number(item.qty || 0), item.expiryDate),
          normalizeStockBatches(productData)
        );
      transaction.update(doc(db, ...storeDocPath(sid, 'products', update.productId)), {
        quantity: update.newQuantity,
        stockBatches,
        expiryDate: getEarliestStockExpiry(stockBatches),
        updatedAt: serverTimestamp(),
      });
    });

    // Items not in Stock: one new product per distinct name
    const newGroups = new Map();
    linkedItems.filter((item) => !item.productId && nameKey(item.name)).forEach((item) => {
      const key = nameKey(item.name);
      const group = newGroups.get(key) || {
        name: String(item.name).trim(),
        costPrice: 0,
        sellingPrice: 0,
        reorderLevel: DEFAULT_REORDER_LEVEL,
        items: [],
      };
      group.items.push(item);
      if (Number(item.unitCost) > 0) group.costPrice = Number(item.unitCost);
      if (Number(item.sellingPrice) > 0) group.sellingPrice = Number(item.sellingPrice);
      group.reorderLevel = reorderLevelOf(item.reorderLevel);
      newGroups.set(key, group);
    });
    const createdIdByName = new Map();
    const created = [];
    newGroups.forEach((group, key) => {
      const productReference = doc(productsCollection);
      const stockBatches = group.items.reduce(
        (batches, item) => addStockBatch(batches, Number(item.qty || 0), item.expiryDate),
        []
      );
      transaction.set(productReference, {
        storeId: sid,
        name: group.name,
        sku: '',
        barcode: '',
        unitPrice: group.sellingPrice,
        costPrice: group.costPrice,
        quantity: group.items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
        reorderLevel: group.reorderLevel,
        category: 'General',
        expiryDate: getEarliestStockExpiry(stockBatches),
        stockBatches,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdIdByName.set(key, productReference.id);
      created.push(group.name);
    });

    // Save the order with the product each item ended up linked to
    const finalItems = linkedItems.map((item) => (
      item.productId ? item : { ...item, productId: createdIdByName.get(nameKey(item.name)) || '' }
    ));
    transaction.update(orderReference, {
      items: finalItems,
      status: 'delivered',
      deliveredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { updated: plan.updates.length, created, skipped: plan.skipped };
  });
}