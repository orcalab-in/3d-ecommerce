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
import { generateLithophaneSTL } from "@/lib/server-lithophane";
import { supabaseAdmin } from "@/lib/supabase/server";
import { validateOrderDetails } from "@/lib/validate-order";
import { validatePhotoFile } from "@/lib/validate-photo";

export const runtime = "nodejs";

interface OrderDetails {
  name: string;
  whatsapp: string;
  address: string;
  pincode: string;
  notes: string;
  neededBy: string;
  consent: boolean;
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

  const type = form.get("type");
  if (type !== "photo_lamp" && type !== "stl_upload") {
    return fail("Invalid order type");
  }

  const details = {
    name: String(form.get("name") ?? ""),
    whatsapp: String(form.get("whatsapp") ?? ""),
    address: String(form.get("address") ?? ""),
    pincode: String(form.get("pincode") ?? ""),
    notes: String(form.get("notes") ?? ""),
    neededBy: String(form.get("neededBy") ?? ""),
    consent: form.get("consent") === "true",
  };
  const detailErrors = validateOrderDetails(details);
  if (detailErrors.length > 0) return fail(detailErrors.join(" "));

  const qtyRaw = Number(form.get("qty") ?? 1);
  const qty = Number.isFinite(qtyRaw) ? Math.min(20, Math.max(1, Math.round(qtyRaw))) : 1;

  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file uploaded");

  const admin = supabaseAdmin();
  const tempId = randomUUID();

  try {
    if (type === "photo_lamp") {
      const fileErrors = validatePhotoFile(file);
      if (fileErrors.length > 0) return fail(fileErrors.join(" "));

      const sizeId = String(form.get("sizeId") ?? "") as SizeOptionId;
      if (!(sizeId in SIZE_OPTIONS)) return fail("Invalid size option");

      const baseOption = String(form.get("baseOption") ?? "none") as BaseOptionId;
      if (!(baseOption in BASE_OPTIONS)) return fail("Invalid base option");

      let crop: CropState;
      let adjust: AdjustState;
      try {
        crop = JSON.parse(String(form.get("crop") ?? "{}"));
        adjust = JSON.parse(String(form.get("adjust") ?? "{}"));
      } catch {
        return fail("Invalid crop/adjust parameters");
      }
      crop = { zoom: Number(crop.zoom) || 1, offsetX: Number(crop.offsetX) || 0, offsetY: Number(crop.offsetY) || 0 };
      adjust = {
        brightness: Number(adjust.brightness) || 1,
        contrast: Number(adjust.contrast) || 1,
        invert: Boolean(adjust.invert),
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

      const orderNo = await createOrderWithItem(admin, details, qty, {
        type: "photo_lamp",
        size: sizeId,
        options: { base: baseOption },
        params_json: { crop, adjust, sizeId },
        source_file_path: originalPath,
        generated_file_path: generatedPath,
        preview_image_path: previewPath,
      });
      if (!orderNo) return fail("Could not save order", 500);
      return NextResponse.json({ orderNo });
    }

    // stl_upload
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!STL_UPLOAD.acceptedExtensions.includes(ext)) return fail("Please upload an STL or 3MF file");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > STL_UPLOAD.maxBytes) return fail("File is too large (max 50MB)");

    const sizeNotes = String(form.get("sizeNotes") ?? "").slice(0, 500);
    const colour = String(form.get("colour") ?? "").slice(0, 200);

    const sourcePath = `originals/${tempId}/${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await admin.storage.from(STORAGE_BUCKET).upload(sourcePath, buffer, {
      contentType: ext === ".3mf" ? "model/3mf" : "model/stl",
    });
    if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`, 500);

    const orderNo = await createOrderWithItem(admin, details, qty, {
      type: "stl_upload",
      size: sizeNotes || null,
      options: { colour },
      params_json: {},
      source_file_path: sourcePath,
      generated_file_path: null,
      preview_image_path: null,
    });
    if (!orderNo) return fail("Could not save order", 500);
    return NextResponse.json({ orderNo });
  } catch (err) {
    console.error("Order creation failed", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return fail(message, 500);
  }
}

async function createOrderWithItem(
  admin: ReturnType<typeof supabaseAdmin>,
  details: OrderDetails,
  qty: number,
  item: {
    type: "photo_lamp" | "stl_upload";
    size: string | null;
    options: Record<string, unknown>;
    params_json: Record<string, unknown>;
    source_file_path: string;
    generated_file_path: string | null;
    preview_image_path: string | null;
  }
): Promise<string | null> {
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({ name: details.name.trim(), whatsapp: details.whatsapp.trim() })
    .select("id")
    .single();
  if (customerError || !customer) {
    console.error("customer insert failed", customerError);
    return null;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      customer_id: customer.id,
      address: details.address.trim(),
      pincode: details.pincode.trim(),
      notes: details.notes.trim() || null,
      needed_by: details.neededBy || null,
    })
    .select("id, order_no")
    .single();
  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return null;
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    type: item.type,
    size: item.size,
    options: item.options,
    qty,
    params_json: item.params_json,
    source_file_path: item.source_file_path,
    generated_file_path: item.generated_file_path,
    preview_image_path: item.preview_image_path,
  });
  if (itemError) {
    console.error("order_item insert failed", itemError);
    return null;
  }

  await admin.from("status_events").insert({
    order_id: order.id,
    status: "Received",
    note: "Order received via website",
  });

  return order.order_no as string;
}
