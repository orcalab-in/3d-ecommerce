import json

import pytest

from printforge import api, meshcheck, stl_io


@pytest.mark.parametrize("size", ["S", "M", "L"])
def test_photo_lamp_sizes_are_watertight(sample_photo, tmp_path, size):
    result = api.generate("photo_lamp", {"image": sample_photo, "size": size},
                           out=str(tmp_path / "job"))
    assert {o.name for o in result.objects} == {"panel", "stand", "ledboard"}
    for obj in result.objects:
        assert obj.watertight, obj.name
        tris = stl_io.read_binary_stl(obj.stl_path)
        check = meshcheck.check_mesh(tris)
        assert check.watertight, (obj.name, check.problems)
        assert obj.grams > 0
    assert result.total_grams > 0
    assert result.estimated_print_time_minutes > 0
    assert result.preview_png_path is not None


def test_photo_lamp_with_caption_is_watertight(sample_photo, tmp_path):
    result = api.generate(
        "photo_lamp",
        {"image": sample_photo, "size": "M", "caption": "Hi Mom",
         "caption_font": "Pacifico"},
        out=str(tmp_path / "job"))
    stand = next(o for o in result.objects if o.name == "stand")
    assert stand.watertight


def test_photo_lamp_with_rounded_corners_is_watertight(sample_photo, tmp_path):
    result = api.generate(
        "photo_lamp",
        {"image": sample_photo, "size": "S", "corner_radius_mm": 8.0},
        out=str(tmp_path / "job"))
    panel = next(o for o in result.objects if o.name == "panel")
    assert panel.watertight


def test_photo_lamp_rejects_unknown_size(sample_photo, tmp_path):
    with pytest.raises(ValueError):
        api.generate("photo_lamp", {"image": sample_photo, "size": "XL"},
                     out=str(tmp_path / "job"))


def test_job_result_is_json_serializable(sample_photo, tmp_path):
    result = api.generate("photo_lamp", {"image": sample_photo, "size": "S"},
                           out=str(tmp_path / "job"))
    payload = json.loads(result.to_json())
    assert payload["product"] == "photo_lamp"
    assert len(payload["objects"]) == 3
