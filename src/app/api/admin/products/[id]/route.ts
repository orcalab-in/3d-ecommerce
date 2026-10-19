import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const form = await request.formData();
  const admin = supabaseAdmin();

  const update: Record<string, unknown> = {};
  if (form.has("name")) update.name = String(form.get("name")).trim();
  if (form.has("description")) update.description = String(form.get("description")).trim() || null;
  if (form.has("price")) {
    const price = Number(form.get("price"));
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });
    }
    update.price = price;
  }
  if (form.has("active")) update.active = form.get("active") === "true";

  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    const buffer = Buffer.from(await image.arrayBuffer());
    const ext = image.name.toLowerCase().slice(image.name.lastIndexOf("."));
    const imagePath = `products/${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await admin.storage.from(CATALOG_IMAGES_BUCKET).upload(imagePath, buffer, {
      contentType: image.type || "image/jpeg",
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
    update.image_path = imagePath;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin.from("products").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
