# printforge

The model-generation engine for an automated 3D-print gifting business: a Python package + CLI that turns customer input (a photo, a Strava/GPX route, an IGC flight log, a name) into print-ready STL/3MF files for a Bambu Lab A1 (256 x 256 x 256mm, 0.4mm nozzle, AMS Lite). No web UI, no printer control, no slicing -- every output is meant to open in OrcaSlicer without repair.

## Install

```bash
cd printforge
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[test,fonts]"        # add "dem" for local GeoTIFF support (rasterio)
pytest tests -q                        # 91 tests, fully offline
```

Hard dependencies are numpy and Pillow only. `fonttools` (text embossing quality), `rasterio` (local GeoTIFF DEM tiles) and `shapely` are optional -- every feature that needs them degrades gracefully with a clear message if they're missing (see `docs/DECISIONS.md`).

## Usage

CLI:
```bash
printforge <product> <input> [--key value ...] --out <prefix>
# e.g.
printforge photo_lamp photo.jpg --size M --caption "Hi Mom" --out orders/ORD123
printforge terrain run.gpx --route-variant ridge --emboss-text --out orders/ORD124
printforge flight flight.igc --track-mode plaque --out orders/ORD125
printforge led_base "Alex" --form name_lamp --out orders/ORD126
```

Python API (what the website backend calls):
```python
from printforge import generate

result = generate("photo_lamp", {"image": "photo.jpg", "size": "M"}, out="orders/ORD123")
result.to_dict()   # JSON-serializable: file paths, grams, print time, warnings
```

See `docs/PRODUCTS.md` for every parameter, its default, and its valid range (generated from each product's `PARAM_SPEC` -- run `python scripts/gen_products_doc.py` after changing any product's parameters). See `docs/DECISIONS.md` for every physical design decision that was made without an explicit spec value, and why.

## Products

| Product | What it makes |
|---|---|
| `photo_lamp` | Flat lithophane panel + slot stand + LED backboard, S/M/L, optional caption/rounded corners |
| `lithophane` | Standalone panel family: flat+hole, curved (cylinder segment), full cylinder wrap (1-4 photos), keychain |
| `terrain` | Terrain relief tile + a Strava/GPX route, as a raised 2-colour ridge or an inlaid single-colour channel |
| `flight` | Terrain relief + a paragliding flight track, as a supported 3D tube or a projected ridge + altitude plaque |
| `led_base` | Puck base, backlit box frame, or a name-plate lamp -- lights any of the above |

## Print settings (Bambu Lab A1, 0.4mm nozzle)

Every object lists which AMS slot it expects; multi-object jobs export a combined `.3mf` (terrain/flight products) with per-object colour already set so OrcaSlicer offers the right slot on import, or separate `.stl` files (photo_lamp/lithophane/led_base) meant to be arranged on one plate.

| Product | Object | Layer height | Infill | Walls | Orientation | AMS slot |
|---|---|---|---|---|---|---|
| `photo_lamp` | panel | 0.12mm | 100% (solid; wall count irrelevant) | -- | Flat, image side up | 1 -- white/translucent PLA |
| | stand | 0.20mm | 15% | 3 | Flat, floor down | 2 -- any colour |
| | ledboard | 0.20mm | 15-20% | 2 | Flat | 2 -- any colour, or black |
| `lithophane` (flat_hole, keychain) | panel | 0.12mm | 100% | -- | Flat, image side up | 1 -- white/translucent PLA |
| `lithophane` (curved, cylinder) | panel | 0.12mm | 100% | -- | **Cylinder axis vertical** (thickness modulates radius, never an overhang at any arc/radius) | 1 -- white/translucent PLA |
| `terrain` | terrain | 0.20mm | 15-20% | 3 | Flat, floor down | 1 |
| | route | (same print as terrain) | -- | -- | (embedded 0.2mm into the terrain, prints as part of the same job) | 2 |
| `flight` (track_mode=plaque, default) | terrain | 0.20mm | 15-20% | 3 | Flat, floor down | 1 |
| | track | (same print as terrain) | -- | -- | (raised ridge, embedded into terrain) | 2 |
| | altitude_plaque | 0.20mm | 20% | 2 | **Flat on the bed** (never stood up -- zero overhang risk) | 2 (separate plate from the terrain) |
| `flight` (track_mode=tube) | terrain | 0.20mm | 15-20% | 3 | Flat, floor down | 1 |
| | track (tube + pillars) | (same print as terrain) | -- | -- | Printed as designed; verify pillar spacing against the specific flight's terrain clearance before a production run | 2 |
| `led_base` (puck) | base | 0.20mm | 15% | 3 | Flat, floor down | 2 -- any colour |
| `led_base` (backlit_box) | base | 0.20mm | 15% | 3 | Flat, floor down | 2 -- any colour |
| `led_base` (name_lamp) | plate | 0.16mm | 100% (thin, for edge-lit clarity) | -- | As designed, standing on the base's bottom edge | 1 -- clear/white PLA |
| | base | 0.20mm | 15% | 3 | Flat, floor down | 2 -- any colour |

General notes:
- No object in this package needs supports when printed in the orientation listed -- that's a hard requirement enforced by construction (see `docs/DECISIONS.md` for how each product's geometry avoids overhangs), not just a suggestion.
- Panels are printed at fine layers and full infill because they're the customer-facing optical/structural element (a lithophane's contrast comes from consistent, solid, thin-walled printing); everything else (stands, bases, boxes) is a support structure and prints faster/cheaper at coarser settings.
- 3MF colour assignment uses core-spec `<basematerials>`/`pindex`, which OrcaSlicer maps to AMS filament slots on import -- confirm the mapping in OrcaSlicer's object list before slicing, since slot *numbers* are assigned by import order, not guaranteed identical to the `extruder` field name.
