"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { track } from "@/lib/analytics/track";
import { STL_UPLOAD } from "@/lib/config";

export default function CreateStlPage() {
  const { addItem } = useCart();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sizeNotes, setSizeNotes] = useState("");
  const [colour, setColour] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function handleFile(selected: File | null) {
    setFileError(null);
    if (!selected) return;
    const ext = selected.name.toLowerCase().slice(selected.name.lastIndexOf("."));
    if (!STL_UPLOAD.acceptedExtensions.includes(ext)) {
      setFileError("Please upload a .stl or .3mf file.");
      return;
    }
    if (selected.size > STL_UPLOAD.maxBytes) {
      setFileError("File is too large (max 50MB).");
      return;
    }
    setFile(selected);
  }

  function handleAdd() {
    if (!file) {
      setFileError("Please choose a file first.");
      return;
    }
    addItem({ id: crypto.randomUUID(), type: "stl_upload", file, sizeNotes, colour, qty });
    track("stl_upload_submitted");
    setAdded(true);
  }

  if (added) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="text-4xl">🛒</span>
        <h1 className="text-xl font-bold text-ember">Added to cart</h1>
        <p className="text-sm text-foreground/70">We&apos;ll confirm pricing for your file on WhatsApp.</p>
        <div className="mt-2 flex gap-3">
          <Link href="/cart" className="rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
            View cart
          </Link>
          <Link href="/" className="rounded-full border border-amber/40 px-6 py-2.5 text-sm text-amber-dark">
            Keep shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-8">
      <Link href="/" className="mb-4 text-sm text-ember underline underline-offset-2">
        ← Back
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-ember">Have your own STL/3MF?</h1>
      <p className="mb-5 text-sm text-foreground/70">
        Upload your file and tell us a bit about the print — we&apos;ll confirm pricing on WhatsApp.
      </p>

      <label className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber/40 bg-white/50 px-6 py-10 text-center transition hover:border-amber">
        <span className="text-3xl">🧩</span>
        <span className="font-medium text-amber-dark">{file ? file.name : "Choose a file"}</span>
        <span className="text-xs text-foreground/50">STL or 3MF — up to 50MB</span>
        <input
          type="file"
          accept=".stl,.3mf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {fileError && <p className="mb-4 text-sm text-red-600">{fileError}</p>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Size notes</label>
        <input
          className="w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          value={sizeNotes}
          onChange={(e) => setSizeNotes(e.target.value)}
          placeholder="e.g. scale to 120mm tall"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Colour</label>
        <input
          className="w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          placeholder="e.g. black PLA"
        />
      </div>

      <div className="mb-5 flex items-center justify-between">
        <span className="text-sm font-medium">Quantity</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full bg-white text-lg shadow-sm">
            −
          </button>
          <span className="w-6 text-center">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(20, q + 1))} className="h-8 w-8 rounded-full bg-white text-lg shadow-sm">
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="w-full rounded-full bg-amber px-6 py-3 text-center text-base font-semibold text-white shadow-md transition hover:bg-amber-dark"
      >
        Add to cart
      </button>
    </main>
  );
}
