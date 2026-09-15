import os

import numpy as np
import pytest

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")

# samples/sample.gpx is a small loop centered near lat=37.7749, lon=-122.4194
# (see scripts/generate_samples.py) -- N37W123.hgt covers that exactly.
_HGT_LAT_SW, _HGT_LON_SW = 37, -123


@pytest.fixture
def sample_photo():
    return os.path.join(SAMPLES_DIR, "test_photo.jpg")


@pytest.fixture
def sample_gpx():
    return os.path.join(SAMPLES_DIR, "sample.gpx")


@pytest.fixture
def sample_igc():
    return os.path.join(SAMPLES_DIR, "sample.igc")


@pytest.fixture
def dem_dir(tmp_path):
    """A tiny synthetic, deterministic SRTM-style .hgt tile covering
    samples/sample.gpx's route, written to a tmp dem/ directory."""
    n = 25
    lats = np.linspace(_HGT_LAT_SW + 1.0, _HGT_LAT_SW, n)
    lons = np.linspace(_HGT_LON_SW, _HGT_LON_SW + 1.0, n)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    z = 30 + 20 * np.sin((lat_grid - 37.77) * 300) * np.cos((lon_grid + 122.42) * 300)
    path = tmp_path / "dem"
    path.mkdir()
    z.astype(">i2").tofile(path / f"N{_HGT_LAT_SW}W{abs(_HGT_LON_SW)}.hgt")
    return str(path)


@pytest.fixture
def flight_dem_dir(tmp_path):
    """A tiny synthetic .hgt tile covering samples/sample.igc's flight
    (see scripts/generate_samples.py: lat0=46.52, lon0=8.05)."""
    n = 25
    lat_sw, lon_sw = 46, 8
    lats = np.linspace(lat_sw + 1.0, lat_sw, n)
    lons = np.linspace(lon_sw, lon_sw + 1.0, n)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    z = 1300 + 150 * np.sin((lat_grid - 46.52) * 100) * np.cos((lon_grid - 8.06) * 100)
    path = tmp_path / "flight_dem"
    path.mkdir()
    z.astype(">i2").tofile(path / f"N{lat_sw}E{lon_sw:03d}.hgt")
    return str(path)


@pytest.fixture
def mock_opentopo(monkeypatch):
    """Patch dem.http_get to return a small canned AAIGrid tile instead
    of making a real network call; also tracks call count so tests can
    assert the disk cache avoids a second fetch for the same bbox."""
    from printforge import dem

    canned = (
        "ncols 5\nnrows 5\nxllcorner -122.44\nyllcorner 37.76\n"
        "cellsize 0.02\nNODATA_value -9999\n"
        "40 41 42 43 44\n39 40 41 42 43\n38 39 40 41 42\n37 38 39 40 41\n36 37 38 39 40\n"
    ).encode()
    calls = {"n": 0}

    def fake_http_get(url, timeout=30):
        calls["n"] += 1
        return canned

    monkeypatch.setattr(dem, "http_get", fake_http_get)
    return calls
