/** Minimal binary STL writer. Normals are computed per-facet from winding order. */

function triangleNormal(
  v0: readonly [number, number, number],
  v1: readonly [number, number, number],
  v2: readonly [number, number, number]
): [number, number, number] {
  const ux = v1[0] - v0[0];
  const uy = v1[1] - v0[1];
  const uz = v1[2] - v0[2];
  const vx = v2[0] - v0[0];
  const vy = v2[1] - v0[1];
  const vz = v2[2] - v0[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** Append-only buffer of triangles (flat, 9 floats per triangle: v0xyz, v1xyz, v2xyz). */
export class TriangleBuffer {
  private data: Float64Array;
  private count = 0;

  constructor(capacity: number) {
    this.data = new Float64Array(Math.max(capacity, 1) * 9);
  }

  push(
    v0x: number, v0y: number, v0z: number,
    v1x: number, v1y: number, v1z: number,
    v2x: number, v2y: number, v2z: number
  ) {
    if (this.count * 9 >= this.data.length) this.grow();
    const o = this.count * 9;
    const d = this.data;
    d[o] = v0x; d[o + 1] = v0y; d[o + 2] = v0z;
    d[o + 3] = v1x; d[o + 4] = v1y; d[o + 5] = v1z;
    d[o + 6] = v2x; d[o + 7] = v2y; d[o + 8] = v2z;
    this.count++;
  }

  private grow() {
    const next = new Float64Array(this.data.length * 2);
    next.set(this.data);
    this.data = next;
  }

  get triangleCount() {
    return this.count;
  }

  /** Non-indexed position buffer (3 verts * 3 floats per triangle) -- directly usable as a THREE.BufferAttribute. */
  toFloat32Positions(): Float32Array {
    return Float32Array.from(this.data.subarray(0, this.count * 9));
  }

  triangleAt(i: number): {
    v0: [number, number, number];
    v1: [number, number, number];
    v2: [number, number, number];
  } {
    const o = i * 9;
    const d = this.data;
    return {
      v0: [d[o], d[o + 1], d[o + 2]],
      v1: [d[o + 3], d[o + 4], d[o + 5]],
      v2: [d[o + 6], d[o + 7], d[o + 8]],
    };
  }

  bounds() {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.count * 9; i += 3) {
      const x = this.data[i], y = this.data[i + 1], z = this.data[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

  toBinarySTL(header = "lithophane"): Buffer {
    const headerBytes = Buffer.alloc(80);
    headerBytes.write(header.slice(0, 79), "ascii");
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(this.count, 0);
    const body = Buffer.alloc(this.count * 50);
    let offset = 0;
    for (let i = 0; i < this.count; i++) {
      const t = this.triangleAt(i);
      const n = triangleNormal(t.v0, t.v1, t.v2);
      offset = body.writeFloatLE(n[0], offset);
      offset = body.writeFloatLE(n[1], offset);
      offset = body.writeFloatLE(n[2], offset);
      for (const v of [t.v0, t.v1, t.v2]) {
        offset = body.writeFloatLE(v[0], offset);
        offset = body.writeFloatLE(v[1], offset);
        offset = body.writeFloatLE(v[2], offset);
      }
      offset += 2; // attribute byte count, left as 0
    }
    return Buffer.concat([headerBytes, countBuf, body]);
  }
}
