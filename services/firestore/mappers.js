function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function mapProduct(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  return {
    id: snapshot.id ?? data.id,
    name: data.name ?? '',
    sku: data.sku ?? '',
    barcode: data.barcode ?? '',
    unit_price: Number(data.unitPrice ?? data.unit_price ?? 0),
    cost_price: Number(data.costPrice ?? data.cost_price ?? 0),
    quantity: Number(data.quantity ?? data.stockQuantity ?? 0),
    reorder_level: Number(data.reorderLevel ?? data.reorder_level ?? 0),
    category: data.category ?? 'General',
    updated_at: timestampToIso(data.updatedAt ?? data.updated_at),
  };
}

export function mapCustomer(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  const balance = Number(data.balance ?? currentBalance(data.ledgerBalance));
  const nextDueDate = data.nextDueDate ?? data.next_due_date ?? null;
  const overdueByDate = nextDueDate && new Date(nextDueDate) < new Date() && balance > 0;
  const overdue = Boolean(data.overdue || data.overdueBalance > 0 || overdueByDate);
  return {
    id: snapshot.id ?? data.id,
    name: data.name ?? '',
    phone: data.phone ?? '',
    creditLimit: Number(data.creditLimit ?? 0),
    balance,
    nextDueDate,
    overdue,
    overdueBalance: overdue ? Number(data.overdueBalance ?? balance) : 0,
    status: overdue ? 'at_risk' : balance > 0 ? 'fair' : 'good',
  };
}

function currentBalance(value) {
  return Number(value ?? 0);
}

export function mapLedgerEntry(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  return {
    id: snapshot.id ?? data.id,
    customerId: data.customerId ?? data.customer_id,
    storeId: data.storeId ?? data.store_id,
    type: data.type ?? (Number(data.amount) < 0 ? 'payment' : 'credit'),
    amount: Number(data.amount ?? 0),
    dueDate: data.dueDate ?? data.due_date ?? null,
    idempotencyKey: data.idempotencyKey ?? null,
    createdAt: timestampToIso(data.createdAt ?? data.created_at),
  };
}

export function mapSale(snapshot) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  return {
    id: snapshot.id ?? data.id,
    paymentMethod: data.paymentMethod ?? data.payment_method,
    total: Number(data.total ?? 0),
    paidAmount: Number(data.paidAmount ?? 0),
    creditAmount: Number(data.creditAmount ?? 0),
    customerId: data.customerId ?? null,
    items: data.items ?? [],
    createdAt: timestampToIso(data.createdAt ?? data.created_at),
  };
}
