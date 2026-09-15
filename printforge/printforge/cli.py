"""printforge <product> <input> [--key value ...] --out <prefix>

A small hand-rolled parser rather than argparse subcommands: each
product declares its own PARAM_SPEC (name -> {type, default, ...}), so
the CLI can generically coerce `--key value` pairs without every
product needing to touch cli.py.
"""
from __future__ import annotations

import sys

from .api import PRODUCTS, generate

_TRUE_STRINGS = {"1", "true", "yes", "on"}


def _coerce(kind: str, raw: str | None):
    if kind == "float":
        return float(raw)
    if kind == "int":
        return int(raw)
    if kind == "bool":
        return True if raw is None else raw.lower() in _TRUE_STRINGS
    return raw  # "str" / "enum"


def _print_usage() -> None:
    print("usage: printforge <product> <input> [--key value ...] --out <prefix>")
    print(f"products: {', '.join(sorted(PRODUCTS))}")


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if len(argv) < 2 or argv[0] in ("-h", "--help"):
        _print_usage()
        return 0 if argv[:1] == ["--help"] or argv[:1] == ["-h"] else 2

    product, input_path, rest = argv[0], argv[1], argv[2:]
    if product not in PRODUCTS:
        print(f"error: unknown product {product!r}; choices: {sorted(PRODUCTS)}", file=sys.stderr)
        return 2
    module = PRODUCTS[product]
    spec = getattr(module, "PARAM_SPEC", {})

    out = None
    skip_validate = False
    params: dict = {}
    i = 0
    while i < len(rest):
        tok = rest[i]
        if tok == "--out":
            out = rest[i + 1]
            i += 2
            continue
        if tok == "--skip-validate":
            skip_validate = True
            i += 1
            continue
        if tok.startswith("--"):
            key = tok[2:].replace("-", "_")
            kind = spec.get(key, {}).get("type", "str")
            if kind == "bool" and (i + 1 >= len(rest) or rest[i + 1].startswith("--")):
                params[key] = _coerce("bool", None)
                i += 1
                continue
            raw = rest[i + 1] if i + 1 < len(rest) else None
            params[key] = _coerce(kind, raw)
            i += 2
            continue
        i += 1  # ignore stray positional tokens

    if out is None:
        print("error: --out is required", file=sys.stderr)
        return 2

    input_key = getattr(module, "INPUT_PARAM", "input")
    params[input_key] = input_path

    result = generate(product, params, out, skip_validate=skip_validate)
    for obj in result.objects:
        status = "OK" if obj.watertight else "FAILED watertight check"
        print(f"{obj.name:12s} {obj.grams:7.1f} g  {obj.triangle_count:6d} tris  [{status}]  -> {obj.stl_path}")
    if result.threemf_path:
        print(f"{'3mf':12s} -> {result.threemf_path}")
    if result.preview_png_path:
        print(f"{'preview':12s} -> {result.preview_png_path}")
    print(f"total: {result.total_grams:.1f} g, ~{result.estimated_print_time_minutes:.0f} min")
    for w in result.warnings:
        print(f"warning: {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
