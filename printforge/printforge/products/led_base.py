"""Product 3: lamp / LED base family -- built last (checkpoint order
1, 2, 4, 5, 3), lights any of the panels/cylinders from products 1/2.

Three forms, all sharing the same "2-level heightmap through
ruled_grid_solid" construction technique as mesh.slotted_base (no box
unions -- see docs/DECISIONS.md checkpoint 1 for why):

- puck: a disc with a circular top recess for a coiled LED strip
  (default 30mm, per spec) and a straight channel from the recess to
  the rim for the strip's lead.
- backlit_box: mesh.slotted_base with two slots (a flat panel in
  front, an LED board behind it, a diffuser air gap between them).
- name_lamp: a name extruded as a standalone flat plate (like a glyph,
  reusing text.emboss_text directly -- the extrusion axis already
  matches "thin plate" without any reshaping) standing in a single
  slot on its own small base.

Every form gets a 5mm cable-exit notch (mesh.slotted_base's
cable_channel, or the puck's built-in recess channel) and assumes a
USB-A lead for power, per the spec.
"""
from __future__ import annotations

import numpy as np

from .. import mesh, text
from ..assets import font_path
from ..jobtypes import SolidMesh

INPUT_PARAM = "name"  # only meaningful for form="name_lamp"; ignored otherwise

FORMS = ("puck", "backlit_box", "name_lamp")

BASE_COLOR = "#B0B0B0FF"
PLATE_COLOR = "#F2F2F2FF"

DEFAULTS = {
    "form": "puck",
    "res_mm": 0.5,
    "slot_clearance_mm": 0.4,
    "cable_channel_mm": 5.0,
    # puck
    "puck_radius_mm": 25.0,
    "puck_height_mm": 15.0,
    "led_coil_diameter_mm": 30.0,
    "recess_depth_mm": 4.0,
    # backlit_box
    "box_width_mm": 110.0,
    "box_depth_mm": 40.0,
    "panel_thickness_mm": 3.0,
    "led_board_thickness_mm": 2.0,
    "diffuser_gap_mm": 10.0,
    "box_floor_mm": 5.0,
    "box_wall_height_mm": 15.0,
    # name_lamp
    "name": "NAME",
    "font": "OpenSans",
    "text_height_mm": 25.0,
    "plate_thickness_mm": 3.0,
    "name_lamp_margin_mm": 15.0,
    "name_lamp_base_depth_mm": 30.0,
    "name_lamp_base_height_mm": 15.0,
    "name_lamp_base_floor_mm": 5.0,
}

PARAM_SPEC = {
    "form": {"type": "enum", "choices": list(FORMS), "default": "puck"},
    "res_mm": {"type": "float", "default": 0.5, "min": 0.2, "max": 1.0},
    "slot_clearance_mm": {"type": "float", "default": 0.4, "min": 0.1, "max": 1.0},
    "cable_channel_mm": {"type": "float", "default": 5.0, "min": 3.0, "max": 10.0},
    "puck_radius_mm": {"type": "float", "default": 25.0, "min": 18.0, "max": 60.0},
    "puck_height_mm": {"type": "float", "default": 15.0, "min": 8.0, "max": 30.0},
    "led_coil_diameter_mm": {"type": "float", "default": 30.0, "min": 20.0, "max": 50.0},
    "recess_depth_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 8.0},
    "box_width_mm": {"type": "float", "default": 110.0, "min": 60.0, "max": 240.0},
    "box_depth_mm": {"type": "float", "default": 40.0, "min": 25.0, "max": 60.0},
    "panel_thickness_mm": {"type": "float", "default": 3.0, "min": 1.5, "max": 4.0},
    "led_board_thickness_mm": {"type": "float", "default": 2.0, "min": 1.0, "max": 3.0},
    "diffuser_gap_mm": {"type": "float", "default": 10.0, "min": 5.0, "max": 20.0},
    "box_floor_mm": {"type": "float", "default": 5.0, "min": 3.0, "max": 10.0},
    "box_wall_height_mm": {"type": "float", "default": 15.0, "min": 10.0, "max": 30.0},
    "name": {"type": "str", "default": "NAME"},
    "font": {"type": "enum", "choices": ["OpenSans", "Pacifico"], "default": "OpenSans"},
    "text_height_mm": {"type": "float", "default": 25.0, "min": 10.0, "max": 60.0},
    "plate_thickness_mm": {"type": "float", "default": 3.0, "min": 2.0, "max": 5.0},
    "name_lamp_margin_mm": {"type": "float", "default": 15.0, "min": 8.0, "max": 30.0},
    "name_lamp_base_depth_mm": {"type": "float", "default": 30.0, "min": 20.0, "max": 50.0},
    "name_lamp_base_height_mm": {"type": "float", "default": 15.0, "min": 10.0, "max": 25.0},
    "name_lamp_base_floor_mm": {"type": "float", "default": 5.0, "min": 3.0, "max": 10.0},
}


def resolve_params(params: dict) -> dict:
    resolved = dict(DEFAULTS)
    resolved.update(params or {})
    if resolved["form"] not in FORMS:
        raise ValueError(f"led_base: unknown form {resolved['form']!r}; choices: {list(FORMS)}")
    if resolved["form"] == "name_lamp" and not resolved.get("name"):
        raise ValueError("led_base: params['name'] is required for form='name_lamp'")
    return resolved


def _build_puck(p: dict) -> np.ndarray:
    radius, height = p["puck_radius_mm"], p["puck_height_mm"]
    recess_r = p["led_coil_diameter_mm"] / 2.0
    recess_depth = min(p["recess_depth_mm"], height - 1.0)
    channel_w, res = p["cable_channel_mm"], p["res_mm"]

    n = max(4, int(round(2 * radius / res)) + 1)
    xs = np.linspace(-radius, radius, n)
    ys = np.linspace(-radius, radius, n)
    x, y = np.meshgrid(xs, ys)

    # Height dips (recess_depth) inside the coil recess AND along a
    # straight channel from the recess out to the rim, for the LED
    # strip's lead -- both are plain height variation, no masking needed
    # (masking is only for the puck's outer circular boundary, below).
    low = (x ** 2 + y ** 2 <= recess_r ** 2) | ((np.abs(y) <= channel_w / 2.0) & (x >= 0))
    top_h = np.where(low, height - recess_depth, height)

    cell_x = (xs[:-1] + xs[1:]) / 2.0
    cell_y = (ys[:-1] + ys[1:]) / 2.0
    cx, cy = np.meshgrid(cell_x, cell_y)
    footprint = cx ** 2 + cy ** 2 <= radius ** 2

    top = np.stack([x, y, top_h], axis=-1)
    bottom = np.stack([x, y, np.zeros_like(top_h)], axis=-1)
    return mesh.ruled_grid_solid(top, bottom, close_u=False, mask=footprint)


def _build_backlit_box(p: dict) -> np.ndarray:
    clearance = p["slot_clearance_mm"]
    front_y = 8.0
    panel_end = front_y + p["panel_thickness_mm"] + clearance
    board_start = panel_end + p["diffuser_gap_mm"]
    slots = [
        {"y_start": front_y, "thickness": p["panel_thickness_mm"], "clearance": clearance},
        {"y_start": board_start, "thickness": p["led_board_thickness_mm"], "clearance": clearance},
    ]
    depth = max(p["box_depth_mm"], board_start + p["led_board_thickness_mm"] + clearance + 5.0)
    return mesh.slotted_base(
        p["box_width_mm"], depth, slots, floor=p["box_floor_mm"], height=p["box_wall_height_mm"],
        cable_channel={"x_center_mm": p["box_width_mm"] / 2.0, "width_mm": p["cable_channel_mm"]})


def _build_name_lamp(p: dict) -> tuple[np.ndarray, np.ndarray, list[str]]:
    warnings: list[str] = []
    font = text.load_font(font_path(p["font"]))
    tris, width_mm, skipped = text.emboss_text(p["name"], font, p["text_height_mm"], p["plate_thickness_mm"])
    if skipped:
        warnings.append(f"name lamp: dropped {len(skipped)} character(s) that failed mesh "
                         f"validation ({''.join(skipped)!r})")
    if len(tris) == 0:
        raise ValueError(f"led_base: params['name']={p['name']!r} has no renderable characters")

    # emboss_text's native frame is already a thin flat plate (glyphs in
    # X/Y, thickness along Z) -- stand it upright with a proper rotation
    # (x, y, z) -> (x, z, -y): det=+1, so winding/normals stay correct.
    plate = tris.copy()
    tx, ty, tz = tris[:, :, 0], tris[:, :, 1], tris[:, :, 2]
    plate[:, :, 0] = tx
    plate[:, :, 1] = tz
    plate[:, :, 2] = -ty + p["text_height_mm"]

    base_width = width_mm + 2 * p["name_lamp_margin_mm"]
    depth = p["name_lamp_base_depth_mm"]
    clearance = p["slot_clearance_mm"]
    slot_y = (depth - p["plate_thickness_mm"] - clearance) / 2.0
    base = mesh.slotted_base(
        base_width, depth, [{"y_start": slot_y, "thickness": p["plate_thickness_mm"], "clearance": clearance}],
        floor=p["name_lamp_base_floor_mm"], height=p["name_lamp_base_height_mm"],
        cable_channel={"x_center_mm": base_width / 2.0, "width_mm": p["cable_channel_mm"]})

    plate[:, :, 0] += (base_width - width_mm) / 2.0
    plate[:, :, 1] += slot_y + clearance / 2.0
    plate[:, :, 2] += p["name_lamp_base_floor_mm"] - 0.2  # embed 0.2mm into the floor for a fused joint

    return plate.astype(np.float32), base, warnings


def build(params: dict) -> tuple[list[SolidMesh], dict, list[str]]:
    p = resolve_params(params)
    warnings: list[str] = []
    form = p["form"]

    if form == "puck":
        objects = [SolidMesh(name="base", triangles=_build_puck(p).astype(np.float32),
                              color_hex=BASE_COLOR, extruder=2, rate_class="support")]
    elif form == "backlit_box":
        objects = [SolidMesh(name="base", triangles=_build_backlit_box(p).astype(np.float32),
                              color_hex=BASE_COLOR, extruder=2, rate_class="support")]
    else:
        try:
            plate_tris, base_tris, name_warnings = _build_name_lamp(p)
        except text.TextUnavailable as exc:
            raise ValueError(f"led_base: {exc}") from exc
        warnings.extend(name_warnings)
        objects = [
            SolidMesh(name="plate", triangles=plate_tris, color_hex=PLATE_COLOR, extruder=1, rate_class="panel"),
            SolidMesh(name="base", triangles=base_tris.astype(np.float32),
                      color_hex=BASE_COLOR, extruder=2, rate_class="support"),
        ]

    return objects, p, warnings
