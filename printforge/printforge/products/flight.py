"""Product 5: paragliding flight terrain + track.

Terrain relief is built the same way as product 4. The flight track
itself has two printable approaches (the naive "floating tube" with no
support is not one of them -- it's a guaranteed print failure):

(a) "tube": the track as a swept tube, held up by thin vertical pillars
    down to the terrain every `pillar_spacing_mm` -- one multi-colour
    3MF (terrain filament 1, track+pillars filament 2). More literally
    3D and dramatic, but the pillars are thin/breakable and the spacing
    needs tuning per how steep/close the terrain is beneath the flight.
(b) "plaque" (default): the track projected onto the terrain as a
    raised line (reusing product 4's ridge technique) plus a SEPARATE
    flat altitude-profile plaque (distance along track -> X, altitude ->
    Y, extruded like a name-lamp plate) that stands next to the tile.
    Reuses ~90% of product 4's code, prints faster, and -- printed flat
    on the bed -- carries zero overhang risk at all, vs. the tube mode's
    pillar spacing being terrain-dependent. Default because it's the
    robust choice; `--track-mode tube` is there for the dramatic one.

Both modes print on the A1 without supports.
"""
from __future__ import annotations

import numpy as np

from .. import dem, geo, gpx, igc, mesh, preview, text, threemf
from ..assets import font_path
from ..jobtypes import SolidMesh

INPUT_PARAM = "flight_path"

TERRAIN_COLOR = "#D9C7A5FF"
TRACK_COLOR = "#C24E2EFF"

DEFAULTS = {
    "margin_frac": 0.15,
    "footprint_mm": 150.0,
    "max_footprint_mm": 240.0,
    "exaggeration": 1.5,
    "min_base_thickness_mm": 4.0,
    "terrain_res_mm": 1.0,
    "track_mode": "plaque",         # plaque | tube
    "ridge_width_mm": 1.5,
    "ridge_height_mm": 1.2,
    "ridge_embed_mm": 0.2,
    "tube_radius_mm": 1.5,
    "pillar_radius_mm": 0.8,
    "pillar_spacing_mm": 15.0,
    "pillar_min_height_mm": 3.0,
    "max_track_height_mm": 70.0,
    "plaque_max_width_mm": 150.0,
    "plaque_max_height_mm": 40.0,
    "plaque_thickness_mm": 2.5,
    "plaque_base_mm": 4.0,
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
    "margin_frac": {"type": "float", "default": 0.15, "min": 0.0, "max": 0.5},
    "footprint_mm": {"type": "float", "default": 150.0, "min": 60.0, "max": 240.0},
    "max_footprint_mm": {"type": "float", "default": 240.0, "min": 60.0, "max": 240.0},
    "exaggeration": {"type": "float", "default": 1.5, "min": 1.0, "max": 4.0},
    "min_base_thickness_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 10.0},
    "terrain_res_mm": {"type": "float", "default": 1.0, "min": 0.4, "max": 2.0},
    "track_mode": {"type": "enum", "choices": ["plaque", "tube"], "default": "plaque"},
    "ridge_width_mm": {"type": "float", "default": 1.5, "min": 0.8, "max": 3.0},
    "ridge_height_mm": {"type": "float", "default": 1.2, "min": 0.6, "max": 3.0},
    "ridge_embed_mm": {"type": "float", "default": 0.2, "min": 0.1, "max": 0.5},
    "tube_radius_mm": {"type": "float", "default": 1.5, "min": 0.8, "max": 3.0},
    "pillar_radius_mm": {"type": "float", "default": 0.8, "min": 0.5, "max": 1.5},
    "pillar_spacing_mm": {"type": "float", "default": 15.0, "min": 5.0, "max": 40.0},
    "pillar_min_height_mm": {"type": "float", "default": 3.0, "min": 1.0, "max": 10.0},
    "max_track_height_mm": {"type": "float", "default": 70.0, "min": 20.0, "max": 150.0},
    "plaque_max_width_mm": {"type": "float", "default": 150.0, "min": 60.0, "max": 240.0},
    "plaque_max_height_mm": {"type": "float", "default": 40.0, "min": 15.0, "max": 80.0},
    "plaque_thickness_mm": {"type": "float", "default": 2.5, "min": 1.5, "max": 4.0},
    "plaque_base_mm": {"type": "float", "default": 4.0, "min": 2.0, "max": 8.0},
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
    if resolved.get("flight_path") is None:
        raise ValueError("flight: params['flight_path'] is required")
    if resolved["track_mode"] not in ("plaque", "tube"):
        raise ValueError(f"flight: unknown track_mode {resolved['track_mode']!r}")
    return resolved


class _FlightData:
    """Unified view over an IGC flight or a GPX-with-elevation track, so
    the rest of this module doesn't care which the customer supplied."""

    def __init__(self, path: str):
        if path.lower().endswith(".igc"):
            flight = igc.parse_igc(path)
            self.lats, self.lons, self.alts = flight.lats(), flight.lons(), flight.alts_gps()
            self.launch = flight.launch_site
            self.landing = flight.landing_site
            self.date = flight.date
            self.distance_m = igc.flight_distance_m(flight)
            self.max_alt_m = igc.flight_max_altitude_m(flight)
            self.duration_str = igc.flight_duration_str(flight)
        else:
            route = gpx.load_route(path)
            if not any(p.ele is not None for p in route.points):
                raise ValueError(f"{path}: GPX has no elevation data (needed for the altitude profile)")
            self.lats, self.lons, self.alts = route.lats(), route.lons(), route.eles()
            self.launch, self.landing = route.name, None
            self.date = gpx.route_date(route)
            self.distance_m = gpx.route_distance_m(route)
            self.max_alt_m = float(np.max(self.alts))
            self.duration_str = None


def _build_terrain_grid(p: dict, flight: _FlightData) -> dict:
    bbox = geo.fit_bbox(flight.lats, flight.lons, margin_frac=p["margin_frac"])
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
    terrain_z = p["min_base_thickness_mm"] + (elev - elev.min()) * p["exaggeration"]

    track_x_m, track_y_m = geo.project_local(flight.lats, flight.lons, lat0, lon0)
    track_xy_mm = (np.stack([track_x_m, track_y_m], axis=1)
                   - np.array([bbox["x0"], bbox["y0"]])) * scale
    track_xy_mm = geo.smooth_polyline(track_xy_mm, window=5)
    track_xy_mm[:, 0] = np.clip(track_xy_mm[:, 0], 0.0, out_w_mm)
    track_xy_mm[:, 1] = np.clip(track_xy_mm[:, 1], 0.0, out_h_mm)

    # DEM ground elevation directly under the (unclamped) flight track,
    # for the "how high above the ground was the pilot" (AGL) mapping.
    ground_elev_m = dem_source.elevation_grid(flight.lats, flight.lons)

    return {
        "x_mm": x_mm, "y_mm": y_mm, "terrain_z": terrain_z, "res_mm": res_mm,
        "out_w_mm": out_w_mm, "out_h_mm": out_h_mm, "track_xy_mm": track_xy_mm,
        "ground_elev_m": ground_elev_m,
    }


def _resample_with_z(xy_mm: np.ndarray, z: np.ndarray, spacing_mm: float) -> tuple[np.ndarray, np.ndarray]:
    seg = np.linalg.norm(np.diff(xy_mm, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    total = cum[-1]
    if total <= 0:
        return xy_mm[:1], z[:1]
    n = max(2, int(total // spacing_mm) + 1)
    targets = np.linspace(0.0, total, n)
    x = np.interp(targets, cum, xy_mm[:, 0])
    y = np.interp(targets, cum, xy_mm[:, 1])
    zt = np.interp(targets, cum, z)
    return np.stack([x, y], axis=1), zt


def _build_tube_track(p: dict, g: dict, flight: _FlightData) -> np.ndarray:
    xy_mm, terrain_z = g["track_xy_mm"], g["terrain_z"]
    res_mm = g["res_mm"]
    terrain_at_track = geo.sample_grid_bilinear(terrain_z, res_mm, xy_mm[:, 0], xy_mm[:, 1])

    agl_m = np.clip(flight.alts - g["ground_elev_m"], 0.0, None)
    agl_norm = agl_m / (agl_m.max() + 1e-9)
    height_above = p["pillar_min_height_mm"] + agl_norm * (p["max_track_height_mm"] - p["pillar_min_height_mm"])
    z_track = terrain_at_track + height_above

    path3d = np.column_stack([xy_mm, z_track])
    tube = mesh.sweep_tube(path3d, radius=p["tube_radius_mm"], segments=10)

    pillar_xy, pillar_z_top = _resample_with_z(xy_mm, z_track, p["pillar_spacing_mm"])
    embed = p["ridge_embed_mm"]
    pillars = []
    for (px, py), z_top in zip(pillar_xy, pillar_z_top):
        z_ground = float(geo.sample_grid_bilinear(terrain_z, res_mm, [px], [py])[0])
        pillars.append(mesh.cylinder((float(px), float(py)), z_ground - embed,
                                      z_top + embed, p["pillar_radius_mm"]))

    return np.concatenate([tube, *pillars]).astype(np.float32)


def _build_plaque(p: dict, flight: _FlightData) -> np.ndarray:
    lat0, lon0 = float(np.mean(flight.lats)), float(np.mean(flight.lons))
    x, y = geo.project_local(flight.lats, flight.lons, lat0, lon0)
    seg = np.hypot(np.diff(x), np.diff(y))
    dist_m = np.concatenate([[0.0], np.cumsum(seg)])

    d = dist_m - dist_m.min()
    d_span = d.max() if d.max() > 0 else 1.0
    d_norm = d / d_span * p["plaque_max_width_mm"]

    a = flight.alts - flight.alts.min()
    a_span = a.max() if a.max() > 0 else 1.0
    profile_h = p["plaque_max_height_mm"] - p["plaque_base_mm"]
    a_norm = a / a_span * profile_h + p["plaque_base_mm"]

    top = np.stack([d_norm, a_norm], axis=1)
    outline = np.concatenate([top, [[d_norm[-1], 0.0], [d_norm[0], 0.0]]])
    return text.extrude_polygon_2d(outline, thickness=p["plaque_thickness_mm"])


def _flight_caption(flight: _FlightData) -> str:
    parts = []
    if flight.launch:
        label = flight.launch if not flight.landing else f"{flight.launch} -> {flight.landing}"
        parts.append(label)
    parts.append(f"{flight.distance_m / 1000.0:.1f}km")
    parts.append(f"max {flight.max_alt_m:.0f}m")
    if flight.duration_str:
        parts.append(flight.duration_str)
    if flight.date:
        parts.append(flight.date)
    return "  ".join(parts)


def build(params: dict) -> tuple[list[SolidMesh], dict, list[str]]:
    p = resolve_params(params)
    warnings: list[str] = []
    flight = _FlightData(p["flight_path"])
    if len(flight.lats) < 2:
        raise ValueError("flight: track needs at least 2 points")

    g = _build_terrain_grid(p, flight)
    x_mm, y_mm, terrain_z = g["x_mm"], g["y_mm"], g["terrain_z"]
    out_w_mm = g["out_w_mm"]

    objects: list[SolidMesh] = []

    if p["track_mode"] == "tube":
        track_tris = _build_tube_track(p, g, flight)
    else:
        res_mm = g["res_mm"]
        route_z = geo.sample_grid_bilinear(terrain_z, res_mm, g["track_xy_mm"][:, 0], g["track_xy_mm"][:, 1])
        track_tris = mesh.ribbon(g["track_xy_mm"], route_z, p["ridge_width_mm"],
                                  top_offset=p["ridge_height_mm"], bottom_offset=-p["ridge_embed_mm"])

    if p["emboss_text"]:
        try:
            font = text.load_font(font_path(p["text_font"]))
            caption = _flight_caption(flight)
            cap_tris, cap_w, skipped = text.emboss_text(caption, font, p["text_size_mm"], p["text_depth_mm"])
            if skipped:
                warnings.append(f"flight caption: dropped {len(skipped)} character(s) that failed "
                                 f"mesh validation ({''.join(skipped)!r})")
            if len(cap_tris):
                placed = cap_tris.copy()
                cx, cy, cz = cap_tris[:, :, 0], cap_tris[:, :, 1], cap_tris[:, :, 2]
                placed[:, :, 0] = cx - cap_w / 2.0 + out_w_mm / 2.0
                placed[:, :, 1] = -cz + 0.2
                placed[:, :, 2] = cy + max(p["min_base_thickness_mm"] - p["text_size_mm"], 0.3) / 2.0
                terrain_z_tris_extra = placed
            else:
                terrain_z_tris_extra = None
        except text.TextUnavailable as exc:
            warnings.append(str(exc) + " -- continuing without the caption")
            terrain_z_tris_extra = None
    else:
        terrain_z_tris_extra = None

    top = np.stack([x_mm, y_mm, terrain_z], axis=-1)
    bottom = np.stack([x_mm, y_mm, np.zeros_like(terrain_z)], axis=-1)
    terrain_tris = mesh.ruled_grid_solid(top, bottom, close_u=False)
    if terrain_z_tris_extra is not None:
        terrain_tris = np.concatenate([terrain_tris, terrain_z_tris_extra])

    objects.append(SolidMesh(name="terrain", triangles=terrain_tris.astype(np.float32),
                              color_hex=TERRAIN_COLOR, extruder=1, rate_class="default"))
    objects.append(SolidMesh(name="track", triangles=track_tris.astype(np.float32),
                              color_hex=TRACK_COLOR, extruder=2, rate_class="support"))

    if p["track_mode"] == "plaque":
        plaque_tris = _build_plaque(p, flight)
        objects.append(SolidMesh(name="altitude_plaque", triangles=plaque_tris.astype(np.float32),
                                  color_hex=TRACK_COLOR, extruder=2, rate_class="support"))

    return objects, p, warnings


def render_preview(p: dict, objects: list[SolidMesh], out_path: str) -> None:
    flight = _FlightData(p["flight_path"])
    g = _build_terrain_grid(p, flight)
    preview.hillshade_preview(g["terrain_z"], g["res_mm"], out_path, route_xy=g["track_xy_mm"])


def build_threemf(objects: list[SolidMesh], threemf_path: str) -> None:
    threemf.write_3mf(threemf_path, [
        threemf.ThreeMFObject(name=o.name, triangles=o.triangles, color_hex=o.color_hex, extruder=o.extruder)
        for o in objects
    ])
