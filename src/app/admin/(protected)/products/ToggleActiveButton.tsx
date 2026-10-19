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
    <button
      onClick={toggle}
      disabled={submitting}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-amber/10 text-amber-dark" : "bg-neutral-200 text-foreground/50"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
