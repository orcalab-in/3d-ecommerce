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
    .select("id, name, description, price, image_path")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const imageUrl = product.image_path
    ? admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(product.image_path).data.publicUrl
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/products" className="mb-4 inline-block text-sm text-ember underline underline-offset-2">
        ← All products
      </Link>
      <h1 className="mb-4 text-xl font-bold text-ember">Edit product</h1>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={product.name} className="mb-4 h-32 w-32 rounded-lg object-cover" />
      )}
      <EditProductForm
        id={product.id}
        initialName={product.name}
        initialDescription={product.description ?? ""}
        initialPrice={String(product.price)}
      />
    </div>
  );
}
