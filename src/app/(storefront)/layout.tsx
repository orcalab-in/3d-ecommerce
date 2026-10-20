import Link from "next/link";
import { CartProvider } from "@/contexts/CartContext";
import CartBadge from "./CartBadge";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <header className="flex items-center justify-between border-b border-amber/15 px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold text-ember">
          Litho & Glow
        </Link>
        <CartBadge />
      </header>
      {children}
    </CartProvider>
  );
}
