import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus, STORAGE_BUCKET } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import OrderAdminPanel from "./OrderAdminPanel";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

interface OrderItemRow {
  id: string;
  type: "photo_lamp" | "stl_upload";
  size: string | null;
  options: Record<string, unknown>;
  qty: number;
  params_json: Record<string, unknown>;
  source_file_path: string | null;
  generated_file_path: string | null;
  preview_image_path: string | null;
}

interface StatusEventRow {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const admin = supabaseAdmin();

  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_no, status, quote_amount, needed_by, address, pincode, notes, created_at, customers(name, whatsapp)"
    )
    .eq("order_no", orderNo)
    .single();

  if (!order) notFound();

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;

  const [{ data: items }, { data: events }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id),
    admin.from("status_events").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
  ]);

  const orderItems = (items ?? []) as OrderItemRow[];
  const statusEvents = (events ?? []) as StatusEventRow[];

  const signedUrls = new Map<string, string>();
  await Promise.all(
    orderItems.flatMap((item) =>
      [item.source_file_path, item.generated_file_path, item.preview_image_path]
        .filter((p): p is string => Boolean(p))
        .map(async (path) => {
          const { data } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          if (data?.signedUrl) signedUrls.set(path, data.signedUrl);
        })
    )
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div>
          <Link href="/admin/orders" className="text-sm text-ember underline underline-offset-2">
            ← All orders
          </Link>
          <h1 className="mt-2 text-xl font-bold text-ember">{order.order_no}</h1>
          <p className="text-sm text-foreground/60">
            {customer?.name} · {customer?.whatsapp}
          </p>
        </div>

        <section className="rounded-xl bg-white p-4 shadow-sm text-sm">
          <h2 className="mb-2 font-semibold">Delivery</h2>
          <p>{order.address}</p>
          <p>Pincode: {order.pincode}</p>
          {order.needed_by && <p>Needed by: {order.needed_by}</p>}
        </section>

        {orderItems.map((item) => (
          <section key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">
              {item.type === "photo_lamp" ? "Photo lamp" : "STL/3MF upload"} {item.size ? `— ${item.size}` : ""}
            </h2>
            <div className="mb-3 flex flex-wrap gap-4">
              {item.preview_image_path && signedUrls.get(item.preview_image_path) && (
                <div>
                  <p className="mb-1 text-xs text-foreground/50">Preview</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrls.get(item.preview_image_path)}
                    alt="Lithophane preview"
                    className="h-40 w-auto rounded-lg border border-neutral-200 object-contain"
                  />
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-foreground/50">Qty</dt>
              <dd>{item.qty}</dd>
              <dt className="text-foreground/50">Options</dt>
              <dd>{JSON.stringify(item.options)}</dd>
              {item.type === "photo_lamp" && (
                <>
                  <dt className="text-foreground/50">Params</dt>
                  <dd className="truncate">{JSON.stringify(item.params_json)}</dd>
                </>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {item.source_file_path && signedUrls.get(item.source_file_path) && (
                <a
                  href={signedUrls.get(item.source_file_path)}
                  className="rounded-full border border-amber/40 px-3 py-1 text-amber-dark"
                >
                  Download {item.type === "photo_lamp" ? "original photo" : "source file"}
                </a>
              )}
              {item.generated_file_path && signedUrls.get(item.generated_file_path) && (
                <a
                  href={signedUrls.get(item.generated_file_path)}
                  className="rounded-full border border-amber/40 px-3 py-1 text-amber-dark"
                >
                  Download generated STL
                </a>
              )}
            </div>
          </section>
        ))}

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {statusEvents.map((ev) => (
              <li key={ev.id} className="border-b border-neutral-100 pb-2 last:border-0">
                <span className="font-medium">{ev.status}</span>{" "}
                <span className="text-xs text-foreground/50">{new Date(ev.created_at).toLocaleString()}</span>
                {ev.note && <p className="text-foreground/70">{ev.note}</p>}
              </li>
            ))}
            {statusEvents.length === 0 && <li className="text-foreground/50">No history yet.</li>}
          </ul>
        </section>
      </div>

      <OrderAdminPanel
        orderNo={order.order_no}
        customerName={customer?.name ?? ""}
        initialStatus={order.status as OrderStatus}
        initialNotes={order.notes ?? ""}
        initialQuoteAmount={order.quote_amount != null ? String(order.quote_amount) : ""}
        neededBy={order.needed_by ?? ""}
      />
    </div>
  );
}
