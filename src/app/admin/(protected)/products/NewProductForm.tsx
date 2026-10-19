"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewProductForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("description", description);
      form.set("price", price);
      if (image) form.set("image", image);

      const res = await fetch("/api/admin/products", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not create product");

      setName("");
      setDescription("");
      setPrice("");
      setImage(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create product");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Add product</h2>
      <input className={inputClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea
        className={inputClass}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <input
        className={inputClass}
        type="number"
        placeholder="Price (₹)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Add product"}
      </button>
    </form>
  );
}
