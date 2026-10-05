// Firestore is the single source of truth for products and sales.
export {
  fetchProducts,
  subscribeProducts,
  createProduct,
  updateProduct,
} from './firestore/productsRepository';
export {
  fetchSales,
  subscribeSales,
  recordSale,
} from './firestore/salesRepository';