"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    const form = new FormData();
    form.set("active", String(!active));
    await fetch(`/api/admin/products/${id}`, { method: "PATCH", body: form });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-foreground/50"
        }`}
      >
        {active ? "In stock" : "Out of stock"}
      </span>
      <button
        onClick={toggle}
        disabled={submitting}
        className="rounded-full border border-amber/40 px-3 py-1 text-xs font-medium text-amber-dark disabled:opacity-50"
      >
        {submitting ? "..." : active ? "Mark out of stock" : "Mark in stock"}
      </button>
    </div>
  );
}
