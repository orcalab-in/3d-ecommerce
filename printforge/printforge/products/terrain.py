"""Product 4: terrain map with a Strava/GPX running line.

Pipeline: parse the route (GPX or Strava JSON) -> fit a local bounding
box with margin -> scale to a printable footprint (letterboxed to the
route's aspect ratio, not squashed) -> sample a DEM over that area ->
vertically exaggerate into a terrain solid -> lay the route on top,
either as a raised ridge (a SEPARATE mesh, filament 2, embedded 0.2mm
into the terrain for a fused joint) or as an inlaid groove carved
directly into the terrain (single object, for hand-painting).
"""
from __future__ import annotations

import numpy as np

from .. import dem, geo, gpx, mesh, preview, text, threemf
from ..assets import font_path
from ..jobtypes import SolidMesh

INPUT_PARAM = "route_path"

TERRAIN_COLOR = "#D9C7A5FF"
ROUTE_COLOR = "#2E6E4EFF"

DEFAULTS = {
    "margin_frac": 0.12,
    "footprint_mm": 150.0,
    "max_footprint_mm": 240.0,
    "exaggeration": 1.5,
    "min_base_thickness_mm": 4.0,
    "terrain_res_mm": 1.0,
    "route_variant": "ridge",       # ridge | channel
    "ridge_width_mm": 1.5,
    "ridge_height_mm": 1.2,
    "ridge_embed_mm": 0.2,
    "channel_depth_mm": 0.8,
    "markers": False,
    "marker_radius_mm": 1.5,
    "marker_height_mm": 3.0,
    "emboss_text": False,
    "text_size_mm": 2.5,
    "text_depth_mm": 0.5,
    "text_font": "OpenSans",
    "dem_dir": "dem",
    "dem_cache_dir": ".cache/printforge/dem",
    "opentopo_dataset": "SRTMGL1",
    "opentopo_key": None,
}

PARAM_SPEC = {
    "margin_frac": {"type": "float", "default": 0.12, "min": 0.0, "max": 0.5},
    "footprint_mm": {"type": "float", "default": 150.0, "min": 60.0, "max": 240.0},
    "max_footprint_mm": {"type": "float", "default": 240.0, "min": 60.0, "max": 240.0},
    "exaggeration": {"type": "float", "default": 1.5, "min": 1.0, "max": 4.0},
    "min_base_thickness_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 10.0},
    "terrain_res_mm": {"type": "float", "default": 1.0, "min": 0.4, "max": 2.0},
    "route_variant": {"type": "enum", "choices": ["ridge", "channel"], "default": "ridge"},
    "ridge_width_mm": {"type": "float", "default": 1.5, "min": 0.8, "max": 3.0},
    "ridge_height_mm": {"type": "float", "default": 1.2, "min": 0.6, "max": 3.0},
    "ridge_embed_mm": {"type": "float", "default": 0.2, "min": 0.1, "max": 0.5},
    "channel_depth_mm": {"type": "float", "default": 0.8, "min": 0.3, "max": 1.5},
    "markers": {"type": "bool", "default": False},
    "marker_radius_mm": {"type": "float", "default": 1.5, "min": 0.8, "max": 3.0},
    "marker_height_mm": {"type": "float", "default": 3.0, "min": 1.5, "max": 6.0},
    "emboss_text": {"type": "bool", "default": False},
    "text_size_mm": {"type": "float", "default": 2.5, "min": 1.5, "max": 5.0},
    "text_depth_mm": {"type": "float", "default": 0.5, "min": 0.3, "max": 1.0},
    "text_font": {"type": "enum", "choices": ["OpenSans", "Pacifico"], "default": "OpenSans"},
    "dem_dir": {"type": "str", "default": "dem"},
    "dem_cache_dir": {"type": "str", "default": ".cache/printforge/dem"},
    "opentopo_dataset": {"type": "enum", "choices": ["SRTMGL1", "COP30"], "default": "SRTMGL1"},
    "opentopo_key": {"type": "str", "default": None},
}


def resolve_params(params: dict) -> dict:
    resolved = dict(DEFAULTS)
    resolved.update(params or {})
    if resolved.get("route_path") is None:
        raise ValueError("terrain: params['route_path'] is required")
    if resolved["route_variant"] not in ("ridge", "channel"):
        raise ValueError(f"terrain: unknown route_variant {resolved['route_variant']!r}")
    return resolved


def _build_terrain_grid(p: dict, route: gpx.Route) -> dict:
    """Shared geometry setup used by both build() and render_preview()."""
    lats, lons = route.lats(), route.lons()
    bbox = geo.fit_bbox(lats, lons, margin_frac=p["margin_frac"])
    lat0, lon0 = bbox["lat0"], bbox["lon0"]
    width_m, height_m = bbox["x1"] - bbox["x0"], bbox["y1"] - bbox["y0"]
    out_w_mm, out_h_mm, scale = geo.fit_footprint(
        width_m, height_m, p["footprint_mm"], p["max_footprint_mm"])

    res_mm = p["terrain_res_mm"]
    nx = max(2, int(round(out_w_mm / res_mm)) + 1)
    ny = max(2, int(round(out_h_mm / res_mm)) + 1)
    xs_mm = np.linspace(0.0, out_w_mm, nx)
    ys_mm = np.linspace(0.0, out_h_mm, ny)
    x_mm, y_mm = np.meshgrid(xs_mm, ys_mm)
    x_m = x_mm / scale + bbox["x0"]
    y_m = y_mm / scale + bbox["y0"]
    grid_lat, grid_lon = geo.unproject_local(x_m, y_m, lat0, lon0)

    dem_source = dem.DemSource(dem_dir=p["dem_dir"], cache_dir=p["dem_cache_dir"],
                                api_key=p["opentopo_key"], dataset=p["opentopo_dataset"])
    elev = dem_source.elevation_grid(grid_lat.ravel(), grid_lon.ravel()).reshape(ny, nx)
    rel = (elev - elev.min()) * p["exaggeration"]
    terrain_z = p["min_base_thickness_mm"] + rel

    route_xy_m = gpx.route_local_xy(route, lat0, lon0)
    route_xy_mm = (route_xy_m - np.array([bbox["x0"], bbox["y0"]])) * scale
    route_xy_mm = geo.smooth_polyline(route_xy_mm, window=5)
    route_xy_mm = geo.simplify_rdp(route_xy_mm, epsilon=max(res_mm * 0.5, 0.2))
    route_xy_mm = geo.resample_polyline(route_xy_mm, spacing=max(res_mm, 0.5))
    route_xy_mm[:, 0] = np.clip(route_xy_mm[:, 0], 0.0, out_w_mm)
    route_xy_mm[:, 1] = np.clip(route_xy_mm[:, 1], 0.0, out_h_mm)

    return {
        "x_mm": x_mm, "y_mm": y_mm, "terrain_z": terrain_z, "res_mm": res_mm,
        "out_w_mm": out_w_mm, "out_h_mm": out_h_mm, "route_xy_mm": route_xy_mm,
    }


def _route_stats_text(route: gpx.Route) -> str:
    parts = []
    if route.name:
        parts.append(route.name)
    dist_km = gpx.route_distance_m(route) / 1000.0
    parts.append(f"{dist_km:.1f}km")
    gain_m = gpx.route_elevation_gain_m(route)
    if gain_m > 0:
        parts.append(f"+{gain_m:.0f}m")
    date = gpx.route_date(route)
    if date:
        parts.append(date)
    return "  ".join(parts)


def build(params: dict) -> tuple[list[SolidMesh], dict, list[str]]:
    p = resolve_params(params)
    warnings: list[str] = []
    route = gpx.load_route(p["route_path"])
    if len(route.points) < 2:
        raise ValueError("terrain: route needs at least 2 points")

    g = _build_terrain_grid(p, route)
    x_mm, y_mm, terrain_z, res_mm = g["x_mm"], g["y_mm"], g["terrain_z"], g["res_mm"]
    out_w_mm, out_h_mm, route_xy_mm = g["out_w_mm"], g["out_h_mm"], g["route_xy_mm"]

    objects: list[SolidMesh] = []

    if p["route_variant"] == "channel":
        flat_xy = np.stack([x_mm.ravel(), y_mm.ravel()], axis=1)
        dist = geo.path_distance_field(flat_xy, route_xy_mm).reshape(terrain_z.shape)
        half_w = p["ridge_width_mm"] / 2.0
        falloff = np.clip(1.0 - dist / half_w, 0.0, 1.0)
        terrain_z = terrain_z - p["channel_depth_mm"] * falloff
        route_obj = None
    else:
        route_z = geo.sample_grid_bilinear(terrain_z, res_mm, route_xy_mm[:, 0], route_xy_mm[:, 1])
        ridge_tris = mesh.ribbon(route_xy_mm, route_z, p["ridge_width_mm"],
                                  top_offset=p["ridge_height_mm"], bottom_offset=-p["ridge_embed_mm"])
        route_tris = [ridge_tris]

        if p["markers"]:
            for pt in (route_xy_mm[0], route_xy_mm[-1]):
                z = float(geo.sample_grid_bilinear(terrain_z, res_mm, [pt[0]], [pt[1]])[0])
                route_tris.append(mesh.cylinder(
                    (float(pt[0]), float(pt[1])), z - p["ridge_embed_mm"],
                    z + p["marker_height_mm"], p["marker_radius_mm"]))
        route_obj = SolidMesh(name="route", triangles=np.concatenate(route_tris).astype(np.float32),
                               color_hex=ROUTE_COLOR, extruder=2, rate_class="support")

    top = np.stack([x_mm, y_mm, terrain_z], axis=-1)
    bottom = np.stack([x_mm, y_mm, np.zeros_like(terrain_z)], axis=-1)
    terrain_tris = mesh.ruled_grid_solid(top, bottom, close_u=False)

    if p["emboss_text"]:
        try:
            font = text.load_font(font_path(p["text_font"]))
            caption = _route_stats_text(route)
            cap_tris, cap_w, skipped = text.emboss_text(caption, font, p["text_size_mm"], p["text_depth_mm"])
            if skipped:
                warnings.append(f"terrain caption: dropped {len(skipped)} character(s) that failed "
                                 f"mesh validation ({''.join(skipped)!r})")
            if len(cap_tris):
                placed = cap_tris.copy()
                cx, cy, cz = cap_tris[:, :, 0], cap_tris[:, :, 1], cap_tris[:, :, 2]
                placed[:, :, 0] = cx - cap_w / 2.0 + out_w_mm / 2.0
                placed[:, :, 1] = -cz + 0.2
                placed[:, :, 2] = cy + max(p["min_base_thickness_mm"] - p["text_size_mm"], 0.3) / 2.0
                terrain_tris = np.concatenate([terrain_tris, placed])
        except text.TextUnavailable as exc:
            warnings.append(str(exc) + " -- continuing without the bevel caption")

    objects.append(SolidMesh(name="terrain", triangles=terrain_tris.astype(np.float32),
                              color_hex=TERRAIN_COLOR, extruder=1, rate_class="default"))
    if route_obj is not None:
        objects.append(route_obj)

    return objects, p, warnings


def render_preview(p: dict, objects: list[SolidMesh], out_path: str) -> None:
    route = gpx.load_route(p["route_path"])
    g = _build_terrain_grid(p, route)
    preview.hillshade_preview(g["terrain_z"], g["res_mm"], out_path, route_xy=g["route_xy_mm"])


def build_threemf(objects: list[SolidMesh], threemf_path: str) -> None:
    threemf.write_3mf(threemf_path, [
        threemf.ThreeMFObject(name=o.name, triangles=o.triangles, color_hex=o.color_hex, extruder=o.extruder)
        for o in objects
    ])
