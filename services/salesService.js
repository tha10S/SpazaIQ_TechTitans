// Router: sends calls to the mock backend or Supabase depending on config.
import { USE_MOCK_BACKEND } from './config';

const impl = USE_MOCK_BACKEND
  ? require('./mock/mockSalesService')
  : require('./supabase/supabaseSalesService');

export const fetchProducts = impl.fetchProducts;
export const recordSale = impl.recordSale;
export * from "./firebase/firebaseSalesService";