import { NextResponse } from "next/server";
import { supabaseServerAuth } from "@/lib/supabase/server-auth";

export async function POST() {
  const supabase = await supabaseServerAuth();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
