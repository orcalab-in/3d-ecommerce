export interface CropState {
  /** 1 = image fitted to the target aspect with no extra zoom. */
  zoom: number;
  /** -1..1 pan fraction, 0 = centered. */
  offsetX: number;
  offsetY: number;
}

export interface AdjustState {
  /** 1 = no change. */
  brightness: number;
  contrast: number;
  invert: boolean;
}

export const DEFAULT_CROP: CropState = { zoom: 1, offsetX: 0, offsetY: 0 };
export const DEFAULT_ADJUST: AdjustState = { brightness: 1, contrast: 1, invert: false };

/** Source rect (in source-image pixels) that `drawCropped` would sample, given a target aspect ratio. */
export function cropSourceRect(
  srcWidth: number,
  srcHeight: number,
  targetAspect: number,
  crop: CropState
) {
  const srcAspect = srcWidth / srcHeight;
  let baseW: number, baseH: number;
  if (srcAspect > targetAspect) {
    baseH = srcHeight;
    baseW = srcHeight * targetAspect;
  } else {
    baseW = srcWidth;
    baseH = srcWidth / targetAspect;
  }
  const w = Math.min(srcWidth, baseW / crop.zoom);
  const h = Math.min(srcHeight, baseH / crop.zoom);
  const maxOffX = (srcWidth - w) / 2;
  const maxOffY = (srcHeight - h) / 2;
  const cx = srcWidth / 2 + crop.offsetX * maxOffX;
  const cy = srcHeight / 2 + crop.offsetY * maxOffY;
  const sx = Math.min(Math.max(cx - w / 2, 0), srcWidth - w);
  const sy = Math.min(Math.max(cy - h / 2, 0), srcHeight - h);
  return { sx, sy, sw: w, sh: h };
}

/** Draws the cropped + brightness/contrast/invert-adjusted image into `ctx`, filling it exactly. */
export function drawCroppedAdjusted(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  outWidth: number,
  outHeight: number,
  crop: CropState,
  adjust: AdjustState,
  /** Extra CSS filter functions appended to the chain, e.g. "grayscale(1)". */
  extraFilter = ""
) {
  const { sx, sy, sw, sh } = cropSourceRect(srcWidth, srcHeight, outWidth / outHeight, crop);
  ctx.save();
  ctx.filter = `brightness(${adjust.brightness}) contrast(${adjust.contrast})${
    adjust.invert ? " invert(1)" : ""
  }${extraFilter ? ` ${extraFilter}` : ""}`;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
  ctx.restore();
}

/** Rec. 601 luma, normalized 0 (black) .. 1 (white). */
export function luminanceFromImageData(data: Uint8ClampedArray, pixelCount: number) {
  const out = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    out[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
  }
  return out;
}

export function averageLuminance(data: Uint8ClampedArray) {
  const pixelCount = data.length / 4;
  const lum = luminanceFromImageData(data, pixelCount);
  let sum = 0;
  for (let i = 0; i < lum.length; i++) sum += lum[i];
  return (sum / lum.length) * 255;
}
