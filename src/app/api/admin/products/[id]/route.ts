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

  const newImages = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  let removeImagePaths: string[] = [];
  if (form.has("removeImagePaths")) {
    try {
      removeImagePaths = JSON.parse(String(form.get("removeImagePaths")));
    } catch {
      return NextResponse.json({ error: "Invalid removeImagePaths" }, { status: 400 });
    }
  }

  if (newImages.length > 0 || removeImagePaths.length > 0) {
    const { data: existing, error: fetchError } = await admin
      .from("products")
      .select("image_paths")
      .eq("id", id)
      .single();
    if (fetchError || !existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const kept = (existing.image_paths as string[]).filter((p) => !removeImagePaths.includes(p));

    const uploadedPaths: string[] = [];
    for (const image of newImages) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = image.name.toLowerCase().slice(image.name.lastIndexOf("."));
      const path = `products/${crypto.randomUUID()}${ext}`;
      const { error: uploadError } = await admin.storage.from(CATALOG_IMAGES_BUCKET).upload(path, buffer, {
        contentType: image.type || "image/jpeg",
      });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
      uploadedPaths.push(path);
    }

    update.image_paths = [...kept, ...uploadedPaths];

    if (removeImagePaths.length > 0) {
      await admin.storage.from(CATALOG_IMAGES_BUCKET).remove(removeImagePaths);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin.from("products").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
