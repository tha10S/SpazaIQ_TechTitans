import { getState, mutate, delay, generateId } from './mockData';

export async function fetchProducts(_storeId, searchTerm = '') {
  await delay(250);
  const { products } = await getState();
  if (!searchTerm) return products;
  const term = searchTerm.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(term));
}

export async function recordSale({ cart, paymentMethod, total }) {
  await delay();

  const sale = {
    id: generateId('sale'),
    payment_method: paymentMethod,
    total,
    items: cart,
    created_at: new Date().toISOString(),
  };

  await mutate((state) => {
    state.sales.push(sale);
  });

  console.log('[mock] Sale recorded', sale);
  return sale.id;
}