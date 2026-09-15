"""Binary STL read/write and the axis-aligned box primitive.

Ported from the lithophane.py prototype. No external mesh library —
triangles are plain (N, 3, 3) float32 numpy arrays, counter-clockwise
when viewed from outside the solid.
"""
from __future__ import annotations

import struct

import numpy as np

STL_HEADER_BYTES = 80
_RECORD_DTYPE = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])


def write_binary_stl(path: str, tris: np.ndarray, name: bytes = b"printforge") -> int:
    """Write a binary STL file. tris: (N, 3, 3) float32/float64 array of
    triangles, CCW seen from outside. Normals are (re)computed from the
    triangle winding so callers never need to supply them. Returns the
    triangle count written."""
    tris = np.asarray(tris, dtype=np.float32)
    if tris.ndim != 3 or tris.shape[1:] != (3, 3):
        raise ValueError(f"expected (N, 3, 3) triangle array, got {tris.shape}")
    n = len(tris)
    v1 = tris[:, 1] - tris[:, 0]
    v2 = tris[:, 2] - tris[:, 0]
    normals = np.cross(v1, v2)
    lens = np.linalg.norm(normals, axis=1, keepdims=True)
    lens[lens == 0] = 1
    normals = (normals / lens).astype(np.float32)

    rec = np.zeros(n, dtype=_RECORD_DTYPE)
    rec["n"] = normals
    rec["v"] = tris
    with open(path, "wb") as f:
        f.write(name.ljust(STL_HEADER_BYTES, b" ")[:STL_HEADER_BYTES])
        f.write(struct.pack("<I", n))
        f.write(rec.tobytes())
    return n


def read_binary_stl(path: str) -> np.ndarray:
    """Read a binary STL file back into an (N, 3, 3) float32 triangle array.
    Used for round-trip tests and re-validating written files."""
    with open(path, "rb") as f:
        header = f.read(STL_HEADER_BYTES)
        if len(header) < STL_HEADER_BYTES:
            raise ValueError(f"{path}: truncated STL header")
        (n,) = struct.unpack("<I", f.read(4))
        rec = np.frombuffer(f.read(n * _RECORD_DTYPE.itemsize), dtype=_RECORD_DTYPE, count=n)
    return np.array(rec["v"], dtype=np.float32)


def box(x0: float, x1: float, y0: float, y1: float, z0: float, z1: float) -> np.ndarray:
    """12 triangles for an axis-aligned box, outward-facing. Slicers merge
    coincident faces between touching boxes, so composite parts (stands,
    bases, slots) can be built purely from unions of boxes without CSG."""
    p = np.array(
        [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
         [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], dtype=np.float32)
    faces = [
        (0, 2, 1), (0, 3, 2),  # bottom (z0), normal -z
        (4, 5, 6), (4, 6, 7),  # top (z1), normal +z
        (0, 1, 5), (0, 5, 4),  # front (y0), normal -y
        (2, 3, 7), (2, 7, 6),  # back (y1), normal +y
        (3, 0, 4), (3, 4, 7),  # left (x0), normal -x
        (1, 2, 6), (1, 6, 5),  # right (x1), normal +x
    ]
    return p[np.array(faces)]
