"""Shared dataclasses with no dependencies on the rest of the package, so
both api.py and products/*.py can import them without a circular import
(api.py imports the products registry; products must not import api.py)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class SolidMesh:
    """One printable solid, as returned by a product's pure build()
    function -- no filesystem I/O. `rate_class` selects a print-time
    throughput constant from estimate.PRINT_RATE_CM3_PER_HOUR."""
    name: str
    triangles: np.ndarray
    color_hex: str = "#CCCCCCFF"
    extruder: int = 1
    rate_class: str = "default"
