import Link from "next/link";
import { CATALOG_IMAGES_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import NewProductForm from "./NewProductForm";
import ToggleActiveButton from "./ToggleActiveButton";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_path: string | null;
  active: boolean;
}

export default async function AdminProductsPage() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("products")
    .select("id, slug, name, price, image_path, active")
    .order("name");
  const products = (data ?? []) as ProductRow[];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-bold text-ember">Products</h1>

      <NewProductForm />

      <div className="flex flex-col gap-2">
        {products.map((p) => {
          const imageUrl = p.image_path
            ? admin.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(p.image_path).data.publicUrl
            : null;
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {imageUrl && <img src={imageUrl} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />}
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-foreground/50">₹{p.price}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ToggleActiveButton id={p.id} active={p.active} />
                <Link href={`/admin/products/${p.id}`} className="text-sm text-ember underline underline-offset-2">
                  Edit
                </Link>
              </div>
            </div>
          );
        })}
        {products.length === 0 && <p className="text-sm text-foreground/50">No products yet.</p>}
      </div>
    </div>
  );
}
