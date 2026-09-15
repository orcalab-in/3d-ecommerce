#!/usr/bin/env python3
"""
Photo -> flat lithophane panel (STL), plus a slot stand and LED backboard.

Only needs numpy and Pillow:   pip install numpy pillow

Usage:
    python lithophane.py photo.jpg                       # 100 mm wide panel, defaults
    python lithophane.py photo.jpg --width 100 --max-height 130 --out orders/ORD123

Outputs (prefix = --out, default = photo name):
    <prefix>_panel.stl      the lithophane panel, print flat, white PLA
    <prefix>_stand.stl      slot stand: front slot for the panel, rear slot for the LED board
    <prefix>_ledboard.stl   flat plate the LED strip sticks to, drops into the rear slot
    <prefix>_preview.png    simulated lit view (what the customer will see)

Print notes (Bambu A1, 0.4 nozzle):
    panel   0.12 mm layers, 100 % infill, 3+ walls, 0 top/bottom layers not needed (solid anyway),
            print flat on the bed, image side up. No supports.
    stand   0.2 mm layers, 15 % infill, any colour.
"""
import argparse
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageOps


# ----------------------------------------------------------------------------- STL writing
def write_binary_stl(path, tris):
    """tris: (N, 3, 3) float32 array of triangles (counter-clockwise viewed from outside)."""
    tris = np.asarray(tris, dtype=np.float32)
    n = len(tris)
    v1 = tris[:, 1] - tris[:, 0]
    v2 = tris[:, 2] - tris[:, 0]
    normals = np.cross(v1, v2)
    lens = np.linalg.norm(normals, axis=1, keepdims=True)
    lens[lens == 0] = 1
    normals = (normals / lens).astype(np.float32)

    rec = np.zeros(n, dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
    rec["n"] = normals
    rec["v"] = tris
    with open(path, "wb") as f:
        f.write(b"lithophane generator".ljust(80, b" "))
        f.write(struct.pack("<I", n))
        f.write(rec.tobytes())
    return n


def box(x0, x1, y0, y1, z0, z1):
    """12 triangles for an axis-aligned box, outward-facing."""
    p = np.array(
        [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
         [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], dtype=np.float32)
    faces = [
        (0, 2, 1), (0, 3, 2),  # bottom (z0), normal -z
        (4, 5, 6), (4, 6, 7),  # top (z1), normal +z
        (0, 1, 5), (0, 5, 4),  # front (y0), normal -y
        (2, 3, 7), (2, 7, 6),  # back (y1), normal +y
        (3, 0, 4), (3, 4, 7),  # left (x0), normal -x
        (1, 2, 6), (1, 6, 5),  # right (x1), normal +x
    ]
    return p[np.array(faces)]


# ----------------------------------------------------------------------------- image -> heights
def load_heightmap(image_path, width_mm, max_height_mm, res_mm, min_t, max_t, gamma, border_mm):
    img = Image.open(image_path)
    img = ImageOps.exif_transpose(img).convert("L")

    # Fit the image inside width x max_height by centre-cropping to the target aspect.
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

    px_w = int(round(inner_w / res_mm))
    px_h = int(round(target_h / res_mm))
    img = ImageOps.autocontrast(img, cutoff=1)      # use the full tonal range
    img = img.resize((px_w, px_h), Image.LANCZOS)

    lum = np.asarray(img, dtype=np.float32) / 255.0  # 1 = white, 0 = black
    lum = np.flipud(lum)                              # image row 0 is top; y grows upward in STL
    dark = (1.0 - lum) ** gamma
    heights = min_t + dark * (max_t - min_t)          # dark pixels -> thick -> block light

    # Frame border at full thickness so the panel is rigid and the edge prints cleanly.
    b = int(round(border_mm / res_mm))
    if b > 0:
        heights = np.pad(heights, b, mode="constant", constant_values=max_t)
    return heights


def heightmap_to_stl(heights, res_mm):
    """Solid slab: flat bottom at z=0, top surface = heights, closed sides."""
    ny, nx = heights.shape
    xs = np.arange(nx, dtype=np.float32) * res_mm
    ys = np.arange(ny, dtype=np.float32) * res_mm
    X, Y = np.meshgrid(xs, ys)
    top = np.stack([X, Y, heights.astype(np.float32)], axis=-1)     # (ny, nx, 3)

    # Top surface: two triangles per cell, CCW seen from +z.
    a = top[:-1, :-1]; b = top[:-1, 1:]; c = top[1:, 1:]; d = top[1:, :-1]
    t_top = np.concatenate([np.stack([a, b, c], axis=2), np.stack([a, c, d], axis=2)]).reshape(-1, 3, 3)

    # Boundary loop, counter-clockwise seen from +z: front edge, right edge, back edge, left edge.
    loop = np.concatenate([top[0, :-1], top[:-1, -1], top[-1, ::-1][:-1], top[::-1, 0][:-1]])
    loop_bottom = loop.copy(); loop_bottom[:, 2] = 0

    # Bottom: fan from the centre over every boundary vertex so the edges match the walls.
    # Clockwise seen from +z, so the normal points -z.
    centre = np.array([xs[-1] / 2, ys[-1] / 2, 0], dtype=np.float32)
    b0 = loop_bottom; b1 = np.roll(loop_bottom, -1, axis=0)
    t_bot = np.stack([np.broadcast_to(centre, b0.shape), b1, b0], axis=1)

    # Sides: one quad per boundary segment, from the top loop down to z=0, facing outward.
    p0 = loop; p1 = np.roll(loop, -1, axis=0)
    q0 = loop_bottom; q1 = np.roll(loop_bottom, -1, axis=0)
    t_sides = np.concatenate([np.stack([p0, q0, q1], 1), np.stack([p0, q1, p1], 1)])
    return np.concatenate([t_top, t_bot, t_sides])


# ----------------------------------------------------------------------------- stand + LED board
def stand_stl(panel_w, panel_t, gap=10.0, depth=36.0, height=15.0, floor=5.0, clearance=0.4):
    """Slot stand. Front slot takes the panel, rear slot takes the LED board, `gap` mm apart.
    Built from touching boxes; slicers merge them."""
    w = panel_w + 10.0                                  # 5 mm margin each side
    slot = panel_t + clearance
    x0, x1 = -5.0, panel_w + 5.0
    y_front_slot = 12.0
    y_rear_slot = y_front_slot + slot + gap
    parts = [
        box(x0, x1, 0, depth, 0, floor),                                  # floor
        box(x0, x1, 0, y_front_slot, floor, height),                      # front lip
        box(x0, x1, y_front_slot + slot, y_rear_slot, floor, height),     # middle bar
        box(x0, x1, y_rear_slot + slot, depth, floor, height),            # rear lip
    ]
    return np.concatenate(parts), w


def ledboard_stl(panel_w, panel_h, thickness):
    return box(0, panel_w, 0, panel_h, 0, thickness)


# ----------------------------------------------------------------------------- preview
def lit_preview(heights, res_mm, out_path, k=1.1):
    """Simulated backlit view: transmission falls off exponentially with thickness."""
    trans = np.exp(-k * (heights - heights.min()))
    trans = (trans - trans.min()) / (trans.max() - trans.min() + 1e-9)
    warm = np.stack([trans, trans * 0.92, trans * 0.72], axis=-1)   # warm-white LED tint
    img = Image.fromarray((np.flipud(warm) * 255).astype(np.uint8))
    scale = max(1, int(round(0.25 / res_mm)))                          # keep preview ~4 px/mm
    if scale > 1:
        img = img.resize((img.width // scale, img.height // scale), Image.LANCZOS)
    img.save(out_path)


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="Photo -> lithophane panel STL")
    ap.add_argument("image")
    ap.add_argument("--out", help="output prefix (default: image name)")
    ap.add_argument("--width", type=float, default=100.0, help="panel width in mm (default 100)")
    ap.add_argument("--max-height", type=float, default=130.0, help="max panel height in mm")
    ap.add_argument("--res", type=float, default=0.2, help="mm per pixel (0.2 default, 0.1 finer/bigger file)")
    ap.add_argument("--min", dest="min_t", type=float, default=0.6, help="thinnest point mm (brightest)")
    ap.add_argument("--max", dest="max_t", type=float, default=3.0, help="thickest point mm (darkest)")
    ap.add_argument("--gamma", type=float, default=1.0, help=">1 lifts midtones, <1 darkens")
    ap.add_argument("--border", type=float, default=3.0, help="solid frame width mm")
    ap.add_argument("--no-stand", action="store_true", help="panel only")
    args = ap.parse_args()

    prefix = args.out or os.path.splitext(os.path.basename(args.image))[0]
    os.makedirs(os.path.dirname(prefix) or ".", exist_ok=True)

    heights = load_heightmap(args.image, args.width, args.max_height, args.res,
                             args.min_t, args.max_t, args.gamma, args.border)
    ny, nx = heights.shape
    panel_w, panel_h = (nx - 1) * args.res, (ny - 1) * args.res

    n = write_binary_stl(f"{prefix}_panel.stl", heightmap_to_stl(heights, args.res))
    lit_preview(heights, args.res, f"{prefix}_preview.png")

    # Filament estimate: PLA 1.24 g/cm3, cell area * mean height.
    vol_mm3 = float(heights.mean()) * panel_w * panel_h
    grams = vol_mm3 / 1000 * 1.24
    print(f"panel     {panel_w:.1f} x {panel_h:.1f} mm, {args.min_t}-{args.max_t} mm thick, "
          f"{n:,} triangles, ~{grams:.0f} g PLA  -> {prefix}_panel.stl")

    if not args.no_stand:
        board_t = 2.0
        tris, w = stand_stl(panel_w, args.max_t)
        write_binary_stl(f"{prefix}_stand.stl", tris)
        write_binary_stl(f"{prefix}_ledboard.stl", ledboard_stl(panel_w, panel_h, board_t))
        print(f"stand     {w:.0f} x 36 x 15 mm, slots {args.max_t + 0.4:.1f} mm  -> {prefix}_stand.stl")
        print(f"ledboard  {panel_w:.0f} x {panel_h:.0f} x {board_t:.0f} mm       -> {prefix}_ledboard.stl")
    print(f"preview   -> {prefix}_preview.png")


if __name__ == "__main__":
    sys.exit(main())