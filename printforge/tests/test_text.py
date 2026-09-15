import numpy as np
import pytest

from printforge import meshcheck, text
from printforge.assets import BUNDLED_FONTS, font_path


@pytest.fixture(params=sorted(BUNDLED_FONTS))
def bundled_font(request):
    return text.load_font(font_path(request.param))


def test_load_font_prefers_fonttools_when_available(bundled_font):
    pytest.importorskip("fontTools")
    assert bundled_font.backend == "fonttools"


def test_simple_glyph_without_hole_is_watertight(bundled_font):
    tris, width_mm, skipped = text.emboss_text("HM", bundled_font, size_mm=6.0, depth_mm=0.6)
    assert not skipped
    assert width_mm > 0
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems


def test_full_alphanumeric_charset_mostly_watertight(bundled_font):
    charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    tris, width_mm, skipped = text.emboss_text(charset, bundled_font, size_mm=6.0, depth_mm=0.6)
    # emboss_text validates every glyph itself and drops any that can't be
    # made watertight (see its docstring) -- so what it RETURNS must
    # always check out clean, and only a small minority of glyphs should
    # ever need dropping.
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    assert len(skipped) <= 4, f"unexpectedly many dropped glyphs: {skipped}"


def test_emboss_text_empty_string_returns_empty_mesh(bundled_font):
    tris, width_mm, skipped = text.emboss_text("", bundled_font, size_mm=6.0, depth_mm=0.6)
    assert len(tris) == 0
    assert width_mm == 0.0
    assert skipped == []


def test_extrude_polygon_2d_simple_square_is_watertight():
    square = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=float)
    tris = text.extrude_polygon_2d(square, thickness=2.0)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    assert abs(result.volume_mm3 - 200.0) < 1e-6


def test_extrude_polygon_2d_square_with_hole_is_watertight():
    outer = np.array([[0, 0], [10, 0], [10, 10], [0, 10]], dtype=float)
    hole = np.array([[3, 3], [7, 3], [7, 7], [3, 7]], dtype=float)
    tris = text.extrude_polygon_2d(outer, (hole,), thickness=2.0)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    assert abs(result.volume_mm3 - (100 - 16) * 2.0) < 1e-6
