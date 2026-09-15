"""Pytest fixtures shared across the test suite."""

import os
import pytest

# Inject env vars BEFORE any api module is imported so Settings() resolves.
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("JWT_SECRET", "test-secret-key-that-is-long-enough-for-hs256")
os.environ.setdefault("JWT_EXPIRE_HOURS", "24")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:8081")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("ADMIN_EMAILS", "")

from fastapi.testclient import TestClient

from api.dependencies import create_access_token
from api.main import create_app
from api.tests.helpers import SupabaseMock, USER_ID


@pytest.fixture(autouse=True)
def reset_supabase_singleton():
    """Reset the Supabase singleton between tests so mocks don't bleed."""
    import api.services.supabase_client as sc
    sc._client = None
    yield
    sc._client = None


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def auth_headers():
    """Real JWT token for USER_ID (customer) — exercises encode/decode."""
    token, _ = create_access_token(USER_ID, role="customer")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers():
    """Real JWT token for USER_ID with role=admin."""
    token, _ = create_access_token(USER_ID, role="admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_supabase(monkeypatch):
    """Patch get_supabase() everywhere it is imported. Returns the mock to configure."""
    db = SupabaseMock()
    monkeypatch.setattr("api.services.supabase_client.get_supabase", lambda: db)
    # Patch in every router module that imports get_supabase directly.
    for module in [
        "api.routers.auth",
        "api.routers.users",
        "api.routers.categories",
        "api.routers.colors",
        "api.routers.products",
        "api.routers.cart",
        "api.routers.addresses",
        "api.routers.orders",
        "api.routers.uploads",
        "api.routers.pricing",
        "api.routers.delivery",
        "api.routers.print_jobs",
        "api.main",
    ]:
        try:
            monkeypatch.setattr(f"{module}.get_supabase", lambda: db)
        except AttributeError:
            pass
    return db
