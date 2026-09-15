"""Filament weight and rough print-time estimates.

Weight is computed from true signed volume (reusing meshcheck's volume
math) rather than the prototype's mean-height approximation, so it's
exact for flat, curved, or cylindrical geometry alike. Print time is a
coarse volume/rate estimate -- good enough for a customer-facing
quote, not a slicer replacement.
"""
from __future__ import annotations

import numpy as np

from .meshcheck import signed_volume

PLA_DENSITY_G_PER_MM3 = 1.24 / 1000.0  # 1.24 g/cm^3

# Rough cm^3/hour throughput per product "family", used only for the
# ballpark print-time estimate returned in JobResult. Solid, high-infill
# parts (lithophane panels) print slowly at fine layers; boxy, low-infill
# support parts (stands/bases) print much faster. See docs/PRODUCTS.md.
PRINT_RATE_CM3_PER_HOUR = {
    "panel": 9.0,       # 0.12mm layers, ~100% infill
    "support": 20.0,    # 0.2mm layers, ~15% infill
    "default": 14.0,
}
SETUP_MINUTES = 3.0  # purge/prime/skirt overhead added per object


def grams(triangles: np.ndarray) -> float:
    """Filament weight in grams, from a watertight mesh's true volume."""
    return signed_volume(triangles) * PLA_DENSITY_G_PER_MM3


def print_time_hours_from_volume(vol_cm3: float, rate_class: str = "default") -> float:
    """print_time_hours(), given an already-computed volume -- callers
    that also need meshcheck's volume (e.g. api.generate) should compute
    it once and pass it here rather than re-scanning the mesh."""
    rate = PRINT_RATE_CM3_PER_HOUR.get(rate_class, PRINT_RATE_CM3_PER_HOUR["default"])
    return vol_cm3 / rate + SETUP_MINUTES / 60.0


def print_time_hours(triangles: np.ndarray, rate_class: str = "default") -> float:
    """Rough print time in hours from volume and a per-family throughput
    constant, plus a small fixed setup allowance."""
    return print_time_hours_from_volume(signed_volume(triangles) / 1000.0, rate_class)
