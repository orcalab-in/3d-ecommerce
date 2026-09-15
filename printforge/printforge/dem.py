"""Elevation data: local SRTM/Copernicus .hgt tiles (pure numpy), local
GeoTIFF (optional rasterio), or OpenTopography's Global DEM API.

The network path deliberately requests AAIGrid (a trivial text format)
rather than GeoTIFF, so fetched tiles never need rasterio even though
local GeoTIFF support optionally does -- keeps the numpy+Pillow-only
promise intact for the online path.
"""
from __future__ import annotations

import os
import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


class DemBackendUnavailable(Exception):
    """A DEM source needs an optional dependency that isn't installed."""


class DemSourceUnavailable(Exception):
    """No DEM data is available for the requested area."""


@dataclass
class ElevationTile:
    z: np.ndarray       # (ny, nx) meters; row 0 = NORTH edge, col 0 = WEST edge
    lat0: float          # latitude of row 0
    lon0: float          # longitude of col 0
    dlat: float           # degrees per row, negative (south is +row)
    dlon: float           # degrees per col, positive (east is +col)

    def sample(self, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        lats = np.asarray(lats, dtype=np.float64)
        lons = np.asarray(lons, dtype=np.float64)
        ny, nx = self.z.shape
        fy = np.clip((lats - self.lat0) / self.dlat, 0.0, ny - 1 - 1e-9)
        fx = np.clip((lons - self.lon0) / self.dlon, 0.0, nx - 1 - 1e-9)
        y0, x0 = np.floor(fy).astype(np.int64), np.floor(fx).astype(np.int64)
        y1, x1 = y0 + 1, x0 + 1
        ty, tx = fy - y0, fx - x0
        z00, z10 = self.z[y0, x0], self.z[y0, x1]
        z01, z11 = self.z[y1, x0], self.z[y1, x1]
        return (z00 * (1 - tx) * (1 - ty) + z10 * tx * (1 - ty)
                + z01 * (1 - tx) * ty + z11 * tx * ty)

    def covers(self, lats: np.ndarray, lons: np.ndarray) -> bool:
        ny, nx = self.z.shape
        lat_max, lat_min = self.lat0, self.lat0 + self.dlat * (ny - 1)
        lon_min, lon_max = self.lon0, self.lon0 + self.dlon * (nx - 1)
        return bool(lat_min <= np.min(lats) and np.max(lats) <= lat_max
                    and lon_min <= np.min(lons) and np.max(lons) <= lon_max)


def _parse_hgt_filename(path: str) -> tuple[float, float]:
    name = Path(path).stem.upper()
    m = re.match(r"^([NS])(\d{2})([EW])(\d{3})$", name)
    if not m:
        raise ValueError(f"{path}: filename doesn't match SRTM convention (e.g. N33W118.hgt)")
    ns, lat_str, ew, lon_str = m.groups()
    lat = int(lat_str) * (1 if ns == "N" else -1)
    lon = int(lon_str) * (1 if ew == "E" else -1)
    return float(lat), float(lon)


def read_hgt(path: str) -> ElevationTile:
    """Pure-numpy SRTM .hgt reader: raw big-endian i16, square grid
    (1201^2 for SRTM3, 3601^2 for SRTM1), void = -32768."""
    data = np.fromfile(path, dtype=">i2")
    n = int(round(np.sqrt(len(data))))
    if n * n != len(data):
        raise ValueError(f"{path}: not a square SRTM grid ({len(data)} samples)")
    z = data.reshape(n, n).astype(np.float64)
    z[z <= -32768] = np.nan
    lat_sw, lon_sw = _parse_hgt_filename(path)
    return ElevationTile(z=z, lat0=lat_sw + 1.0, lon0=lon_sw, dlat=-1.0 / (n - 1), dlon=1.0 / (n - 1))


def read_aaigrid(source: str | bytes) -> ElevationTile:
    """Arc/Info ASCII Grid (OpenTopography's outputFormat=AAIGrid): a
    text header (ncols/nrows/xllcorner/yllcorner/cellsize/NODATA_value)
    followed by nrows rows of ncols floats, row 0 = north. `source` is
    either a file path or the raw text/bytes already in memory."""
    if isinstance(source, bytes):
        text = source.decode("utf-8")
    elif "\n" in source:
        text = source
    else:
        with open(source) as f:
            text = f.read()

    lines = text.strip().splitlines()
    header: dict[str, float] = {}
    i = 0
    header_keys = {"ncols", "nrows", "xllcorner", "yllcorner", "xllcenter", "yllcenter",
                    "cellsize", "nodata_value"}
    while i < len(lines):
        parts = lines[i].split()
        if len(parts) == 2 and parts[0].lower() in header_keys:
            header[parts[0].lower()] = float(parts[1])
            i += 1
        else:
            break

    nrows, ncols = int(header["nrows"]), int(header["ncols"])
    cellsize = header["cellsize"]
    xll = header.get("xllcorner", header.get("xllcenter"))
    yll = header.get("yllcorner", header.get("yllcenter"))
    nodata = header.get("nodata_value", -9999.0)

    values = np.array(" ".join(lines[i:]).split(), dtype=np.float64)
    z = values[: nrows * ncols].reshape(nrows, ncols)
    z[z == nodata] = np.nan
    return ElevationTile(z=z, lat0=yll + nrows * cellsize, lon0=xll, dlat=-cellsize, dlon=cellsize)


def http_get(url: str, timeout: int = 30) -> bytes:
    """Thin stdlib HTTP wrapper -- the single seam tests mock to avoid
    real network access."""
    with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


def fetch_opentopo(bbox: dict, dataset: str = "SRTMGL1", api_key: str | None = None,
                    cache_dir: str = ".cache/printforge/dem") -> Path:
    """Fetch (or return the cached copy of) an AAIGrid tile covering
    bbox = {south, north, west, east} from OpenTopography's Global DEM
    API. Caching is keyed on the rounded bbox + dataset."""
    south, north, west, east = bbox["south"], bbox["north"], bbox["west"], bbox["east"]
    cache_key = f"{dataset}_{south:.4f}_{north:.4f}_{west:.4f}_{east:.4f}.asc"
    cache_path = Path(cache_dir) / cache_key
    if cache_path.exists():
        return cache_path
    url = (f"https://portal.opentopography.org/API/globaldem?demtype={dataset}"
           f"&south={south}&north={north}&west={west}&east={east}"
           f"&outputFormat=AAIGrid&API_Key={api_key or ''}")
    data = http_get(url)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return cache_path


@dataclass
class DemSource:
    """Resolves elevation for a route: checks dem_dir for a local tile
    that covers the route first, falls back to OpenTopography (needs
    OPENTOPO_KEY, read from the environment unless passed explicitly)."""
    dem_dir: str = "dem"
    cache_dir: str = ".cache/printforge/dem"
    api_key: str | None = None
    dataset: str = "SRTMGL1"
    margin_deg: float = 0.02

    def __post_init__(self) -> None:
        if self.api_key is None:
            self.api_key = os.environ.get("OPENTOPO_KEY")

    def elevation_grid(self, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        tile = self._find_local_tile(lats, lons) or self._fetch_remote_tile(lats, lons)
        z = tile.sample(lats, lons)
        if np.isnan(z).any():
            fill = float(np.nanmean(tile.z)) if not np.all(np.isnan(tile.z)) else 0.0
            z = np.nan_to_num(z, nan=fill)
        return z

    def _find_local_tile(self, lats: np.ndarray, lons: np.ndarray) -> ElevationTile | None:
        dem_path = Path(self.dem_dir)
        if not dem_path.exists():
            return None
        candidates = sorted(dem_path.glob("*.hgt")) + sorted(dem_path.glob("*.tif")) \
            + sorted(dem_path.glob("*.tiff"))
        for path in candidates:
            try:
                tile = self._read_local(path)
            except Exception:
                continue
            if tile.covers(lats, lons):
                return tile
        return None

    def _read_local(self, path: Path) -> ElevationTile:
        if path.suffix.lower() == ".hgt":
            return read_hgt(str(path))
        try:
            import rasterio  # noqa: PLC0415
        except ImportError as exc:
            raise DemBackendUnavailable(
                f"{path}: reading GeoTIFF needs rasterio (pip install rasterio), "
                "or use .hgt tiles / set OPENTOPO_KEY") from exc
        with rasterio.open(path) as ds:
            z = ds.read(1).astype(np.float64)
            transform = ds.transform
            return ElevationTile(z=z, lat0=transform.f, lon0=transform.c,
                                  dlat=transform.e, dlon=transform.a)

    def _fetch_remote_tile(self, lats: np.ndarray, lons: np.ndarray) -> ElevationTile:
        if not self.api_key:
            raise DemSourceUnavailable(
                "no local DEM tile in dem/ covers this route, and OPENTOPO_KEY is not "
                "set -- add a covering .hgt/.tif to dem/, or set the OPENTOPO_KEY env var")
        m = self.margin_deg
        bbox = {"south": float(np.min(lats)) - m, "north": float(np.max(lats)) + m,
                "west": float(np.min(lons)) - m, "east": float(np.max(lons)) + m}
        path = fetch_opentopo(bbox, dataset=self.dataset, api_key=self.api_key, cache_dir=self.cache_dir)
        return read_aaigrid(str(path))
