import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  BASE_OPTIONS,
  BaseOptionId,
  PHOTO_UPLOAD,
  SIZE_OPTIONS,
  SizeOptionId,
  STL_UPLOAD,
  STORAGE_BUCKET,
} from "@/lib/config";
import { AdjustState, CropState } from "@/lib/imaging";
import { computeLampPrice } from "@/lib/pricing";
import { generateLithophaneSTL } from "@/lib/server-lithophane";
import { loadSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-auth";
import { validateOrderDetails } from "@/lib/validate-order";
import { validatePhotoFile } from "@/lib/validate-photo";

export const runtime = "nodejs";

interface OrderDetails {
  name: string;
  whatsapp: string;
  address: string;
  pincode: string;
  notes: string;
  consent: boolean;
}

interface PreparedItem {
  type: "photo_lamp" | "stl_upload" | "catalog_product";
  size: string | null;
  options: Record<string, unknown>;
  params_json: Record<string, unknown>;
  source_file_path: string | null;
  generated_file_path: string | null;
  preview_image_path: string | null;
  product_id?: string;
  qty: number;
  unitPrice: number | null;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Could not read form data");
  }

  const details = {
    name: String(form.get("name") ?? ""),
    whatsapp: String(form.get("whatsapp") ?? ""),
    address: String(form.get("address") ?? ""),
    pincode: String(form.get("pincode") ?? ""),
    notes: String(form.get("notes") ?? ""),
    consent: form.get("consent") === "true",
  };
  const detailErrors = validateOrderDetails(details);
  if (detailErrors.length > 0) return fail(detailErrors.join(" "));

  let itemsMetaRaw: Record<string, unknown>[];
  try {
    itemsMetaRaw = JSON.parse(String(form.get("itemsMeta") ?? "[]"));
  } catch {
    return fail("Invalid cart contents");
  }
  if (!Array.isArray(itemsMetaRaw) || itemsMetaRaw.length === 0) return fail("Your cart is empty");
  if (itemsMetaRaw.length > 20) return fail("Too many items in one order");

  const admin = supabaseAdmin();
  const sessionUser = await getSessionUser();
  const settings = await loadSettings();

  try {
    const prepared: PreparedItem[] = [];

    for (const raw of itemsMetaRaw) {
      const qtyRaw = Number(raw.qty ?? 1);
      const qty = Number.isFinite(qtyRaw) ? Math.min(20, Math.max(1, Math.round(qtyRaw))) : 1;
      const tempId = randomUUID();

      if (raw.type === "photo_lamp") {
        const file = form.get(String(raw.fileField));
        if (!(file instanceof File)) return fail("Missing photo file for an item in your cart");
        const fileErrors = validatePhotoFile(file);
        if (fileErrors.length > 0) return fail(fileErrors.join(" "));

        const sizeId = String(raw.sizeId ?? "") as SizeOptionId;
        if (!(sizeId in SIZE_OPTIONS)) return fail("Invalid size option");
        const baseOption = String(raw.baseOption ?? "none") as BaseOptionId;
        if (!(baseOption in BASE_OPTIONS)) return fail("Invalid base option");

        const rawCrop = (raw.crop ?? {}) as Partial<CropState>;
        const rawAdjust = (raw.adjust ?? {}) as Partial<AdjustState>;
        const crop: CropState = {
          zoom: Number(rawCrop.zoom) || 1,
          offsetX: Number(rawCrop.offsetX) || 0,
          offsetY: Number(rawCrop.offsetY) || 0,
        };
        const adjust: AdjustState = {
          brightness: Number(rawAdjust.brightness) || 1,
          contrast: Number(rawAdjust.contrast) || 1,
          invert: Boolean(rawAdjust.invert),
        };

        const originalBuffer = Buffer.from(await file.arrayBuffer());
        if (originalBuffer.byteLength > PHOTO_UPLOAD.maxBytes) return fail("Photo is too large");

        const { stlBuffer, previewPng } = await generateLithophaneSTL({
          originalBuffer,
          sizeId,
          crop,
          adjust,
        });

        const originalPath = `originals/${tempId}/${sanitizeFilename(file.name)}`;
        const generatedPath = `generated/${tempId}/model.stl`;
        const previewPath = `previews/${tempId}/preview.png`;

        const uploads = await Promise.all([
          admin.storage.from(STORAGE_BUCKET).upload(originalPath, originalBuffer, {
            contentType: file.type || "application/octet-stream",
          }),
          admin.storage.from(STORAGE_BUCKET).upload(generatedPath, stlBuffer, {
            contentType: "model/stl",
          }),
          admin.storage.from(STORAGE_BUCKET).upload(previewPath, previewPng, {
            contentType: "image/png",
          }),
        ]);
        const uploadError = uploads.find((u) => u.error)?.error;
        if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`, 500);

        prepared.push({
          type: "photo_lamp",
          size: sizeId,
          options: { base: baseOption },
          params_json: { crop, adjust, sizeId },
          source_file_path: originalPath,
          generated_file_path: generatedPath,
          preview_image_path: previewPath,
          qty,
          unitPrice: computeLampPrice(settings.pricing, sizeId, baseOption, 1),
        });
        continue;
      }

      if (raw.type === "stl_upload") {
        const file = form.get(String(raw.fileField));
        if (!(file instanceof File)) return fail("Missing file for an STL/3MF item in your cart");
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
        if (!STL_UPLOAD.acceptedExtensions.includes(ext)) return fail("Please upload an STL or 3MF file");
        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.byteLength > STL_UPLOAD.maxBytes) return fail("File is too large (max 50MB)");

        const sizeNotes = String(raw.sizeNotes ?? "").slice(0, 500);
        const colour = String(raw.colour ?? "").slice(0, 200);
        const sourcePath = `originals/${tempId}/${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(sourcePath, buffer, {
          contentType: ext === ".3mf" ? "model/3mf" : "model/stl",
        });
        if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`, 500);

        prepared.push({
          type: "stl_upload",
          size: sizeNotes || null,
          options: { colour },
          params_json: {},
          source_file_path: sourcePath,
          generated_file_path: null,
          preview_image_path: null,
          qty,
          unitPrice: null,
        });
        continue;
      }

      if (raw.type === "catalog_product") {
        const productId = String(raw.productId ?? "");
        const { data: product } = await admin
          .from("products")
          .select("id, name, price, active")
          .eq("id", productId)
          .single();
        if (!product || !product.active) return fail("One of the items in your cart is no longer available");

        prepared.push({
          type: "catalog_product",
          size: null,
          options: {},
          params_json: { productName: product.name, unitPrice: product.price },
          source_file_path: null,
          generated_file_path: null,
          preview_image_path: null,
          product_id: product.id,
          qty,
          unitPrice: product.price,
        });
        continue;
      }

      return fail("Invalid item type in cart");
    }

    const hasUnpriced = prepared.some((p) => p.unitPrice == null);
    const quoteAmount = hasUnpriced
      ? null
      : prepared.reduce((sum, p) => sum + (p.unitPrice as number) * p.qty, 0);

    const orderNo = await createOrderWithItems(admin, details, prepared, quoteAmount, sessionUser);
    if (!orderNo) return fail("Could not save order", 500);
    return NextResponse.json({ orderNo });
  } catch (err) {
    console.error("Order creation failed", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return fail(message, 500);
  }
}

async function createOrderWithItems(
  admin: ReturnType<typeof supabaseAdmin>,
  details: OrderDetails,
  items: PreparedItem[],
  quoteAmount: number | null,
  sessionUser: Awaited<ReturnType<typeof getSessionUser>>
): Promise<string | null> {
  const customer = await findOrCreateCustomer(admin, details, sessionUser);
  if (!customer) return null;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      customer_id: customer.id,
      address: details.address.trim(),
      pincode: details.pincode.trim(),
      notes: details.notes.trim() || null,
      quote_amount: quoteAmount,
    })
    .select("id, order_no")
    .single();
  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return null;
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      type: item.type,
      size: item.size,
      options: item.options,
      qty: item.qty,
      params_json: item.params_json,
      source_file_path: item.source_file_path,
      generated_file_path: item.generated_file_path,
      preview_image_path: item.preview_image_path,
      product_id: item.product_id ?? null,
    }))
  );
  if (itemsError) {
    console.error("order_items insert failed", itemsError);
    return null;
  }

  await admin.from("status_events").insert({
    order_id: order.id,
    status: "Received",
    note: "Order received via website",
  });

  return order.order_no as string;
}

/**
 * Guest checkout (no session): always insert a fresh customer row, as before.
 * Logged-in: reuse the one customer row linked to this account (creating it
 * on first order) so "My Orders" can list everything by customer_id --
 * without this, every order would be a disconnected row.
 */
async function findOrCreateCustomer(
  admin: ReturnType<typeof supabaseAdmin>,
  details: OrderDetails,
  sessionUser: Awaited<ReturnType<typeof getSessionUser>>
): Promise<{ id: string } | null> {
  if (!sessionUser) {
    const { data, error } = await admin
      .from("customers")
      .insert({ name: details.name.trim(), whatsapp: details.whatsapp.trim() })
      .select("id")
      .single();
    if (error || !data) {
      console.error("customer insert failed", error);
      return null;
    }
    return data;
  }

  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("customers")
      .update({
        name: details.name.trim(),
        whatsapp: details.whatsapp.trim(),
        email: sessionUser.email,
        address: details.address.trim(),
        pincode: details.pincode.trim(),
      })
      .eq("id", existing.id);
    return existing;
  }

  const { data, error } = await admin
    .from("customers")
    .insert({
      name: details.name.trim(),
      whatsapp: details.whatsapp.trim(),
      user_id: sessionUser.id,
      email: sessionUser.email,
      address: details.address.trim(),
      pincode: details.pincode.trim(),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("customer insert failed", error);
    return null;
  }
  return data;
}
