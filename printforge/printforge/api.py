"""The only I/O boundary in printforge.

products/*.py builders are pure functions (no filesystem access) that
return SolidMesh objects. generate() resolves params, calls the
builder, validates every mesh with meshcheck, writes STL/3MF/preview
files, and assembles a JSON-serializable JobResult. No global state --
every call is a pure function of (product, params, out) plus whatever
filesystem inputs the product reads (the input file, dem/, fonts/).
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from types import ModuleType

from . import estimate, meshcheck
from .products import flight, lithophane, photo_lamp, terrain
from .stl_io import write_binary_stl

PRODUCTS: dict[str, ModuleType] = {
    "photo_lamp": photo_lamp,
    "lithophane": lithophane,
    "terrain": terrain,
    "flight": flight,
}


@dataclass
class JobObject:
    name: str
    stl_path: str | None
    grams: float
    color_hex: str | None
    extruder: int | None
    triangle_count: int
    watertight: bool

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "stl_path": self.stl_path,
            "grams": round(self.grams, 2),
            "color_hex": self.color_hex,
            "extruder": self.extruder,
            "triangle_count": self.triangle_count,
            "watertight": self.watertight,
        }


@dataclass
class JobResult:
    product: str
    out_prefix: str
    objects: list[JobObject]
    threemf_path: str | None
    preview_png_path: str | None
    total_grams: float
    estimated_print_time_minutes: float
    params: dict
    warnings: list[str]
    generated_at: str

    def to_dict(self) -> dict:
        return {
            "product": self.product,
            "out_prefix": self.out_prefix,
            "objects": [o.to_dict() for o in self.objects],
            "threemf_path": self.threemf_path,
            "preview_png_path": self.preview_png_path,
            "total_grams": round(self.total_grams, 2),
            "estimated_print_time_minutes": round(self.estimated_print_time_minutes, 1),
            "params": self.params,
            "warnings": self.warnings,
            "generated_at": self.generated_at,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


def generate(product: str, params: dict, out: str, skip_validate: bool = False) -> JobResult:
    """Turn customer input into print-ready files. `out` is a path
    prefix -- objects are written to `{out}_{name}.stl`, a combined
    `{out}.3mf` if the product supports it, and `{out}_preview.png`."""
    if product not in PRODUCTS:
        raise ValueError(f"unknown product {product!r}; choices: {list(PRODUCTS)}")
    module = PRODUCTS[product]

    objects, resolved_params, warnings = module.build(dict(params or {}))

    out_dir = os.path.dirname(out) or "."
    os.makedirs(out_dir, exist_ok=True)

    job_objects: list[JobObject] = []
    total_grams = 0.0
    total_hours = 0.0
    for obj in objects:
        # check_mesh() is the expensive step on a fine mesh (np.unique over
        # every vertex/edge) -- run it exactly once and reuse the result
        # for both validation and the reported triangle count/watertight
        # flag, rather than calling it again right after assert_watertight
        # (which already computed it internally).
        check = meshcheck.check_mesh(obj.triangles)
        if not skip_validate and not check.watertight:
            raise meshcheck.MeshCheckError(f"{obj.name}: not watertight -- {'; '.join(check.problems)}")
        stl_path = f"{out}_{obj.name}.stl"
        write_binary_stl(stl_path, obj.triangles, name=obj.name.encode("ascii", "ignore")[:80])
        # grams and print-time both derive from the same signed volume
        # meshcheck already computed -- reuse it instead of a third pass.
        vol_cm3 = check.volume_mm3 / 1000.0
        grams = check.volume_mm3 * estimate.PLA_DENSITY_G_PER_MM3
        hours = estimate.print_time_hours_from_volume(vol_cm3, rate_class=obj.rate_class)
        total_grams += grams
        total_hours += hours
        job_objects.append(JobObject(
            name=obj.name, stl_path=stl_path, grams=grams, color_hex=obj.color_hex,
            extruder=obj.extruder, triangle_count=check.triangle_count, watertight=check.watertight,
        ))

    preview_path = None
    render_preview = getattr(module, "render_preview", None)
    if render_preview is not None:
        preview_path = f"{out}_preview.png"
        render_preview(resolved_params, objects, preview_path)

    threemf_path = None
    build_threemf = getattr(module, "build_threemf", None)
    if build_threemf is not None:
        threemf_path = f"{out}.3mf"
        build_threemf(objects, threemf_path)

    return JobResult(
        product=product,
        out_prefix=out,
        objects=job_objects,
        threemf_path=threemf_path,
        preview_png_path=preview_path,
        total_grams=total_grams,
        estimated_print_time_minutes=total_hours * 60.0,
        params=resolved_params,
        warnings=warnings,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
