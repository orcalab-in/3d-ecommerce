import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { BASE_OPTIONS, BaseOptionId, SIZE_OPTIONS, SizeOptionId } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const whatsappNumber = String(body.whatsappNumber ?? "").replace(/\D/g, "");
  if (whatsappNumber.length < 10) {
    return NextResponse.json({ error: "Enter a valid WhatsApp number (digits only, with country code)" }, { status: 400 });
  }

  const pricing: Record<string, Record<string, number>> = {};
  for (const sizeId of Object.keys(SIZE_OPTIONS) as SizeOptionId[]) {
    pricing[sizeId] = {};
    for (const baseOption of Object.keys(BASE_OPTIONS) as BaseOptionId[]) {
      const value = Number(body.pricing?.[sizeId]?.[baseOption]);
      if (!Number.isFinite(value) || value <= 0) {
        return NextResponse.json({ error: `Enter a valid price for ${sizeId} / ${baseOption}` }, { status: 400 });
      }
      pricing[sizeId][baseOption] = value;
    }
  }

  const diwaliCutoffDate = body.diwaliCutoffDate ? String(body.diwaliCutoffDate) : null;
  const diwaliCutoffMessage = diwaliCutoffDate ? String(body.diwaliCutoffMessage ?? "").slice(0, 500) : null;

  const admin = supabaseAdmin();
  const { error } = await admin.from("app_settings").upsert({
    id: 1,
    whatsapp_number: whatsappNumber,
    pricing,
    diwali_cutoff_date: diwaliCutoffDate,
    diwali_cutoff_message: diwaliCutoffMessage,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
