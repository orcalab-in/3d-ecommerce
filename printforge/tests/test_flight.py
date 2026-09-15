import pytest

from printforge import api, meshcheck, stl_io, threemf


def _assert_watertight_job(result):
    for obj in result.objects:
        assert obj.watertight, obj.name
        tris = stl_io.read_binary_stl(obj.stl_path)
        check = meshcheck.check_mesh(tris)
        assert check.watertight, (obj.name, check.problems)
        assert obj.grams > 0


def test_flight_plaque_mode_default(sample_igc, flight_dem_dir, tmp_path):
    result = api.generate(
        "flight", {"flight_path": sample_igc, "dem_dir": flight_dem_dir, "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    assert result.params["track_mode"] == "plaque"
    assert {o.name for o in result.objects} == {"terrain", "track", "altitude_plaque"}
    _assert_watertight_job(result)
    objs = threemf.read_3mf(result.threemf_path)
    assert len(objs) == 3


def test_flight_tube_mode(sample_igc, flight_dem_dir, tmp_path):
    result = api.generate(
        "flight",
        {"flight_path": sample_igc, "dem_dir": flight_dem_dir, "track_mode": "tube",
         "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"terrain", "track"}
    _assert_watertight_job(result)


def test_flight_with_caption(sample_igc, flight_dem_dir, tmp_path):
    result = api.generate(
        "flight",
        {"flight_path": sample_igc, "dem_dir": flight_dem_dir, "emboss_text": True,
         "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_flight_accepts_gpx_with_elevation(sample_gpx, dem_dir, tmp_path):
    result = api.generate(
        "flight", {"flight_path": sample_gpx, "dem_dir": dem_dir, "terrain_res_mm": 2.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_flight_requires_input(flight_dem_dir, tmp_path):
    with pytest.raises(ValueError):
        api.generate("flight", {"dem_dir": flight_dem_dir}, out=str(tmp_path / "job"))


def test_flight_rejects_unknown_track_mode(sample_igc, flight_dem_dir, tmp_path):
    with pytest.raises(ValueError):
        api.generate(
            "flight",
            {"flight_path": sample_igc, "dem_dir": flight_dem_dir, "track_mode": "balloon"},
            out=str(tmp_path / "job"))
