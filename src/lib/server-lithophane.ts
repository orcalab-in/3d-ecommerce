import sharp from "sharp";
import { LITHOPHANE, MAX_PANEL_DIMENSION_MM, SIZE_OPTIONS, SizeOptionId } from "./config";
import { AdjustState, CropState, cropSourceRect } from "./imaging";
import { buildFullPanelHeightGrid, buildLithophaneSolid } from "./litho-mesh";

export interface GenerateLithophaneResult {
  stlBuffer: Buffer;
  previewPng: Buffer;
  triangleCount: number;
}

/** Hard ceiling so a pathological config (tiny mmPerPixel + max panel size) can't hang the server. */
const MAX_TRIANGLES = 6_000_000;

export async function generateLithophaneSTL(opts: {
  originalBuffer: Buffer;
  sizeId: SizeOptionId;
  crop: CropState;
  adjust: AdjustState;
}): Promise<GenerateLithophaneResult> {
  const size = SIZE_OPTIONS[opts.sizeId];
  if (!size) throw new Error(`Unknown size option: ${opts.sizeId}`);
  const { widthMm: panelWidthMm, heightMm: panelHeightMm } = size;
  if (panelWidthMm > MAX_PANEL_DIMENSION_MM || panelHeightMm > MAX_PANEL_DIMENSION_MM) {
    throw new Error(`Panel exceeds the ${MAX_PANEL_DIMENSION_MM}mm max printable dimension`);
  }

  const { borderFrameMm, minThicknessMm, maxThicknessMm, borderThicknessMm, mmPerPixel } = LITHOPHANE;

  const base = sharp(opts.originalBuffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image dimensions");

  const innerWidthMm = panelWidthMm - 2 * borderFrameMm;
  const innerHeightMm = panelHeightMm - 2 * borderFrameMm;
  const interiorCols = Math.round(innerWidthMm / mmPerPixel);
  const interiorRows = Math.round(innerHeightMm / mmPerPixel);
  const cols = Math.round(panelWidthMm / mmPerPixel);
  const rows = Math.round(panelHeightMm / mmPerPixel);

  const estimatedTriangles = cols * rows * 4 + 2 * (cols + rows) * 2;
  if (estimatedTriangles > MAX_TRIANGLES) {
    throw new Error(
      "This configuration would generate too large a mesh. Reduce LITHOPHANE.mmPerPixel in src/lib/config.ts or the panel size."
    );
  }

  const rect = cropSourceRect(meta.width, meta.height, innerWidthMm / innerHeightMm, opts.crop);

  const contrastA = opts.adjust.contrast;
  const contrastB = 127.5 * (1 - contrastA);

  let pipeline = sharp(opts.originalBuffer, { failOn: "none" })
    .rotate()
    .extract({
      left: Math.round(rect.sx),
      top: Math.round(rect.sy),
      width: Math.max(1, Math.round(rect.sw)),
      height: Math.max(1, Math.round(rect.sh)),
    })
    .resize(interiorCols + 1, interiorRows + 1, { fit: "fill" })
    .modulate({ brightness: opts.adjust.brightness })
    .linear(contrastA, contrastB)
    .grayscale();
  if (opts.adjust.invert) pipeline = pipeline.negate({ alpha: false });

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`Expected 1-channel grayscale output, got ${info.channels}`);

  const interiorLuminance = new Float32Array(info.width * info.height);
  for (let i = 0; i < interiorLuminance.length; i++) interiorLuminance[i] = data[i] / 255;

  const heightGrid = buildFullPanelHeightGrid({
    interiorLuminance,
    interiorCols: info.width - 1,
    interiorRows: info.height - 1,
    cols,
    rows,
    panelWidthMm,
    panelHeightMm,
    borderFrameMm,
    minThicknessMm,
    maxThicknessMm,
    borderThicknessMm,
  });

  const solid = buildLithophaneSolid({ heightGrid, cols, rows, panelWidthMm, panelHeightMm });
  const stlBuffer = solid.toBinarySTL(`lithophane ${panelWidthMm}x${panelHeightMm}mm`);

  const previewPng = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toBuffer();

  return { stlBuffer, previewPng, triangleCount: solid.triangleCount };
}
