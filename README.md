# Litho & Glow — photo lithophane lamp ordering

Customers upload a photo, preview it live as a backlit lithophane lamp
panel, pick a size, and submit an order request with an upfront published
price. They can optionally create an account (email magic link) to track
and self-cancel their orders. A small catalog of ready-made items (`/shop`)
sits alongside the custom photo flow. You (the owner) review orders in
`/admin`, confirm final pricing/delivery on WhatsApp, and print on a Bambu
Lab A1.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind v4, Supabase (Postgres +
Storage + Auth), three.js for the live preview, sharp for server-side image
processing. Ordering is guest-friendly (no login required); customer
accounts are optional, via Supabase Auth email magic links, for order
tracking/cancellation only. `/admin` is protected separately by a single
shared password (no accounts there).

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then in the SQL
editor run, in order:

1. `supabase/migrations/0001_init.sql` — tables (`customers`, `orders`,
   `order_items`, `status_events`), the `PR-001`-style order number sequence,
   and RLS (locked down — the app only ever talks to Supabase with the
   service-role key, server-side).
2. `supabase/migrations/0002_accounts_pricing_catalog.sql` — adds
   `customers.user_id`/`email` (links a customer to a Supabase Auth account),
   and the `products` table + `order_items.product_id` for the catalog.
3. `supabase/storage.sql` — creates the private `lithophane-files` bucket
   and the **public** `catalog-images` bucket (product photos need to render
   on `/shop` without a signed-URL round trip).

Then in **Authentication → URL Configuration**, add
`http://localhost:3000/auth/callback` (and your production equivalent) to
the allowed Redirect URLs — required for the magic-link login to work.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API.
  **Service-role key is server-only** — it's never sent to the browser.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same
  project, anon/public key. Exposed to the browser (safe), used only for
  customer login (Supabase Auth) — never for direct table access; all data
  reads/writes still go through the service-role key server-side.
- `ADMIN_PASSWORD` — whatever you want to log into `/admin` with.
- `ADMIN_SESSION_SECRET` — random string, e.g. `openssl rand -hex 32`.

### 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. Admin panel is at `/admin`.

### 4. Tests

```bash
npm test
```

Covers the lithophane mesh generator: watertightness (every edge shared by
exactly 2 triangles), triangle count, and that the output matches the
requested panel dimensions and thickness bounds.

## Tuning

Every lithophane generation constant (min/max thickness, mm-per-pixel,
border width, size options, max printable dimension, upload limits, Diwali
cutoff date), the `PRICING` table (size × base-option → ₹), and
`SELF_CANCEL_ALLOWED_STATUSES` all live in **`src/lib/config.ts`**. Nothing
else hardcodes these numbers — tune there after test prints.

`BUSINESS_WHATSAPP_NUMBER` in `config.ts` is a **placeholder** — replace it
with your real number before the landing page's "Message us on WhatsApp"
link goes live.

WhatsApp message templates (placeholder copy) are in
`src/lib/whatsapp-templates.ts` — swap in your real wording any time.

Catalog product prices (`/shop`) are *not* in `config.ts` — they're set
per-product in `/admin/products`, since they're individually curated
listings rather than a formula.

## How the STL is generated

1. Browser: live preview resamples the photo into a small heightmap
   (~130px) on every crop/brightness/contrast change and renders it with
   three.js — fast enough to drag in real time, not meant to be printed.
2. On order submission, the **original** photo is uploaded as-is, and the
   server (`src/lib/server-lithophane.ts`) re-applies the same crop/adjust
   math at full `config.ts` resolution using `sharp`, then builds a
   watertight solid (`src/lib/litho-mesh.ts`): flat bottom, relief top
   surface, flat border frame, closed side walls. That solid is written out
   as a binary STL (`src/lib/stl.ts`).
3. Preview and final STL use the *same* crop math (`cropSourceRect` in
   `src/lib/imaging.ts`) so what you see is close to what prints — they
   aren't pixel-identical, since the browser preview uses canvas filters and
   the server uses sharp's image pipeline, but they should look very close.

## What's done

- Landing page, photo upload with client-side validation (size, type, low
  resolution / dark-image warnings), HEIC accepted (best-effort — see below).
- Live 3D preview (crop/zoom, pan by dragging, brightness, contrast, invert,
  unlit/backlit toggle).
- Order request form (size, base, qty, needed-by, address, pincode, notes,
  rights checkbox), Diwali cutoff notice.
- Server-side lithophane STL generation, uploaded to private Supabase
  Storage alongside the original photo and a preview PNG.
- `/create-stl` — simple STL/3MF upload request form (no viewer, as scoped).
- Published pricing: `PRICING` in `config.ts` drives a live price shown
  during `/create` and `/shop`, auto-filled into `orders.quote_amount` at
  submission (admin can still override it).
- Customer accounts (optional, guest checkout still works): email magic
  link via Supabase Auth, `/account/orders` (My Orders), self-cancel while
  status is `Received`/`Quote sent` (`SELF_CANCEL_ALLOWED_STATUSES`).
- `/shop` — fixed ready-made product catalog (figurines, etc. — no
  upload/customization step), managed via `/admin/products`.
- Landing page: how-it-works steps, pricing preview, shop teaser, FAQ
  accordion, WhatsApp contact link.
- `/admin`: password login, order list with status filter, order detail
  (photo/preview/params, signed download links, notes, quote amount, status
  dropdown that logs a `status_events` row, copy-WhatsApp-message button),
  product management (`/admin/products`).
- Unit tests for mesh watertightness + dimensions + pricing.

## What's untested

- **No real print yet** — geometry has only been validated in software
  (watertight check + three.js preview), not sliced/printed.
- Magic-link login was verified end-to-end manually (request → email →
  click link → session) but relies on PKCE matching the browser that
  requested the link — clicking the link in a different browser/profile
  than the one that requested it will always fail (expected PKCE
  behavior, not a bug). No automated test covers the auth round-trip.
- No multi-item cart — `/shop` orders are single-product, same pattern as
  `/create-stl`. If you want a real cart, that's a bigger follow-up.
- Catalog product images are uploaded through `/admin/products` to the
  public `catalog-images` bucket — fine for a handful of products, but
  there's no image optimization/resizing on upload.
- HEIC: the upload form accepts `.heic`/`.heif` and the server pipeline
  attempts conversion via `sharp`, but this depends on the `sharp` build
  having libheif support, which isn't guaranteed on every platform. If it
  fails, the order submission will return a clear error asking for JPG/PNG
  — it won't silently corrupt a file. The live *preview* for HEIC only
  works in browsers that can decode HEIC in an `<img>` (Safari); elsewhere
  you still get a working order with no live preview.
- `mmPerPixel` defaults to **0.4mm**, not the `0.2mm` originally sketched —
  0.2mm produced a ~75MB STL for even the smaller 100x150mm panel in
  testing, over Supabase's default per-file upload limit. The bucket's
  `file_size_limit` is now set to 100MB in `supabase/storage.sql`, but some
  Supabase plans also enforce a project-wide upload cap (Dashboard →
  Storage → Settings) independent of the bucket setting — check that if you
  lower `mmPerPixel` again. There's also a 6M-triangle safety ceiling in
  `server-lithophane.ts`, but no timeout handling beyond Next.js defaults.
- Admin → Supabase Storage signed URLs are short-lived (10 min) — fine for
  interactive browsing, but a stale tab's download links will 403.
- Partial-failure handling on order submission is best-effort: files upload
  to Storage *before* the DB rows are created, so a DB failure after a
  successful upload leaves an orphaned file (harmless, just unreferenced)
  rather than a broken order in the admin list.

## Before your first real test print

1. Run a full order through `/create` with a real photo, download the
   generated STL from `/admin`, and open it in Bambu Studio — check it
   looks right and slices without repair warnings.
2. Confirm actual print thickness at 0.8mm (lightest) is not so thin it's
   fragile for your printer/nozzle, and that 3.2mm (darkest border) doesn't
   over-extrude oddly at the frame.
3. The `0.4mm` `mmPerPixel` default roughly matches a typical 0.4mm nozzle.
   If prints look blocky and your Supabase plan allows larger uploads, try
   dropping it to ~0.3mm in `config.ts`.
4. Sanity-check brightness/contrast defaults against how *your* printer's
   filament transmits light — lithophane "best settings" are very
   printer/filament specific.
