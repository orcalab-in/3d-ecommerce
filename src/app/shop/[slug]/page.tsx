import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import ShopOrderForm from "./ShopOrderForm";

// Catalog is admin-editable (see /admin/products) -- force dynamic rendering
// so price/active-state edits show up immediately, not just after a rebuild.
export const dynamic = "force-dynamic";

export default async function ShopProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = supabaseAdmin();
  const { data: product } = await admin
    .from("products")
    .select("id, name, description, price, image_path, active")
    .eq("slug", slug)
    .single();

  if (!product || !product.active) notFound();

  const imageUrl = product.image_path
    ? admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(product.image_path).data.publicUrl
    : null;

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-8">
      <Link href="/shop" className="mb-4 text-sm text-ember underline underline-offset-2">
        ← Shop
      </Link>

      <div className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-neutral-200 shadow-md">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">🧩</span>
        )}
      </div>

      <h1 className="text-2xl font-bold text-ember">{product.name}</h1>
      <p className="mb-1 text-lg font-semibold text-amber-dark">₹{product.price}</p>
      {product.description && <p className="mb-5 text-sm text-foreground/70">{product.description}</p>}

      <ShopOrderForm productId={product.id} productName={product.name} price={product.price} />
    </main>
  );
}
