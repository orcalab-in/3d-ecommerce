from printforge import gpx


def test_parse_gpx_sample(sample_gpx):
    route = gpx.load_route(sample_gpx)
    assert len(route.points) > 5
    assert route.name
    assert all(-90 <= p.lat <= 90 for p in route.points)
    assert all(-180 <= p.lon <= 180 for p in route.points)
    assert any(p.ele is not None for p in route.points)


def test_route_distance_and_gain_positive(sample_gpx):
    route = gpx.load_route(sample_gpx)
    assert gpx.route_distance_m(route) > 0
    assert gpx.route_elevation_gain_m(route) >= 0


def test_route_date_extracted(sample_gpx):
    route = gpx.load_route(sample_gpx)
    date = gpx.route_date(route)
    assert date is not None
    assert date.startswith("2024-05-01")


def test_parse_strava_json(tmp_path):
    import json
    data = {
        "name": "Evening Loop",
        "latlng": [[37.77, -122.42], [37.771, -122.421], [37.772, -122.419]],
        "altitude": [10.0, 12.0, 9.0],
        "start_date": "2024-06-01T18:00:00Z",
    }
    path = tmp_path / "activity.json"
    path.write_text(json.dumps(data))
    route = gpx.load_route(str(path))
    assert route.name == "Evening Loop"
    assert len(route.points) == 3
    assert route.points[0].ele == 10.0
