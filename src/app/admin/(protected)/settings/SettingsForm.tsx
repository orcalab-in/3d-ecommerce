"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BASE_OPTIONS, BaseOptionId, SIZE_OPTIONS, SizeOptionId } from "@/lib/config";
import type { AppSettings } from "@/lib/settings";

export default function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber);
  const [pricing, setPricing] = useState(initial.pricing);
  const [cutoffEnabled, setCutoffEnabled] = useState(Boolean(initial.diwaliCutoffDate));
  const [diwaliCutoffDate, setDiwaliCutoffDate] = useState(initial.diwaliCutoffDate ?? "");
  const [diwaliCutoffMessage, setDiwaliCutoffMessage] = useState(initial.diwaliCutoffMessage ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setPrice(sizeId: SizeOptionId, baseOption: BaseOptionId, value: string) {
    setPricing((p) => ({ ...p, [sizeId]: { ...p[sizeId], [baseOption]: Number(value) || 0 } }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber,
          pricing,
          diwaliCutoffDate: cutoffEnabled ? diwaliCutoffDate : null,
          diwaliCutoffMessage: cutoffEnabled ? diwaliCutoffMessage : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not save settings");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">WhatsApp number</h2>
        <p className="text-xs text-foreground/50">
          Digits only, with country code (e.g. 91XXXXXXXXXX). Used for the landing page&apos;s &quot;Message
          us&quot; link.
        </p>
        <input
          className={inputClass}
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          required
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Pricing (₹)</h2>
        {(Object.keys(SIZE_OPTIONS) as SizeOptionId[]).map((sizeId) => (
          <div key={sizeId} className="flex items-center gap-3">
            <span className="w-28 text-sm text-foreground/70">{SIZE_OPTIONS[sizeId].label}</span>
            {(Object.keys(BASE_OPTIONS) as BaseOptionId[]).map((baseOption) => (
              <label key={baseOption} className="flex flex-1 items-center gap-2 text-xs text-foreground/60">
                {BASE_OPTIONS[baseOption].label}
                <input
                  type="number"
                  className={inputClass}
                  value={pricing[sizeId][baseOption]}
                  onChange={(e) => setPrice(sizeId, baseOption, e.target.value)}
                  required
                />
              </label>
            ))}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Order cutoff banner</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cutoffEnabled} onChange={(e) => setCutoffEnabled(e.target.checked)} />
          Show a cutoff banner on the landing page
        </label>
        {cutoffEnabled && (
          <>
            <input
              type="date"
              className={inputClass}
              value={diwaliCutoffDate}
              onChange={(e) => setDiwaliCutoffDate(e.target.value)}
              required
            />
            <textarea
              className={inputClass}
              rows={2}
              value={diwaliCutoffMessage}
              onChange={(e) => setDiwaliCutoffMessage(e.target.value)}
              placeholder="Message shown under the banner"
              required
            />
          </>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
