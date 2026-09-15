"""Product 2: standalone lithophane panel family.

Same image -> heightmap engine as the photo lamp (product 1), four
different physical forms, each printable on the A1 with no supports:

- flat_hole: flat panel with a hanging hole (mesh.flat_panel_with_hole)
- curved: cylinder-segment panel, radius parameterised, 90-180deg arc.
  Printed with the cylinder axis VERTICAL (vase-mode-like): image X maps
  to arc angle, image Y to print height, and per-pixel thickness
  modulates RADIUS -- purely in-plane at each layer, so it's never an
  overhang regardless of arc or radius (mesh.radial_panel_grids).
- cylinder: full 360deg wrap around a tea-light/LED puck, 1-4 photos
  tiled around the circumference. Same radial technique, close_u=True.
- keychain: 40x50mm flat panel + hole (mesh.flat_panel_with_hole again,
  just smaller and thinner) with clamped 0.4-2.0mm thickness range.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageOps

from .. import mesh, preview
from ..imaging import load_heightmap
from ..jobtypes import SolidMesh

INPUT_PARAM = "image"

FORMS = ("flat_hole", "curved", "cylinder", "keychain")

DEFAULTS = {
    "form": "flat_hole",
    "res_mm": 0.2,
    "min_thickness_mm": 0.6,
    "max_thickness_mm": 3.0,
    "gamma": 1.0,
    "border_mm": 3.0,
    # flat_hole
    "width_mm": 100.0,
    "max_height_mm": 130.0,
    "hole_diameter_mm": 4.0,
    "hole_margin_mm": 6.0,
    # curved
    "radius_mm": 60.0,
    "arc_deg": 120.0,
    "curved_height_mm": 100.0,
    # cylinder (full wrap)
    "cylinder_radius_mm": 35.0,
    "cylinder_height_mm": 80.0,
    "num_photos": 1,
    "images": "",  # comma-separated extra photo paths for num_photos > 1
    # keychain
    "keychain_width_mm": 40.0,
    "keychain_height_mm": 50.0,
    "keychain_hole_diameter_mm": 4.0,
    "keychain_hole_margin_mm": 5.0,
}

PARAM_SPEC = {
    "form": {"type": "enum", "choices": list(FORMS), "default": "flat_hole"},
    "res_mm": {"type": "float", "default": 0.2, "min": 0.1, "max": 0.4},
    "min_thickness_mm": {"type": "float", "default": 0.6, "min": 0.4, "max": 1.2},
    "max_thickness_mm": {"type": "float", "default": 3.0, "min": 1.5, "max": 4.0},
    "gamma": {"type": "float", "default": 1.0, "min": 0.4, "max": 2.5},
    "border_mm": {"type": "float", "default": 3.0, "min": 0.0, "max": 10.0},
    "width_mm": {"type": "float", "default": 100.0, "min": 40.0, "max": 240.0,
                 "help": "flat_hole form only"},
    "max_height_mm": {"type": "float", "default": 130.0, "min": 40.0, "max": 240.0,
                       "help": "flat_hole form only"},
    "hole_diameter_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 10.0},
    "hole_margin_mm": {"type": "float", "default": 6.0, "min": 3.0, "max": 20.0},
    "radius_mm": {"type": "float", "default": 60.0, "min": 20.0, "max": 150.0,
                  "help": "curved form only"},
    "arc_deg": {"type": "float", "default": 120.0, "min": 90.0, "max": 180.0,
                "help": "curved form only"},
    "curved_height_mm": {"type": "float", "default": 100.0, "min": 40.0, "max": 240.0},
    "cylinder_radius_mm": {"type": "float", "default": 35.0, "min": 15.0, "max": 120.0,
                            "help": "cylinder form only; puck/tea-light diameter = 2x this"},
    "cylinder_height_mm": {"type": "float", "default": 80.0, "min": 20.0, "max": 240.0},
    "num_photos": {"type": "int", "default": 1, "min": 1, "max": 4},
    "images": {"type": "str", "default": "",
               "help": "comma-separated extra photo paths, cylinder form with num_photos > 1"},
    "keychain_width_mm": {"type": "float", "default": 40.0},
    "keychain_height_mm": {"type": "float", "default": 50.0},
    "keychain_hole_diameter_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 8.0},
    "keychain_hole_margin_mm": {"type": "float", "default": 5.0, "min": 3.0, "max": 10.0},
}


def resolve_params(params: dict) -> dict:
    resolved = dict(DEFAULTS)
    resolved.update(params or {})
    if resolved.get("image") is None:
        raise ValueError("lithophane: params['image'] is required")
    if resolved["form"] not in FORMS:
        raise ValueError(f"lithophane: unknown form {resolved['form']!r}; choices: {list(FORMS)}")
    if resolved["form"] == "keychain":
        resolved["min_thickness_mm"] = max(0.4, min(resolved["min_thickness_mm"], 2.0))
        resolved["max_thickness_mm"] = max(0.4, min(resolved["max_thickness_mm"], 2.0))
    return resolved


def _wrapped_heightmap(p: dict) -> np.ndarray:
    """Build the (possibly multi-photo) heightmap for the cylinder form:
    N images tiled side by side, each spanning 360/N degrees, all
    resampled to a common row count before concatenation."""
    n = int(p["num_photos"])
    paths = [s for s in p["images"].split(",") if s.strip()] if p.get("images") else []
    paths = (paths + [p["image"]] * n)[:n] if paths else [p["image"]] * n

    seg_width_mm = (2 * np.pi * p["cylinder_radius_mm"]) / n
    blocks = [
        load_heightmap(path, seg_width_mm, p["cylinder_height_mm"], p["res_mm"],
                        p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
        for path in paths
    ]
    ny = min(b.shape[0] for b in blocks)
    resized = []
    for b in blocks:
        if b.shape[0] != ny:
            img = Image.fromarray(b.astype(np.float32), mode="F")
            img = img.resize((b.shape[1], ny), Image.BILINEAR)
            b = np.asarray(img, dtype=np.float64)
        resized.append(b)
    return np.concatenate(resized, axis=1)


def build(params: dict) -> tuple[list[SolidMesh], dict, list[str]]:
    p = resolve_params(params)
    warnings: list[str] = []
    form = p["form"]

    if form == "flat_hole":
        heights = load_heightmap(
            p["image"], p["width_mm"], p["max_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
        ny, nx = heights.shape
        panel_w, panel_h = (nx - 1) * p["res_mm"], (ny - 1) * p["res_mm"]
        hole_r = p["hole_diameter_mm"] / 2.0
        hole_cx, hole_cy = panel_w / 2.0, panel_h - p["hole_margin_mm"] - hole_r
        tris = mesh.flat_panel_with_hole(heights, p["res_mm"], hole_cx, hole_cy, hole_r)

    elif form == "keychain":
        heights = load_heightmap(
            p["image"], p["keychain_width_mm"], p["keychain_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], min(p["border_mm"], 2.0))
        ny, nx = heights.shape
        panel_w, panel_h = (nx - 1) * p["res_mm"], (ny - 1) * p["res_mm"]
        hole_r = p["keychain_hole_diameter_mm"] / 2.0
        hole_cx = panel_w / 2.0
        hole_cy = panel_h - p["keychain_hole_margin_mm"] - hole_r
        tris = mesh.flat_panel_with_hole(heights, p["res_mm"], hole_cx, hole_cy, hole_r)

    elif form == "curved":
        arc_len_mm = p["radius_mm"] * np.radians(p["arc_deg"])
        heights = load_heightmap(
            p["image"], arc_len_mm, p["curved_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
        top, bottom = mesh.radial_panel_grids(heights, p["res_mm"], p["radius_mm"], p["arc_deg"])
        tris = mesh.ruled_grid_solid(top, bottom, close_u=False)

    else:  # cylinder
        heights = _wrapped_heightmap(p)
        top, bottom = mesh.radial_panel_grids(heights, p["res_mm"], p["cylinder_radius_mm"], 360.0)
        tris = mesh.ruled_grid_solid(top, bottom, close_u=True)

    objects = [SolidMesh(name="panel", triangles=tris.astype(np.float32),
                          color_hex="#F5F0E6FF", extruder=1, rate_class="panel")]
    return objects, p, warnings


def render_preview(p: dict, objects: list[SolidMesh], out_path: str) -> None:
    form = p["form"]
    if form == "flat_hole":
        heights = load_heightmap(
            p["image"], p["width_mm"], p["max_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
    elif form == "keychain":
        heights = load_heightmap(
            p["image"], p["keychain_width_mm"], p["keychain_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], min(p["border_mm"], 2.0))
    elif form == "curved":
        arc_len_mm = p["radius_mm"] * np.radians(p["arc_deg"])
        heights = load_heightmap(
            p["image"], arc_len_mm, p["curved_height_mm"], p["res_mm"],
            p["min_thickness_mm"], p["max_thickness_mm"], p["gamma"], p["border_mm"])
    else:
        heights = _wrapped_heightmap(p)
    preview.lit_preview(heights, p["res_mm"], out_path)
