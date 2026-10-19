import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only — bypasses RLS. Never import this from
 * a Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
