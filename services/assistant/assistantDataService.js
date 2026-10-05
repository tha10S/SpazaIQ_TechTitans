import { getState } from '../mock/mockData.js';

const LOCAL_SUPPLIERS = [
  { name: 'Sizwe Wholesalers', category: 'Groceries', phone: '082 345 6712' },
  { name: 'Cape Cold Drinks Co.', category: 'Beverages', phone: '071 902 4483' },
  { name: 'Fresh Bake Distributors', category: 'Bakery', phone: '083 221 0099' },
];

async function fetchLocalAssistantData() {
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
    suppliers: Array.isArray(state.suppliers) && state.suppliers.length ? state.suppliers : LOCAL_SUPPLIERS,
  };
}

function addLocalSupplierFallback(data) {
  return {
    ...data,
    suppliers: Array.isArray(data.suppliers) && data.suppliers.length ? data.suppliers : LOCAL_SUPPLIERS,
  };
}

export async function fetchSpazaIQData(storeId) {
  if (storeId === 'mock-store-1' || !storeId) return fetchLocalAssistantData();

  try {
    const { fetchAssistantData } = await import('../firestore/assistantRepository.js');
    return addLocalSupplierFallback(await fetchAssistantData(storeId));
  } catch (error) {
    console.warn('[assistantDataService] Using offline assistant data', error?.message || error);
    return fetchLocalAssistantData();
  }
}
