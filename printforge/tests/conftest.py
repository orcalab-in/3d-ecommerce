import os

import pytest

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")


@pytest.fixture
def sample_photo():
    return os.path.join(SAMPLES_DIR, "test_photo.jpg")


@pytest.fixture
def sample_gpx():
    return os.path.join(SAMPLES_DIR, "sample.gpx")


@pytest.fixture
def sample_igc():
    return os.path.join(SAMPLES_DIR, "sample.igc")
