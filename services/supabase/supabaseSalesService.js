import { supabase } from './supabaseClient';

export async function fetchProducts(storeId, searchTerm = '') {
  let query = supabase.from('products').select('*').eq('store_id', storeId);
  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data;
}

/**
 * Records a completed sale and its line items in one transaction
 * (via a Postgres function, so it's atomic — see note below).
 */
export async function recordSale({ storeId, cart, paymentMethod, total }) {
  const { data, error } = await supabase.rpc('record_sale', {
    p_store_id: storeId,
    p_payment_method: paymentMethod,
    p_total: total,
    p_items: cart.map((item) => ({
      product_id: item.id,
      qty: item.qty,
      unit_price: item.unitPrice,
    })),
  });

  if (error) throw error;
  return data;
}

/*
Matching Postgres function (SQL editor):

create or replace function record_sale(
  p_store_id uuid,
  p_payment_method text,
  p_total numeric,
  p_items jsonb
) returns uuid as $$
declare
  v_sale_id uuid;
begin
  insert into sales (store_id, payment_method, total)
  values (p_store_id, p_payment_method, p_total)
  returning id into v_sale_id;

  insert into sale_items (sale_id, product_id, qty, unit_price)
  select v_sale_id, (item->>'product_id')::uuid, (item->>'qty')::int, (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_sale_id;
end;
$$ language plpgsql security definer;
*/