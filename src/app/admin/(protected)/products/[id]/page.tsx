import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import EditProductForm from "./EditProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = supabaseAdmin();
  const { data: product } = await admin
    .from("products")
    .select("id, name, description, price, image_paths, active")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const existingImages = ((product.image_paths as string[]) ?? []).map((path) => ({
    path,
    url: admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl,
  }));

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/products" className="mb-4 inline-block text-sm text-ember underline underline-offset-2">
        ← All products
      </Link>
      <h1 className="mb-4 text-xl font-bold text-ember">Edit product</h1>
      <EditProductForm
        id={product.id}
        initialName={product.name}
        initialDescription={product.description ?? ""}
        initialPrice={String(product.price)}
        initialActive={product.active}
        existingImages={existingImages}
      />
    </div>
  );
}
