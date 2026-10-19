import { TriangleBuffer } from "./stl";

export interface LithophaneSolidParams {
  /**
   * Full-panel height (mm) at each grid POINT (not cell), row-major, size
   * (rows + 1) * (cols + 1). Includes the flat border region — callers are
   * expected to have already clamped border cells to borderThicknessMm.
   * Row 0 = y = -panelHeightMm/2, row `rows` = y = +panelHeightMm/2.
   */
  heightGrid: Float32Array;
  cols: number;
  rows: number;
  panelWidthMm: number;
  panelHeightMm: number;
}

/**
 * Builds a single watertight solid from a uniform heightmap grid: a relief
 * top surface, a flat bottom at z=0, and side walls stitching the two
 * together. Because the top and bottom share the exact same x/y grid, every
 * edge is naturally shared by exactly two triangles -- no seam-matching
 * required.
 */
export function buildLithophaneSolid(params: LithophaneSolidParams): TriangleBuffer {
  const { heightGrid, cols, rows, panelWidthMm, panelHeightMm } = params;

  const halfW = panelWidthMm / 2;
  const halfH = panelHeightMm / 2;
  const x = (col: number) => -halfW + (col * panelWidthMm) / cols;
  const y = (row: number) => -halfH + (row * panelHeightMm) / rows;
  const h = (row: number, col: number) => heightGrid[row * (cols + 1) + col];

  const topTris = rows * cols * 2;
  const bottomTris = rows * cols * 2;
  const wallTris = 2 * (cols + rows) * 2;
  const buf = new TriangleBuffer(topTris + bottomTris + wallTris);

  // top relief surface (CCW from +z: outward normal +z)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ax = x(c), ay = y(r), az = h(r, c);
      const bx = x(c + 1), by = y(r), bz = h(r, c + 1);
      const cx = x(c + 1), cy = y(r + 1), cz = h(r + 1, c + 1);
      const dx = x(c), dy = y(r + 1), dz = h(r + 1, c);
      buf.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      buf.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
    }
  }

  // flat bottom (z=0), reversed winding so the outward normal is -z
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ax = x(c), ay = y(r);
      const bx = x(c + 1), by = y(r);
      const cx = x(c + 1), cy = y(r + 1);
      const dx = x(c), dy = y(r + 1);
      buf.push(ax, ay, 0, cx, cy, 0, bx, by, 0);
      buf.push(ax, ay, 0, dx, dy, 0, cx, cy, 0);
    }
  }

  // side walls: front (row 0), back (row rows), left (col 0), right (col cols)
  for (let c = 0; c < cols; c++) {
    const xL = x(c), xR = x(c + 1);
    const yF = y(0);
    buf.push(xR, yF, 0, xL, yF, 0, xL, yF, h(0, c));
    buf.push(xR, yF, 0, xL, yF, h(0, c), xR, yF, h(0, c + 1));

    const yB = y(rows);
    buf.push(xL, yB, 0, xR, yB, 0, xR, yB, h(rows, c + 1));
    buf.push(xL, yB, 0, xR, yB, h(rows, c + 1), xL, yB, h(rows, c));
  }
  for (let r = 0; r < rows; r++) {
    const yB = y(r), yT = y(r + 1);
    const xL = x(0);
    buf.push(xL, yT, 0, xL, yB, 0, xL, yB, h(r, 0));
    buf.push(xL, yT, 0, xL, yB, h(r, 0), xL, yT, h(r + 1, 0));

    const xR = x(cols);
    buf.push(xR, yB, 0, xR, yT, 0, xR, yT, h(r + 1, cols));
    buf.push(xR, yB, 0, xR, yT, h(r + 1, cols), xR, yB, h(r, cols));
  }

  return buf;
}

/** Maps a normalized luminance (0 = black, 1 = white) to panel thickness (mm). Darker = thicker. */
export function luminanceToThicknessMm(
  luminance: number,
  minThicknessMm: number,
  maxThicknessMm: number
): number {
  const l = Math.min(1, Math.max(0, luminance));
  return maxThicknessMm - l * (maxThicknessMm - minThicknessMm);
}

export interface BuildHeightGridParams {
  /** Grayscale luminance samples (0..1), row-major grid of interior POINTS, size (interiorRows+1)*(interiorCols+1). */
  interiorLuminance: Float32Array;
  interiorCols: number;
  interiorRows: number;
  /** Output grid resolution (full panel, including border). */
  cols: number;
  rows: number;
  panelWidthMm: number;
  panelHeightMm: number;
  borderFrameMm: number;
  minThicknessMm: number;
  maxThicknessMm: number;
  borderThicknessMm: number;
}

/**
 * Combines interior photo relief with a flat border frame into one
 * full-panel height grid, ready for {@link buildLithophaneSolid}.
 * `interiorLuminance` is resampled (nearest) to fill every grid point that
 * falls inside the border -- grid points in the border band are clamped to
 * `borderThicknessMm`.
 */
export function buildFullPanelHeightGrid(params: BuildHeightGridParams): Float32Array {
  const {
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
  } = params;

  const halfW = panelWidthMm / 2;
  const halfH = panelHeightMm / 2;
  const innerX0 = -halfW + borderFrameMm;
  const innerX1 = halfW - borderFrameMm;
  const innerY0 = -halfH + borderFrameMm;
  const innerY1 = halfH - borderFrameMm;

  const grid = new Float32Array((rows + 1) * (cols + 1));
  const x = (col: number) => -halfW + (col * panelWidthMm) / cols;
  const y = (row: number) => -halfH + (row * panelHeightMm) / rows;

  for (let r = 0; r <= rows; r++) {
    const py = y(r);
    for (let c = 0; c <= cols; c++) {
      const px = x(c);
      if (px < innerX0 || px > innerX1 || py < innerY0 || py > innerY1) {
        grid[r * (cols + 1) + c] = borderThicknessMm;
        continue;
      }
      const u = ((px - innerX0) / (innerX1 - innerX0)) * interiorCols;
      // Flipped: image row 0 is the top of the photo, but mesh +Y (py near innerY1) is
      // also "up" (top of the rendered panel) -- without this flip the relief geometry
      // (and the printed STL) comes out upside-down relative to the source photo.
      const v = ((innerY1 - py) / (innerY1 - innerY0)) * interiorRows;
      const iu = Math.min(interiorCols, Math.max(0, Math.round(u)));
      const iv = Math.min(interiorRows, Math.max(0, Math.round(v)));
      const lum = interiorLuminance[iv * (interiorCols + 1) + iu] ?? 1;
      grid[r * (cols + 1) + c] = luminanceToThicknessMm(lum, minThicknessMm, maxThicknessMm);
    }
  }

  return grid;
}
