export function buildDashboardSummary(data, now = new Date()) {
  const sales = data.sales ?? [];
  const monthSales = sales.filter((sale) => {
    if (!sale.created_at) return false;
    const date = new Date(sale.created_at);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });

  const customerBalances = (data.customers ?? [])
    .map((customer) => {
      const balance = (data.creditTransactions ?? [])
        .filter((transaction) => String(transaction.customer_id) === String(customer.id))
        .reduce((total, transaction) => total + Number(transaction.amount ?? 0), 0);
      return { ...customer, balance };
    })
    .filter((customer) => customer.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const productTotals = new Map();
  const saleItems = data.saleItems?.length
    ? data.saleItems
    : sales.flatMap((sale) => sale.items ?? []);

  for (const item of saleItems) {
    const key = item.product_id ?? item.id ?? item.name ?? item.products?.name;
    if (!key) continue;
    const product = productTotals.get(key) ?? {
      name: item.name ?? item.products?.name ?? 'Unnamed product',
      quantity: 0,
    };
    product.quantity += Number(item.qty ?? item.quantity ?? 0);
    productTotals.set(key, product);
  }

  const bestSeller = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity)[0] ?? null;
  return {
    monthSalesTotal: monthSales.reduce((total, sale) => total + Number(sale.total ?? 0), 0),
    monthSalesCount: monthSales.length,
    outstandingCredit: customerBalances.reduce((total, customer) => total + customer.balance, 0),
    creditAccountCount: customerBalances.length,
    priorityCustomer: customerBalances[0] ?? null,
    bestSeller,
  };
}