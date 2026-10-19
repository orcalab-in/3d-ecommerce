"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface Props {
  id: string;
  initialName: string;
  initialDescription: string;
  initialPrice: string;
}

export default function EditProductForm({ id, initialName, initialDescription, initialPrice }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState(initialPrice);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("description", description);
      form.set("price", price);
      if (image) form.set("image", image);

      const res = await fetch(`/api/admin/products/${id}`, { method: "PATCH", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <input
        className={inputClass}
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <label className="text-sm text-foreground/60">
        Replace image (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-amber px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
