import Link from "next/link";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

// Catalog is admin-editable (see /admin/products) -- force dynamic rendering
// so new/edited products show up immediately, not just after a rebuild.
export const dynamic = "force-dynamic";

interface ProductRow {
  slug: string;
  name: string;
  price: number;
  image_path: string | null;
}

export default async function ShopPage() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("products")
    .select("slug, name, price, image_path")
    .eq("active", true)
    .order("name");
  const products = (data ?? []) as ProductRow[];

  return (
    <main className="mx-auto flex max-w-4xl flex-1 flex-col px-4 py-8">
      <Link href="/" className="mb-4 text-sm text-ember underline underline-offset-2">
        ← Back
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-ember">Ready-made pieces</h1>
      <p className="mb-6 text-sm text-foreground/70">
        No upload needed — pick one, we print and ship it.
      </p>

      {products.length === 0 ? (
        <p className="text-sm text-foreground/50">Nothing in stock right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {products.map((p) => {
            const imageUrl = p.image_path
              ? admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(p.image_path).data.publicUrl
              : null;
            return (
              <Link
                key={p.slug}
                href={`/shop/${p.slug}`}
                className="flex flex-col gap-2 rounded-xl bg-white/60 p-3 shadow-sm transition hover:bg-white"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-neutral-200">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl">🧩</span>
                  )}
                </div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-sm text-amber-dark">₹{p.price}</div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
