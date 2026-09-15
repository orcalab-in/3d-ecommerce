#!/usr/bin/env python3
"""Regenerate docs/PRODUCTS.md from each product module's PARAM_SPEC, so
the parameter reference can never drift from the actual code. Run:
python scripts/gen_products_doc.py
"""
from __future__ import annotations

import os

from printforge.api import PRODUCTS

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, "..", "docs", "PRODUCTS.md")

TITLES = {
    "photo_lamp": "Photo lamp",
    "lithophane": "Lithophane panel family",
    "terrain": "Terrain map + Strava/GPX running line",
    "flight": "Paragliding flight terrain + track",
    "led_base": "Lamp / LED base family",
}

INPUT_DESCRIPTIONS = {
    "photo_lamp": "a photo (jpg/png)",
    "lithophane": "a photo (jpg/png)",
    "terrain": "a GPX file, or a Strava activity JSON with latlng/altitude streams",
    "flight": "an IGC flight log, or a GPX file with elevation",
    "led_base": "the name to emboss (form=name_lamp only; ignored for puck/backlit_box)",
}


def _fmt_choices(spec: dict) -> str:
    if spec.get("type") == "enum":
        return " / ".join(str(c) for c in spec.get("choices", []))
    return ""


def _fmt_range(spec: dict) -> str:
    lo, hi = spec.get("min"), spec.get("max")
    if lo is not None and hi is not None:
        return f"{lo} - {hi}"
    if lo is not None:
        return f">= {lo}"
    if hi is not None:
        return f"<= {hi}"
    return ""


def render_product(name: str, module) -> str:
    lines = [f"## {TITLES.get(name, name)} (`{name}`)", ""]
    input_param = getattr(module, "INPUT_PARAM", None)
    if input_param:
        lines.append(f"CLI positional input (`--{input_param}` / first arg): "
                      f"{INPUT_DESCRIPTIONS.get(name, '')}")
        lines.append("")
    spec = getattr(module, "PARAM_SPEC", {})
    if not spec:
        lines.append("_No configurable parameters._\n")
        return "\n".join(lines)

    lines.append("| Parameter | Type | Default | Range / choices | Notes |")
    lines.append("|---|---|---|---|---|")
    for key, s in spec.items():
        type_ = s.get("type", "")
        default = s.get("default", "")
        range_or_choices = _fmt_choices(s) or _fmt_range(s)
        help_ = s.get("help", "")
        lines.append(f"| `{key}` | {type_} | {default} | {range_or_choices} | {help_} |")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    header = (
        "# printforge parameter reference\n\n"
        "Generated from each product module's `PARAM_SPEC` by "
        "`scripts/gen_products_doc.py` -- run it again after changing any "
        "product's parameters rather than hand-editing this file.\n\n"
        "CLI usage: `printforge <product> <input> [--key value ...] --out <prefix>`. "
        "Booleans are flags (`--markers` sets true; `--markers false` also works). "
        "The Python API takes the same keys in a `params` dict: "
        "`printforge.generate(product, params, out)`.\n\n"
    )
    sections = [render_product(name, module) for name, module in PRODUCTS.items()]
    with open(OUT_PATH, "w") as f:
        f.write(header + "\n".join(sections))
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
