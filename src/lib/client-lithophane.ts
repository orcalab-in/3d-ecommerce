import { LITHOPHANE, SIZE_OPTIONS, SizeOptionId } from "./config";
import { AdjustState, CropState, drawCroppedAdjusted, luminanceFromImageData } from "./imaging";
import { buildFullPanelHeightGrid, buildLithophaneSolid } from "./litho-mesh";
import { TriangleBuffer } from "./stl";

/** Geometry grid resolution (vertex count) -- kept low so dragging/sliders stay smooth. */
export const PREVIEW_MAX_DIM = 130;
/** Backlit texture resolution -- independent of geometry, since a texture redraw is cheap (no extra triangles). */
export const TEXTURE_MAX_DIM = 600;

export function previewGridDims(panelWidthMm: number, panelHeightMm: number) {
  const scale = PREVIEW_MAX_DIM / Math.max(panelWidthMm, panelHeightMm);
  const cols = Math.max(8, Math.round(panelWidthMm * scale));
  const rows = Math.max(8, Math.round(panelHeightMm * scale));
  return { cols, rows };
}

export interface PreviewPanel {
  solid: TriangleBuffer;
  /** Full-panel texture (dark border + cropped/adjusted photo) for the backlit view. */
  panelCanvas: HTMLCanvasElement;
}

export function buildPreviewPanel(
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  sizeId: SizeOptionId,
  crop: CropState,
  adjust: AdjustState
): PreviewPanel {
  const { widthMm: panelWidthMm, heightMm: panelHeightMm } = SIZE_OPTIONS[sizeId];
  const { borderFrameMm, minThicknessMm, maxThicknessMm, borderThicknessMm } = LITHOPHANE;

  const { cols, rows } = previewGridDims(panelWidthMm, panelHeightMm);
  const innerWidthMm = panelWidthMm - 2 * borderFrameMm;
  const innerHeightMm = panelHeightMm - 2 * borderFrameMm;
  const interiorCols = Math.max(4, Math.round((cols * innerWidthMm) / panelWidthMm));
  const interiorRows = Math.max(4, Math.round((rows * innerHeightMm) / panelHeightMm));

  const interiorCanvas = document.createElement("canvas");
  interiorCanvas.width = interiorCols + 1;
  interiorCanvas.height = interiorRows + 1;
  const ictx = interiorCanvas.getContext("2d");
  if (!ictx) throw new Error("2D canvas context unavailable");
  drawCroppedAdjusted(
    ictx,
    img,
    srcWidth,
    srcHeight,
    interiorCanvas.width,
    interiorCanvas.height,
    crop,
    adjust
  );
  const idata = ictx.getImageData(0, 0, interiorCanvas.width, interiorCanvas.height).data;
  const interiorLuminance = luminanceFromImageData(idata, interiorCanvas.width * interiorCanvas.height);

  const heightGrid = buildFullPanelHeightGrid({
    interiorLuminance,
    interiorCols,
    interiorRows,
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

  // Backlit texture: redrawn from the source image at a much higher resolution than the
  // geometry grid above -- a texture is just a GPU upload, not extra triangles, so this
  // stays cheap even on every drag/slider update.
  const texScale = TEXTURE_MAX_DIM / Math.max(panelWidthMm, panelHeightMm);
  const texCols = Math.max(cols, Math.round(panelWidthMm * texScale));
  const texRows = Math.max(rows, Math.round(panelHeightMm * texScale));
  const texInnerW = Math.round((texCols * innerWidthMm) / panelWidthMm);
  const texInnerH = Math.round((texRows * innerHeightMm) / panelHeightMm);

  const hiResInterior = document.createElement("canvas");
  hiResInterior.width = texInnerW;
  hiResInterior.height = texInnerH;
  const hctx = hiResInterior.getContext("2d");
  if (!hctx) throw new Error("2D canvas context unavailable");
  // Grayscale: a real lithophane only varies light transmission by thickness, so the
  // backlit preview should show the same monochrome image the heightmap is built from --
  // not the original photo's colors, which the physical print can't reproduce.
  drawCroppedAdjusted(hctx, img, srcWidth, srcHeight, texInnerW, texInnerH, crop, adjust, "grayscale(1)");

  const panelCanvas = document.createElement("canvas");
  panelCanvas.width = texCols;
  panelCanvas.height = texRows;
  const pctx = panelCanvas.getContext("2d");
  if (!pctx) throw new Error("2D canvas context unavailable");
  pctx.fillStyle = "#0a0a0a"; // neutral near-black border (blocks light; not tinted)
  pctx.fillRect(0, 0, panelCanvas.width, panelCanvas.height);
  const ix = (borderFrameMm / panelWidthMm) * panelCanvas.width;
  const iy = (borderFrameMm / panelHeightMm) * panelCanvas.height;
  pctx.drawImage(hiResInterior, ix, iy, texInnerW, texInnerH);

  return { solid, panelCanvas };
}
