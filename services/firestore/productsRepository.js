import {
  collection,
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
import { addStockBatch, getEarliestStockExpiry, reconcileStockBatches } from './stockBatches';
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

export async function createProduct(storeId, input) {
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
  return productReference.id;
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
