# 3D Printing E-commerce

A scalable, enterprise-oriented 3D-printing e-commerce platform scaffolded on the
house stack (FastAPI + Supabase + Cloud Run) with an Expo mobile customer app and
a Vite/React web admin console.

## Structure

| Path | What |
|---|---|
| `backend/` | FastAPI API (Python 3.13) — catalog, cart, orders, uploads, pricing, delivery, print queue |
| `mobile/` | Expo SDK 54 customer app — Shop, Cart, Orders, Profile, Support, model detail, STL upload |
| `admin/` | Vite + React + TS web console — products/inventory, categories, colors, orders, print queue, pricing, delivery |
| `db/schema.sql` | Postgres schema for Supabase |

## Tenancy model

The blueprint is single-tenant (every table scoped by `user_id`). E-commerce needs a
shared catalog, so entities are split:

- **Global / admin-owned** (no `user_id`; mutations gated by `role='admin'` via the
  `CurrentAdmin` dependency): `categories`, `products`, `product_categories`,
  `color_palette`, `product_colors`, `pricing_config`, `serviceable_pincodes`,
  `print_jobs`.
- **Per-user** (every query filters `.eq("user_id", ...)`): `addresses`, `cart_items`,
  `orders`, `order_items`, `stl_uploads`.

Bootstrap admins via the backend `ADMIN_EMAILS` env var (comma-separated). Matching
emails are promoted to `role='admin'` on Google sign-in.

## 3D domain rules

- Build volume (Bambu Lab A1): **256 × 256 × 256 mm**; customisation size is clamped to it.
- Up to **4 colors** per model (A1 + AMS lite).
- Print price calculator: `price = (material + electricity + labor) × (1 + margin)`
  where material = `weight_g × filament_rate`, electricity = `(power_w/1000) × hours × kWh_rate`,
  labor = `hours × labor_rate`. Rates live in the admin-managed `pricing_config`.

## Setup

### Backend
```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
cp api/.env.example api/.env   # fill SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, GOOGLE_CLIENT_ID, ADMIN_EMAILS
uvicorn api.main:app --reload  # http://localhost:8000/docs
pytest api/tests               # 27 tests
```
Apply `db/schema.sql` in the Supabase SQL editor first.

### Mobile
```bash
cd mobile
npm install
cp .env.example .env           # EXPO_PUBLIC_API_URL + Google client ids
npx tsc --noEmit
npx expo start
```

### Admin
```bash
cd admin
npm install
cp .env.example .env           # VITE_API_URL + VITE_GOOGLE_CLIENT_ID
npm run dev                     # http://localhost:5173
npm run build
```

## Roadmap (already scaffolded, ready to extend)

- STL upload currently estimates weight from a supplied volume; wire client-side mesh
  volume computation + a 3D preview (`expo-gl`/three) for a fully automatic quote.
- Wire Supabase Storage signed-upload URLs for STL/preview binaries.
- Payment gateway integration at checkout.
