import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-5">
          <Link href="/admin/orders" className="font-semibold text-ember">
            Litho & Glow admin
          </Link>
          <Link href="/admin/orders" className="text-sm text-foreground/60 hover:text-ember">
            Orders
          </Link>
          <Link href="/admin/products" className="text-sm text-foreground/60 hover:text-ember">
            Products
          </Link>
          <Link href="/admin/settings" className="text-sm text-foreground/60 hover:text-ember">
            Settings
          </Link>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
