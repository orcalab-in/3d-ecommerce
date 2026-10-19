"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORDER_STATUSES, OrderStatus } from "@/lib/config";
import { fillTemplate } from "@/lib/whatsapp-templates";

interface Props {
  orderNo: string;
  customerName: string;
  initialStatus: OrderStatus;
  initialNotes: string;
  initialQuoteAmount: string;
  neededBy: string;
}

export default function OrderAdminPanel({
  orderNo,
  customerName,
  initialStatus,
  initialNotes,
  initialQuoteAmount,
  neededBy,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [quoteAmount, setQuoteAmount] = useState(initialQuoteAmount);
  const [statusNote, setStatusNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderNo}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, quoteAmount, statusNote }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Save failed");
      }
      setStatusNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyWhatsApp() {
    const text = fillTemplate(status, { orderNo, customerName, quoteAmount, neededBy });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={inputClass}>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Quote amount (₹)</label>
        <input
          type="number"
          className={inputClass}
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Note for this status change (optional)</label>
        <input
          className={inputClass}
          value={statusNote}
          onChange={(e) => setStatusNote(e.target.value)}
          placeholder="Visible in order history"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      <button
        onClick={copyWhatsApp}
        className="rounded-full border border-amber/40 px-4 py-2 text-sm font-medium text-amber-dark"
      >
        {copied ? "Copied!" : "Copy WhatsApp message"}
      </button>
    </div>
  );
}
