import { getState } from '../mock/mockData.js';

export async function fetchSpazaIQData(storeId) {
  if (storeId === 'mock-store-1') {
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

  const { fetchAssistantData } = await import('../firestore/assistantRepository.js');
  return fetchAssistantData(storeId);
}
