-- Weekend 2: customer accounts (Supabase Auth), published pricing, and a
-- fixed ready-made product catalog. Run after 0001_init.sql.

-- Accounts: link a customer record to a Supabase Auth user. Nullable --
-- guest checkout (no login) still works exactly as before; only logged-in
-- orders get linked, which is what powers "My Orders".
alter table customers add column if not exists user_id uuid references auth.users(id);
alter table customers add column if not exists email text;
create index if not exists idx_customers_user_id on customers(user_id);

-- Catalog: fixed, ready-made items (no customization/upload step).
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table order_items drop constraint if exists order_items_type_check;
alter table order_items add constraint order_items_type_check
  check (type in ('photo_lamp', 'stl_upload', 'catalog_product'));
alter table order_items add column if not exists product_id uuid references products(id);

alter table products enable row level security;
-- No anon/authenticated policies -- same service-role-only pattern as every
-- other table. The /shop pages read via supabaseAdmin() server-side.
