"""Paths to bundled assets (OFL fonts) shipped alongside the package."""
from __future__ import annotations

from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent      # .../printforge/printforge
PROJECT_ROOT = PACKAGE_ROOT.parent                   # .../printforge
FONT_DIR = PROJECT_ROOT / "fonts"

BUNDLED_FONTS = {
    "OpenSans": FONT_DIR / "OFL-OpenSans" / "OpenSans-Regular.ttf",
    "Pacifico": FONT_DIR / "OFL-Pacifico" / "Pacifico-Regular.ttf",
}


def font_path(name: str) -> str:
    try:
        path = BUNDLED_FONTS[name]
    except KeyError:
        raise ValueError(f"unknown bundled font {name!r}; choices: {list(BUNDLED_FONTS)}") from None
    if not path.exists():
        raise FileNotFoundError(f"bundled font missing on disk: {path}")
    return str(path)
