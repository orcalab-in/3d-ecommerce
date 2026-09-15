from printforge import igc


def test_parse_igc_sample(sample_igc):
    flight = igc.parse_igc(sample_igc)
    assert len(flight.points) > 10
    assert flight.pilot == "Sample Pilot"
    assert flight.glider == "Sample Wing"
    assert flight.launch_site == "Launch Point"
    assert flight.date == "2024-05-01"


def test_flight_stats_positive(sample_igc):
    flight = igc.parse_igc(sample_igc)
    assert igc.flight_distance_m(flight) > 0
    assert igc.flight_max_altitude_m(flight) > 0
    assert igc.flight_duration_s(flight) > 0
    assert "m" in igc.flight_duration_str(flight)


def test_parse_lat_lon_precision():
    # 4630000N -> 46 deg, 30.000 min -> 46.5 exactly
    assert abs(igc._parse_lat("4630000N") - 46.5) < 1e-9
    assert abs(igc._parse_lat("4630000S") + 46.5) < 1e-9
    # 00800000E -> 8 deg, 00.000 min -> 8.0 exactly
    assert abs(igc._parse_lon("00800000E") - 8.0) < 1e-9
    assert abs(igc._parse_lon("00800000W") + 8.0) < 1e-9


def test_parse_igc_rejects_file_with_no_b_records(tmp_path):
    path = tmp_path / "empty.igc"
    path.write_text("HFDTE010524\nHFPLTPILOTINCHARGE:Nobody\n")
    try:
        igc.parse_igc(str(path))
        assert False, "expected ValueError"
    except ValueError:
        pass
