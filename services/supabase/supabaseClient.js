import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fill these in from your Supabase project settings (Project Settings > API)
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/*
Suggested schema (run in Supabase SQL editor):

create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores not null,
  name text not null,
  unit_price numeric not null,
  created_at timestamptz default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores not null,
  payment_method text not null check (payment_method in ('cash','card','eft','credit')),
  total numeric not null,
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales on delete cascade not null,
  product_id uuid references products not null,
  qty integer not null,
  unit_price numeric not null
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores not null,
  name text not null,
  phone text, -- E.164 format for WhatsApp, e.g. +27821234567
  created_at timestamptz default now()
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers not null,
  store_id uuid references stores not null,
  amount numeric not null,          -- positive = credit given, negative = repayment
  due_date date,
  created_at timestamptz default now()
);

-- A view that gives each customer's running balance without manual denormalization
create view customer_balances as
select
  c.id,
  c.store_id,
  c.name,
  c.phone,
  coalesce(sum(ct.amount), 0) as balance,
  min(ct.due_date) filter (where ct.amount > 0) as next_due_date
from customers c
left join credit_transactions ct on ct.customer_id = c.id
group by c.id;

-- Row-level security: a store owner only sees their own store's rows
alter table customers enable row level security;
alter table credit_transactions enable row level security;
alter table sales enable row level security;

create policy "Owner reads own customers" on customers
  for select using (store_id in (select id from stores where owner_id = auth.uid()));
create policy "Owner writes own customers" on customers
  for insert with check (store_id in (select id from stores where owner_id = auth.uid()));
-- (repeat similar select/insert/update policies for credit_transactions and sales)
*/