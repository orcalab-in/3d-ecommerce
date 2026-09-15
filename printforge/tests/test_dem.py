import numpy as np
import pytest

from printforge import dem


def test_read_hgt_roundtrip(tmp_path):
    n = 5
    z = np.arange(n * n, dtype=">i2").reshape(n, n)
    path = tmp_path / "N37W123.hgt"
    z.tofile(path)
    tile = dem.read_hgt(str(path))
    assert tile.lat0 == 38.0
    assert tile.lon0 == -123.0
    assert tile.z[0, 0] == 0
    assert tile.z[-1, -1] == n * n - 1


def test_read_hgt_rejects_bad_filename(tmp_path):
    path = tmp_path / "not_a_tile.hgt"
    np.zeros((3, 3), dtype=">i2").tofile(path)
    with pytest.raises(ValueError):
        dem.read_hgt(str(path))


def test_read_aaigrid_parses_header_and_grid():
    text = (
        "ncols 3\nnrows 3\nxllcorner -122.0\nyllcorner 37.0\n"
        "cellsize 1.0\nNODATA_value -9999\n"
        "100 101 102\n110 111 112\n120 121 122\n"
    )
    tile = dem.read_aaigrid(text)
    assert tile.lat0 == 40.0
    assert tile.lon0 == -122.0
    assert tile.z.shape == (3, 3)
    assert tile.z[0, 0] == 100


def test_elevation_tile_covers():
    tile = dem.ElevationTile(z=np.zeros((5, 5)), lat0=38.0, lon0=-123.0, dlat=-0.25, dlon=0.25)
    assert tile.covers(np.array([37.5]), np.array([-122.5]))
    assert not tile.covers(np.array([50.0]), np.array([-122.5]))


def test_dem_source_uses_local_tile_over_remote(dem_dir, mock_opentopo):
    source = dem.DemSource(dem_dir=dem_dir, api_key="unused")
    z = source.elevation_grid(np.array([37.77]), np.array([-122.42]))
    assert z.shape == (1,)
    assert mock_opentopo["n"] == 0  # local tile covers it -- no network call


def test_dem_source_falls_back_to_opentopo_and_caches(tmp_path, mock_opentopo):
    source = dem.DemSource(dem_dir=str(tmp_path / "no_such_dir"),
                            cache_dir=str(tmp_path / "cache"), api_key="FAKEKEY")
    z1 = source.elevation_grid(np.array([37.77]), np.array([-122.42]))
    z2 = source.elevation_grid(np.array([37.77]), np.array([-122.42]))
    assert z1[0] == z2[0]
    assert mock_opentopo["n"] == 1  # second call was a cache hit


def test_dem_source_raises_without_local_tile_or_key(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENTOPO_KEY", raising=False)
    source = dem.DemSource(dem_dir=str(tmp_path / "no_such_dir"), api_key=None)
    with pytest.raises(dem.DemSourceUnavailable):
        source.elevation_grid(np.array([37.77]), np.array([-122.42]))
