#!/usr/bin/env python3
"""Generate one representative sample per product into out/, run the
mesh checker on every object, and print the final summary table:
product, sample input, output files, grams, estimated print time,
mesh-check result. Run: python scripts/summary_table.py
"""
from __future__ import annotations

import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import numpy as np  # noqa: E402

from printforge import api, meshcheck, stl_io  # noqa: E402

SAMPLES = os.path.join(HERE, "..", "samples")
OUT = os.path.join(HERE, "..", "out")
ROOT = os.path.join(HERE, "..")
DEM_TMP = os.path.join(HERE, "..", ".summary_dem")


def _synth_dem(lat_sw: int, lon_sw: int, lat_c: float, lon_c: float) -> None:
    n = 25
    lats = np.linspace(lat_sw + 1.0, lat_sw, n)
    lons = np.linspace(lon_sw, lon_sw + 1.0, n)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    z = 30 + 20 * np.sin((lat_grid - lat_c) * 300) * np.cos((lon_grid - lon_c) * 300)
    os.makedirs(DEM_TMP, exist_ok=True)
    hemi = "W" if lon_sw < 0 else "E"
    z.astype(">i2").tofile(os.path.join(DEM_TMP, f"N{lat_sw}{hemi}{abs(lon_sw):03d}.hgt"))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    _synth_dem(37, -123, 37.7749, -122.4194)   # covers samples/sample.gpx
    _synth_dem(46, 8, 46.52, 8.06)              # covers samples/sample.igc

    photo = os.path.join(SAMPLES, "test_photo.jpg")
    jobs = [
        ("photo_lamp", {"image": photo, "size": "M", "caption": "Hi Mom"}, "summary_photo_lamp", photo),
        ("lithophane", {"image": photo, "form": "curved"}, "summary_lithophane", photo),
        ("terrain", {"route_path": os.path.join(SAMPLES, "sample.gpx"), "dem_dir": DEM_TMP,
                     "emboss_text": True, "markers": True, "terrain_res_mm": 1.5},
         "summary_terrain", "sample.gpx"),
        ("flight", {"flight_path": os.path.join(SAMPLES, "sample.igc"), "dem_dir": DEM_TMP,
                     "emboss_text": True, "terrain_res_mm": 1.5},
         "summary_flight", "sample.igc"),
        ("led_base", {"form": "name_lamp", "name": "Alex"}, "summary_led_base", "Alex"),
    ]

    object_rows, product_rows = [], []
    for product, params, prefix, sample_label in jobs:
        result = api.generate(product, params, out=os.path.join(OUT, prefix))
        label = os.path.basename(sample_label) if os.path.sep in sample_label else sample_label
        for obj in result.objects:
            tris = stl_io.read_binary_stl(obj.stl_path)
            check = meshcheck.check_mesh(tris)
            object_rows.append((product, label, obj.name, os.path.relpath(obj.stl_path, ROOT),
                                 obj.grams, check.watertight))
        if result.threemf_path:
            object_rows.append((product, label, "(3mf)", os.path.relpath(result.threemf_path, ROOT),
                                 result.total_grams, all(o.watertight for o in result.objects)))
        product_rows.append((product, label, result.total_grams, result.estimated_print_time_minutes,
                              all(o.watertight for o in result.objects)))

    shutil.rmtree(DEM_TMP, ignore_errors=True)

    print(f"{'product':12s} {'sample input':14s} {'object':16s} {'grams':>8s}  {'mesh check':10s}  file")
    print("-" * 100)
    for product, label, obj_name, path, grams, ok in object_rows:
        print(f"{product:12s} {label:14s} {obj_name:16s} {grams:8.1f}  {'OK' if ok else 'FAILED':10s}  {path}")

    print()
    print(f"{'product':12s} {'sample input':14s} {'total grams':>12s}  {'est. print time':>16s}  mesh check")
    print("-" * 90)
    all_ok = True
    for product, label, grams, minutes, ok in product_rows:
        all_ok = all_ok and ok
        print(f"{product:12s} {label:14s} {grams:12.1f}  {minutes / 60.0:13.1f} h  {'OK' if ok else 'FAILED'}")

    print()
    print("ALL PRODUCTS WATERTIGHT" if all_ok else "SOME PRODUCTS FAILED THE MESH CHECK")


if __name__ == "__main__":
    main()
