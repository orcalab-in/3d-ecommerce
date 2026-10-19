import { NextResponse } from "next/server";
import { SELF_CANCEL_ALLOWED_STATUSES } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/server-auth";

export async function POST(request: Request, ctx: RouteContext<"/api/account/orders/[orderNo]/cancel">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { orderNo } = await ctx.params;
  const admin = supabaseAdmin();

  // Re-verify everything server-side -- never trust that the cancel button was only
  // shown when eligible on the client.
  const { data: order, error: findError } = await admin
    .from("orders")
    .select("id, status, customers(user_id)")
    .eq("order_no", orderNo)
    .single();
  if (findError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  if (!customer || customer.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!SELF_CANCEL_ALLOWED_STATUSES.includes(order.status as never)) {
    return NextResponse.json(
      { error: "This order can no longer be cancelled -- please contact us on WhatsApp." },
      { status: 400 }
    );
  }

  const { error: updateError } = await admin.from("orders").update({ status: "Cancelled" }).eq("id", order.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("status_events").insert({
    order_id: order.id,
    status: "Cancelled",
    note: "Cancelled by customer",
  });

  return NextResponse.json({ ok: true });
}
