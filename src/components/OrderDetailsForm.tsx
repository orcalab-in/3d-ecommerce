"use client";

import { FormEvent, ReactNode, useState } from "react";
import { validateOrderDetails, type OrderDetailsInput } from "@/lib/validate-order";

interface Props {
  extraFields?: ReactNode;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (details: OrderDetailsInput) => void;
  error: string | null;
}

export default function OrderDetailsForm({ extraFields, submitting, submitLabel, onSubmit, error }: Props) {
  const [details, setDetails] = useState<OrderDetailsInput>({
    name: "",
    whatsapp: "",
    address: "",
    pincode: "",
    notes: "",
    neededBy: "",
    consent: false,
  });
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  function set<K extends keyof OrderDetailsInput>(key: K, value: OrderDetailsInput[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validateOrderDetails(details);
    setLocalErrors(errors);
    if (errors.length > 0) return;
    onSubmit(details);
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {extraFields}

      <div>
        <label className="mb-1 block text-sm font-medium">Your name</label>
        <input
          className={inputClass}
          value={details.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">WhatsApp number</label>
        <input
          className={inputClass}
          value={details.whatsapp}
          onChange={(e) => set("whatsapp", e.target.value)}
          placeholder="+91 98765 43210"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Delivery address</label>
        <textarea
          className={inputClass}
          rows={3}
          value={details.address}
          onChange={(e) => set("address", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Pincode</label>
          <input
            className={inputClass}
            value={details.pincode}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Needed by</label>
          <input
            type="date"
            className={inputClass}
            value={details.neededBy}
            onChange={(e) => set("neededBy", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
        <textarea
          className={inputClass}
          rows={2}
          value={details.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={details.consent}
          onChange={(e) => set("consent", e.target.checked)}
          required
        />
        <span>I own or have the right to use this photo.</span>
      </label>

      {(localErrors.length > 0 || error) && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {[...localErrors, ...(error ? [error] : [])].map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full rounded-full bg-amber px-6 py-3 text-center text-base font-semibold text-white shadow-md transition hover:bg-amber-dark disabled:opacity-50"
      >
        {submitting ? "Submitting..." : submitLabel}
      </button>
    </form>
  );
}
