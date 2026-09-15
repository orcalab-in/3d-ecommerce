import pytest

from printforge import api, meshcheck, stl_io


def _assert_watertight_job(result):
    for obj in result.objects:
        assert obj.watertight, obj.name
        tris = stl_io.read_binary_stl(obj.stl_path)
        check = meshcheck.check_mesh(tris)
        assert check.watertight, (obj.name, check.problems)
        assert obj.grams > 0


def test_puck_form(tmp_path):
    result = api.generate("led_base", {"form": "puck"}, out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"base"}
    _assert_watertight_job(result)


def test_backlit_box_form(tmp_path):
    result = api.generate("led_base", {"form": "backlit_box"}, out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"base"}
    _assert_watertight_job(result)


def test_name_lamp_form(tmp_path):
    result = api.generate("led_base", {"form": "name_lamp", "name": "Alex"},
                           out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"plate", "base"}
    _assert_watertight_job(result)


def test_name_lamp_pacifico_font(tmp_path):
    result = api.generate(
        "led_base", {"form": "name_lamp", "name": "Maria", "font": "Pacifico"},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_name_lamp_special_characters(tmp_path):
    result = api.generate(
        "led_base", {"form": "name_lamp", "name": "O'Brien-Lee"}, out=str(tmp_path / "job"))
    _assert_watertight_job(result)


def test_name_lamp_requires_name(tmp_path):
    with pytest.raises(ValueError):
        api.generate("led_base", {"form": "name_lamp", "name": ""}, out=str(tmp_path / "job"))


def test_unknown_form_rejected(tmp_path):
    with pytest.raises(ValueError):
        api.generate("led_base", {"form": "hexagon"}, out=str(tmp_path / "job"))


def test_puck_recess_fits_within_radius(tmp_path):
    result = api.generate(
        "led_base", {"form": "puck", "puck_radius_mm": 30.0, "led_coil_diameter_mm": 40.0},
        out=str(tmp_path / "job"))
    _assert_watertight_job(result)
