import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

interface OrderRow {
  order_no: string;
  status: string;
  quote_amount: number | null;
  created_at: string;
}

export default async function MyOrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/account/login");
  const admin = supabaseAdmin();

  const { data: customer } = await admin.from("customers").select("id").eq("user_id", user.id).maybeSingle();

  const orders = customer
    ? ((
        await admin
          .from("orders")
          .select("order_no, status, quote_amount, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
      ).data as OrderRow[] | null) ?? []
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-ember">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-white/60 p-6 text-center text-sm text-foreground/60">
          <p>No orders linked to this account yet.</p>
          <Link href="/create" className="mt-3 inline-block rounded-full bg-amber px-5 py-2 text-sm font-semibold text-white">
            Start an order
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.order_no}
              href={`/account/orders/${o.order_no}`}
              className="flex items-center justify-between rounded-xl bg-white/60 p-4 shadow-sm hover:bg-white"
            >
              <div>
                <div className="font-semibold text-ember">{o.order_no}</div>
                <div className="text-xs text-foreground/50">{new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs text-amber-dark">{o.status}</span>
                {o.quote_amount != null && <div className="mt-1 text-sm font-medium">₹{o.quote_amount}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
