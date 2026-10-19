import { TriangleBuffer } from "./stl";

export interface WatertightResult {
  watertight: boolean;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
  triangleCount: number;
}

function roundCoord(v: number) {
  // Collapse float noise so coincident vertices hash identically.
  return Math.round(v * 1e4) / 1e4;
}

function vKey(x: number, y: number, z: number) {
  return `${roundCoord(x)},${roundCoord(y)},${roundCoord(z)}`;
}

/**
 * Checks that every edge in the mesh is shared by exactly two triangles
 * (the standard definition of a closed/watertight 2-manifold triangle soup).
 */
export function checkWatertight(buf: TriangleBuffer): WatertightResult {
  const edgeCounts = new Map<string, number>();
  const n = buf.triangleCount;

  for (let i = 0; i < n; i++) {
    const { v0, v1, v2 } = buf.triangleAt(i);
    const k0 = vKey(...v0);
    const k1 = vKey(...v1);
    const k2 = vKey(...v2);
    for (const [a, b] of [
      [k0, k1],
      [k1, k2],
      [k2, k0],
    ]) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) openEdgeCount++;
    else if (count !== 2) nonManifoldEdgeCount++;
  }

  return {
    watertight: openEdgeCount === 0 && nonManifoldEdgeCount === 0,
    openEdgeCount,
    nonManifoldEdgeCount,
    triangleCount: n,
  };
}
