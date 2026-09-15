import pytest

from printforge import api, meshcheck, stl_io


def _assert_watertight_job(result):
    for obj in result.objects:
        assert obj.watertight, obj.name
        tris = stl_io.read_binary_stl(obj.stl_path)
        check = meshcheck.check_mesh(tris)
        assert check.watertight, (obj.name, check.problems)
        assert obj.grams > 0


def test_flat_hole_form(sample_photo, tmp_path):
    result = api.generate("lithophane", {"image": sample_photo, "form": "flat_hole"},
                           out=str(tmp_path / "job"))
    _assert_watertight_job(result)


@pytest.mark.parametrize("arc_deg", [90.0, 120.0, 180.0])
def test_curved_form_arc_range(sample_photo, tmp_path, arc_deg):
    result = api.generate(
        "lithophane",
        {"image": sample_photo, "form": "curved", "arc_deg": arc_deg, "radius_mm": 50.0},
        out=str(tmp_path / f"job_{arc_deg}"))
    _assert_watertight_job(result)


@pytest.mark.parametrize("num_photos", [1, 2, 3, 4])
def test_cylinder_form_photo_counts(sample_photo, tmp_path, num_photos):
    result = api.generate(
        "lithophane",
        {"image": sample_photo, "form": "cylinder", "num_photos": num_photos},
        out=str(tmp_path / f"job_{num_photos}"))
    _assert_watertight_job(result)


def test_keychain_form(sample_photo, tmp_path):
    result = api.generate("lithophane", {"image": sample_photo, "form": "keychain"},
                           out=str(tmp_path / "job"))
    _assert_watertight_job(result)
    # spec: keychain thickness must stay within 0.4-2.0mm
    assert result.params["min_thickness_mm"] >= 0.4
    assert result.params["max_thickness_mm"] <= 2.0


def test_keychain_thickness_clamped_even_if_overridden(sample_photo, tmp_path):
    result = api.generate(
        "lithophane",
        {"image": sample_photo, "form": "keychain", "max_thickness_mm": 5.0},
        out=str(tmp_path / "job"))
    assert result.params["max_thickness_mm"] <= 2.0


def test_unknown_form_rejected(sample_photo, tmp_path):
    with pytest.raises(ValueError):
        api.generate("lithophane", {"image": sample_photo, "form": "hexagon"},
                     out=str(tmp_path / "job"))
