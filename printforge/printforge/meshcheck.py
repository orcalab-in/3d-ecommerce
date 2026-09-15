"""Watertightness + outward-normal validation for every printforge mesh.

Two independent checks, both required for OrcaSlicer to accept a mesh
without repair:

1. Directed-edge matching -- for a closed, consistently-wound manifold,
   every directed edge (a, b) from one triangle must be matched by
   exactly one reverse edge (b, a) from the adjacent triangle, and no
   directed edge may repeat (non-manifold). A missing reverse means a
   hole; a repeated directed edge means overlapping/non-manifold
   geometry.
2. Signed volume -- a closed mesh with consistently outward-facing
   normals has strictly positive signed volume. Zero/negative volume
   means the mesh is degenerate or inside-out.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


class MeshCheckError(Exception):
    """Raised by assert_watertight when a mesh fails validation."""


@dataclass
class MeshCheckResult:
    watertight: bool
    volume_mm3: float
    triangle_count: int
    problems: list[str] = field(default_factory=list)


def signed_volume(triangles: np.ndarray) -> float:
    """Signed volume (mm^3) of a closed triangle mesh via the divergence
    theorem: sum(v0 . (v1 x v2)) / 6. Positive for outward-facing normals."""
    triangles = np.asarray(triangles, dtype=np.float64)
    v0, v1, v2 = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    return float(np.sum(np.einsum("ij,ij->i", v0, np.cross(v1, v2))) / 6.0)


def check_mesh(triangles: np.ndarray, tol: float = 1e-4) -> MeshCheckResult:
    """Validate a (N, 3, 3) triangle soup. `tol` is the vertex-merge
    tolerance in mm (STL is float32, so coincident vertices from separate
    triangles rarely land on the exact same bit pattern)."""
    triangles = np.asarray(triangles, dtype=np.float64)
    if triangles.ndim != 3 or triangles.shape[1:] != (3, 3) or len(triangles) == 0:
        return MeshCheckResult(False, 0.0, 0, ["empty or malformed triangle array"])

    problems: list[str] = []

    # np.unique(..., axis=0) on raw (M, 3) rows goes through a generic
    # multi-column lexsort; packing each row into one void-typed scalar
    # first lets it use a plain 1D sort instead, which is dramatically
    # faster at the vertex counts a fine lithophane mesh reaches (needed
    # to keep whole-job generation under the ~5s budget).
    scale = 1.0 / tol
    keys = np.ascontiguousarray(np.round(triangles.reshape(-1, 3) * scale).astype(np.int64))
    packed = keys.view(np.dtype((np.void, keys.dtype.itemsize * 3))).reshape(-1)
    uniq_packed, inverse = np.unique(packed, return_inverse=True)
    idx = inverse.reshape(-1, 3)  # (N, 3) vertex indices per triangle, post vertex-merge

    degenerate = (idx[:, 0] == idx[:, 1]) | (idx[:, 1] == idx[:, 2]) | (idx[:, 2] == idx[:, 0])
    if degenerate.any():
        problems.append(f"{int(degenerate.sum())} degenerate triangle(s) after vertex merge")

    edges = np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]])
    v = len(uniq_packed)
    edge_ids = edges[:, 0].astype(np.int64) * v + edges[:, 1].astype(np.int64)
    uniq_edge_ids, counts = np.unique(edge_ids, return_counts=True)

    repeated = counts > 1
    if repeated.any():
        problems.append(f"{int(repeated.sum())} directed edge(s) repeated (non-manifold)")

    # uniq_edge_ids is already sorted (np.unique's output), so a
    # searchsorted lookup is faster than np.isin here.
    reverse_ids = (uniq_edge_ids % v) * v + (uniq_edge_ids // v)
    pos = np.clip(np.searchsorted(uniq_edge_ids, reverse_ids), 0, len(uniq_edge_ids) - 1)
    has_reverse = uniq_edge_ids[pos] == reverse_ids
    missing = int((~has_reverse).sum())
    if missing:
        problems.append(f"{missing} boundary edge(s) with no matching reverse (mesh has a hole)")

    volume_mm3 = signed_volume(triangles)
    if volume_mm3 <= 0:
        problems.append(
            f"non-positive signed volume ({volume_mm3:.4f} mm^3) -- "
            "normals may be inverted or the mesh is inside-out")

    return MeshCheckResult(
        watertight=len(problems) == 0,
        volume_mm3=volume_mm3,
        triangle_count=len(triangles),
        problems=problems,
    )


def assert_watertight(triangles: np.ndarray, name: str = "mesh", tol: float = 1e-4) -> MeshCheckResult:
    """check_mesh(), raising MeshCheckError with the failure details if
    the mesh isn't watertight. Returns the MeshCheckResult on success."""
    result = check_mesh(triangles, tol=tol)
    if not result.watertight:
        raise MeshCheckError(f"{name}: not watertight -- {'; '.join(result.problems)}")
    return result
