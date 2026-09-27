import { USE_MOCK_BACKEND } from '../config.js';
import { getState } from '../mock/mockData.js';
import { supabase } from '../supabase/supabaseClient.js';

export async function fetchSpazaIQData(storeId) {
  if (USE_MOCK_BACKEND) {
    const state = await getState();
    const productsById = new Map((state.products ?? []).map((product) => [product.id, product]));
    return {
      products: state.products ?? [],
      sales: state.sales ?? [],
      saleItems: (state.sales ?? []).flatMap((sale) =>
        (sale.items ?? []).map((item) => {
          const product = productsById.get(item.product_id ?? item.id);
          return {
            ...item,
            product_id: item.product_id ?? item.id,
            name: item.name ?? product?.name,
            unit_price: item.unit_price ?? item.unitPrice ?? product?.unit_price,
            sale_id: sale.id,
            created_at: sale.created_at,
          };
        })
      ),
      customers: state.customers ?? [],
      creditTransactions: state.creditTransactions ?? [],
      inventory: null,
      expenses: null,
      suppliers: null,
    };
  }

  const [products, sales, customers, creditTransactions] = await Promise.all([
    supabase.from('products').select('*').eq('store_id', storeId),
    supabase.from('sales').select('*').eq('store_id', storeId),
    supabase.from('customers').select('*').eq('store_id', storeId),
    supabase.from('credit_transactions').select('*').eq('store_id', storeId),
  ]);

  const saleIds = (sales.data ?? []).map((sale) => sale.id);
  const saleItems = saleIds.length
    ? await supabase.from('sale_items').select('*, products(name)').in('sale_id', saleIds)
    : { data: [], error: null };

  for (const result of [products, sales, customers, creditTransactions, saleItems]) {
    if (result.error) throw result.error;
  }

  return {
    products: products.data ?? [],
    sales: sales.data ?? [],
    saleItems: saleItems.data ?? [],
    customers: customers.data ?? [],
    creditTransactions: creditTransactions.data ?? [],
    inventory: null,
    expenses: null,
    suppliers: null,
  };
}
