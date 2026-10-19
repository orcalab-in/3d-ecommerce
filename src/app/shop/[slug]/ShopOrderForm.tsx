"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import OrderDetailsForm from "@/components/OrderDetailsForm";
import type { OrderDetailsInput } from "@/lib/validate-order";

interface Props {
  productId: string;
  productName: string;
  price: number;
}

export default function ShopOrderForm({ productId, productName, price }: Props) {
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(null);

  const submit = useCallback(
    async (details: OrderDetailsInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const form = new FormData();
        form.set("type", "catalog_product");
        form.set("productId", productId);
        form.set("qty", String(qty));
        form.set("name", details.name);
        form.set("whatsapp", details.whatsapp);
        form.set("address", details.address);
        form.set("pincode", details.pincode);
        form.set("notes", details.notes);
        form.set("neededBy", details.neededBy);
        form.set("consent", String(details.consent));

        const res = await fetch("/api/orders", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong");
        setOrderNo(json.orderNo);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [productId, qty]
  );

  if (orderNo) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="text-4xl">🎉</span>
        <h2 className="text-xl font-bold text-ember">Order received — {orderNo}</h2>
        <p className="text-sm text-foreground/70">We&apos;ll confirm pricing and delivery with you on WhatsApp.</p>
        <Link href="/shop" className="mt-2 rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Quantity</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-8 w-8 rounded-full bg-white text-lg shadow-sm"
          >
            −
          </button>
          <span className="w-6 text-center">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            className="h-8 w-8 rounded-full bg-white text-lg shadow-sm"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-amber/10 px-4 py-2 text-sm font-semibold text-amber-dark">
        <span>Total</span>
        <span>₹{price * qty}</span>
      </div>

      <OrderDetailsForm
        submitting={submitting}
        submitLabel={`Order ${productName}`}
        onSubmit={submit}
        error={error}
        consentLabel="I agree to the order terms."
      />
    </div>
  );
}
