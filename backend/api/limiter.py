"""Shared SlowAPI limiter instance — imported by main.py and all routers."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from api.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.rate_limit_storage_uri,
    default_limits=["50/minute"],
    swallow_errors=True,
)
