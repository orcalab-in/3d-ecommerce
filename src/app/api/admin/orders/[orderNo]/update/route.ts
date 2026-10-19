import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ORDER_STATUSES } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/orders/[orderNo]/update">) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orderNo } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const status = body.status;
  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : null;
  const quoteAmount =
    body.quoteAmount === "" || body.quoteAmount === null || body.quoteAmount === undefined
      ? null
      : Number(body.quoteAmount);
  const statusNote = typeof body.statusNote === "string" ? body.statusNote.slice(0, 1000) : null;

  const admin = supabaseAdmin();
  const { data: order, error: findError } = await admin
    .from("orders")
    .select("id")
    .eq("order_no", orderNo)
    .single();
  if (findError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({ status, notes, quote_amount: quoteAmount })
    .eq("id", order.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("status_events").insert({ order_id: order.id, status, note: statusNote });

  return NextResponse.json({ ok: true });
}
