"use client";

import Link from "next/link";
import { useCart } from "@/contexts/CartContext";

export default function CartBadge() {
  const { itemCount } = useCart();
  return (
    <Link href="/cart" className="relative flex items-center gap-1 text-sm font-medium text-ember">
      <span className="text-lg">🛒</span>
      {itemCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-xs font-semibold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
