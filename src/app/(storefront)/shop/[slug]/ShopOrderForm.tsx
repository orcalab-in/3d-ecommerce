"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

interface Props {
  productId: string;
  productName: string;
  price: number;
  thumbnailUrl?: string;
}

export default function ShopOrderForm({ productId, productName, price, thumbnailUrl }: Props) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem({
      id: crypto.randomUUID(),
      type: "catalog_product",
      productId,
      name: productName,
      unitPrice: price,
      qty,
      thumbnailUrl,
    });
    setAdded(true);
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

      {added ? (
        <div className="flex flex-col gap-2 rounded-lg bg-green-50 p-3 text-center text-sm text-green-800">
          <p>Added to cart.</p>
          <div className="flex justify-center gap-3">
            <Link href="/cart" className="font-semibold underline underline-offset-2">
              View cart
            </Link>
            <Link href="/shop" className="underline underline-offset-2">
              Keep shopping
            </Link>
          </div>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          className="w-full rounded-full bg-amber px-6 py-3 text-center text-base font-semibold text-white shadow-md transition hover:bg-amber-dark"
        >
          Add to cart
        </button>
      )}
    </div>
  );
}
