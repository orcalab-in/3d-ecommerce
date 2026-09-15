-- =============================================================================
-- 3D Printing E-commerce — PostgreSQL Schema (Supabase)
-- =============================================================================
-- Conventions:
--   • UUID primary keys (gen_random_uuid())
--   • NUMERIC(12,2) for all monetary values (never float)
--   • CHECK constraints mirror the Pydantic Field(...) validations
--   • created_at / updated_at on every mutable table (auto via trigger)
--   • Index FKs + any column you filter or sort by
--   • RLS is NOT used — the API uses the service-role key.
--
-- Tenancy model (deviates from the single-tenant blueprint):
--   • CATALOG tables (categories, products, product_categories, color_palette,
--     product_colors, pricing_config, serviceable_pincodes, print_jobs) are
--     GLOBAL and admin-owned — no user_id; writes are gated by role='admin'
--     in the API (CurrentAdmin dependency).
--   • PER-USER tables (cart_items, addresses, orders, order_items, stl_uploads)
--     carry user_id and MUST be filtered by .eq("user_id", ...) on every query.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()


-- ---------------------------------------------------------------------------
-- 1. Updated-at trigger function (apply to every mutable table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. Users (created/updated on every sign-in; UPSERT on the provider id)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id   TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  picture_url TEXT,
  phone       TEXT,
  role        TEXT        NOT NULL DEFAULT 'customer'
                          CHECK (role IN ('customer', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- CATALOG (global / admin-owned — no user_id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3. Categories (self-referencing hierarchy → a model can sit in many)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  description TEXT,
  parent_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent_id  ON categories(parent_id);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Color palette (global set of printable filament colors)
-- ---------------------------------------------------------------------------
CREATE TABLE color_palette (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  hex_code   TEXT        UNIQUE NOT NULL CHECK (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  in_stock   BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_color_palette_updated_at
  BEFORE UPDATE ON color_palette
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 5. Products (3D print models)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT           NOT NULL,
  slug              TEXT           UNIQUE NOT NULL,
  description       TEXT,
  weight_grams      NUMERIC(10, 2) NOT NULL CHECK (weight_grams > 0),
  base_price        NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
  currency          TEXT           NOT NULL DEFAULT 'INR',
  status            TEXT           NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'active', 'out_of_stock', 'archived')),
  preview_image_url TEXT,
  model_file_url    TEXT,
  est_print_minutes INTEGER        NOT NULL DEFAULT 0 CHECK (est_print_minutes >= 0),
  width_mm          NUMERIC(8, 2)  CHECK (width_mm  IS NULL OR width_mm  > 0),
  depth_mm          NUMERIC(8, 2)  CHECK (depth_mm  IS NULL OR depth_mm  > 0),
  height_mm         NUMERIC(8, 2)  CHECK (height_mm IS NULL OR height_mm > 0),
  max_colors        INTEGER        NOT NULL DEFAULT 1 CHECK (max_colors BETWEEN 1 AND 4),
  featured          BOOLEAN        NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_status     ON products(status);
CREATE INDEX idx_products_base_price ON products(base_price);
CREATE INDEX idx_products_featured   ON products(featured);
CREATE INDEX idx_products_name       ON products(name);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 6. Product ↔ Category (a model can belong to multiple categories)
-- ---------------------------------------------------------------------------
CREATE TABLE product_categories (
  product_id  UUID NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);


-- ---------------------------------------------------------------------------
-- 7. Product ↔ Color (colors a model is available in)
-- ---------------------------------------------------------------------------
CREATE TABLE product_colors (
  product_id UUID NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  color_id   UUID NOT NULL REFERENCES color_palette(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, color_id)
);

CREATE INDEX idx_product_colors_color_id ON product_colors(color_id);


-- ---------------------------------------------------------------------------
-- 8. Pricing config (admin-managed rates for the print price calculator)
--    Single active row pattern; keep history by inserting new rows.
-- ---------------------------------------------------------------------------
CREATE TABLE pricing_config (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  filament_price_per_gram  NUMERIC(10, 4) NOT NULL CHECK (filament_price_per_gram >= 0),
  electricity_rate_per_kwh NUMERIC(10, 4) NOT NULL CHECK (electricity_rate_per_kwh >= 0),
  printer_power_watts      NUMERIC(10, 2) NOT NULL CHECK (printer_power_watts >= 0),
  labor_rate_per_hour      NUMERIC(10, 2) NOT NULL CHECK (labor_rate_per_hour >= 0),
  margin_pct               NUMERIC(6, 2)  NOT NULL DEFAULT 0 CHECK (margin_pct >= 0),
  is_active                BOOLEAN        NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 9. Serviceable pincodes (delivery location availability)
-- ---------------------------------------------------------------------------
CREATE TABLE serviceable_pincodes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode    TEXT        UNIQUE NOT NULL,
  city       TEXT        NOT NULL,
  state      TEXT        NOT NULL,
  eta_days   INTEGER     NOT NULL DEFAULT 5 CHECK (eta_days >= 0),
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_serviceable_pincodes_pincode ON serviceable_pincodes(pincode);

CREATE TRIGGER trg_serviceable_pincodes_updated_at
  BEFORE UPDATE ON serviceable_pincodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- PER-USER (carry user_id — filter on EVERY query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 10. Addresses
-- ---------------------------------------------------------------------------
CREATE TABLE addresses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label          TEXT        NOT NULL DEFAULT 'Home',
  recipient_name TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  line1          TEXT        NOT NULL,
  line2          TEXT,
  city           TEXT        NOT NULL,
  state          TEXT        NOT NULL,
  pincode        TEXT        NOT NULL,
  is_default     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 11. STL uploads (custom user models for the price calculator)
-- ---------------------------------------------------------------------------
CREATE TABLE stl_uploads (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name         TEXT           NOT NULL,
  file_url          TEXT,
  file_unit         TEXT           NOT NULL DEFAULT 'mm' CHECK (file_unit IN ('mm', 'inch')),
  volume_cm3        NUMERIC(12, 3) CHECK (volume_cm3 IS NULL OR volume_cm3 >= 0),
  est_weight_grams  NUMERIC(10, 2) CHECK (est_weight_grams IS NULL OR est_weight_grams >= 0),
  est_print_minutes INTEGER        CHECK (est_print_minutes IS NULL OR est_print_minutes >= 0),
  quoted_price      NUMERIC(12, 2) CHECK (quoted_price IS NULL OR quoted_price >= 0),
  status            TEXT           NOT NULL DEFAULT 'uploaded'
                                   CHECK (status IN ('uploaded', 'quoted', 'ordered')),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_stl_uploads_user_id ON stl_uploads(user_id);

CREATE TRIGGER trg_stl_uploads_updated_at
  BEFORE UPDATE ON stl_uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 12. Cart items
-- ---------------------------------------------------------------------------
CREATE TABLE cart_items (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID           NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  product_id        UUID           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity          INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selected_color_ids JSONB         NOT NULL DEFAULT '[]'::jsonb,
  scale             NUMERIC(6, 3)  NOT NULL DEFAULT 1.0 CHECK (scale > 0),
  width_mm          NUMERIC(8, 2)  CHECK (width_mm  IS NULL OR width_mm  > 0),
  depth_mm          NUMERIC(8, 2)  CHECK (depth_mm  IS NULL OR depth_mm  > 0),
  height_mm         NUMERIC(8, 2)  CHECK (height_mm IS NULL OR height_mm > 0),
  unit_price        NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_cart_items_user_id    ON cart_items(user_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 13. Orders + order items
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID           NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  address_id             UUID           REFERENCES addresses(id)          ON DELETE SET NULL,
  status                 TEXT           NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending', 'confirmed', 'printing',
                                                          'shipped', 'delivered', 'cancelled')),
  subtotal               NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total                  NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  expected_delivery_date DATE,
  placed_at              TIMESTAMPTZ    NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(status);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE order_items (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID           NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id         UUID           REFERENCES products(id)          ON DELETE SET NULL,
  stl_upload_id      UUID           REFERENCES stl_uploads(id)       ON DELETE SET NULL,
  name_snapshot      TEXT           NOT NULL,
  quantity           INTEGER        NOT NULL CHECK (quantity > 0),
  unit_price         NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  selected_color_ids JSONB          NOT NULL DEFAULT '[]'::jsonb,
  width_mm           NUMERIC(8, 2),
  depth_mm           NUMERIC(8, 2),
  height_mm          NUMERIC(8, 2),
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);


-- ---------------------------------------------------------------------------
-- 14. Print jobs (production queue — global/admin)
-- ---------------------------------------------------------------------------
CREATE TABLE print_jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id  UUID        NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  printer_name   TEXT        NOT NULL DEFAULT 'Bambu Lab A1',
  status         TEXT        NOT NULL DEFAULT 'queued'
                             CHECK (status IN ('queued', 'printing', 'completed', 'failed')),
  queue_position INTEGER     NOT NULL DEFAULT 0,
  est_minutes    INTEGER     NOT NULL DEFAULT 0 CHECK (est_minutes >= 0),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_jobs_status         ON print_jobs(status);
CREATE INDEX idx_print_jobs_queue_position ON print_jobs(queue_position);
CREATE INDEX idx_print_jobs_order_item_id  ON print_jobs(order_item_id);

CREATE TRIGGER trg_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 15. Seed data (system defaults)
-- =============================================================================
INSERT INTO color_palette (name, hex_code) VALUES
  ('Black',  '#1A1A1A'),
  ('White',  '#F5F5F5'),
  ('Red',    '#E5322D'),
  ('Blue',   '#2D6BE5'),
  ('Green',  '#3FA34D'),
  ('Yellow', '#F2C037'),
  ('Orange', '#F08A24'),
  ('Gray',   '#8A8A8A')
ON CONFLICT (hex_code) DO NOTHING;

INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Miniatures',  'miniatures',  'Tabletop and display miniatures', 1),
  ('Functional',  'functional',  'Brackets, mounts and tools',      2),
  ('Home Decor',  'home-decor',  'Vases, planters and ornaments',   3),
  ('Toys',        'toys',        'Articulated and fidget toys',     4),
  ('Prototyping', 'prototyping', 'Engineering prototypes',          5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO pricing_config
  (filament_price_per_gram, electricity_rate_per_kwh, printer_power_watts, labor_rate_per_hour, margin_pct)
VALUES
  (2.50, 8.00, 100.00, 60.00, 20.00);
