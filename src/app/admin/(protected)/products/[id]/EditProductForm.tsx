"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface ExistingImage {
  path: string;
  url: string;
}

interface Props {
  id: string;
  initialName: string;
  initialDescription: string;
  initialPrice: string;
  initialActive: boolean;
  existingImages: ExistingImage[];
}

export default function EditProductForm({
  id,
  initialName,
  initialDescription,
  initialPrice,
  initialActive,
  existingImages,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState(initialPrice);
  const [active, setActive] = useState(initialActive);
  const [images, setImages] = useState(existingImages);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);

  // useState's initial value only applies on mount -- after a save, router.refresh()
  // re-renders this component with a fresh `existingImages` prop (now including the
  // newly uploaded files). Adjust state during render (React's recommended pattern for
  // this, rather than an effect) so `images` stays in sync without an extra render pass.
  const [syncedImages, setSyncedImages] = useState(existingImages);
  if (syncedImages !== existingImages) {
    setSyncedImages(existingImages);
    setImages(existingImages);
  }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function removeExisting(path: string) {
    setImages((prev) => prev.filter((img) => img.path !== path));
    setRemovedPaths((prev) => [...prev, path]);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    setNewImages((prev) => [...prev, ...Array.from(files)]);
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  }

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
      form.set("active", String(active));
      if (removedPaths.length > 0) form.set("removeImagePaths", JSON.stringify(removedPaths));
      for (const image of newImages) form.append("images", image);

      const res = await fetch(`/api/admin/products/${id}`, { method: "PATCH", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setSaved(true);
      setRemovedPaths([]);
      setNewImages([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber";
  const labelClass = "mb-1 block text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={labelClass}>Stock status</span>
        <button
          type="button"
          onClick={() => setActive((a) => !a)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            active ? "bg-green-100 text-green-800" : "bg-neutral-200 text-foreground/60"
          }`}
        >
          {active ? "In stock — tap to mark out of stock" : "Out of stock — tap to mark in stock"}
        </button>
      </div>

      <div>
        <label className={labelClass}>Name</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div>
        <label className={labelClass}>Price (₹)</label>
        <input
          className={inputClass}
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelClass}>Photos</label>
        {(images.length > 0 || newImages.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.path} className="relative h-16 w-16 overflow-hidden rounded-lg border border-amber/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExisting(img.path)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
            {newImages.map((file, i) => (
              <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-amber">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-amber/40 bg-white/50 px-4 py-3 text-sm transition hover:border-amber">
          <span className="text-xl">🖼️</span>
          <span className="font-medium text-amber-dark">Add photos</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </label>
      </div>

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
