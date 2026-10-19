"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelOrderButton({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/orders/${orderNo}/cancel`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not cancel order");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel order");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={() => setConfirming(true)}
          className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600"
        >
          Cancel order
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-700">Cancel this order? This can&apos;t be undone.</p>
      <div className="flex gap-2">
        <button
          onClick={cancel}
          disabled={submitting}
          className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Cancelling..." : "Yes, cancel"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-600"
        >
          Never mind
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
