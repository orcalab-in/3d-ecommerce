"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import OrderDetailsForm from "@/components/OrderDetailsForm";
import { STL_UPLOAD } from "@/lib/config";
import type { OrderDetailsInput } from "@/lib/validate-order";

export default function CreateStlPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sizeNotes, setSizeNotes] = useState("");
  const [colour, setColour] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(null);

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

  const submit = useCallback(
    async (details: OrderDetailsInput) => {
      if (!file) {
        setSubmitError("Please choose a file first.");
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        const form = new FormData();
        form.set("type", "stl_upload");
        form.set("file", file);
        form.set("sizeNotes", sizeNotes);
        form.set("colour", colour);
        form.set("qty", "1");
        form.set("name", details.name);
        form.set("whatsapp", details.whatsapp);
        form.set("address", details.address);
        form.set("pincode", details.pincode);
        form.set("notes", details.notes);
        form.set("neededBy", details.neededBy);
        form.set("consent", String(details.consent));

        const res = await fetch("/api/orders", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong");
        setOrderNo(json.orderNo);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [file, sizeNotes, colour]
  );

  if (orderNo) {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="text-4xl">🎉</span>
        <h1 className="text-xl font-bold text-ember">Request received — {orderNo}</h1>
        <p className="text-sm text-foreground/70">
          We&apos;ll review your file and confirm the final price with you on WhatsApp shortly.
        </p>
        <Link href="/" className="mt-2 rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
          Back to home
        </Link>
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

      <OrderDetailsForm
        submitting={submitting}
        submitLabel="Submit print request"
        onSubmit={submit}
        error={submitError}
        extraFields={
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Size notes</label>
              <input
                className="w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                value={sizeNotes}
                onChange={(e) => setSizeNotes(e.target.value)}
                placeholder="e.g. scale to 120mm tall"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Colour</label>
              <input
                className="w-full rounded-lg border border-amber/30 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                placeholder="e.g. black PLA"
              />
            </div>
          </>
        }
      />
    </main>
  );
}
