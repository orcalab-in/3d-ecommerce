import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priceRaw = Number(form.get("price"));
  const image = form.get("image");

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isFinite(priceRaw) || priceRaw <= 0) {
    return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  let imagePath: string | null = null;

  if (image instanceof File && image.size > 0) {
    const buffer = Buffer.from(await image.arrayBuffer());
    const ext = image.name.toLowerCase().slice(image.name.lastIndexOf("."));
    imagePath = `products/${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await admin.storage.from(CATALOG_IMAGES_BUCKET).upload(imagePath, buffer, {
      contentType: image.type || "image/jpeg",
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;

  const { error } = await admin.from("products").insert({
    slug,
    name,
    description: description || null,
    price: priceRaw,
    image_path: imagePath,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, slug });
}
