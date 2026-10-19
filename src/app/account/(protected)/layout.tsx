import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-auth";
import AccountLogoutButton from "./AccountLogoutButton";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/account/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-amber/20 px-6 py-3">
        <Link href="/account/orders" className="font-semibold text-ember">
          My orders
        </Link>
        <AccountLogoutButton />
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
