import numpy as np

from printforge import mesh, meshcheck


def test_flat_panel_via_ruled_grid_solid_is_watertight():
    ny, nx = 20, 15
    res = 1.0
    xs = np.arange(nx) * res
    ys = np.arange(ny) * res
    x, y = np.meshgrid(xs, ys)
    heights = 1.0 + 0.5 * np.sin(x / 3.0) * np.cos(y / 3.0)
    top = np.stack([x, y, heights], axis=-1)
    bottom = np.stack([x, y, np.zeros_like(heights)], axis=-1)
    tris = mesh.ruled_grid_solid(top, bottom, close_u=False)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    assert result.volume_mm3 > 0


def test_ruled_grid_solid_with_corner_mask_is_watertight():
    ny, nx = 30, 30
    res = 1.0
    xs = np.arange(nx) * res
    ys = np.arange(ny) * res
    x, y = np.meshgrid(xs, ys)
    top = np.stack([x, y, np.full_like(x, 3.0)], axis=-1)
    bottom = np.stack([x, y, np.zeros_like(x)], axis=-1)
    corner_mask = mesh.corner_mask((ny, nx), res, corner_radius_mm=6.0)
    tris = mesh.ruled_grid_solid(top, bottom, close_u=False, mask=corner_mask)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems


def test_corner_mask_is_single_connected_region():
    m = mesh.corner_mask((10, 10), 1.0, 3.0)
    loops = mesh.boundary_loops(m)
    assert len(loops) == 1


def test_boundary_walk_full_rectangle_is_ccw_perimeter():
    m = np.ones((4, 4), dtype=bool)
    loop = mesh.boundary_walk(m)
    assert len(loop) == 2 * (4 + 4)  # perimeter vertex count of a 5x5 grid


def test_cylinder_is_watertight_and_correct_volume():
    tris = mesh.cylinder((0.0, 0.0), 0.0, 10.0, radius=5.0, segments=48)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    expected = np.pi * 5.0**2 * 10.0
    assert abs(result.volume_mm3 - expected) / expected < 0.02


def test_bridge_loops_annulus_is_watertight_when_closed_with_walls():
    # outer + inner rings at two z levels, closed into a hollow tube via
    # bridge_loops at each end -- exercises bridge_loops independent of
    # cylinder()'s own wall/cap wiring.
    segments = 32
    theta = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    outer_top = np.stack([5 * np.cos(theta), 5 * np.sin(theta), np.full(segments, 10.0)], axis=-1)
    outer_bot = np.stack([5 * np.cos(theta), 5 * np.sin(theta), np.zeros(segments)], axis=-1)
    inner_top = np.stack([3 * np.cos(theta), 3 * np.sin(theta), np.full(segments, 10.0)], axis=-1)
    inner_bot = np.stack([3 * np.cos(theta), 3 * np.sin(theta), np.zeros(segments)], axis=-1)

    outer_wall = mesh.wall_strip(outer_top, outer_bot, close=True)
    inner_wall = mesh.wall_strip(inner_bot, inner_top, close=True)
    top_annulus = mesh.bridge_loops(outer_top, inner_top)
    bottom_annulus = mesh.bridge_loops(outer_bot, inner_bot)[:, ::-1, :]

    tris = np.concatenate([outer_wall, inner_wall, top_annulus, bottom_annulus])
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems


def test_ribbon_closed_loop_is_watertight():
    t = np.linspace(0, 2 * np.pi, 40)
    xy = np.stack([50 + 30 * np.cos(t), 50 + 30 * np.sin(t)], axis=1)
    z = np.full(40, 5.0) + 2 * np.sin(t * 3)
    tris = mesh.ribbon(xy, z, width_mm=1.5, top_offset=1.2, bottom_offset=-0.2)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
    assert result.volume_mm3 > 0


def test_ribbon_open_path_is_watertight():
    t = np.linspace(0, 1, 30)
    xy = np.stack([10 + 80 * t, 20 + 15 * np.sin(t * 4 * np.pi)], axis=1)
    z = 3.0 + 1.5 * np.cos(t * 5)
    tris = mesh.ribbon(xy, z, width_mm=1.5, top_offset=1.2, bottom_offset=-0.2)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems


def test_slotted_base_is_watertight():
    tris = mesh.slotted_base(
        width=100.0, depth=40.0,
        slots=[{"y_start": 10.0, "thickness": 3.0, "clearance": 0.4},
               {"y_start": 25.0, "thickness": 2.0, "clearance": 0.4}],
        floor=5.0, height=15.0)
    result = meshcheck.check_mesh(tris)
    assert result.watertight, result.problems
