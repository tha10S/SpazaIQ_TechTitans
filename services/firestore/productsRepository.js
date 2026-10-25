import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapProduct } from './mappers';
import { parseNonNegativeNumber, validateIsoDate } from '../validation';
import { addStockBatch, getEarliestStockExpiry, normalizeStockBatches, reconcileStockBatches } from './stockBatches';
import {
  getOfflineOperations,
  isNetworkError,
  readPosCreditSnapshot,
  savePosCreditSnapshot,
  subscribeOfflineOperations,
} from '../offline/posCreditQueue';

function matchesSearch(product, term) {
  return !term || [product.name, product.sku, product.barcode]
    .map((value) => String(value ?? '').toLowerCase())
    .some((value) => value.includes(term));
}

function productsCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'products'));
}

function applyPendingStock(products, operations) {
  return products.map((product) => {
    const reserved = operations
      .filter((operation) => operation.type === 'recordSale' && operation.status !== 'failed')
      .reduce((quantity, operation) => {
        const reserved = operation.payload.cart
          .filter((cartItem) => cartItem.id === product.id)
          .reduce((sum, cartItem) => sum + Number(cartItem.qty || 0), 0);
        return quantity + reserved;
      }, 0);
    if (!reserved) return product;
    const stockBatches = reconcileStockBatches(product, Math.max(0, product.quantity - reserved), product.expiry_date);
    return {
      ...product,
      quantity: Math.max(0, product.quantity - reserved),
      expiry_date: getEarliestStockExpiry(stockBatches) || '',
      stock_batches: stockBatches.map((batch) => ({
        quantity: batch.quantity,
        expiry_date: batch.expiryDate || '',
      })),
    };
  });
}

// Product names are compared ignoring capitals and extra spaces
const nameKey = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// The existing product with this name, if there is one
async function findProductByName(storeId, name, excludeId = null) {
  const snapshot = await getDocs(productsCollection(storeId));
  const key = nameKey(name);
  return snapshot.docs.find((item) => item.id !== excludeId && nameKey(item.data().name) === key) || null;
}

// Adds a product. If a product with the same name already exists, the quantity is added to that
// product instead of creating a second entry, and its other details are left as they are.
// Returns { id, name, merged, added, quantity }.
export async function saveNewProduct(storeId, input) {
  const authenticatedStoreId = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  const category = String(input.category || 'General').trim();
  if (!name) throw new Error('Enter a product name.');
  if (!category) throw new Error('Enter a product category.');
  const unitPrice = parseNonNegativeNumber(input.unitPrice, 'selling price');
  const costPrice = parseNonNegativeNumber(input.costPrice || '0', 'cost price');
  const quantity = parseNonNegativeNumber(input.quantity, 'quantity', { integer: true });
  const reorderLevel = parseNonNegativeNumber(input.reorderLevel, 'low-stock threshold', { integer: true });
  const expiryDate = validateIsoDate(input.expiryDate ?? input.expiry_date, 'expiry date', { required: false });

  const existing = await findProductByName(authenticatedStoreId, name);
  if (existing) {
    let newQuantity = 0;
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(existing.ref);
      if (!snapshot.exists()) throw new Error('This product no longer exists. Try adding it again.');
      const data = snapshot.data();
      newQuantity = Number(data.quantity || 0) + quantity;
      const stockBatches = addStockBatch(normalizeStockBatches(data), quantity, expiryDate);
      transaction.update(existing.ref, {
        quantity: newQuantity,
        stockBatches,
        expiryDate: getEarliestStockExpiry(stockBatches),
        updatedAt: serverTimestamp(),
      });
    });
    return { id: existing.id, name: String(existing.data().name || name), merged: true, added: quantity, quantity: newQuantity };
  }

  const productReference = doc(productsCollection(authenticatedStoreId));
  const stockBatches = addStockBatch([], quantity, expiryDate);
  await setDoc(productReference, {
    storeId: authenticatedStoreId,
    name,
    sku: String(input.sku || '').trim(),
    barcode: String(input.barcode || '').trim(),
    unitPrice,
    costPrice,
    quantity,
    reorderLevel,
    category,
    expiryDate: expiryDate || null,
    stockBatches,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: productReference.id, name, merged: false, added: quantity, quantity };
}

export async function createProduct(storeId, input) {
  return (await saveNewProduct(storeId, input)).id;
}

export async function updateProduct(storeId, productId, input) {
  const authenticatedStoreId = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  const category = String(input.category || 'General').trim();
  if (!productId || !name) throw new Error('Enter a product name.');
  if (!category) throw new Error('Enter a product category.');
  const unitPrice = parseNonNegativeNumber(input.unitPrice, 'selling price');
  const costPrice = parseNonNegativeNumber(input.costPrice || '0', 'cost price');
  const quantity = parseNonNegativeNumber(input.quantity, 'quantity', { integer: true });
  const reorderLevel = parseNonNegativeNumber(input.reorderLevel, 'low-stock threshold', { integer: true });
  const expiryDate = validateIsoDate(input.expiryDate ?? input.expiry_date, 'expiry date', { required: false });

  const duplicate = await findProductByName(authenticatedStoreId, name, productId);
  if (duplicate) {
    throw new Error(`A product named "${name}" already exists. Edit that one instead, or choose a different name.`);
  }

  const productReference = doc(productsCollection(authenticatedStoreId), productId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productReference);
    if (!snapshot.exists()) throw new Error('This product no longer exists.');
    const stockBatches = reconcileStockBatches(snapshot.data(), quantity, expiryDate);
    transaction.update(productReference, {
      name,
      sku: String(input.sku || '').trim(),
      barcode: String(input.barcode || '').trim(),
      unitPrice,
      costPrice,
      quantity,
      reorderLevel,
      category,
      expiryDate: getEarliestStockExpiry(stockBatches) || (quantity <= 0 ? expiryDate || null : null),
      stockBatches,
      updatedAt: serverTimestamp(),
    });
  });
}

// Removes a product from Stock. Past sales keep their own copy of the item name and price,
// so they are not affected.
export async function deleteProduct(storeId, productId) {
  const authenticatedStoreId = assertStoreId(storeId);
  if (!productId) throw new Error('Choose a product to remove.');
  await deleteDoc(doc(productsCollection(authenticatedStoreId), productId));
}

export async function fetchProducts(storeId, searchTerm = '') {
  const authenticatedStoreId = assertStoreId(storeId);
  let products;
  try {
    const snapshot = await getDocs(query(productsCollection(authenticatedStoreId), orderBy('name')));
    products = snapshot.docs.map(mapProduct);
    await savePosCreditSnapshot(authenticatedStoreId, 'products', products);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    products = await readPosCreditSnapshot(authenticatedStoreId, 'products');
    if (!Array.isArray(products)) throw error;
  }
  const operations = await getOfflineOperations(authenticatedStoreId);
  const term = searchTerm.trim().toLowerCase();
  return applyPendingStock(products, operations).filter((product) => matchesSearch(product, term));
}

export function subscribeProducts(storeId, searchTerm, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  const term = searchTerm.trim().toLowerCase();
  const productsQuery = query(productsCollection(authenticatedStoreId), orderBy('name'));
  let active = true;
  let cachedProducts = null;
  let queuedOperations = [];
  let unsubscribe = () => {};
  let unsubscribeQueue = () => {};
  const publishProducts = (products) => onData(
    applyPendingStock(products, queuedOperations).filter((product) => matchesSearch(product, term))
  );
  const start = async () => {
    try {
      cachedProducts = await readPosCreditSnapshot(authenticatedStoreId, 'products');
      if (cachedProducts !== null && !Array.isArray(cachedProducts)) {
        throw new Error('The saved offline product list is invalid.');
      }
      if (active && cachedProducts) publishProducts(cachedProducts);
    } catch (error) {
      if (active) onError(error);
    }
    if (!active) return;
    unsubscribeQueue = subscribeOfflineOperations(authenticatedStoreId, (operations) => {
      queuedOperations = operations;
      if (active && cachedProducts) publishProducts(cachedProducts);
    }, onError);
    unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      if (snapshot.metadata.fromCache && cachedProducts?.length) return;
      const products = snapshot.docs.map(mapProduct);
      if (!snapshot.metadata.fromCache) {
        cachedProducts = products;
        savePosCreditSnapshot(authenticatedStoreId, 'products', products).catch(onError);
      }
      cachedProducts = products;
      publishProducts(products);
    }, (error) => {
      if (cachedProducts) publishProducts(cachedProducts);
      onError(error);
    });
  };
  start();
  return () => {
    active = false;
    unsubscribe();
    unsubscribeQueue();
  };
}

export function subscribeLowStockProducts(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  const productsQuery = query(productsCollection(authenticatedStoreId), where('quantity', '<=', 10), orderBy('quantity'));
  return onSnapshot(productsQuery, (snapshot) => onData(snapshot.docs.map(mapProduct)), onError);
}