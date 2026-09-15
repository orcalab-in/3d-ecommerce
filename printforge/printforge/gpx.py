"""Route parsing: GPX files and Strava activity JSON (latlng + altitude
streams), both used by the terrain product (and, for a GPX with
elevation, the paragliding flight product as a fallback to IGC)."""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from . import geo


@dataclass
class RoutePoint:
    lat: float
    lon: float
    ele: float | None = None
    time: str | None = None


@dataclass
class Route:
    points: list[RoutePoint]
    name: str | None = None
    start_date: str | None = None

    def lats(self) -> np.ndarray:
        return np.array([p.lat for p in self.points], dtype=np.float64)

    def lons(self) -> np.ndarray:
        return np.array([p.lon for p in self.points], dtype=np.float64)

    def eles(self) -> np.ndarray:
        return np.array([p.ele if p.ele is not None else 0.0 for p in self.points], dtype=np.float64)


def _local_tag(tag: str) -> str:
    return tag.split("}")[-1]


def parse_gpx(path: str) -> Route:
    tree = ET.parse(path)
    root = tree.getroot()
    name = None
    points: list[RoutePoint] = []
    for el in root.iter():
        tag = _local_tag(el.tag)
        if tag == "name" and name is None and (el.text or "").strip():
            name = el.text.strip()
        elif tag == "trkpt":
            lat, lon = float(el.attrib["lat"]), float(el.attrib["lon"])
            ele, time = None, None
            for child in el:
                ctag = _local_tag(child.tag)
                if ctag == "ele" and child.text:
                    ele = float(child.text)
                elif ctag == "time" and child.text:
                    time = child.text.strip()
            points.append(RoutePoint(lat, lon, ele, time))
    if not points:
        raise ValueError(f"{path}: no <trkpt> elements found")
    start_date = points[0].time
    return Route(points=points, name=name, start_date=start_date)


def parse_strava_json(path: str) -> Route:
    with open(path) as f:
        data = json.load(f)
    latlng = data.get("latlng")
    if latlng is None:
        raise ValueError(f"{path}: no 'latlng' stream found")
    altitude = data.get("altitude") or []
    points = [
        RoutePoint(lat=float(ll[0]), lon=float(ll[1]),
                   ele=float(altitude[i]) if i < len(altitude) else None)
        for i, ll in enumerate(latlng)
    ]
    return Route(points=points, name=data.get("name"), start_date=data.get("start_date"))


def load_route(path: str) -> Route:
    """Dispatch on extension, falling back to content sniffing."""
    lower = path.lower()
    if lower.endswith(".gpx"):
        return parse_gpx(path)
    if lower.endswith(".json"):
        return parse_strava_json(path)
    with open(path, "r", errors="ignore") as f:
        head = f.read(256).lstrip()
    return parse_gpx(path) if head.startswith("<") else parse_strava_json(path)


def route_local_xy(route: Route, lat0: float, lon0: float) -> np.ndarray:
    x, y = geo.project_local(route.lats(), route.lons(), lat0, lon0)
    return np.stack([x, y], axis=1)


def route_distance_m(route: Route) -> float:
    lat0, lon0 = float(np.mean(route.lats())), float(np.mean(route.lons()))
    xy = route_local_xy(route, lat0, lon0)
    if len(xy) < 2:
        return 0.0
    return float(np.sum(np.linalg.norm(np.diff(xy, axis=0), axis=1)))


def route_elevation_gain_m(route: Route) -> float:
    eles = route.eles()
    if len(eles) < 2:
        return 0.0
    diffs = np.diff(eles)
    return float(np.sum(diffs[diffs > 0]))


def route_date(route: Route) -> str | None:
    """A plain YYYY-MM-DD, from the route's start_date/first timestamp."""
    raw = route.start_date
    if not raw:
        return None
    try:
        cleaned = raw.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned).astimezone(timezone.utc).date().isoformat()
    except ValueError:
        return raw[:10] if len(raw) >= 10 else raw
