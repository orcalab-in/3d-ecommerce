"""Text embossing: font glyph outlines -> triangulated extrusion.

Three-tier degradation, honoring the "hard deps: numpy + Pillow only"
requirement:

1. fonttools installed (optional dep) -- real glyph outlines read
   straight from the font's `glyf` table.
2. fonttools absent -- Pillow's bundled FreeType rasterizes each glyph
   to a mask, and a pure-numpy boundary tracer (`mesh.boundary_loops`,
   the same tool used for rounded-corner panel masking) extracts polygon
   contours from the mask. Lower fidelity, but only needs the two hard
   deps.
3. Even Pillow's FreeType is unusable (rare, an unusual Pillow build) --
   `load_font` raises `TextUnavailable`. Callers should catch this,
   record a warning, and continue generating the rest of the model
   without the caption/emboss rather than failing the whole job.

`ear_clip_triangulate` / `extrude_polygon_2d` are generic 2D-polygon ->
3D-solid tools, reused for glyph extrusion here and for the flight
altitude-profile plaque (product 5) and name-lamp plate (product 3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from . import mesh, meshcheck

__all__ = [
    "TextUnavailable",
    "FontHandle",
    "load_font",
    "glyph_outline",
    "ear_clip_triangulate",
    "extrude_polygon_2d",
    "emboss_text",
]


class TextUnavailable(Exception):
    """Raised by load_font when no glyph-outline backend is usable."""


# --------------------------------------------------------------------- font loading

@dataclass
class FontHandle:
    path: str
    backend: str            # "fonttools" or "pillow"
    upm: float = 1000.0     # units-per-em normalization factor
    _tt: Any = field(default=None, repr=False)


def load_font(path: str) -> FontHandle:
    """Load a font, preferring fonttools (accurate outlines) and falling
    back to Pillow+FreeType rasterization. Raises TextUnavailable if
    neither backend can read the font."""
    try:
        from fontTools.ttLib import TTFont  # noqa: PLC0415
        tt = TTFont(path)
        upm = float(tt["head"].unitsPerEm)
        return FontHandle(path=path, backend="fonttools", upm=upm, _tt=tt)
    except ImportError:
        pass
    except Exception:
        pass  # malformed for fonttools; try the Pillow fallback below

    try:
        from PIL import ImageFont  # noqa: PLC0415
        ImageFont.truetype(path, size=64)  # probe: raises if FreeType is unavailable
        return FontHandle(path=path, backend="pillow", upm=1.0, _tt=None)
    except Exception as exc:
        raise TextUnavailable(
            "text embossing unavailable: install fonttools, or use a Pillow build "
            f"with FreeType support ({exc})") from exc


# --------------------------------------------------------------------- glyph outlines

def glyph_outline(font: FontHandle, char: str) -> tuple[list[np.ndarray], float]:
    """Returns (contours, advance) for one character. contours: list of
    (K, 2) float64 loops in em units (1.0 = 1 em), any winding -- callers
    must not assume outer-CCW/hole-CW since classification is by
    containment, not sign. advance: horizontal advance width in em units."""
    if font.backend == "fonttools":
        return _glyph_outline_fonttools(font, char)
    return _glyph_outline_pillow(font, char)


def _flatten_quadratic(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, steps: int = 8) -> np.ndarray:
    t = np.linspace(0.0, 1.0, steps + 1)[1:]
    return ((1 - t)[:, None] ** 2 * p0 + 2 * (1 - t)[:, None] * t[:, None] * p1
             + t[:, None] ** 2 * p2)


def _flatten_cubic(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray,
                    steps: int = 8) -> np.ndarray:
    t = np.linspace(0.0, 1.0, steps + 1)[1:]
    a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
    return a[:, None] * p0 + b[:, None] * p1 + c[:, None] * p2 + d[:, None] * p3


class _ContourCollector:
    """Duck-typed fontTools pen: collects flattened polygon contours."""

    def __init__(self) -> None:
        self.contours: list[list[list[float]]] = []
        self.current: list[list[float]] = []
        self.start = np.zeros(2)
        self.last = np.zeros(2)

    def moveTo(self, pt):
        self.start = np.array(pt, dtype=float)
        self.last = self.start
        self.current = [self.start.tolist()]

    def lineTo(self, pt):
        p = np.array(pt, dtype=float)
        self.current.append(p.tolist())
        self.last = p

    def qCurveTo(self, *points):
        pts = [np.array(p, dtype=float) if p is not None else self.start for p in points]
        if len(pts) == 1:
            self.current.append(pts[0].tolist())
            self.last = pts[0]
            return
        offs, end = pts[:-1], pts[-1]
        p0 = self.last
        for k, ctrl in enumerate(offs):
            nxt_on = (offs[k + 1] + ctrl) / 2 if k + 1 < len(offs) else end
            self.current.extend(_flatten_quadratic(p0, ctrl, nxt_on).tolist())
            p0 = nxt_on
        self.last = end

    def curveTo(self, *points):
        off1, off2, on = [np.array(p, dtype=float) for p in points]
        self.current.extend(_flatten_cubic(self.last, off1, off2, on).tolist())
        self.last = on

    def closePath(self):
        if len(self.current) >= 3:
            self.contours.append(self.current)
        self.current = []

    def endPath(self):
        self.closePath()

    def addComponent(self, glyph_name, transformation):
        pass  # composite (accented) glyphs are skipped; plain ASCII works fine


def _glyph_outline_fonttools(font: FontHandle, char: str) -> tuple[list[np.ndarray], float]:
    tt = font._tt
    cmap = tt.getBestCmap()
    glyph_name = cmap.get(ord(char))
    if glyph_name is None:
        return [], 0.0
    glyph_set = tt.getGlyphSet()
    glyph = glyph_set[glyph_name]
    collector = _ContourCollector()
    glyph.draw(collector)
    contours = [np.array(c, dtype=np.float64) / font.upm for c in collector.contours]
    return contours, glyph.width / font.upm


def _glyph_outline_pillow(font: FontHandle, char: str,
                           raster_px_per_em: int = 200) -> tuple[list[np.ndarray], float]:
    from PIL import Image as PILImage, ImageDraw, ImageFont  # noqa: PLC0415

    pil_font = ImageFont.truetype(font.path, size=raster_px_per_em)
    advance = pil_font.getlength(char) / raster_px_per_em
    bbox = pil_font.getbbox(char)
    if bbox is None or bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
        return [], advance

    x0, y0, x1, y1 = bbox
    pad = 2
    w, h = int(x1 - x0) + 2 * pad, int(y1 - y0) + 2 * pad
    img = PILImage.new("L", (w, h), 0)
    origin = (pad - x0, pad - y0)
    ImageDraw.Draw(img).text(origin, char, font=pil_font, fill=255)
    mask = np.array(img) > 127

    contours = []
    for loop in mesh.boundary_loops(mask):
        row, col = loop[:, 0].astype(float), loop[:, 1].astype(float)
        fx = (col - origin[0]) / raster_px_per_em
        fy = -(row - origin[1]) / raster_px_per_em  # pixel y grows down; font y grows up
        contours.append(np.stack([fx, fy], axis=1))
    return contours, advance


# --------------------------------------------------------------------- 2D polygon geometry

def _signed_area(poly: np.ndarray) -> float:
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def _force_orientation(poly: np.ndarray, ccw: bool) -> np.ndarray:
    poly = np.asarray(poly, dtype=np.float64)
    if (_signed_area(poly) > 0) != ccw:
        return poly[::-1].copy()
    return poly


def _point_in_polygon(pt: np.ndarray, poly: np.ndarray) -> bool:
    x, y = pt
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            x_cross = (x2 - x1) * (y - y1) / (y2 - y1 + 1e-15) + x1
            if x < x_cross:
                inside = not inside
    return inside


def classify_contours(loops: list[np.ndarray]) -> list[tuple[np.ndarray, list[np.ndarray]]]:
    """Group a flat list of polygon loops (e.g. all contours of one
    glyph) into (outer, [holes]) pairs by greedy largest-first point
    containment. Winding direction is ignored -- extrude_polygon_2d
    fixes orientation itself."""
    areas = [abs(_signed_area(loop)) for loop in loops]
    order = sorted(range(len(loops)), key=lambda i: areas[i], reverse=True)
    groups: list[list] = []
    for idx in order:
        pt = loops[idx].mean(axis=0)
        for group in groups:
            if _point_in_polygon(pt, loops[group[0]]):
                group[1].append(idx)
                break
        else:
            groups.append([idx, []])
    return [(loops[g[0]], [loops[h] for h in g[1]]) for g in groups]


def _is_left_turn(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> bool:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 1e-12


def _point_in_triangle(p: np.ndarray, a: np.ndarray, b: np.ndarray, c: np.ndarray) -> bool:
    d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1])
    d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1])
    d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1])
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def _simplify_collinear(poly: np.ndarray, tol: float = 1e-4, passes: int = 3) -> np.ndarray:
    """Drop points that sit within `tol` mm of the line through their
    neighbors. Curve flattening emits far more points than a glyph's
    shape needs, and long near-collinear runs are exactly what stalls
    the O(n^2) ear-clipper below (tiny cross-products that hover right
    around zero). Repeated passes catch runs of 3+ collinear points that
    a single pass (which only compares against original neighbors)
    would miss."""
    for _ in range(passes):
        if len(poly) <= 3:
            break
        n = len(poly)
        keep = []
        for i in range(n):
            a, b, c = poly[i - 1], poly[i], poly[(i + 1) % n]
            ac = c - a
            ac_len = np.linalg.norm(ac)
            if ac_len < 1e-12:
                continue  # a and c coincide -- b is a spike; drop it
            dist = abs(ac[0] * (b[1] - a[1]) - ac[1] * (b[0] - a[0])) / ac_len
            if dist < tol:
                continue
            keep.append(b)
        if len(keep) < 3 or len(keep) == len(poly):
            break
        poly = np.array(keep)
    return poly


def _dedup_consecutive(poly: np.ndarray, tol: float = 1e-9) -> np.ndarray:
    """Drop near-duplicate consecutive points (a common artifact where a
    flattened curve segment meets a line segment at ~the same point) --
    left in, they stall ear-clipping below and silently truncate the
    triangulation, leaving an open boundary edge in the final mesh."""
    if len(poly) < 2:
        return poly
    keep = [poly[0]]
    for p in poly[1:]:
        if np.linalg.norm(p - keep[-1]) > tol:
            keep.append(p)
    if len(keep) > 1 and np.linalg.norm(keep[0] - keep[-1]) <= tol:
        keep.pop()
    return np.array(keep) if len(keep) >= 3 else poly


def _find_ear(poly: np.ndarray, idx: list[int], convex_eps: float,
              check_containment: bool) -> int | None:
    """Scan idx for a valid ear tip under the given convexity threshold
    (looser than the strict 1e-12 lets a near-collinear-but-genuinely-
    convex vertex, common after curve flattening, still count as an ear)
    and, unless disabled, the standard containment test. Returns the
    position in idx to clip, or None."""
    m = len(idx)
    for k in range(m):
        i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % m]
        a, b, c = poly[i0], poly[i1], poly[i2]
        cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if cross <= convex_eps:
            continue
        if check_containment and any(
                _point_in_triangle(poly[o], a, b, c) for o in idx if o not in (i0, i1, i2)):
            continue
        return k
    return None


def _ear_clip_indices(poly: np.ndarray) -> list[tuple[int, int, int]]:
    """poly: (n, 2) CCW simple polygon. Classic O(n^2) ear clipping. Real
    font/GPS-derived polygons routinely have near-collinear vertices from
    curve flattening that make the strict convexity test (> 1e-12) or the
    strict containment test stall -- rather than silently truncating the
    polygon (which leaves an open boundary edge, i.e. a hole, once
    extruded to 3D), retry with a looser convexity threshold first, and
    only as a last resort drop the containment check for one ear (a rare
    hairline sliver beats a hole in the mesh)."""
    idx = list(range(len(poly)))
    tris: list[tuple[int, int, int]] = []
    guard = 0
    while len(idx) > 3 and guard < 20000:
        guard += 1
        k = _find_ear(poly, idx, 1e-12, True)
        if k is None:
            k = _find_ear(poly, idx, -1e-9, True)
        if k is None:
            k = _find_ear(poly, idx, -1e-9, False)
        if k is None:
            break  # no usable vertex at all -- truly degenerate input
        i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
        tris.append((i0, i1, i2))
        del idx[k]
    if len(idx) == 3:
        tris.append((idx[0], idx[1], idx[2]))
    return tris


def _segment_orient(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> int:
    val = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if val > 1e-12:
        return 1
    if val < -1e-12:
        return -1
    return 0


def _segments_cross(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray, p4: np.ndarray) -> bool:
    """True if segment p1-p2 PROPERLY crosses p3-p4 -- shared/touching
    endpoints (orient()==0) don't count, which is exactly what's needed
    when a candidate bridge starts at a vertex already on the boundary."""
    o1, o2 = _segment_orient(p1, p2, p3), _segment_orient(p1, p2, p4)
    o3, o4 = _segment_orient(p3, p4, p1), _segment_orient(p3, p4, p2)
    return o1 != o2 and o3 != o4 and 0 not in (o1, o2, o3, o4)


def _bridge_is_clear(a: np.ndarray, b: np.ndarray, boundary: np.ndarray) -> bool:
    n = len(boundary)
    for i in range(n):
        p3, p4 = boundary[i], boundary[(i + 1) % n]
        if _segments_cross(a, b, p3, p4):
            return False
    return True


def _splice_holes(outer: np.ndarray, holes: list[np.ndarray]) -> tuple[np.ndarray, dict]:
    """Standard bridge-edge technique: splice each hole into the outer
    ring via a zero-width cut, reducing a polygon-with-holes to one
    simple polygon that plain ear-clipping can triangulate. The bridge
    endpoint is the nearest boundary vertex with a clear line of sight to
    the hole's rightmost point (not just the nearest vertex outright --
    for concave letterforms like B/8/e/p/q the nearest vertex is often
    behind another part of the outline, and an occluded bridge silently
    corrupts the splice into a self-intersecting polygon that ear-
    clipping can't close, leaving a hole in the final mesh). Also returns
    a snap-back map (perturbed point -> true point, see below) that the
    caller must apply to its output, NOT to the polygon used here."""
    poly = [v for v in outer]
    snap: dict[tuple[float, float], np.ndarray] = {}
    for hole in holes:
        hi = int(np.argmax(hole[:, 0]))
        target = hole[hi]
        cur = np.array(poly)
        order = np.argsort(np.linalg.norm(cur - target, axis=1))
        chosen = int(order[0])
        for oi in order:
            if _bridge_is_clear(cur[oi], target, cur):
                chosen = int(oi)
                break
        bridge_out = poly[chosen]

        # The bridge duplicates bridge_out and hole[hi] once each (an
        # "in" copy and an "out" copy) to form a zero-width slit. Left
        # EXACTLY coincident, ear-clipping can find a technically-valid
        # ear right at the pinch that consumes one copy of a duplicated
        # point without the other, silently severing the hole from the
        # outer ring -- it's then walked as an isolated, wrongly-wound
        # leftover polygon and never closes. Nudging the "out" copies
        # apart from the "in" copies by a tiny perpendicular epsilon
        # resolves the ambiguity for ear-clipping's PURPOSES, but a true
        # boundary coordinate can happen to sit right at a meshcheck
        # vertex-merge rounding boundary, where even this tiny a nudge
        # flips which bucket it rounds into -- so the perturbation is
        # only ever used to help ear-clipping find a triangulation, and
        # the caller snaps every perturbed vertex in the OUTPUT back to
        # its exact true coordinate (see _triangulate_clean).
        direction = target - bridge_out
        dist = np.linalg.norm(direction)
        unit = direction / dist if dist > 1e-9 else np.array([1.0, 0.0])
        perp = np.array([-unit[1], unit[0]])
        eps = 1e-5
        hole_entry, hole_exit = target + perp * eps, target - perp * eps
        out_exit = bridge_out - perp * eps
        snap[tuple(np.round(hole_entry, 9))] = target
        snap[tuple(np.round(hole_exit, 9))] = target
        snap[tuple(np.round(out_exit, 9))] = bridge_out

        middle = list(hole[hi + 1:]) + list(hole[:hi])
        hole_ring = [hole_entry] + middle + [hole_exit]
        poly = poly[: chosen + 1] + hole_ring + [out_exit] + poly[chosen + 1:]
    return np.array(poly, dtype=np.float64), snap


def _clean_loop(loop: np.ndarray, ccw: bool) -> np.ndarray:
    """The one place orientation/dedup/simplify preprocessing happens.
    ear_clip_triangulate and extrude_polygon_2d both call this on their
    inputs -- previously each did its own preprocessing independently,
    which could (rarely) converge to slightly different point sets and
    leave a top/bottom face triangulated from a different loop than the
    wall built alongside it, opening a seam."""
    return _simplify_collinear(_dedup_consecutive(
        _force_orientation(np.asarray(loop, dtype=np.float64), ccw=ccw)))


def _triangulate_clean(outer: np.ndarray, holes: list[np.ndarray]) -> np.ndarray:
    """outer/holes must already be _clean_loop'd (CCW/CW, deduped,
    simplified). Returns (T, 3, 2) triangles."""
    snap: dict = {}
    if holes:
        poly, snap = _splice_holes(outer, holes)
    else:
        poly = outer
    tris_idx = _ear_clip_indices(poly)
    if not tris_idx:
        return np.zeros((0, 3, 2), dtype=np.float64)
    tris = poly[np.array(tris_idx)]
    if snap:
        flat = tris.reshape(-1, 2).copy()
        for i, pt in enumerate(flat):
            true_pt = snap.get(tuple(np.round(pt, 9)))
            if true_pt is not None:
                flat[i] = true_pt
        tris = flat.reshape(tris.shape)
    # The hole-splicing bridge duplicates its two anchor points, which can
    # produce a hairline zero-area sliver right at the bridge; extruding
    # one turns it into a degenerate/repeated 3D edge, so drop them here.
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    area2 = (b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0])
    return tris[np.abs(area2) > 1e-9]


def ear_clip_triangulate(outer: np.ndarray, holes: tuple[np.ndarray, ...] = ()) -> np.ndarray:
    """outer: (N, 2) polygon (any winding). holes: (M, 2) polygons fully
    inside outer (any winding). Returns (T, 3, 2) triangles."""
    outer = _clean_loop(outer, ccw=True)
    holes = [_clean_loop(h, ccw=False) for h in holes]
    return _triangulate_clean(outer, holes)


def _extrude_wall(loop_2d: np.ndarray, z0: float, z1: float) -> np.ndarray:
    n = len(loop_2d)
    top = np.column_stack([loop_2d, np.full(n, z1)]).astype(np.float32)
    bottom = np.column_stack([loop_2d, np.full(n, z0)]).astype(np.float32)
    return mesh.wall_strip(top, bottom, close=True)


def extrude_polygon_2d(outline: np.ndarray, holes: tuple[np.ndarray, ...] = (),
                        thickness: float = 1.0, z0: float = 0.0) -> np.ndarray:
    """A flat 2D polygon (with optional holes), extruded into a
    watertight 3D solid of the given thickness. Shared by glyph
    extrusion, the name-lamp plate, and the flight altitude plaque."""
    # Preprocess once, up front, so the SAME loop (vertex-for-vertex) is
    # used for both the triangulated top/bottom faces and the wall
    # strips below -- see _clean_loop's docstring for why that matters.
    outline = _clean_loop(outline, ccw=True)
    holes = [_clean_loop(h, ccw=False) for h in holes]
    tri2d = _triangulate_clean(outline, holes)
    if len(tri2d) == 0:
        return np.zeros((0, 3, 3), dtype=np.float32)
    z1 = z0 + thickness
    top = np.dstack([tri2d[:, :, 0], tri2d[:, :, 1], np.full(tri2d.shape[:2], z1)]).astype(np.float32)
    bottom = np.dstack([tri2d[:, :, 0], tri2d[:, :, 1],
                         np.full(tri2d.shape[:2], z0)]).astype(np.float32)[:, ::-1, :]
    tris = [top, bottom, _extrude_wall(outline, z0, z1)]
    for h in holes:
        tris.append(_extrude_wall(h, z0, z1))
    return np.concatenate(tris).astype(np.float32)


# --------------------------------------------------------------------- text layout

def emboss_text(text: str, font: FontHandle, size_mm: float, depth_mm: float,
                 tracking_mm: float = 0.0, z0: float = 0.0) -> tuple[np.ndarray, float, list[str]]:
    """Lay out `text` left-to-right and extrude each glyph to a solid.
    size_mm is the em-square height in mm (a simple, documented
    approximation of "font size" -- see docs/DECISIONS.md). As a final
    safety net beyond the hole-bridging fixes above, each glyph's mesh is
    validated before being added -- ear-clipping-with-holes is provably
    correct on paper but a handful of real font/character combinations
    still occasionally defeat it, and a broken caption is a far smaller
    problem than a broken print file, so an unvalidatable glyph is
    dropped (cursor still advances, so spacing stays correct) rather than
    shipped. Returns (triangles, total_width_mm, skipped_chars)."""
    x_cursor = 0.0
    all_tris = []
    skipped: list[str] = []
    for ch in text:
        contours, advance_em = glyph_outline(font, ch)
        if contours:
            scaled = [c * size_mm for c in contours]
            glyph_ok = True
            for outer, holes in classify_contours(scaled):
                tris = extrude_polygon_2d(outer, tuple(holes), thickness=depth_mm, z0=z0)
                if len(tris) and not meshcheck.check_mesh(tris).watertight:
                    glyph_ok = False
                    continue
                if len(tris):
                    tris = tris.copy()
                    tris[:, :, 0] += x_cursor
                    all_tris.append(tris)
            if not glyph_ok and ch not in skipped:
                skipped.append(ch)
        x_cursor += advance_em * size_mm + tracking_mm
    total_width_mm = max(x_cursor - tracking_mm, 0.0)
    if not all_tris:
        return np.zeros((0, 3, 3), dtype=np.float32), total_width_mm, skipped
    return np.concatenate(all_tris).astype(np.float32), total_width_mm, skipped
