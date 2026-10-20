import Link from "next/link";
import { Suspense } from "react";
import { CartProvider } from "@/contexts/CartContext";
import PostHogPageView from "@/lib/analytics/PostHogPageView";
import CartBadge from "./CartBadge";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <header className="flex items-center justify-between border-b border-amber/15 px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold text-ember">
          Litho & Glow
        </Link>
        <CartBadge />
      </header>
      {children}
      <footer className="border-t border-amber/15 px-4 py-4 text-center text-xs text-foreground/50 sm:px-6">
        We use analytics to improve this site.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ember">
          Learn more
        </Link>
      </footer>
    </CartProvider>
  );
}
