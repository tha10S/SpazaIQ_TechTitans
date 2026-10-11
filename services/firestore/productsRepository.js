import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapProduct } from './mappers';
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
        const item = operation.payload.cart.find((cartItem) => cartItem.id === product.id);
        return quantity + Number(item?.qty || 0);
      }, 0);
    return reserved ? { ...product, quantity: Math.max(0, product.quantity - reserved) } : product;
  });
}

export async function createProduct(storeId, input) {
  const authenticatedStoreId = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  const unitPrice = Number(input.unitPrice);
  const quantity = Number(input.quantity);
  const reorderLevel = Number(input.reorderLevel);
  if (!name || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(reorderLevel) || reorderLevel < 0) {
    throw new Error('Enter a product name, valid price, quantity, and reorder level.');
  }

  const productReference = doc(productsCollection(authenticatedStoreId));
  await setDoc(productReference, {
    storeId: authenticatedStoreId,
    name,
    sku: String(input.sku || '').trim(),
    barcode: String(input.barcode || '').trim(),
    unitPrice,
    costPrice: Number(input.costPrice || 0),
    quantity,
    reorderLevel,
    category: String(input.category || 'General').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return productReference.id;
}

export async function updateProduct(storeId, productId, input) {
  const authenticatedStoreId = assertStoreId(storeId);
  const name = String(input.name || '').trim();
  const unitPrice = Number(input.unitPrice);
  const quantity = Number(input.quantity);
  const reorderLevel = Number(input.reorderLevel);
  if (!productId || !name || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(reorderLevel) || reorderLevel < 0) {
    throw new Error('Enter a product name, valid price, quantity, and reorder level.');
  }

  await updateDoc(doc(productsCollection(authenticatedStoreId), productId), {
    name,
    sku: String(input.sku || '').trim(),
    barcode: String(input.barcode || '').trim(),
    unitPrice,
    costPrice: Number(input.costPrice || 0),
    quantity,
    reorderLevel,
    category: String(input.category || 'General').trim(),
    updatedAt: serverTimestamp(),
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
