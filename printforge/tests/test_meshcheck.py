import numpy as np

from printforge import mesh, meshcheck


def test_valid_box_is_watertight_with_correct_volume():
    tris = mesh.box(0, 10, 0, 5, 0, 2)
    result = meshcheck.check_mesh(tris)
    assert result.watertight
    assert result.volume_mm3 == 100.0


def test_open_mesh_detected_as_hole():
    tris = mesh.box(0, 10, 0, 5, 0, 2)[:-1]
    result = meshcheck.check_mesh(tris)
    assert not result.watertight
    assert any("no matching reverse" in p for p in result.problems)


def test_inverted_normals_detected_via_negative_volume():
    tris = mesh.box(0, 10, 0, 5, 0, 2)[:, ::-1, :]
    result = meshcheck.check_mesh(tris)
    assert not result.watertight
    assert result.volume_mm3 < 0


def test_duplicate_triangle_detected_as_non_manifold():
    tris = mesh.box(0, 10, 0, 5, 0, 2)
    dup = np.concatenate([tris, tris[:1]])
    result = meshcheck.check_mesh(dup)
    assert not result.watertight
    assert any("non-manifold" in p for p in result.problems)


def test_assert_watertight_raises_on_broken_mesh():
    tris = mesh.box(0, 10, 0, 5, 0, 2)[:-1]
    try:
        meshcheck.assert_watertight(tris, name="broken")
        assert False, "expected MeshCheckError"
    except meshcheck.MeshCheckError as exc:
        assert "broken" in str(exc)


def test_assert_watertight_passes_on_good_mesh():
    tris = mesh.box(0, 10, 0, 5, 0, 2)
    result = meshcheck.assert_watertight(tris, name="good")
    assert result.watertight
