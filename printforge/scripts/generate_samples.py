#!/usr/bin/env python3
"""(Re)generate the small, deterministic fixtures committed under samples/,
so tests never need network access or hand-authored binary files.
Run: python scripts/generate_samples.py
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(HERE, "..", "samples")


def make_test_photo(path: str, size: tuple[int, int] = (160, 200)) -> None:
    """A deterministic synthetic portrait-ish gradient + a dark circle
    "subject" in the middle -- gives the lithophane engine tonal range
    and a circular feature (rules out any accidental symmetry bugs)."""
    w, h = size
    y, x = np.mgrid[0:h, 0:w]
    gradient = (x / w * 0.6 + y / h * 0.4)
    cx, cy, r = w / 2, h * 0.42, min(w, h) * 0.28
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    subject = np.clip(1.0 - dist / r, 0.0, 1.0) ** 1.5
    lum = np.clip(gradient * 0.7 + (1.0 - subject) * 0.3, 0.0, 1.0)
    img = Image.fromarray((lum * 255).astype(np.uint8), mode="L").convert("RGB")
    img.save(path, quality=92)


GPX_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="printforge-sample" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Sample Morning Run</name>
    <trkseg>
{points}
    </trkseg>
  </trk>
</gpx>
"""


def make_sample_gpx(path: str) -> None:
    lat0, lon0 = 37.7749, -122.4194
    n = 24
    t = np.linspace(0, 2 * np.pi, n)
    lats = lat0 + 0.004 * np.sin(t)
    lons = lon0 + 0.006 * np.cos(t)
    eles = 30 + 15 * np.sin(2 * t) + 5 * np.cos(3 * t)
    lines = []
    for i in range(n):
        ts = f"2024-05-01T07:{i:02d}:00Z"
        lines.append(
            f'      <trkpt lat="{lats[i]:.6f}" lon="{lons[i]:.6f}">'
            f"<ele>{eles[i]:.1f}</ele><time>{ts}</time></trkpt>")
    with open(path, "w") as f:
        f.write(GPX_TEMPLATE.format(points="\n".join(lines)))


def make_sample_igc(path: str) -> None:
    lines = [
        "AXXX printforge sample flight",
        "HFDTE010524",
        "HFPLTPILOTINCHARGE:Sample Pilot",
        "HFGTYGLIDERTYPE:Sample Wing",
        "HFCIDCOMPETITIONID:PF01",
        "HFSITSITE:Launch Point",
    ]
    # Deliberately not on a whole-degree boundary (e.g. NOT 46.0/8.0):
    # the flight's lat/lon minimum lands exactly at (lat0, lon0) below
    # (sin/t start at 0), and a boundary value there would place it
    # exactly on the edge between two SRTM .hgt tiles, which a single
    # local tile can never fully cover.
    lat0, lon0, alt0 = 46.52, 8.05, 1400.0
    n = 40
    t = np.linspace(0, 1, n)
    lats = lat0 + 0.01 * t
    lons = lon0 + 0.02 * np.sin(t * np.pi)
    alts_gps = alt0 + 300 * np.sin(t * np.pi) - 100 * t
    alts_baro = alts_gps - 5

    def fmt_lat(v: float) -> str:
        deg = int(abs(v))
        minutes = (abs(v) - deg) * 60
        hemi = "N" if v >= 0 else "S"
        # IGC lat = DDMMmmm: 2-digit degrees + minutes to 3 fractional
        # digits (thousandths), 5 digits total -- 06.3f gives "MM.mmm"
        # (6 chars incl. the dot); stripping the dot leaves those 5 digits.
        return f"{deg:02d}{minutes:06.3f}".replace(".", "") + hemi

    def fmt_lon(v: float) -> str:
        deg = int(abs(v))
        minutes = (abs(v) - deg) * 60
        hemi = "E" if v >= 0 else "W"
        # IGC lon = DDDMMmmm: 3-digit degrees + the same 5-digit minutes.
        return f"{deg:03d}{minutes:06.3f}".replace(".", "") + hemi

    for i in range(n):
        h, m, s = 9, i // 2, (i % 2) * 30
        time_str = f"{h:02d}{m:02d}{s:02d}"
        lat_str = fmt_lat(lats[i])
        lon_str = fmt_lon(lons[i])
        baro = max(0, int(alts_baro[i]))
        gps = max(0, int(alts_gps[i]))
        lines.append(f"B{time_str}{lat_str}{lon_str}A{baro:05d}{gps:05d}")

    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main() -> None:
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    make_test_photo(os.path.join(SAMPLES_DIR, "test_photo.jpg"))
    make_sample_gpx(os.path.join(SAMPLES_DIR, "sample.gpx"))
    make_sample_igc(os.path.join(SAMPLES_DIR, "sample.igc"))
    print(f"wrote samples to {SAMPLES_DIR}")


if __name__ == "__main__":
    main()
