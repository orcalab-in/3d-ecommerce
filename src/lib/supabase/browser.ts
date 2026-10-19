import { createBrowserClient } from "@supabase/ssr";

/**
 * Anon-key client for the browser. Used only for Supabase Auth
 * (signInWithOtp, signOut, etc.) -- never for data queries. All table
 * reads/writes go through the service-role client server-side instead.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
