"""Preview PNG renderers."""
from __future__ import annotations

import numpy as np
from PIL import Image


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
