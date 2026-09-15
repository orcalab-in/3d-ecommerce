from supabase import create_client, Client
from api.config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client using the service-role key.

    The service key bypasses Row-Level Security — all queries MUST
    include an explicit user_id filter so users cannot access each
    other's data.
    """
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
