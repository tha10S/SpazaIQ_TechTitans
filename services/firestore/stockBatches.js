function cleanExpiryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function cleanQuantity(value) {
  const quantity = Number(value ?? 0);
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
}

export function normalizeStockBatches(product = {}) {
  const quantity = cleanQuantity(product.quantity ?? product.stockQuantity);
  const sourceBatches = product.stockBatches ?? product.stock_batches;
  const hasBatches = Array.isArray(sourceBatches);
  const batches = hasBatches
    ? sourceBatches
      .map((batch) => ({
        quantity: cleanQuantity(batch?.quantity),
        expiryDate: cleanExpiryDate(batch?.expiryDate ?? batch?.expiry_date),
      }))
      .filter((batch) => batch.quantity > 0)
    : quantity
      ? [{
        quantity,
        expiryDate: cleanExpiryDate(product.expiryDate ?? product.expiry_date),
      }]
      : [];

  const batchQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
  if (batchQuantity < quantity) {
    batches.push({ quantity: quantity - batchQuantity, expiryDate: null });
  } else if (batchQuantity > quantity) {
    return consumeStockBatches(batches, batchQuantity - quantity).batches;
  }
  return batches;
}

export function consumeStockBatches(batches, quantity) {
  let remaining = cleanQuantity(quantity);
  const allocations = [];
  const byExpiry = [...batches].sort((left, right) => {
    if (!left.expiryDate) return right.expiryDate ? 1 : 0;
    if (!right.expiryDate) return -1;
    return left.expiryDate.localeCompare(right.expiryDate);
  });
  const remainingByIndex = batches.map((batch) => Number(batch.quantity));

  byExpiry.forEach((batch) => {
    if (!remaining) return;
    const index = batches.indexOf(batch);
    const used = Math.min(remainingByIndex[index], remaining);
    if (used <= 0) return;
    allocations.push({ quantity: used, expiryDate: batch.expiryDate || null });
    remainingByIndex[index] -= used;
    remaining -= used;
  });

  return {
    batches: batches
      .map((batch, index) => ({ ...batch, quantity: remainingByIndex[index] }))
      .filter((batch) => batch.quantity > 0),
    allocations,
  };
}

export function addStockBatch(batches, quantity, expiryDate) {
  const added = cleanQuantity(quantity);
  if (!added) return [...batches];
  return [...batches, { quantity: added, expiryDate: cleanExpiryDate(expiryDate) }];
}

export function getEarliestStockExpiry(batches) {
  return batches
    .map((batch) => batch.expiryDate)
    .filter(Boolean)
    .sort()[0] || null;
}

export function reconcileStockBatches(product, newQuantity, expiryDate) {
  const currentQuantity = cleanQuantity(product.quantity ?? product.stockQuantity);
  const nextQuantity = cleanQuantity(newQuantity);
  let batches = normalizeStockBatches(product);

  if (nextQuantity > currentQuantity) {
    batches = addStockBatch(batches, nextQuantity - currentQuantity, expiryDate);
  } else if (nextQuantity < currentQuantity) {
    batches = consumeStockBatches(batches, currentQuantity - nextQuantity).batches;
  } else if (cleanExpiryDate(expiryDate) !== getEarliestStockExpiry(batches)) {
    if (batches.length <= 1) {
      batches = batches.map((batch) => ({ ...batch, expiryDate: cleanExpiryDate(expiryDate) }));
    } else {
      const earliest = getEarliestStockExpiry(batches);
      batches = batches.map((batch) => (
        batch.expiryDate === earliest ? { ...batch, expiryDate: cleanExpiryDate(expiryDate) } : batch
      ));
    }
  }

  return batches;
}
