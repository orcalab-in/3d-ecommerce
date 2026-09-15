"""Image -> heightmap conversion, shared by the photo lamp and the
lithophane panel family. Ported from lithophane.py's load_heightmap."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageOps


def load_heightmap(image_path: str, width_mm: float, max_height_mm: float, res_mm: float,
                    min_t: float, max_t: float, gamma: float, border_mm: float) -> np.ndarray:
    """Fit an image inside width_mm x max_height_mm (centre-cropping to
    the target aspect), resample to res_mm/pixel, and map luminance to a
    thickness heightmap (dark pixels -> thick -> block more light)."""
    img = Image.open(image_path)
    img = ImageOps.exif_transpose(img).convert("L")

    inner_w = width_mm - 2 * border_mm
    aspect = img.height / img.width
    target_h = min(inner_w * aspect, max_height_mm - 2 * border_mm)
    target_aspect = target_h / inner_w
    if aspect > target_aspect:                      # too tall: crop top/bottom
        new_h = int(round(img.width * target_aspect))
        top = (img.height - new_h) // 2
        img = img.crop((0, top, img.width, top + new_h))
    elif aspect < target_aspect:                    # too wide: crop sides
        new_w = int(round(img.height / target_aspect))
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))

    px_w = max(2, int(round(inner_w / res_mm)))
    px_h = max(2, int(round(target_h / res_mm)))
    img = ImageOps.autocontrast(img, cutoff=1)       # use the full tonal range
    img = img.resize((px_w, px_h), Image.LANCZOS)

    lum = np.asarray(img, dtype=np.float32) / 255.0  # 1 = white, 0 = black
    lum = np.flipud(lum)                              # image row 0 is top; y grows upward in STL
    dark = (1.0 - lum) ** gamma
    heights = min_t + dark * (max_t - min_t)          # dark pixels -> thick -> block light

    b = int(round(border_mm / res_mm))
    if b > 0:
        heights = np.pad(heights, b, mode="constant", constant_values=max_t)
    return heights.astype(np.float64)
