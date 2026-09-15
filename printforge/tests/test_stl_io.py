import numpy as np

from printforge import stl_io


def test_box_watertight_by_construction(tmp_path):
    tris = stl_io.box(0, 10, 0, 5, 0, 2)
    assert tris.shape == (12, 3, 3)


def test_write_read_roundtrip(tmp_path):
    tris = stl_io.box(0, 10, 0, 5, 0, 2)
    path = str(tmp_path / "box.stl")
    n = stl_io.write_binary_stl(path, tris)
    assert n == 12
    back = stl_io.read_binary_stl(path)
    assert back.shape == tris.shape
    np.testing.assert_allclose(back, tris, atol=1e-4)


def test_write_binary_stl_rejects_bad_shape(tmp_path):
    bad = np.zeros((4, 3, 2), dtype=np.float32)
    try:
        stl_io.write_binary_stl(str(tmp_path / "bad.stl"), bad)
        assert False, "expected ValueError"
    except ValueError:
        pass
