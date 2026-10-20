"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LithophanePreview, { PreviewMode } from "@/components/LithophanePreview";
import { useCart } from "@/contexts/CartContext";
import { BASE_OPTIONS, BaseOptionId, SIZE_OPTIONS, SizeOptionId } from "@/lib/config";
import { buildPreviewPanel, PreviewPanel } from "@/lib/client-lithophane";
import { AdjustState, averageLuminance, CropState, DEFAULT_ADJUST, DEFAULT_CROP } from "@/lib/imaging";
import { computeLampPrice } from "@/lib/pricing";
import { checkPhotoQuality, validatePhotoFile } from "@/lib/validate-photo";

type Step = "upload" | "adjust" | "addedToCart";

interface Props {
  pricing: Record<SizeOptionId, Record<BaseOptionId, number>>;
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = url;
  });
}

export default function CreateClient({ pricing }: Props) {
  const { addItem } = useCart();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [heicUndecodable, setHeicUndecodable] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [sizeId, setSizeId] = useState<SizeOptionId>("100x150");
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [adjust, setAdjust] = useState<AdjustState>(DEFAULT_ADJUST);
  const [mode, setMode] = useState<PreviewMode>("backlit");
  const [preview, setPreview] = useState<PreviewPanel | null>(null);

  const [baseOption, setBaseOption] = useState<BaseOptionId>("none");
  const [qty, setQty] = useState(1);

  const dragState = useRef<{ x: number; y: number } | null>(null);

  // Rebuild the 3D preview whenever the image, size, crop, or adjustments change.
  // Deliberately an effect, not a render-time computation: buildPreviewPanel touches
  // canvas/DOM APIs and is too expensive to re-run on every render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!imgEl) {
      setPreview(null);
      return;
    }
    try {
      const panel = buildPreviewPanel(imgEl, imgEl.naturalWidth, imgEl.naturalHeight, sizeId, crop, adjust);
      setPreview(panel);
    } catch (err) {
      console.error("Preview build failed", err);
    }
  }, [imgEl, sizeId, crop, adjust]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleFileSelect(selected: File | null) {
    setUploadError(null);
    setWarnings([]);
    setHeicUndecodable(false);
    if (!selected) return;

    const errors = validatePhotoFile(selected);
    if (errors.length > 0) {
      setUploadError(errors.join(" "));
      return;
    }

    setFile(selected);
    try {
      const img = await loadImageFile(selected);
      setImgEl(img);

      const sample = document.createElement("canvas");
      sample.width = 50;
      sample.height = 50;
      const ctx = sample.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 50, 50);
        const avg = averageLuminance(ctx.getImageData(0, 0, 50, 50).data);
        setWarnings(checkPhotoQuality(img, avg));
      }
    } catch {
      setImgEl(null);
      setHeicUndecodable(true);
    }
    setStep("adjust");
  }

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent, containerWidth: number, containerHeight: number) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    dragState.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => ({
      ...c,
      offsetX: Math.min(1, Math.max(-1, c.offsetX - (dx / containerWidth) * 1.5)),
      offsetY: Math.min(1, Math.max(-1, c.offsetY - (dy / containerHeight) * 1.5)),
    }));
  }
  function onPointerUp() {
    dragState.current = null;
  }

  function addToCart() {
    if (!file) return;
    addItem({
      id: crypto.randomUUID(),
      type: "photo_lamp",
      file,
      previewThumbnail: preview?.panelCanvas.toDataURL() ?? "",
      sizeId,
      baseOption,
      crop,
      adjust,
      unitPrice: computeLampPrice(pricing, sizeId, baseOption, 1),
      qty,
    });
    setStep("addedToCart");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-8">
      <Link href="/" className="mb-4 text-sm text-ember underline underline-offset-2">
        ← Back
      </Link>

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-ember">Upload your photo</h1>
          <p className="text-sm text-foreground/70">
            JPG or PNG work best. We&apos;ll show you a live preview before you order anything.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber/40 bg-white/50 px-6 py-12 text-center transition hover:border-amber">
            <span className="text-3xl">📷</span>
            <span className="font-medium text-amber-dark">Choose a photo</span>
            <span className="text-xs text-foreground/50">JPG, PNG, HEIC — up to 15MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </label>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {step === "adjust" && (
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-bold text-ember">Preview your lamp</h1>

          {warnings.map((w) => (
            <p key={w} className="rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber-dark">
              ⚠️ {w}
            </p>
          ))}

          {heicUndecodable && (
            <p className="rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber-dark">
              Your browser can&apos;t preview HEIC photos directly. We&apos;ll still accept and convert the file —
              continue below to pick a size and place your order.
            </p>
          )}

          {!heicUndecodable && (
            <>
              <div
                className="relative aspect-[3/4] w-full touch-none overflow-hidden rounded-2xl shadow-lg"
                onPointerDown={onPointerDown}
                onPointerMove={(e) => onPointerMove(e, e.currentTarget.clientWidth, e.currentTarget.clientHeight)}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <LithophanePreview
                  solid={preview?.solid ?? null}
                  panelCanvas={preview?.panelCanvas ?? null}
                  mode={mode}
                  panelWidthMm={SIZE_OPTIONS[sizeId].widthMm}
                  panelHeightMm={SIZE_OPTIONS[sizeId].heightMm}
                />
                <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white">
                  drag to reposition
                </span>
              </div>

              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setMode("unlit")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    mode === "unlit" ? "bg-amber text-white" : "bg-white text-foreground/70"
                  }`}
                >
                  Unlit
                </button>
                <button
                  onClick={() => setMode("backlit")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    mode === "backlit" ? "bg-amber text-white" : "bg-white text-foreground/70"
                  }`}
                >
                  Backlit
                </button>
              </div>
              <p className="text-center text-xs text-foreground/50">
                {mode === "backlit"
                  ? "This is how your lamp looks lit up — judge your photo by this view."
                  : "This is how it looks with the light off. A real lithophane is meant to be backlit — it's normal for this view to look faint."}
              </p>

              <div className="flex flex-col gap-3 rounded-xl bg-white/60 p-4">
                <SliderRow
                  label="Zoom"
                  value={crop.zoom}
                  min={1}
                  max={3}
                  step={0.01}
                  onChange={(v) => setCrop((c) => ({ ...c, zoom: v }))}
                />
                <SliderRow
                  label="Brightness"
                  value={adjust.brightness}
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))}
                />
                <SliderRow
                  label="Contrast"
                  value={adjust.contrast}
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))}
                />
                <label className="flex items-center justify-between text-sm">
                  Invert
                  <input
                    type="checkbox"
                    checked={adjust.invert}
                    onChange={(e) => setAdjust((a) => ({ ...a, invert: e.target.checked }))}
                  />
                </label>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Size</span>
            <div className="flex gap-2">
              {(Object.keys(SIZE_OPTIONS) as SizeOptionId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => setSizeId(id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    sizeId === id ? "border-amber bg-amber/10 font-semibold text-amber-dark" : "border-amber/20"
                  }`}
                >
                  {SIZE_OPTIONS[id].label}
                  <div className="text-xs text-foreground/50">from ₹{computeLampPrice(pricing, id, "none", 1)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Base</span>
            <div className="flex gap-2">
              {(Object.keys(BASE_OPTIONS) as BaseOptionId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => setBaseOption(id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    baseOption === id ? "border-amber bg-amber/10 font-semibold text-amber-dark" : "border-amber/20"
                  }`}
                >
                  {BASE_OPTIONS[id].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full bg-white text-lg shadow-sm"
              >
                −
              </button>
              <span className="w-6 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                className="h-8 w-8 rounded-full bg-white text-lg shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-amber/10 px-4 py-2 text-sm font-semibold text-amber-dark">
            <span>Total</span>
            <span>₹{computeLampPrice(pricing, sizeId, baseOption, qty)}</span>
          </div>

          <button
            onClick={addToCart}
            className="mt-2 w-full rounded-full bg-amber px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-amber-dark"
          >
            Add to cart
          </button>
        </div>
      )}

      {step === "addedToCart" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-4xl">🛒</span>
          <h1 className="text-xl font-bold text-ember">Added to cart</h1>
          <p className="text-sm text-foreground/70">
            {SIZE_OPTIONS[sizeId].label} photo lamp, {BASE_OPTIONS[baseOption].label.toLowerCase()} — x{qty}
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/cart" className="rounded-full bg-amber px-6 py-2.5 text-sm font-semibold text-white">
              View cart
            </Link>
            <Link href="/" className="rounded-full border border-amber/40 px-6 py-2.5 text-sm text-amber-dark">
              Keep shopping
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
