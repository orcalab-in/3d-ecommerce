import Link from "next/link";
import { notFound } from "next/navigation";
import ProductImageCarousel from "@/components/ProductImageCarousel";
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
    .select("id, name, description, price, image_paths, active")
    .eq("slug", slug)
    .single();

  if (!product || !product.active) notFound();

  const imageUrls = ((product.image_paths as string[]) ?? []).map(
    (path) => admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
  );

  return (
    <main className="mx-auto max-w-5xl flex-1 px-4 py-8">
      <Link href="/shop" className="mb-4 inline-block text-sm text-ember underline underline-offset-2">
        ← Shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="lg:sticky lg:top-8">
          <ProductImageCarousel images={imageUrls} alt={product.name} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ember">{product.name}</h1>
          <p className="mb-1 text-lg font-semibold text-amber-dark">₹{product.price}</p>
          {product.description && <p className="mb-5 text-sm text-foreground/70">{product.description}</p>}

          <ShopOrderForm
            productId={product.id}
            productName={product.name}
            price={product.price}
            thumbnailUrl={imageUrls[0]}
          />
        </div>
      </div>
    </main>
  );
}
