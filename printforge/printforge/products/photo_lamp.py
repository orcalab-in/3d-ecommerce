"""Product 1: photo lamp -- lithophane panel + slot stand + LED board.

This is what lithophane.py did as a standalone script; refactored onto
the shared mesh/text toolkit and extended with S/M/L sizes, an optional
embossed caption on the stand front, and optional rounded panel corners.
"""
from __future__ import annotations

import numpy as np

from .. import mesh, preview, text
from ..assets import font_path
from ..imaging import load_heightmap
from ..jobtypes import SolidMesh

INPUT_PARAM = "image"

SIZES = {
    "S": (80.0, 100.0),
    "M": (100.0, 130.0),
    "L": (150.0, 200.0),
}

DEFAULTS = {
    "size": "M",
    "res_mm": 0.2,
    "min_thickness_mm": 0.6,
    "max_thickness_mm": 3.0,
    "gamma": 1.0,
    "border_mm": 3.0,
    "corner_radius_mm": 0.0,
    "caption": "",
    "caption_font": "OpenSans",
    "caption_size_mm": 6.0,
    "caption_depth_mm": 0.6,
    "led_board_thickness_mm": 2.0,
    "stand_gap_mm": 10.0,
    "stand_depth_mm": 36.0,
    "stand_height_mm": 15.0,
    "stand_floor_mm": 5.0,
    "slot_clearance_mm": 0.4,
}

PARAM_SPEC = {
    "size": {"type": "enum", "choices": list(SIZES), "default": "M",
             "help": "S 80x100, M 100x130, L 150x200 mm"},
    "res_mm": {"type": "float", "default": 0.2, "min": 0.1, "max": 0.4},
    "min_thickness_mm": {"type": "float", "default": 0.6, "min": 0.4, "max": 1.2},
    "max_thickness_mm": {"type": "float", "default": 3.0, "min": 1.5, "max": 4.0},
    "gamma": {"type": "float", "default": 1.0, "min": 0.4, "max": 2.5},
    "border_mm": {"type": "float", "default": 3.0, "min": 0.0, "max": 10.0},
    "corner_radius_mm": {"type": "float", "default": 0.0, "min": 0.0, "max": 20.0},
    "caption": {"type": "str", "default": "", "help": "optional text embossed on the stand front"},
    "caption_font": {"type": "enum", "choices": ["OpenSans", "Pacifico"], "default": "OpenSans"},
    "caption_size_mm": {"type": "float", "default": 6.0, "min": 3.0, "max": 12.0},
    "caption_depth_mm": {"type": "float", "default": 0.6, "min": 0.3, "max": 1.5},
    "led_board_thickness_mm": {"type": "float", "default": 2.0, "min": 1.0, "max": 3.0},
    "stand_gap_mm": {"type": "float", "default": 10.0, "min": 5.0, "max": 25.0},
    "stand_depth_mm": {"type": "float", "default": 36.0, "min": 25.0, "max": 60.0},
    "stand_height_mm": {"type": "float", "default": 15.0, "min": 10.0, "max": 30.0},
    "stand_floor_mm": {"type": "float", "default": 5.0, "min": 3.0, "max": 10.0},
    "slot_clearance_mm": {"type": "float", "default": 0.4, "min": 0.1, "max": 1.0},
}


def resolve_params(params: dict) -> dict:
    resolved = dict(DEFAULTS)
    resolved.update(params or {})
    if resolved.get("image") is None:
        raise ValueError("photo_lamp: params['image'] is required")
    if resolved["size"] not in SIZES:
        raise ValueError(f"photo_lamp: unknown size {resolved['size']!r}; choices: {list(SIZES)}")
    return resolved


def _panel_grids(heights: np.ndarray, res_mm: float) -> tuple[np.ndarray, np.ndarray]:
    ny, nx = heights.shape
    xs = np.arange(nx, dtype=np.float64) * res_mm
    ys = np.arange(ny, dtype=np.float64) * res_mm
    x, y = np.meshgrid(xs, ys)
    top = np.stack([x, y, heights.astype(np.float64)], axis=-1)
    bottom = np.stack([x, y, np.zeros_like(heights, dtype=np.float64)], axis=-1)
    return top, bottom


def _build_stand(panel_w: float, panel_t: float, board_t: float, p: dict,
                  caption_tris: np.ndarray | None, caption_w: float) -> np.ndarray:
    margin = 5.0
    width = panel_w + 2 * margin
    clearance = p["slot_clearance_mm"]
    front_y = 12.0
    front_slot_end = front_y + panel_t + clearance
    rear_y = front_slot_end + p["stand_gap_mm"]
    depth = max(p["stand_depth_mm"], rear_y + board_t + clearance + 5.0)
    slots = [
        {"y_start": front_y, "thickness": panel_t, "clearance": clearance},
        {"y_start": rear_y, "thickness": board_t, "clearance": clearance},
    ]
    tris = mesh.slotted_base(width, depth, slots, floor=p["stand_floor_mm"], height=p["stand_height_mm"])

    if caption_tris is not None and len(caption_tris):
        # Rotate the caption from its native (baseline=X, height=Y, depth=Z)
        # frame onto the stand's front face (Y=0, facing -Y): a proper
        # rotation (x, y, z) -> (x, -z, y), so winding/normals stay correct.
        placed = caption_tris.copy()
        cx, cy, cz = caption_tris[:, :, 0], caption_tris[:, :, 1], caption_tris[:, :, 2]
        placed[:, :, 0] = cx - caption_w / 2.0 + width / 2.0
        placed[:, :, 1] = -cz + 0.2  # 0.2mm embed into the stand for a fused joint
        placed[:, :, 2] = cy + p["stand_floor_mm"] + p["stand_height_mm"] / 2.0 - p["caption_size_mm"] / 2.0
        tris = np.concatenate([tris, placed])
    return tris.astype(np.float32)


def build(params: dict) -> tuple[list[SolidMesh], dict, list[str]]:
    """Pure builder: no filesystem writes. Returns (objects, resolved
    params, warnings)."""
    p = resolve_params(params)
    warnings: list[str] = []
    width_mm, max_height_mm = SIZES[p["size"]]

    heights = load_heightmap(
        p["image"], width_mm, max_height_mm, p["res_mm"],
        p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
    ny, nx = heights.shape
    panel_w = (nx - 1) * p["res_mm"]
    panel_h = (ny - 1) * p["res_mm"]

    top, bottom = _panel_grids(heights, p["res_mm"])
    corner_mask_arr = (mesh.corner_mask(heights.shape, p["res_mm"], p["corner_radius_mm"])
                        if p["corner_radius_mm"] > 0 else None)
    panel_tris = mesh.ruled_grid_solid(top, bottom, close_u=False, mask=corner_mask_arr)

    caption_tris, caption_w = None, 0.0
    if p.get("caption"):
        try:
            font = text.load_font(font_path(p["caption_font"]))
            caption_tris, caption_w, skipped = text.emboss_text(
                p["caption"], font, p["caption_size_mm"], p["caption_depth_mm"])
            if skipped:
                warnings.append(
                    f"caption: dropped {len(skipped)} character(s) that failed mesh "
                    f"validation ({''.join(skipped)!r}) -- rest of the caption is unaffected")
        except text.TextUnavailable as exc:
            warnings.append(str(exc) + " -- continuing without the caption")

    board_t = p["led_board_thickness_mm"]
    stand_tris = _build_stand(panel_w, p["max_thickness_mm"], board_t, p, caption_tris, caption_w)
    ledboard_tris = mesh.box(0, panel_w, 0, panel_h, 0, board_t)

    objects = [
        SolidMesh(name="panel", triangles=panel_tris.astype(np.float32),
                  color_hex="#F5F0E6FF", extruder=1, rate_class="panel"),
        SolidMesh(name="stand", triangles=stand_tris,
                  color_hex="#B0B0B0FF", extruder=2, rate_class="support"),
        SolidMesh(name="ledboard", triangles=ledboard_tris.astype(np.float32),
                  color_hex="#2B2B2BFF", extruder=2, rate_class="support"),
    ]
    return objects, p, warnings


def render_preview(p: dict, objects: list[SolidMesh], out_path: str) -> None:
    width_mm, max_height_mm = SIZES[p["size"]]
    heights = load_heightmap(
        p["image"], width_mm, max_height_mm, p["res_mm"],
        p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
    preview.lit_preview(heights, p["res_mm"], out_path)
