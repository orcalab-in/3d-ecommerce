"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import OrderDetailsForm from "@/components/OrderDetailsForm";
import { useCart } from "@/contexts/CartContext";
import { track } from "@/lib/analytics/track";
import { cartHasUnpricedItem, itemLabel, itemUnitPrice } from "@/lib/cart";
import type { OrderDetailsInput } from "@/lib/validate-order";

interface Props {
  initialProfile?: Partial<OrderDetailsInput>;
}

export default function CheckoutClient({ initialProfile }: Props) {
  const { items, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(null);

  useEffect(() => {
    if (items.length > 0) track("order_form_started");
    // Only on mount -- this marks the start of a checkout attempt, not every cart change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    async (details: OrderDetailsInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const form = new FormData();
        form.set("name", details.name);
        form.set("whatsapp", details.whatsapp);
        form.set("address", details.address);
        form.set("pincode", details.pincode);
        form.set("notes", details.notes);
        form.set("consent", String(details.consent));

        const itemsMeta = items.map((item, i) => {
          if (item.type === "photo_lamp") {
            form.set(`file_${i}`, item.file);
            return {
              type: item.type,
              qty: item.qty,
              fileField: `file_${i}`,
              sizeId: item.sizeId,
              baseOption: item.baseOption,
              crop: item.crop,
              adjust: item.adjust,
            };
          }
          if (item.type === "stl_upload") {
            form.set(`file_${i}`, item.file);
            return {
              type: item.type,
              qty: item.qty,
              fileField: `file_${i}`,
              sizeNotes: item.sizeNotes,
              colour: item.colour,
            };
          }
          return { type: item.type, qty: item.qty, productId: item.productId };
        });
        form.set("itemsMeta", JSON.stringify(itemsMeta));

        const res = await fetch("/api/orders", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong");
        items.forEach((item) => {
          track("order_submitted", {
            size: item.type === "photo_lamp" ? item.sizeId : null,
            qty: item.qty,
            type: item.type,
          });
        });
        setOrderNo(json.orderNo);
        clearCart();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [items, clearCart]
  );

  if (orderNo) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="text-4xl">🎉</span>
        <h1 className="text-xl font-bold text-ember">Order received — {orderNo}</h1>
        <p className="text-sm text-foreground/70">We&apos;ll confirm pricing and delivery with you on WhatsApp.</p>
        <Link href="/" className="mt-2 rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
          Back to home
        </Link>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <p className="text-sm text-foreground/60">Your cart is empty.</p>
        <Link href="/" className="rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
          Start shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/cart" className="mb-4 inline-block text-sm text-ember underline underline-offset-2">
        ← Cart
      </Link>
      <h1 className="mb-6 text-xl font-bold text-ember">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <OrderDetailsForm
          submitting={submitting}
          submitLabel="Place order"
          onSubmit={submit}
          error={error}
          initial={initialProfile}
          consentLabel={
            items.some((i) => i.type === "photo_lamp")
              ? "I own or have the right to use the photo(s) in this order."
              : "I agree to the order terms."
          }
        />

        <div className="h-fit rounded-xl bg-white/60 p-4 text-sm lg:sticky lg:top-6">
          <h2 className="mb-3 font-semibold text-ember">Order summary</h2>
          {items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 py-1">
              <span>
                {itemLabel(item)} x{item.qty}
              </span>
              <span className="whitespace-nowrap">
                {itemUnitPrice(item) != null ? `₹${itemUnitPrice(item)! * item.qty}` : "Quote"}
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          {cartHasUnpricedItem(items) && (
            <p className="mt-1 text-xs text-foreground/50">
              Plus a custom quote for your uploaded STL/3MF file(s).
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
