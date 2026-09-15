"""Minimal, spec-compliant 3MF writer/reader.

Just the core 3MF spec (no vendor extensions): a 3-entry zip
([Content_Types].xml, _rels/.rels, 3D/3dmodel.model) with one
<object> per solid and colour communicated via <basematerials> +
per-object pid/pindex, which OrcaSlicer reads on import to offer
per-object AMS filament assignment.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from xml.sax.saxutils import escape

import numpy as np

_CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"

_CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
    '</Types>'
)

_RELS = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rel0" Target="/3D/3dmodel.model" '
    'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
    '</Relationships>'
)


@dataclass
class ThreeMFObject:
    name: str
    triangles: np.ndarray
    color_hex: str = "#CCCCCCFF"
    extruder: int = 1


def _dedupe_vertices(triangles: np.ndarray, precision: int = 4) -> tuple[np.ndarray, np.ndarray]:
    """(T, 3, 3) triangle soup -> (unique vertices, (T, 3) index triples).
    Same void-packing trick as meshcheck for a fast merge-by-rounding."""
    flat = triangles.reshape(-1, 3).astype(np.float64)
    scale = 10 ** precision
    keys = np.ascontiguousarray(np.round(flat * scale).astype(np.int64))
    packed = keys.view(np.dtype((np.void, keys.dtype.itemsize * 3))).reshape(-1)
    _, first_index, inverse = np.unique(packed, return_index=True, return_inverse=True)
    return flat[first_index], inverse.reshape(-1, 3)


def write_3mf(path: str, objects: list[ThreeMFObject], unit: str = "millimeter") -> None:
    if not objects:
        raise ValueError("write_3mf: at least one object is required")

    colors_seen: dict[str, int] = {}
    for obj in objects:
        colors_seen.setdefault(obj.color_hex, len(colors_seen))
    base_entries = "".join(
        f'<base name="Filament {i + 1}" displaycolor="{color}"/>'
        for color, i in sorted(colors_seen.items(), key=lambda kv: kv[1])
    )

    objects_xml = []
    items_xml = []
    object_id = 2  # id 1 is the basematerials resource
    for obj in objects:
        verts, idx = _dedupe_vertices(obj.triangles)
        pindex = colors_seen[obj.color_hex]
        vtx_xml = "".join(f'<vertex x="{v[0]:.4f}" y="{v[1]:.4f}" z="{v[2]:.4f}"/>' for v in verts)
        tri_xml = "".join(f'<triangle v1="{t[0]}" v2="{t[1]}" v3="{t[2]}"/>' for t in idx)
        objects_xml.append(
            f'<object id="{object_id}" type="model" pid="1" pindex="{pindex}" '
            f'name="{escape(obj.name)}"><mesh><vertices>{vtx_xml}</vertices>'
            f'<triangles>{tri_xml}</triangles></mesh></object>')
        items_xml.append(f'<item objectid="{object_id}"/>')
        object_id += 1

    model_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<model unit="{unit}" xml:lang="en-US" xmlns="{_CORE_NS}">'
        f'<resources><basematerials id="1">{base_entries}</basematerials>'
        f'{"".join(objects_xml)}</resources>'
        f'<build>{"".join(items_xml)}</build></model>'
    )

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _CONTENT_TYPES)
        zf.writestr("_rels/.rels", _RELS)
        zf.writestr("3D/3dmodel.model", model_xml)


def read_3mf(path: str) -> list[ThreeMFObject]:
    with zipfile.ZipFile(path) as zf:
        model_xml = zf.read("3D/3dmodel.model")
    ns = {"m": _CORE_NS}
    root = ET.fromstring(model_xml)

    colors_by_index: dict[int, str] = {}
    basematerials = root.find("m:resources/m:basematerials", ns)
    if basematerials is not None:
        for i, base in enumerate(basematerials.findall("m:base", ns)):
            colors_by_index[i] = base.attrib.get("displaycolor", "#CCCCCCFF")

    objects = []
    for obj_el in root.findall("m:resources/m:object", ns):
        pindex = int(obj_el.attrib.get("pindex", 0))
        mesh_el = obj_el.find("m:mesh", ns)
        verts = np.array(
            [[float(v.attrib["x"]), float(v.attrib["y"]), float(v.attrib["z"])]
             for v in mesh_el.find("m:vertices", ns).findall("m:vertex", ns)], dtype=np.float64)
        idx = np.array(
            [[int(t.attrib["v1"]), int(t.attrib["v2"]), int(t.attrib["v3"])]
             for t in mesh_el.find("m:triangles", ns).findall("m:triangle", ns)], dtype=np.int64)
        objects.append(ThreeMFObject(
            name=obj_el.attrib.get("name", ""),
            triangles=verts[idx].astype(np.float32),
            color_hex=colors_by_index.get(pindex, "#CCCCCCFF"),
        ))
    return objects
