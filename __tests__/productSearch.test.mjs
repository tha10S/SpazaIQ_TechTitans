import test from 'node:test';
import assert from 'node:assert/strict';

const { filterProductsBySearch } = await import('../services/productSearch.js');

const products = [
  { id: '1', name: 'Brown Bread', sku: 'BR-01', barcode: '600123' },
  { id: '2', name: 'Full Cream Milk', sku: 'ML-02', barcode: '700456' },
];

test('product search matches names, SKUs, and barcodes without case sensitivity', () => {
  assert.deepEqual(filterProductsBySearch(products, 'BROWN'), [products[0]]);
  assert.deepEqual(filterProductsBySearch(products, 'ml-02'), [products[1]]);
  assert.deepEqual(filterProductsBySearch(products, '700456'), [products[1]]);
});

test('product search trims input and returns all products for an empty query', () => {
  assert.deepEqual(filterProductsBySearch(products, '  milk  '), [products[1]]);
  assert.deepEqual(filterProductsBySearch(products, '  '), products);
});

test('product search returns an empty list when there are no matches', () => {
  assert.deepEqual(filterProductsBySearch(products, 'coffee'), []);
});
