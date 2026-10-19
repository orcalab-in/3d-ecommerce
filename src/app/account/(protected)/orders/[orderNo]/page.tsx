import Link from "next/link";
import { notFound } from "next/navigation";
import { SELF_CANCEL_ALLOWED_STATUSES } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-auth";
import CancelOrderButton from "./CancelOrderButton";

interface StatusEventRow {
  id: string;
  status: string;
  created_at: string;
}

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_no, status, quote_amount, needed_by, address, pincode, notes, created_at, customers(user_id)"
    )
    .eq("order_no", orderNo)
    .single();

  if (!order) notFound();
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  if (!customer || customer.user_id !== user.id) notFound();

  const { data: items } = await admin
    .from("order_items")
    .select("type, size, qty, params_json")
    .eq("order_id", order.id);

  const { data: events } = await admin
    .from("status_events")
    .select("id, status, created_at")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const statusEvents = (events ?? []) as StatusEventRow[];

  const canCancel = SELF_CANCEL_ALLOWED_STATUSES.includes(order.status as never);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/account/orders" className="mb-4 inline-block text-sm text-ember underline underline-offset-2">
        ← My orders
      </Link>
      <h1 className="mb-1 text-xl font-bold text-ember">{order.order_no}</h1>
      <span className="mb-4 inline-block rounded-full bg-amber/10 px-2 py-0.5 text-xs text-amber-dark">
        {order.status}
      </span>

      <div className="mt-4 flex flex-col gap-4">
        <section className="rounded-xl bg-white/60 p-4 text-sm">
          {(items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {item.type === "photo_lamp"
                  ? "Photo lamp"
                  : item.type === "stl_upload"
                    ? "STL/3MF upload"
                    : (item.params_json as { productName?: string })?.productName ?? "Item"}
                {item.size ? ` — ${item.size}` : ""}
              </span>
              <span>x{item.qty}</span>
            </div>
          ))}
          {order.quote_amount != null && (
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold">
              <span>Total</span>
              <span>₹{order.quote_amount}</span>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white/60 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Delivery</h2>
          <p>{order.address}</p>
          <p>Pincode: {order.pincode}</p>
          {order.needed_by && <p>Needed by: {order.needed_by}</p>}
        </section>

        <section className="rounded-xl bg-white/60 p-4">
          <h2 className="mb-2 text-sm font-semibold">History</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {statusEvents.map((ev) => (
              <li key={ev.id} className="flex justify-between">
                <span>{ev.status}</span>
                <span className="text-xs text-foreground/50">{new Date(ev.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>

        {canCancel ? (
          <CancelOrderButton orderNo={order.order_no} />
        ) : (
          order.status !== "Cancelled" && (
            <p className="text-xs text-foreground/50">
              This order can no longer be self-cancelled — message us on WhatsApp if you need changes.
            </p>
          )
        )}
      </div>
    </div>
  );
}
