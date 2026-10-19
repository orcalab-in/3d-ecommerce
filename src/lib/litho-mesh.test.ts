import { describe, expect, it } from "vitest";
import {
  buildFullPanelHeightGrid,
  buildLithophaneSolid,
  luminanceToThicknessMm,
} from "./litho-mesh";
import { checkWatertight } from "./mesh-check";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTestSolid() {
  const panelWidthMm = 40;
  const panelHeightMm = 50;
  const borderFrameMm = 4;
  const minThicknessMm = 0.8;
  const maxThicknessMm = 3.2;
  const borderThicknessMm = 3.2;
  const cols = 40;
  const rows = 50;
  const interiorCols = 32;
  const interiorRows = 42;

  const rand = mulberry32(42);
  const interiorLuminance = new Float32Array((interiorRows + 1) * (interiorCols + 1));
  for (let i = 0; i < interiorLuminance.length; i++) interiorLuminance[i] = rand();

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

  const solid = buildLithophaneSolid({
    heightGrid,
    cols,
    rows,
    panelWidthMm,
    panelHeightMm,
  });

  return { solid, panelWidthMm, panelHeightMm, minThicknessMm, maxThicknessMm, borderThicknessMm, cols, rows };
}

describe("luminanceToThicknessMm", () => {
  it("maps black to max thickness and white to min thickness", () => {
    expect(luminanceToThicknessMm(0, 0.8, 3.2)).toBeCloseTo(3.2);
    expect(luminanceToThicknessMm(1, 0.8, 3.2)).toBeCloseTo(0.8);
    expect(luminanceToThicknessMm(0.5, 0.8, 3.2)).toBeCloseTo(2.0);
  });

  it("clamps out-of-range input", () => {
    expect(luminanceToThicknessMm(-1, 0.8, 3.2)).toBeCloseTo(3.2);
    expect(luminanceToThicknessMm(2, 0.8, 3.2)).toBeCloseTo(0.8);
  });
});

describe("buildLithophaneSolid", () => {
  it("produces a watertight (closed, 2-manifold) mesh", () => {
    const { solid } = makeTestSolid();
    const result = checkWatertight(solid);
    expect(result.openEdgeCount).toBe(0);
    expect(result.nonManifoldEdgeCount).toBe(0);
    expect(result.watertight).toBe(true);
  });

  it("has the expected triangle count", () => {
    const { solid, cols, rows } = makeTestSolid();
    const expected = cols * rows * 2 /* top */ + cols * rows * 2 /* bottom */ + 2 * (cols + rows) * 2 /* walls */;
    expect(solid.triangleCount).toBe(expected);
  });

  it("matches the requested panel footprint and thickness bounds", () => {
    const { solid, panelWidthMm, panelHeightMm, minThicknessMm, maxThicknessMm } = makeTestSolid();
    const b = solid.bounds();

    expect(b.maxX - b.minX).toBeCloseTo(panelWidthMm, 5);
    expect(b.maxY - b.minY).toBeCloseTo(panelHeightMm, 5);
    expect(b.minZ).toBeCloseTo(0, 10);
    expect(b.maxZ).toBeLessThanOrEqual(maxThicknessMm + 1e-6);
    expect(b.maxZ).toBeGreaterThan(minThicknessMm);
  });

  it("stays watertight for a flat (uniform luminance) interior too", () => {
    const panelWidthMm = 20;
    const panelHeightMm = 20;
    const borderFrameMm = 4;
    const cols = 20;
    const rows = 20;
    const interiorCols = 12;
    const interiorRows = 12;
    const interiorLuminance = new Float32Array((interiorRows + 1) * (interiorCols + 1)).fill(0.5);

    const heightGrid = buildFullPanelHeightGrid({
      interiorLuminance,
      interiorCols,
      interiorRows,
      cols,
      rows,
      panelWidthMm,
      panelHeightMm,
      borderFrameMm,
      minThicknessMm: 0.8,
      maxThicknessMm: 3.2,
      borderThicknessMm: 3.2,
    });
    const solid = buildLithophaneSolid({ heightGrid, cols, rows, panelWidthMm, panelHeightMm });
    expect(checkWatertight(solid).watertight).toBe(true);
  });
});
