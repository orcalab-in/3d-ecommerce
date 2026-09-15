import numpy as np

from printforge import geo


def test_project_unproject_roundtrip():
    lats = np.array([37.77, 37.78, 37.76])
    lons = np.array([-122.42, -122.41, -122.43])
    x, y = geo.project_local(lats, lons, lat0=37.77, lon0=-122.42)
    lat2, lon2 = geo.unproject_local(x, y, lat0=37.77, lon0=-122.42)
    np.testing.assert_allclose(lat2, lats, atol=1e-9)
    np.testing.assert_allclose(lon2, lons, atol=1e-9)


def test_fit_bbox_applies_margin():
    lats = np.array([37.77, 37.78])
    lons = np.array([-122.42, -122.41])
    bbox = geo.fit_bbox(lats, lons, margin_frac=0.5)
    assert bbox["x1"] - bbox["x0"] > 0
    assert bbox["y1"] - bbox["y0"] > 0


def test_fit_footprint_preserves_aspect_and_clamps():
    w, h, scale = geo.fit_footprint(200.0, 100.0, footprint_mm=150.0, max_mm=240.0)
    assert abs(w - 150.0) < 1e-9
    assert abs(h - 75.0) < 1e-9
    w2, h2, _ = geo.fit_footprint(500.0, 500.0, footprint_mm=300.0, max_mm=240.0)
    assert abs(max(w2, h2) - 240.0) < 1e-9


def test_simplify_rdp_reduces_points_on_straight_line():
    x = np.linspace(0, 100, 50)
    y = np.zeros_like(x)
    points = np.stack([x, y], axis=1)
    simplified = geo.simplify_rdp(points, epsilon=0.1)
    assert len(simplified) == 2  # a straight line reduces to its endpoints


def test_resample_polyline_gives_roughly_uniform_spacing():
    points = np.array([[0, 0], [10, 0], [10, 10]], dtype=float)
    resampled = geo.resample_polyline(points, spacing=1.0)
    seg = np.linalg.norm(np.diff(resampled, axis=0), axis=1)
    assert np.all(seg < 1.5)


def test_path_distance_field_zero_on_the_path():
    polyline = np.array([[0, 0], [10, 0]], dtype=float)
    query = np.array([[5, 0], [5, 5]], dtype=float)
    d = geo.path_distance_field(query, polyline)
    assert abs(d[0]) < 1e-9
    assert abs(d[1] - 5.0) < 1e-9


def test_sample_grid_bilinear_matches_grid_points():
    z = np.array([[0.0, 10.0], [20.0, 30.0]])
    val = geo.sample_grid_bilinear(z, res_mm=1.0, x=np.array([0.0]), y=np.array([0.0]))
    assert abs(val[0] - 0.0) < 1e-9
    val_center = geo.sample_grid_bilinear(z, res_mm=1.0, x=np.array([0.5]), y=np.array([0.5]))
    assert abs(val_center[0] - 15.0) < 1e-9
