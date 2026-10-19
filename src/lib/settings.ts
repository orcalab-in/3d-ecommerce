import {
  BASE_OPTIONS,
  BaseOptionId,
  BUSINESS_WHATSAPP_NUMBER,
  ORDER_CUTOFF,
  PRICING,
  SIZE_OPTIONS,
  SizeOptionId,
} from "./config";
import { supabaseAdmin } from "./supabase/server";

export interface AppSettings {
  whatsappNumber: string;
  pricing: Record<SizeOptionId, Record<BaseOptionId, number>>;
  diwaliCutoffDate: string | null;
  diwaliCutoffMessage: string | null;
}

function defaults(): AppSettings {
  return {
    whatsappNumber: BUSINESS_WHATSAPP_NUMBER,
    pricing: PRICING,
    diwaliCutoffDate: ORDER_CUTOFF.diwaliCutoffDate,
    diwaliCutoffMessage: ORDER_CUTOFF.message,
  };
}

/**
 * Admin-editable settings (pricing, WhatsApp number, Diwali cutoff), stored
 * in the `app_settings` singleton row. Falls back to the hardcoded
 * config.ts defaults if the migration hasn't been run yet or the row is
 * somehow missing, so the app degrades gracefully rather than crashing.
 */
export async function loadSettings(): Promise<AppSettings> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return defaults();

  return {
    whatsappNumber: data.whatsapp_number,
    pricing: data.pricing,
    diwaliCutoffDate: data.diwali_cutoff_date,
    diwaliCutoffMessage: data.diwali_cutoff_message,
  };
}

export function emptyPricingTable(): Record<SizeOptionId, Record<BaseOptionId, number>> {
  const table = {} as Record<SizeOptionId, Record<BaseOptionId, number>>;
  for (const sizeId of Object.keys(SIZE_OPTIONS) as SizeOptionId[]) {
    table[sizeId] = {} as Record<BaseOptionId, number>;
    for (const baseOption of Object.keys(BASE_OPTIONS) as BaseOptionId[]) {
      table[sizeId][baseOption] = 0;
    }
  }
  return table;
}
