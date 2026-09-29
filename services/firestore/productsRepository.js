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

function productsCollection(storeId) {
  return collection(db, ...storeCollectionPath(storeId, 'products'));
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
  const snapshot = await getDocs(query(productsCollection(authenticatedStoreId), orderBy('name')));
  const products = snapshot.docs.map(mapProduct);
  const term = searchTerm.trim().toLowerCase();
  return term
    ? products.filter((product) => [product.name, product.sku, product.barcode].some((value) => value.toLowerCase().includes(term)))
    : products;
}

export function subscribeProducts(storeId, searchTerm, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  const term = searchTerm.trim().toLowerCase();
  const productsQuery = query(productsCollection(authenticatedStoreId), orderBy('name'));
  return onSnapshot(productsQuery, (snapshot) => {
    const products = snapshot.docs.map(mapProduct).filter((product) =>
      !term || [product.name, product.sku, product.barcode].some((value) => value.toLowerCase().includes(term))
    );
    onData(products);
  }, onError);
}

export function subscribeLowStockProducts(storeId, onData, onError) {
  const authenticatedStoreId = assertStoreId(storeId);
  const productsQuery = query(productsCollection(authenticatedStoreId), where('quantity', '<=', 10), orderBy('quantity'));
  return onSnapshot(productsQuery, (snapshot) => onData(snapshot.docs.map(mapProduct)), onError);
}
