import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Anon-key client for reading the current session/user server-side (Server
 * Components, Route Handlers). Used only for `auth.getUser()` -- mirrors how
 * `src/lib/admin-auth.ts` reads the admin cookie. All actual data
 * reads/writes still go through `supabaseAdmin()` (service role) in
 * `src/lib/supabase/server.ts`, so no RLS policies are needed.
 */
export async function supabaseServerAuth() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component -- cookies can't be set there.
            // The proxy (src/proxy.ts) refreshes the session cookie instead.
          }
        },
      },
    }
  );
}

export async function getSessionUser() {
  const supabase = await supabaseServerAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
