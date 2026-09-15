"""Generalized mesh-building toolkit shared by every product.

The core idea: the lithophane.py prototype's `heightmap_to_stl` builds a
watertight solid from ONE heightmap by pairing a top surface with a flat
z=0 bottom (fan-triangulated from a centroid) and ruled side walls. Every
product in this package needs the same "two matching-topology vertex
grids, stitched into a closed solid" shape — just with different grids:
flat top / flat bottom (panel), curved top / curved bottom (cylinder-arc
panel), outer radius / inner radius (full cylinder wrap), terrain
surface / flat base (terrain tile). `ruled_grid_solid` is that one
reusable primitive; everything else in this module is a building block
either it or a product module calls directly.
"""
from __future__ import annotations

import numpy as np

from .stl_io import box

__all__ = [
    "box",
    "grid_surface_tris",
    "wall_strip",
    "bridge_loops",
    "ruled_grid_solid",
    "boundary_loops",
    "boundary_walk",
    "corner_mask",
    "slotted_base",
    "cylinder",
    "sweep_tube",
]


def grid_surface_tris(grid: np.ndarray, close_u: bool = False,
                       mask: np.ndarray | None = None) -> np.ndarray:
    """grid: (ny, nx, 3) vertex positions. Emits 2 CCW triangles per cell
    (as seen from the direction consistent with increasing row/col via
    the right-hand rule -- +z for a flat XY grid). close_u=True also
    connects column nx-1 back to column 0 (closed ring, e.g. a cylinder
    wrap). mask: optional (ny-1, ncols) bool array (ncols = nx if
    close_u else nx-1) -- cells where mask is False are skipped."""
    grid = np.asarray(grid, dtype=np.float32)
    ny, nx = grid.shape[:2]
    ncols = nx if close_u else nx - 1
    col0 = np.arange(ncols)
    col1 = (col0 + 1) % nx if close_u else col0 + 1

    a = grid[:-1, col0, :]
    b = grid[:-1, col1, :]
    c = grid[1:, col1, :]
    d = grid[1:, col0, :]

    t1 = np.stack([a, b, c], axis=2)  # (ny-1, ncols, 3, 3)
    t2 = np.stack([a, c, d], axis=2)

    if mask is not None:
        mask = np.asarray(mask, dtype=bool)
        t1 = t1[mask]
        t2 = t2[mask]
    else:
        t1 = t1.reshape(-1, 3, 3)
        t2 = t2.reshape(-1, 3, 3)
    return np.concatenate([t1, t2]).astype(np.float32)


def wall_strip(ring_a: np.ndarray, ring_b: np.ndarray, close: bool = False) -> np.ndarray:
    """ring_a, ring_b: (n, 3) polylines with matching point count and
    index correspondence (ring_a "outboard" of ring_b, e.g. a top rim
    above a bottom rim, or an outer radius outside an inner radius).
    Emits a ruled quad-strip: (a[i], b[i], b[i+1]) and (a[i], b[i+1],
    a[i+1]) per consecutive pair. close=True also wraps n-1 -> 0."""
    ring_a = np.asarray(ring_a, dtype=np.float32)
    ring_b = np.asarray(ring_b, dtype=np.float32)
    n = len(ring_a)
    if len(ring_b) != n:
        raise ValueError(f"wall_strip: ring length mismatch {n} vs {len(ring_b)}")
    count = n if close else n - 1
    idx0 = np.arange(count)
    idx1 = (idx0 + 1) % n
    a0, a1 = ring_a[idx0], ring_a[idx1]
    b0, b1 = ring_b[idx0], ring_b[idx1]
    t1 = np.stack([a0, b0, b1], axis=1)
    t2 = np.stack([a0, b1, a1], axis=1)
    return np.concatenate([t1, t2]).astype(np.float32)


def bridge_loops(outer: np.ndarray, inner: np.ndarray) -> np.ndarray:
    """Triangulate the annulus between two closed, same-winding (both
    CCW, as seen from the direction the result should face) loops.
    `inner` may degenerate to a single repeated point (an end-cap fan,
    e.g. a cylinder cap) -- and symmetrically for `outer`. General case
    walks both loops by cumulative normalized arc-length, always
    advancing whichever loop's next vertex is closer in that fraction,
    for exactly len(outer) + len(inner) triangles."""
    outer = np.asarray(outer, dtype=np.float32)
    inner = np.asarray(inner, dtype=np.float32)
    m, n = len(outer), len(inner)

    if n == 1:
        centre = inner[0]
        i0 = np.arange(m)
        i1 = (i0 + 1) % m
        return np.stack([outer[i0], outer[i1], np.broadcast_to(centre, (m, 3))],
                         axis=1).astype(np.float32)
    if m == 1:
        centre = outer[0]
        j0 = np.arange(n)
        j1 = (j0 + 1) % n
        return np.stack([np.broadcast_to(centre, (n, 3)), inner[j1], inner[j0]],
                         axis=1).astype(np.float32)

    def cum_frac(loop: np.ndarray) -> np.ndarray:
        seg = np.linalg.norm(np.roll(loop, -1, axis=0) - loop, axis=1)
        total = seg.sum()
        if total <= 0:
            return np.linspace(0.0, 1.0, len(loop), endpoint=False)
        return np.concatenate([[0.0], np.cumsum(seg)[:-1]]) / total

    fo, fi = cum_frac(outer), cum_frac(inner)
    tris = []
    i = j = 0
    while i < m or j < n:
        fo_next = fo[i + 1] if i + 1 < m else 1.0
        fi_next = fi[j + 1] if j + 1 < n else 1.0
        if j >= n or (i < m and fo_next <= fi_next):
            tris.append((outer[i % m], outer[(i + 1) % m], inner[j % n]))
            i += 1
        else:
            tris.append((outer[i % m], inner[(j + 1) % n], inner[j % n]))
            j += 1
    return np.array(tris, dtype=np.float32)


def _boundary_edges(mask: np.ndarray) -> dict[tuple[int, int], tuple[int, int]]:
    """Directed boundary edges (as a start-vertex -> end-vertex map) of a
    boolean cell mask: cell (i, j) has corners (i, j), (i, j+1),
    (i+1, j+1), (i+1, j). An edge is a boundary edge whenever the cell on
    the far side is not included (or off the grid). By construction, the
    outer perimeter of a connected region comes out CCW and any interior
    holes come out CW -- exactly the winding convention `extrude_polygon_2d`
    and `ruled_grid_solid` expect, no separate classification needed."""
    mask = np.asarray(mask, dtype=bool)
    ny_c, nx_c = mask.shape

    def included(i: int, j: int) -> bool:
        return 0 <= i < ny_c and 0 <= j < nx_c and mask[i, j]

    nxt: dict[tuple[int, int], tuple[int, int]] = {}
    for i in range(ny_c):
        for j in range(nx_c):
            if not mask[i, j]:
                continue
            if not included(i - 1, j):          # south edge
                nxt[(i, j)] = (i, j + 1)
            if not included(i, j + 1):           # east edge
                nxt[(i, j + 1)] = (i + 1, j + 1)
            if not included(i + 1, j):           # north edge
                nxt[(i + 1, j + 1)] = (i + 1, j)
            if not included(i, j - 1):           # west edge
                nxt[(i + 1, j)] = (i, j)
    return nxt


def boundary_loops(mask: np.ndarray) -> list[np.ndarray]:
    """All closed boundary loops of a boolean cell mask -- the outer
    perimeter (or perimeters, if the mask has several disjoint regions)
    plus one loop per hole, as sequences of (row, col) VERTEX indices
    into the (ny, nx) grid the mask sits inside. Sorted largest-first."""
    nxt = _boundary_edges(mask)
    if not nxt:
        raise ValueError("boundary_loops: mask has no included cells")

    visited: set[tuple[int, int]] = set()
    loops: list[np.ndarray] = []
    guard_limit = 4 * len(nxt) + 8
    for start in list(nxt.keys()):
        if start in visited:
            continue
        loop = [start]
        visited.add(start)
        cur = nxt[start]
        while cur != start:
            loop.append(cur)
            visited.add(cur)
            cur = nxt[cur]
            if len(loop) > guard_limit:
                raise ValueError("boundary_loops: malformed boundary graph")
        loops.append(np.array(loop, dtype=np.int64))
    loops.sort(key=len, reverse=True)
    return loops


def boundary_walk(mask: np.ndarray) -> np.ndarray:
    """boundary_loops(), asserting the mask has exactly one loop (a
    single simply-connected region with no holes) -- e.g. a rounded-
    corner rectangle. Reduces to the plain rectangle perimeter (front,
    right, back, left, CCW) when every cell is included."""
    loops = boundary_loops(mask)
    if len(loops) != 1:
        raise ValueError(f"boundary_walk: expected a single simple loop, found {len(loops)}")
    return loops[0]


def corner_mask(shape: tuple[int, int], res_mm: float, corner_radius_mm: float) -> np.ndarray:
    """shape: (ny, nx) VERTEX grid shape. Returns a (ny-1, nx-1) boolean
    cell mask: True unless a cell's centre falls in the small region cut
    off by a rounded corner of corner_radius_mm at one of the 4 rectangle
    corners -- i.e. outside the arc of an r-radius circle whose centre is
    inset by r from each of that corner's two edges (NOT the corner
    vertex itself, which would clip a single far cell rather than a
    proper rounded bite -- see docs/DECISIONS.md)."""
    ny, nx = shape
    if corner_radius_mm <= 0:
        return np.ones((ny - 1, nx - 1), dtype=bool)
    cx = (np.arange(nx - 1) + 0.5) * res_mm
    cy = (np.arange(ny - 1) + 0.5) * res_mm
    x, y = np.meshgrid(cx, cy)
    w, h = (nx - 1) * res_mm, (ny - 1) * res_mm
    r = min(corner_radius_mm, w / 2, h / 2)
    clip = np.zeros_like(x, dtype=bool)
    for corner_x, corner_y, center_x, center_y in (
        (0.0, 0.0, r, r),
        (0.0, h, r, h - r),
        (w, 0.0, w - r, r),
        (w, h, w - r, h - r),
    ):
        near = (np.abs(x - corner_x) <= r) & (np.abs(y - corner_y) <= r)
        dist = np.hypot(x - center_x, y - center_y)
        clip |= near & (dist > r)
    return ~clip


def ruled_grid_solid(top: np.ndarray, bottom: np.ndarray, close_u: bool = False,
                      mask: np.ndarray | None = None) -> np.ndarray:
    """The generalized heightmap_to_stl. top/bottom: (ny, nx, 3), same
    topology, any 3D shape (flat, cylindrical-curved, radial in/out).
    Builds a watertight solid: top surface, bottom surface (reversed
    winding), and walls closing the gap between them -- via boundary_walk
    when the grid has an open edge (close_u=False, e.g. a rectangular
    panel, optionally with masked-out corners), or via two end-cap
    annuli when the u-direction wraps (close_u=True, e.g. a full
    cylinder wrap)."""
    top = np.asarray(top, dtype=np.float32)
    bottom = np.asarray(bottom, dtype=np.float32)
    if top.shape != bottom.shape:
        raise ValueError(f"ruled_grid_solid: shape mismatch {top.shape} vs {bottom.shape}")
    ny, nx = top.shape[:2]

    t_top = grid_surface_tris(top, close_u=close_u, mask=mask)
    t_bottom = grid_surface_tris(bottom, close_u=close_u, mask=mask)[:, ::-1, :]
    tris = [t_top, t_bottom]

    if close_u:
        tris.append(bridge_loops(top[-1, :], bottom[-1, :]))
        tris.append(bridge_loops(top[0, :], bottom[0, :])[:, ::-1, :])
    else:
        if mask is None:
            mask = np.ones((ny - 1, nx - 1), dtype=bool)
        loop_idx = boundary_walk(mask)
        top_loop = top[loop_idx[:, 0], loop_idx[:, 1]]
        bottom_loop = bottom[loop_idx[:, 0], loop_idx[:, 1]]
        tris.append(wall_strip(top_loop, bottom_loop, close=True))

    return np.concatenate(tris).astype(np.float32)


def slotted_base(width: float, depth: float, slots: list[dict], floor: float = 5.0,
                  height: float = 15.0, res_mm: float = 1.0, step_eps: float = 0.001) -> np.ndarray:
    """Generalizes the prototype's box-union stand_stl into N parallel
    slots -- WITHOUT box unions. A union of touching boxes leaves behind
    internal seams that are only *partially* coincident (a wall segment's
    footprint is a subset of the floor's footprint beneath it), so exact
    triangle-pair cancellation can't clean it up and the result fails
    strict watertightness. Instead this is built the same way as a
    lithophane panel: ONE two-level heightmap (floor everywhere, floor +
    height everywhere except the slot y-ranges) fed through
    ruled_grid_solid -- genuinely one watertight solid, no seams to
    cancel. Each height *step* is encoded as a tight (step_eps-wide) pair
    of grid rows at the two levels, so the wall reads as vertical rather
    than a ramp. slots: [{"y_start": float, "thickness": float,
    "clearance": float=0.4}, ...] -- a real part (panel, LED board) drops
    into each gap."""
    nx = max(2, int(round(width / res_mm)) + 1)
    xs = np.linspace(0.0, width, nx)

    spans = [(s["y_start"], s["y_start"] + s["thickness"] + s.get("clearance", 0.4)) for s in slots]

    ys = list(np.linspace(0.0, depth, max(2, int(round(depth / res_mm)) + 1)))
    for y0, y1 in spans:
        for b in (y0, y1):
            ys.extend([max(0.0, b - step_eps), min(depth, b + step_eps)])
    ys = np.array(sorted(set(np.round(np.clip(ys, 0.0, depth), 6).tolist())))
    ny = len(ys)

    top_h = np.full(ny, floor + height)
    for y0, y1 in spans:
        top_h[(ys >= y0) & (ys < y1)] = floor

    x, y = np.meshgrid(xs, ys)
    top = np.stack([x, y, np.broadcast_to(top_h[:, None], (ny, nx))], axis=-1).astype(np.float64)
    bottom = np.stack([x, y, np.zeros((ny, nx))], axis=-1).astype(np.float64)
    return ruled_grid_solid(top, bottom, close_u=False).astype(np.float32)


def cylinder(center_xy: tuple[float, float], z0: float, z1: float, radius: float,
             segments: int = 24) -> np.ndarray:
    """A closed solid cylinder (used for hanging/keychain-hole walls,
    text pin markers, flight-track support pillars)."""
    cx, cy = center_xy
    theta = np.linspace(0.0, 2 * np.pi, segments, endpoint=False)
    ring_top = np.stack(
        [cx + radius * np.cos(theta), cy + radius * np.sin(theta), np.full(segments, z1)],
        axis=-1).astype(np.float32)
    ring_bottom = np.stack(
        [cx + radius * np.cos(theta), cy + radius * np.sin(theta), np.full(segments, z0)],
        axis=-1).astype(np.float32)
    wall = wall_strip(ring_top, ring_bottom, close=True)
    cap_top = bridge_loops(ring_top, np.array([[cx, cy, z1]], dtype=np.float32))
    cap_bottom = bridge_loops(ring_bottom, np.array([[cx, cy, z0]], dtype=np.float32))[:, ::-1, :]
    return np.concatenate([wall, cap_top, cap_bottom]).astype(np.float32)


def sweep_tube(centerline: np.ndarray, radius: float, segments: int = 10) -> np.ndarray:
    """A closed tube solid swept along a 3D centerline, used for the
    flight-track tube (checkpoint 4). Uses parallel-transport frames
    (each ring's local "up" is propagated from the previous ring rather
    than recomputed independently) so the tube doesn't twist along
    curved paths."""
    centerline = np.asarray(centerline, dtype=np.float64)
    n = len(centerline)
    if n < 2:
        raise ValueError("sweep_tube: centerline needs at least 2 points")

    tangents = np.zeros_like(centerline)
    tangents[1:-1] = centerline[2:] - centerline[:-2]
    tangents[0] = centerline[1] - centerline[0]
    tangents[-1] = centerline[-1] - centerline[-2]
    tangents /= np.linalg.norm(tangents, axis=1, keepdims=True).clip(min=1e-9)

    seed = np.array([0.0, 0.0, 1.0])
    if abs(np.dot(seed, tangents[0])) > 0.99:
        seed = np.array([1.0, 0.0, 0.0])
    normal = seed - tangents[0] * np.dot(seed, tangents[0])
    normal /= np.linalg.norm(normal)

    normals = np.zeros_like(centerline)
    normals[0] = normal
    for i in range(1, n):
        t_prev, t_cur = tangents[i - 1], tangents[i]
        axis = np.cross(t_prev, t_cur)
        axis_len = np.linalg.norm(axis)
        if axis_len < 1e-9:
            normals[i] = normals[i - 1]
            continue
        axis /= axis_len
        angle = np.arctan2(axis_len, np.dot(t_prev, t_cur))
        n_prev = normals[i - 1]
        rotated = (n_prev * np.cos(angle) + np.cross(axis, n_prev) * np.sin(angle)
                   + axis * np.dot(axis, n_prev) * (1 - np.cos(angle)))
        normals[i] = rotated - tangents[i] * np.dot(rotated, tangents[i])
        normals[i] /= np.linalg.norm(normals[i])

    binormals = np.cross(tangents, normals)
    theta = np.linspace(0.0, 2 * np.pi, segments, endpoint=False)
    cos_t, sin_t = np.cos(theta), np.sin(theta)  # (segments,)

    # ring[i, k] = centerline[i] + radius*(cos*normal[i] + sin*binormal[i])
    ring = (centerline[:, None, :]
            + radius * cos_t[None, :, None] * normals[:, None, :]
            + radius * sin_t[None, :, None] * binormals[:, None, :]).astype(np.float32)

    wall = grid_surface_tris(ring, close_u=True)
    cap_start = bridge_loops(ring[0][::-1], np.array([centerline[0]], dtype=np.float32))
    cap_end = bridge_loops(ring[-1], np.array([centerline[-1]], dtype=np.float32))
    return np.concatenate([wall, cap_start, cap_end]).astype(np.float32)
