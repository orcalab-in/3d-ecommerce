import zipfile

from printforge import mesh, meshcheck, threemf


def test_write_3mf_has_exact_expected_zip_entries(tmp_path):
    objs = [threemf.ThreeMFObject(name="a", triangles=mesh.box(0, 10, 0, 10, 0, 10))]
    path = str(tmp_path / "test.3mf")
    threemf.write_3mf(path, objs)
    assert set(zipfile.ZipFile(path).namelist()) == {
        "[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"}


def test_roundtrip_preserves_objects_colors_and_watertightness(tmp_path):
    box1 = mesh.box(0, 10, 0, 10, 0, 10)
    box2 = mesh.box(20, 25, 0, 5, 0, 5)
    objs = [
        threemf.ThreeMFObject(name="terrain", triangles=box1, color_hex="#D9C7A5FF", extruder=1),
        threemf.ThreeMFObject(name="route", triangles=box2, color_hex="#2E6E4EFF", extruder=2),
    ]
    path = str(tmp_path / "test.3mf")
    threemf.write_3mf(path, objs)
    back = threemf.read_3mf(path)

    assert len(back) == 2
    assert {o.name for o in back} == {"terrain", "route"}
    for original, obj in zip(objs, back):
        assert obj.name == original.name
        assert obj.color_hex == original.color_hex
        assert len(obj.triangles) == len(original.triangles)
        check = meshcheck.check_mesh(obj.triangles)
        assert check.watertight, (obj.name, check.problems)
        original_vol = meshcheck.signed_volume(original.triangles)
        assert abs(check.volume_mm3 - original_vol) < 0.01


def test_write_3mf_requires_at_least_one_object(tmp_path):
    try:
        threemf.write_3mf(str(tmp_path / "empty.3mf"), [])
        assert False, "expected ValueError"
    except ValueError:
        pass
