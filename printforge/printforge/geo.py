"""Local map projection and polyline utilities shared by the terrain
(product 4) and paragliding flight (product 5) products.

Routes span at most a few kilometers, so a simple local equirectangular
projection centered on the route's centroid is accurate enough -- no
need for a real map projection library (keeps shapely genuinely
optional, per the spec).
"""
from __future__ import annotations

import numpy as np

EARTH_RADIUS_M = 6371000.0


def project_local(lats: np.ndarray, lons: np.ndarray, lat0: float, lon0: float) -> tuple[np.ndarray, np.ndarray]:
    """Lat/lon -> local (x, y) meters, centered on (lat0, lon0). x is
    east, y is north."""
    lats = np.asarray(lats, dtype=np.float64)
    lons = np.asarray(lons, dtype=np.float64)
    lat0_rad = np.radians(lat0)
    x = np.radians(lons - lon0) * np.cos(lat0_rad) * EARTH_RADIUS_M
    y = np.radians(lats - lat0) * EARTH_RADIUS_M
    return x, y


def unproject_local(x: np.ndarray, y: np.ndarray, lat0: float, lon0: float) -> tuple[np.ndarray, np.ndarray]:
    """Inverse of project_local."""
    lat0_rad = np.radians(lat0)
    lat = lat0 + np.degrees(np.asarray(y, dtype=np.float64) / EARTH_RADIUS_M)
    lon = lon0 + np.degrees(np.asarray(x, dtype=np.float64) / (EARTH_RADIUS_M * np.cos(lat0_rad)))
    return lat, lon


def fit_bbox(lats: np.ndarray, lons: np.ndarray, margin_frac: float = 0.12) -> dict:
    """Local-meters bounding box of a route, expanded by margin_frac on
    each side. Returns the projection origin plus the expanded bounds."""
    lat0, lon0 = float(np.mean(lats)), float(np.mean(lons))
    x, y = project_local(lats, lons, lat0, lon0)
    x0, x1, y0, y1 = float(x.min()), float(x.max()), float(y.min()), float(y.max())
    mx, my = (x1 - x0) * margin_frac, (y1 - y0) * margin_frac
    # A degenerate (near-point) route still needs a non-zero tile.
    mx, my = max(mx, 5.0), max(my, 5.0)
    return {"lat0": lat0, "lon0": lon0, "x0": x0 - mx, "x1": x1 + mx, "y0": y0 - my, "y1": y1 + my}


def fit_footprint(width_m: float, height_m: float, footprint_mm: float = 150.0,
                   max_mm: float = 240.0) -> tuple[float, float, float]:
    """Scale a (width_m, height_m) bbox to fit within footprint_mm on its
    longer side (clamped to max_mm), preserving aspect ratio -- so an
    elongated route prints as a non-square, letterboxed tile rather than
    being squashed or clipped. Returns (out_width_mm, out_height_mm,
    scale_mm_per_m)."""
    footprint_mm = min(footprint_mm, max_mm)
    longer = max(width_m, height_m, 1e-6)
    scale = footprint_mm / longer
    return width_m * scale, height_m * scale, scale


def smooth_polyline(xy: np.ndarray, window: int = 5) -> np.ndarray:
    """Simple centered moving-average smoothing (GPS tracks are noisy;
    a raised route ridge printed straight from raw points looks jagged)."""
    xy = np.asarray(xy, dtype=np.float64)
    if len(xy) < window or window < 3:
        return xy
    kernel = np.ones(window) / window
    pad = window // 2
    x = np.pad(xy[:, 0], pad, mode="edge")
    y = np.pad(xy[:, 1], pad, mode="edge")
    xs = np.convolve(x, kernel, mode="valid")[: len(xy)]
    ys = np.convolve(y, kernel, mode="valid")[: len(xy)]
    return np.stack([xs, ys], axis=1)


def simplify_rdp(points: np.ndarray, epsilon: float) -> np.ndarray:
    """Ramer-Douglas-Peucker polyline simplification (iterative, avoids
    recursion-depth issues on long tracks)."""
    points = np.asarray(points, dtype=np.float64)
    n = len(points)
    if n < 3 or epsilon <= 0:
        return points
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1:
            continue
        a, b = points[i0], points[i1]
        seg = b - a
        seg_len2 = float(seg @ seg)
        mid_pts = points[i0 + 1:i1]
        if seg_len2 < 1e-12:
            d = np.linalg.norm(mid_pts - a, axis=1)
        else:
            t = ((mid_pts - a) @ seg) / seg_len2
            proj = a + np.outer(t, seg)
            d = np.linalg.norm(mid_pts - proj, axis=1)
        idx_max = int(np.argmax(d))
        if d[idx_max] > epsilon:
            mid = i0 + 1 + idx_max
            keep[mid] = True
            stack.append((i0, mid))
            stack.append((mid, i1))
    return points[keep]


def resample_polyline(points: np.ndarray, spacing: float) -> np.ndarray:
    """Resample a polyline to roughly uniform arc-length spacing."""
    points = np.asarray(points, dtype=np.float64)
    if len(points) < 2:
        return points
    seg_len = np.linalg.norm(np.diff(points, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg_len)])
    total = cum[-1]
    if total <= 0:
        return points[:1]
    n = max(2, int(round(total / spacing)) + 1)
    targets = np.linspace(0.0, total, n)
    x = np.interp(targets, cum, points[:, 0])
    y = np.interp(targets, cum, points[:, 1])
    return np.stack([x, y], axis=1)


def path_distance_field(query_xy: np.ndarray, polyline: np.ndarray, chunk: int = 20000) -> np.ndarray:
    """Minimum distance from each query point to a polyline (chunked to
    bound memory on large terrain grids). Used for the inlaid-channel
    route variant's groove falloff."""
    query_xy = np.asarray(query_xy, dtype=np.float64)
    polyline = np.asarray(polyline, dtype=np.float64)
    if len(polyline) < 2:
        return np.full(len(query_xy), np.inf)
    a = polyline[:-1]
    seg = polyline[1:] - a
    seg_len2 = np.maximum(np.sum(seg ** 2, axis=1), 1e-12)
    out = np.empty(len(query_xy), dtype=np.float64)
    for start in range(0, len(query_xy), chunk):
        q = query_xy[start:start + chunk]
        diff = q[:, None, :] - a[None, :, :]
        t = np.clip(np.sum(diff * seg[None, :, :], axis=2) / seg_len2[None, :], 0.0, 1.0)
        proj = a[None, :, :] + t[:, :, None] * seg[None, :, :]
        d = np.linalg.norm(q[:, None, :] - proj, axis=2)
        out[start:start + chunk] = d.min(axis=1)
    return out


def sample_grid_bilinear(z: np.ndarray, res_mm: float, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinear-interpolate a (ny, nx) grid (sampled at i*res_mm, j*res_mm)
    at arbitrary query (x, y) mm coordinates, clamped to the grid edge."""
    ny, nx = z.shape
    x, y = np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64)
    fx = np.clip(x / res_mm, 0.0, nx - 1 - 1e-9)
    fy = np.clip(y / res_mm, 0.0, ny - 1 - 1e-9)
    x0 = np.floor(fx).astype(np.int64)
    y0 = np.floor(fy).astype(np.int64)
    x1, y1 = x0 + 1, y0 + 1
    tx, ty = fx - x0, fy - y0
    z00, z10 = z[y0, x0], z[y0, x1]
    z01, z11 = z[y1, x0], z[y1, x1]
    return (z00 * (1 - tx) * (1 - ty) + z10 * tx * (1 - ty)
            + z01 * (1 - tx) * ty + z11 * tx * ty)
