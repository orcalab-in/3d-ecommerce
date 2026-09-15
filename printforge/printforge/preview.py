"""Preview PNG renderers."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw


def lit_preview(heights: np.ndarray, res_mm: float, out_path: str, k: float = 1.1) -> None:
    """Simulated backlit view of a lithophane heightmap: transmission
    falls off exponentially with thickness. Ported from lithophane.py."""
    trans = np.exp(-k * (heights - heights.min()))
    trans = (trans - trans.min()) / (trans.max() - trans.min() + 1e-9)
    warm = np.stack([trans, trans * 0.92, trans * 0.72], axis=-1)  # warm-white LED tint
    img = Image.fromarray((np.flipud(warm) * 255).astype(np.uint8))
    scale = max(1, int(round(0.25 / res_mm)))  # keep preview ~4 px/mm
    if scale > 1:
        img = img.resize((img.width // scale, img.height // scale), Image.LANCZOS)
    img.save(out_path)


def hillshade_preview(heights: np.ndarray, res_mm: float, out_path: str,
                       route_xy: np.ndarray | None = None,
                       route_color: tuple[int, int, int] = (46, 110, 78),
                       azimuth_deg: float = 315.0, altitude_deg: float = 45.0) -> None:
    """A top-down hillshaded PNG of a terrain heightmap, with an optional
    route polyline overlaid in a second colour. `heights`/`route_xy` use
    the same (row=y, col=x, y grows "up"/north) convention as the
    terrain mesh; north is placed at the top of the image."""
    gy, gx = np.gradient(heights, res_mm)
    azimuth, altitude = np.radians(azimuth_deg), np.radians(altitude_deg)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    shade = np.cos(altitude) * np.cos(slope) + np.sin(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    shade = np.clip(shade, 0.0, 1.0)

    # Blend in a light "elevation tint" so flat-but-high terrain doesn't
    # look identical to flat-but-low terrain (pure hillshade is relief-only).
    rel = heights - heights.min()
    rel = rel / (rel.max() + 1e-9)
    tint = 0.25 + 0.55 * rel
    tone = 0.35 * tint + 0.65 * shade
    rgb = np.stack([tone, tone * 0.98, tone * 0.9], axis=-1)  # a faint warm cast

    img_arr = (np.flipud(rgb) * 255).astype(np.uint8)  # north (max y) at the top
    img = Image.fromarray(img_arr, mode="RGB")
    ny = heights.shape[0]

    if route_xy is not None and len(route_xy) > 1:
        draw = ImageDraw.Draw(img)
        pts = [(x / res_mm, (ny - 1) - y / res_mm) for x, y in route_xy]
        draw.line(pts, fill=route_color, width=max(2, int(round(0.6 / res_mm))))

    scale = max(1, int(round(0.5 / res_mm)))
    if scale > 1:
        img = img.resize((img.width // scale, img.height // scale), Image.LANCZOS)
    img.save(out_path)
