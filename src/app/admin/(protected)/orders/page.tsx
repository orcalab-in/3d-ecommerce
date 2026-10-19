import Link from "next/link";
import { ORDER_STATUSES } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  created_at: string;
  needed_by: string | null;
  customers: { name: string; whatsapp: string } | { name: string; whatsapp: string }[] | null;
}

function customerOf(row: OrderRow) {
  return Array.isArray(row.customers) ? row.customers[0] : row.customers;
}

export default async function OrdersListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const admin = supabaseAdmin();
  let query = admin
    .from("orders")
    .select("id, order_no, status, created_at, needed_by, customers(name, whatsapp)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-bold text-ember">Orders</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-amber text-white" : "bg-white text-foreground/60"}`}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${encodeURIComponent(s)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-amber text-white" : "bg-white text-foreground/60"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">Failed to load orders: {error.message}</p>}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Needed by</th>
              <th className="px-4 py-2">Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const customer = customerOf(o);
              return (
                <tr key={o.id} className="border-t border-neutral-100 hover:bg-amber/5">
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${o.order_no}`} className="font-medium text-ember">
                      {o.order_no}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {customer?.name}
                    <div className="text-xs text-foreground/50">{customer?.whatsapp}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs text-amber-dark">{o.status}</span>
                  </td>
                  <td className="px-4 py-2">{o.needed_by ?? "—"}</td>
                  <td className="px-4 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {orders.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
