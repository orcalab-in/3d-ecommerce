import { NextResponse } from "next/server";
import { supabaseServerAuth } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

/** Magic-link landing page: exchanges the emailed code for a session, then redirects. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account/orders";

  if (code) {
    const supabase = await supabaseServerAuth();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/account/login?error=auth`);
}
