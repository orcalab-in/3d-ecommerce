# printforge parameter reference

Generated from each product module's `PARAM_SPEC` by `scripts/gen_products_doc.py` -- run it again after changing any product's parameters rather than hand-editing this file.

CLI usage: `printforge <product> <input> [--key value ...] --out <prefix>`. Booleans are flags (`--markers` sets true; `--markers false` also works). The Python API takes the same keys in a `params` dict: `printforge.generate(product, params, out)`.

## Photo lamp (`photo_lamp`)

CLI positional input (`--image` / first arg): a photo (jpg/png)

| Parameter | Type | Default | Range / choices | Notes |
|---|---|---|---|---|
| `size` | enum | M | S / M / L | S 80x100, M 100x130, L 150x200 mm |
| `res_mm` | float | 0.2 | 0.1 - 0.4 |  |
| `min_thickness_mm` | float | 0.6 | 0.4 - 1.2 |  |
| `max_thickness_mm` | float | 3.0 | 1.5 - 4.0 |  |
| `gamma` | float | 1.0 | 0.4 - 2.5 |  |
| `border_mm` | float | 3.0 | 0.0 - 10.0 |  |
| `corner_radius_mm` | float | 0.0 | 0.0 - 20.0 |  |
| `caption` | str |  |  | optional text embossed on the stand front |
| `caption_font` | enum | OpenSans | OpenSans / Pacifico |  |
| `caption_size_mm` | float | 6.0 | 3.0 - 12.0 |  |
| `caption_depth_mm` | float | 0.6 | 0.3 - 1.5 |  |
| `led_board_thickness_mm` | float | 2.0 | 1.0 - 3.0 |  |
| `stand_gap_mm` | float | 10.0 | 5.0 - 25.0 |  |
| `stand_depth_mm` | float | 36.0 | 25.0 - 60.0 |  |
| `stand_height_mm` | float | 15.0 | 10.0 - 30.0 |  |
| `stand_floor_mm` | float | 5.0 | 3.0 - 10.0 |  |
| `slot_clearance_mm` | float | 0.4 | 0.1 - 1.0 |  |

## Lithophane panel family (`lithophane`)

CLI positional input (`--image` / first arg): a photo (jpg/png)

| Parameter | Type | Default | Range / choices | Notes |
|---|---|---|---|---|
| `form` | enum | flat_hole | flat_hole / curved / cylinder / keychain |  |
| `res_mm` | float | 0.2 | 0.1 - 0.4 |  |
| `min_thickness_mm` | float | 0.6 | 0.4 - 1.2 |  |
| `max_thickness_mm` | float | 3.0 | 1.5 - 4.0 |  |
| `gamma` | float | 1.0 | 0.4 - 2.5 |  |
| `border_mm` | float | 3.0 | 0.0 - 10.0 |  |
| `width_mm` | float | 100.0 | 40.0 - 240.0 | flat_hole form only |
| `max_height_mm` | float | 130.0 | 40.0 - 240.0 | flat_hole form only |
| `hole_diameter_mm` | float | 4.0 | 2.0 - 10.0 |  |
| `hole_margin_mm` | float | 6.0 | 3.0 - 20.0 |  |
| `radius_mm` | float | 60.0 | 20.0 - 150.0 | curved form only |
| `arc_deg` | float | 120.0 | 90.0 - 180.0 | curved form only |
| `curved_height_mm` | float | 100.0 | 40.0 - 240.0 |  |
| `cylinder_radius_mm` | float | 35.0 | 15.0 - 120.0 | cylinder form only; puck/tea-light diameter = 2x this |
| `cylinder_height_mm` | float | 80.0 | 20.0 - 240.0 |  |
| `num_photos` | int | 1 | 1 - 4 |  |
| `images` | str |  |  | comma-separated extra photo paths, cylinder form with num_photos > 1 |
| `keychain_width_mm` | float | 40.0 |  |  |
| `keychain_height_mm` | float | 50.0 |  |  |
| `keychain_hole_diameter_mm` | float | 4.0 | 2.0 - 8.0 |  |
| `keychain_hole_margin_mm` | float | 5.0 | 3.0 - 10.0 |  |

## Terrain map + Strava/GPX running line (`terrain`)

CLI positional input (`--route_path` / first arg): a GPX file, or a Strava activity JSON with latlng/altitude streams

| Parameter | Type | Default | Range / choices | Notes |
|---|---|---|---|---|
| `margin_frac` | float | 0.12 | 0.0 - 0.5 |  |
| `footprint_mm` | float | 150.0 | 60.0 - 240.0 |  |
| `max_footprint_mm` | float | 240.0 | 60.0 - 240.0 |  |
| `exaggeration` | float | 1.5 | 1.0 - 4.0 |  |
| `min_base_thickness_mm` | float | 4.0 | 2.0 - 10.0 |  |
| `terrain_res_mm` | float | 1.0 | 0.4 - 2.0 |  |
| `route_variant` | enum | ridge | ridge / channel |  |
| `ridge_width_mm` | float | 1.5 | 0.8 - 3.0 |  |
| `ridge_height_mm` | float | 1.2 | 0.6 - 3.0 |  |
| `ridge_embed_mm` | float | 0.2 | 0.1 - 0.5 |  |
| `channel_depth_mm` | float | 0.8 | 0.3 - 1.5 |  |
| `markers` | bool | False |  |  |
| `marker_radius_mm` | float | 1.5 | 0.8 - 3.0 |  |
| `marker_height_mm` | float | 3.0 | 1.5 - 6.0 |  |
| `emboss_text` | bool | False |  |  |
| `text_size_mm` | float | 2.5 | 1.5 - 5.0 |  |
| `text_depth_mm` | float | 0.5 | 0.3 - 1.0 |  |
| `text_font` | enum | OpenSans | OpenSans / Pacifico |  |
| `dem_dir` | str | dem |  |  |
| `dem_cache_dir` | str | .cache/printforge/dem |  |  |
| `opentopo_dataset` | enum | SRTMGL1 | SRTMGL1 / COP30 |  |
| `opentopo_key` | str | None |  |  |

## Paragliding flight terrain + track (`flight`)

CLI positional input (`--flight_path` / first arg): an IGC flight log, or a GPX file with elevation

| Parameter | Type | Default | Range / choices | Notes |
|---|---|---|---|---|
| `margin_frac` | float | 0.15 | 0.0 - 0.5 |  |
| `footprint_mm` | float | 150.0 | 60.0 - 240.0 |  |
| `max_footprint_mm` | float | 240.0 | 60.0 - 240.0 |  |
| `exaggeration` | float | 1.5 | 1.0 - 4.0 |  |
| `min_base_thickness_mm` | float | 4.0 | 2.0 - 10.0 |  |
| `terrain_res_mm` | float | 1.0 | 0.4 - 2.0 |  |
| `track_mode` | enum | plaque | plaque / tube |  |
| `ridge_width_mm` | float | 1.5 | 0.8 - 3.0 |  |
| `ridge_height_mm` | float | 1.2 | 0.6 - 3.0 |  |
| `ridge_embed_mm` | float | 0.2 | 0.1 - 0.5 |  |
| `tube_radius_mm` | float | 1.5 | 0.8 - 3.0 |  |
| `pillar_radius_mm` | float | 0.8 | 0.5 - 1.5 |  |
| `pillar_spacing_mm` | float | 15.0 | 5.0 - 40.0 |  |
| `pillar_min_height_mm` | float | 3.0 | 1.0 - 10.0 |  |
| `max_track_height_mm` | float | 70.0 | 20.0 - 150.0 |  |
| `plaque_max_width_mm` | float | 150.0 | 60.0 - 240.0 |  |
| `plaque_max_height_mm` | float | 40.0 | 15.0 - 80.0 |  |
| `plaque_thickness_mm` | float | 2.5 | 1.5 - 4.0 |  |
| `plaque_base_mm` | float | 4.0 | 2.0 - 8.0 |  |
| `emboss_text` | bool | False |  |  |
| `text_size_mm` | float | 2.5 | 1.5 - 5.0 |  |
| `text_depth_mm` | float | 0.5 | 0.3 - 1.0 |  |
| `text_font` | enum | OpenSans | OpenSans / Pacifico |  |
| `dem_dir` | str | dem |  |  |
| `dem_cache_dir` | str | .cache/printforge/dem |  |  |
| `opentopo_dataset` | enum | SRTMGL1 | SRTMGL1 / COP30 |  |
| `opentopo_key` | str | None |  |  |

## Lamp / LED base family (`led_base`)

CLI positional input (`--name` / first arg): the name to emboss (form=name_lamp only; ignored for puck/backlit_box)

| Parameter | Type | Default | Range / choices | Notes |
|---|---|---|---|---|
| `form` | enum | puck | puck / backlit_box / name_lamp |  |
| `res_mm` | float | 0.5 | 0.2 - 1.0 |  |
| `slot_clearance_mm` | float | 0.4 | 0.1 - 1.0 |  |
| `cable_channel_mm` | float | 5.0 | 3.0 - 10.0 |  |
| `puck_radius_mm` | float | 25.0 | 18.0 - 60.0 |  |
| `puck_height_mm` | float | 15.0 | 8.0 - 30.0 |  |
| `led_coil_diameter_mm` | float | 30.0 | 20.0 - 50.0 |  |
| `recess_depth_mm` | float | 4.0 | 2.0 - 8.0 |  |
| `box_width_mm` | float | 110.0 | 60.0 - 240.0 |  |
| `box_depth_mm` | float | 40.0 | 25.0 - 60.0 |  |
| `panel_thickness_mm` | float | 3.0 | 1.5 - 4.0 |  |
| `led_board_thickness_mm` | float | 2.0 | 1.0 - 3.0 |  |
| `diffuser_gap_mm` | float | 10.0 | 5.0 - 20.0 |  |
| `box_floor_mm` | float | 5.0 | 3.0 - 10.0 |  |
| `box_wall_height_mm` | float | 15.0 | 10.0 - 30.0 |  |
| `name` | str | NAME |  |  |
| `font` | enum | OpenSans | OpenSans / Pacifico |  |
| `text_height_mm` | float | 25.0 | 10.0 - 60.0 |  |
| `plate_thickness_mm` | float | 3.0 | 2.0 - 5.0 |  |
| `name_lamp_margin_mm` | float | 15.0 | 8.0 - 30.0 |  |
| `name_lamp_base_depth_mm` | float | 30.0 | 20.0 - 50.0 |  |
| `name_lamp_base_height_mm` | float | 15.0 | 10.0 - 25.0 |  |
| `name_lamp_base_floor_mm` | float | 5.0 | 3.0 - 10.0 |  |
