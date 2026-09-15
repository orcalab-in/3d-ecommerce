"""IGC flight-log parsing (the standard paragliding/gliding logger
format): B-records for the track (time, lat, lon, pressure + GPS
altitude), H-records for the header (pilot, glider, launch site, date).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np

from . import geo


@dataclass
class FlightPoint:
    time_s: int  # seconds since UTC midnight
    lat: float
    lon: float
    alt_baro: float
    alt_gps: float


@dataclass
class Flight:
    points: list[FlightPoint]
    pilot: str | None = None
    glider: str | None = None
    launch_site: str | None = None
    landing_site: str | None = None
    date: str | None = None  # YYYY-MM-DD

    def lats(self) -> np.ndarray:
        return np.array([p.lat for p in self.points], dtype=np.float64)

    def lons(self) -> np.ndarray:
        return np.array([p.lon for p in self.points], dtype=np.float64)

    def alts_gps(self) -> np.ndarray:
        return np.array([p.alt_gps for p in self.points], dtype=np.float64)


def _parse_lat(s: str) -> float:
    deg, minutes, frac = int(s[0:2]), int(s[2:4]), int(s[4:7])
    val = deg + (minutes + frac / 1000.0) / 60.0
    return val if s[7] == "N" else -val


def _parse_lon(s: str) -> float:
    deg, minutes, frac = int(s[0:3]), int(s[3:5]), int(s[5:8])
    val = deg + (minutes + frac / 1000.0) / 60.0
    return val if s[8] == "E" else -val


def _parse_header(line: str) -> tuple[str, str] | None:
    if len(line) < 5:
        return None
    code = line[2:5].upper()
    rest = line[5:]
    value = rest.split(":", 1)[1].strip() if ":" in rest else rest.strip()
    return code, value


def parse_igc(path: str) -> Flight:
    points: list[FlightPoint] = []
    pilot = glider = launch_site = landing_site = date = None

    with open(path, "r", errors="ignore") as f:
        for raw in f:
            line = raw.rstrip("\r\n")
            if not line:
                continue
            kind = line[0]
            if kind == "H":
                parsed = _parse_header(line)
                if parsed is None:
                    continue
                code, value = parsed
                if code == "DTE":
                    digits = re.sub(r"[^0-9]", "", value)[:6]
                    if len(digits) == 6:
                        dd, mm, yy = digits[0:2], digits[2:4], digits[4:6]
                        year = 2000 + int(yy) if int(yy) < 80 else 1900 + int(yy)
                        date = f"{year:04d}-{mm}-{dd}"
                elif code == "PLT" and value:
                    pilot = value
                elif code == "GTY" and value:
                    glider = value
                elif code == "SIT" and value:
                    launch_site = value
                elif code == "LDG" and value:
                    landing_site = value
            elif kind == "B" and len(line) >= 35:
                try:
                    hh, mm, ss = int(line[1:3]), int(line[3:5]), int(line[5:7])
                    lat = _parse_lat(line[7:15])
                    lon = _parse_lon(line[15:24])
                    baro = int(line[25:30])
                    gps = int(line[30:35])
                except ValueError:
                    continue
                points.append(FlightPoint(hh * 3600 + mm * 60 + ss, lat, lon, float(baro), float(gps)))

    if not points:
        raise ValueError(f"{path}: no valid B-records found")
    return Flight(points=points, pilot=pilot, glider=glider,
                  launch_site=launch_site, landing_site=landing_site, date=date)


def flight_local_xy(flight: Flight, lat0: float, lon0: float) -> np.ndarray:
    x, y = geo.project_local(flight.lats(), flight.lons(), lat0, lon0)
    return np.stack([x, y], axis=1)


def flight_distance_m(flight: Flight) -> float:
    lat0, lon0 = float(np.mean(flight.lats())), float(np.mean(flight.lons()))
    xy = flight_local_xy(flight, lat0, lon0)
    if len(xy) < 2:
        return 0.0
    return float(np.sum(np.linalg.norm(np.diff(xy, axis=0), axis=1)))


def flight_max_altitude_m(flight: Flight) -> float:
    return float(np.max(flight.alts_gps())) if flight.points else 0.0


def flight_duration_s(flight: Flight) -> int:
    if len(flight.points) < 2:
        return 0
    dt = flight.points[-1].time_s - flight.points[0].time_s
    return dt if dt >= 0 else dt + 24 * 3600  # crossed UTC midnight


def flight_duration_str(flight: Flight) -> str:
    total = flight_duration_s(flight)
    h, m = total // 3600, (total % 3600) // 60
    return f"{h}h{m:02d}m" if h else f"{m}m"
