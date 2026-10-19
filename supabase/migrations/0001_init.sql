-- Weekend 1 schema: photo-to-lithophane ordering.
-- Run in the Supabase SQL editor, or via `supabase db push` / psql.

create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists order_no_seq start 1;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null default 'Received',
  quote_amount numeric(10, 2),
  needed_by date,
  address text not null,
  pincode text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_order_no()
returns trigger as $$
begin
  if new.order_no is null then
    new.order_no := 'PR-' || lpad(nextval('order_no_seq')::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_order_no on orders;
create trigger trg_set_order_no
  before insert on orders
  for each row
  execute function set_order_no();

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_touch on orders;
create trigger trg_orders_touch
  before update on orders
  for each row
  execute function touch_updated_at();

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null check (type in ('photo_lamp', 'stl_upload')),
  size text,
  options jsonb not null default '{}'::jsonb,
  qty integer not null default 1 check (qty > 0),
  params_json jsonb not null default '{}'::jsonb,
  source_file_path text,
  generated_file_path text,
  preview_image_path text,
  created_at timestamptz not null default now()
);

create table if not exists status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_status_events_order_id on status_events(order_id);
create index if not exists idx_orders_status on orders(status);

-- Lock every table down from the anon/authenticated roles. The app only
-- ever talks to Supabase with the service-role key (server-side), which
-- bypasses RLS, so these tables are intentionally policy-less.
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table status_events enable row level security;
