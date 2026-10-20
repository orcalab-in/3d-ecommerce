"use client";

import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { CartItem, itemLabel, itemUnitPrice } from "@/lib/cart";

function thumbnailFor(item: CartItem): string | null {
  if (item.type === "photo_lamp") return item.previewThumbnail;
  if (item.type === "catalog_product") return item.thumbnailUrl ?? null;
  return null;
}

export default function CartPage() {
  const { items, removeItem, updateQty, itemCount, subtotal } = useCart();
  const hasUnpriced = items.some((i) => i.type === "stl_upload");

  if (itemCount === 0) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="text-4xl">🛒</span>
        <h1 className="text-xl font-bold text-ember">Your cart is empty</h1>
        <Link href="/" className="rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
          Start shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-8">
      <h1 className="mb-4 text-xl font-bold text-ember">Your cart</h1>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const thumb = thumbnailFor(item);
          const price = itemUnitPrice(item);
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/60 p-3 shadow-sm">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-200">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl">🧩</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{itemLabel(item)}</div>
                <div className="text-xs text-foreground/50">
                  {price != null ? `₹${price} each` : "Quote on confirmation"}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.id, item.qty - 1)}
                    className="h-6 w-6 rounded-full bg-white text-sm shadow-sm"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.id, item.qty + 1)}
                    className="h-6 w-6 rounded-full bg-white text-sm shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="self-start text-xs text-red-600 underline underline-offset-2"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg bg-amber/10 px-4 py-2 text-sm font-semibold text-amber-dark">
        <span>Subtotal</span>
        <span>₹{subtotal}</span>
      </div>
      {hasUnpriced && (
        <p className="mt-2 text-xs text-foreground/50">
          Plus a custom quote for your uploaded STL/3MF file(s), confirmed on WhatsApp.
        </p>
      )}

      <Link
        href="/checkout"
        className="mt-5 w-full rounded-full bg-amber px-6 py-3 text-center text-base font-semibold text-white shadow-md transition hover:bg-amber-dark"
      >
        Proceed to checkout
      </Link>
      <Link href="/" className="mt-3 text-center text-sm text-ember underline underline-offset-2">
        Continue shopping
      </Link>
    </main>
  );
}
