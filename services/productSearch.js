export function filterProductsBySearch(products, searchTerm = '') {
  const term = String(searchTerm ?? '').trim().toLowerCase();
  if (!term) return products;

  return products.filter((product) =>
    [product.name, product.sku, product.barcode]
      .map((value) => String(value ?? '').toLowerCase())
      .some((value) => value.includes(term))
  );
}
