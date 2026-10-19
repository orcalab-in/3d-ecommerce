"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AccountLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send login link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md">
        <h1 className="mb-1 text-xl font-bold text-ember">Track your orders</h1>
        <p className="mb-4 text-sm text-foreground/60">
          We&apos;ll email you a link to log in — no password needed.
        </p>

        {sent ? (
          <p className="rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber-dark">
            Check your inbox for a login link. You can close this tab.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-amber/30 px-3 py-2 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-full bg-amber px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send login link"}
            </button>
          </form>
        )}

        <Link href="/" className="mt-4 block text-center text-xs text-foreground/50 underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
