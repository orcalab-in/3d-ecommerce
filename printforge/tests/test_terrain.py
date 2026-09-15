import pytest

from printforge import api, meshcheck, stl_io, threemf


def _assert_watertight_job(result):
    for obj in result.objects:
        assert obj.watertight, obj.name
        tris = stl_io.read_binary_stl(obj.stl_path)
        check = meshcheck.check_mesh(tris)
        assert check.watertight, (obj.name, check.problems)
        assert obj.grams > 0


def test_terrain_ridge_variant(sample_gpx, dem_dir, mock_opentopo, tmp_path):
    result = api.generate(
        "terrain",
        {"route_path": sample_gpx, "dem_dir": dem_dir, "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"terrain", "route"}
    _assert_watertight_job(result)
    assert mock_opentopo["n"] == 0  # local DEM tile covers the route
    assert result.threemf_path is not None
    objs = threemf.read_3mf(result.threemf_path)
    assert len(objs) == 2


def test_terrain_channel_variant(sample_gpx, dem_dir, tmp_path):
    result = api.generate(
        "terrain",
        {"route_path": sample_gpx, "dem_dir": dem_dir, "route_variant": "channel",
         "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"terrain"}
    _assert_watertight_job(result)


def test_terrain_with_markers_and_text(sample_gpx, dem_dir, tmp_path):
    result = api.generate(
        "terrain",
        {"route_path": sample_gpx, "dem_dir": dem_dir, "markers": True,
         "emboss_text": True, "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_terrain_falls_back_to_opentopo_when_no_local_tile(sample_gpx, mock_opentopo, tmp_path):
    result = api.generate(
        "terrain",
        {"route_path": sample_gpx, "dem_dir": str(tmp_path / "no_such_dem"),
         "dem_cache_dir": str(tmp_path / "dem_cache"),
         "opentopo_key": "FAKEKEY", "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)
    assert mock_opentopo["n"] == 1


def test_terrain_footprint_respects_max(sample_gpx, dem_dir, tmp_path):
    result = api.generate(
        "terrain",
        {"route_path": sample_gpx, "dem_dir": dem_dir, "footprint_mm": 300.0,
         "max_footprint_mm": 240.0, "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_terrain_requires_route_path(dem_dir, tmp_path):
    with pytest.raises(ValueError):
        api.generate("terrain", {"dem_dir": dem_dir}, out=str(tmp_path / "job"))
