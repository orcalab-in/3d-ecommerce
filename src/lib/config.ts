/**
 * Single source of truth for lithophane generation + business rules.
 * Tune these after test prints; nothing else in the codebase should
 * hardcode these numbers.
 */

export const LITHOPHANE = {
  /** Thickness (mm) at the brightest (whitest) pixel — the thinnest, most translucent point. */
  minThicknessMm: 0.8,
  /** Thickness (mm) at the darkest pixel — thickest, most opaque point. */
  maxThicknessMm: 3.2,
  /**
   * Physical size (mm) of one heightmap pixel in X/Y. Lower = more detail,
   * more triangles. 0.2mm (one heightmap pixel per ~0.04mm^2) produced a
   * ~75MB STL for even the smaller 100x150mm panel in testing -- past
   * Supabase's default per-file upload limit, and finer than a typical
   * 0.4mm FDM nozzle can resolve anyway. 0.4mm keeps the largest panel
   * (150x200mm) under ~40MB. Raise it back down once you've confirmed your
   * Supabase plan's upload limit and done a test print.
   */
  mmPerPixel: 0.4,
  /** Width of the flat, full-thickness border frame around the image (mm). */
  borderFrameMm: 4,
  /** Border thickness (mm) — printed solid at max thickness so it holds its shape. */
  borderThicknessMm: 3.2,
} as const;

export type SizeOptionId = "100x150" | "150x200";

export const SIZE_OPTIONS: Record<
  SizeOptionId,
  { label: string; widthMm: number; heightMm: number }
> = {
  "100x150": { label: "100 x 150 mm", widthMm: 100, heightMm: 150 },
  "150x200": { label: "150 x 200 mm", widthMm: 150, heightMm: 200 },
};

/** Hard ceiling — the Bambu A1 bed is 256mm; reject anything that won't fit with margin. */
export const MAX_PANEL_DIMENSION_MM = 250;

export const PHOTO_UPLOAD = {
  maxBytes: 15 * 1024 * 1024,
  acceptedTypes: ["image/jpeg", "image/png", "image/heic", "image/heif"] as string[],
  /** Warn (not block) if the short side is below this many pixels. */
  minShortSidePx: 800,
  /** Warn if the average luminance (0-255) is below this. */
  minAverageLuminance: 25,
} as const;

export const STL_UPLOAD = {
  maxBytes: 50 * 1024 * 1024,
  acceptedExtensions: [".stl", ".3mf"] as string[],
} as const;

export const BASE_OPTIONS = {
  none: { label: "No base" },
  led: { label: "LED base" },
} as const;
export type BaseOptionId = keyof typeof BASE_OPTIONS;

/**
 * Fallback defaults for src/lib/settings.ts -- the live, admin-editable
 * values (via /admin/settings) live in the `app_settings` DB table. These
 * constants only matter if that row is ever missing (e.g. migration not
 * yet run), and as the migration's seed data. Edit pricing/WhatsApp
 * number/Diwali cutoff in /admin/settings, not here.
 */
export const PRICING: Record<SizeOptionId, Record<BaseOptionId, number>> = {
  "100x150": { none: 499, led: 799 },
  "150x200": { none: 799, led: 1199 },
};

export const BUSINESS_WHATSAPP_NUMBER = "918939244089";

export const ORDER_CUTOFF = {
  diwaliCutoffDate: "2026-10-30",
  message:
    "Heads up: orders placed after 30 Oct may not arrive before Diwali. We'll still take your order, but can't guarantee delivery in time.",
} as const;

export const ORDER_STATUSES = [
  "Received",
  "Quote sent",
  "Quote confirmed",
  "Paid",
  "Printing",
  "Print completed",
  "Packed",
  "Shipped",
  "Delivered",
  "Needs photo fix",
  "Reprint",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A logged-in customer can self-cancel their own order only while it's in one of these statuses. */
export const SELF_CANCEL_ALLOWED_STATUSES: OrderStatus[] = ["Received", "Quote sent"];

/**
 * "Quote sent"/"Quote confirmed" only make sense for orders where the price wasn't
 * known upfront (stl_upload, quoted manually). photo_lamp and catalog_product orders
 * show and agree to a price before submitting, so these statuses are hidden from the
 * admin dropdown for those order types -- see OrderAdminPanel.
 */
export const QUOTE_NEGOTIATION_STATUSES: OrderStatus[] = ["Quote sent", "Quote confirmed"];

export const STORAGE_BUCKET = "lithophane-files";
export const CATALOG_IMAGES_BUCKET = "catalog-images";
