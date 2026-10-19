-- Admin-editable business settings: pricing, WhatsApp contact number, and
-- the Diwali order-cutoff banner. Previously hardcoded in src/lib/config.ts
-- (which still holds fallback defaults -- see src/lib/settings.ts).

create table if not exists app_settings (
  id smallint primary key default 1 check (id = 1),
  whatsapp_number text not null,
  pricing jsonb not null,
  diwali_cutoff_date date,
  diwali_cutoff_message text,
  updated_at timestamptz not null default now()
);

create or replace function touch_app_settings_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_settings_touch on app_settings;
create trigger trg_app_settings_touch
  before update on app_settings
  for each row
  execute function touch_app_settings_updated_at();

insert into app_settings (id, whatsapp_number, pricing, diwali_cutoff_date, diwali_cutoff_message)
values (
  1,
  '918939244089',
  '{"100x150":{"none":499,"led":799},"150x200":{"none":799,"led":1199}}'::jsonb,
  '2026-10-30',
  'Heads up: orders placed after 30 Oct may not arrive before Diwali. We''ll still take your order, but can''t guarantee delivery in time.'
)
on conflict (id) do nothing;

alter table app_settings enable row level security;
-- No anon/authenticated policies -- same service-role-only pattern as every other table.
