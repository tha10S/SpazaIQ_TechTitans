import { getDocs, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { assertStoreId, storeCollectionPath } from './paths';
import { mapCustomer, mapLedgerEntry, mapProduct, mapSale } from './mappers';

export async function fetchAssistantData(storeId) {
  const authenticatedStoreId = assertStoreId(storeId);
  const [productsSnapshot, salesSnapshot, customersSnapshot, ledgerSnapshot] = await Promise.all([
    getDocs(query(collection(db, ...storeCollectionPath(authenticatedStoreId, 'products')), orderBy('name'))),
    getDocs(query(collection(db, ...storeCollectionPath(authenticatedStoreId, 'sales')), orderBy('createdAt', 'desc'), limit(200))),
    getDocs(query(collection(db, ...storeCollectionPath(authenticatedStoreId, 'customers')), orderBy('name'))),
    getDocs(query(collection(db, ...storeCollectionPath(authenticatedStoreId, 'creditTransactions')), orderBy('createdAt', 'desc'), limit(500))),
  ]);

  const sales = salesSnapshot.docs.map(mapSale);
  return {
    products: productsSnapshot.docs.map(mapProduct),
    sales: sales.map((sale) => ({ ...sale, created_at: sale.createdAt, payment_method: sale.paymentMethod })),
    saleItems: sales.flatMap((sale) => (sale.items ?? []).map((item) => ({
      ...item,
      product_id: item.id,
      sale_id: sale.id,
      created_at: sale.createdAt,
      unit_price: item.unitPrice,
    }))),
    customers: customersSnapshot.docs.map(mapCustomer),
    creditTransactions: ledgerSnapshot.docs.map((entry) => ({
      ...mapLedgerEntry(entry),
      customer_id: mapLedgerEntry(entry).customerId,
      created_at: mapLedgerEntry(entry).createdAt,
      due_date: mapLedgerEntry(entry).dueDate,
    })),
    inventory: productsSnapshot.docs.map(mapProduct),
    expenses: null,
    suppliers: null,
  };
}
