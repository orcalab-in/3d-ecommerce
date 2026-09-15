"""Verify a Google identity token and return the user's profile.

The mobile app obtains a Google ID token (via expo-auth-session) and POSTs it
to /v1/auth/google. We verify the signature + audience here, then upsert the
user row and mint a first-party JWT.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from api.config import settings


class GoogleProfile(dict):
    """Lightweight dict with the fields we persist on the users table."""


async def verify_google_token(token: str) -> GoogleProfile:
    """Validate a Google ID token and return its profile claims.

    Raises HTTP 401 if the token is invalid or its audience does not match the
    configured client id.
    """
    try:
        claims = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        ) from exc

    if not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token missing subject",
        )

    return GoogleProfile(
        google_id=claims["sub"],
        email=claims.get("email", ""),
        name=claims.get("name") or claims.get("email", "User"),
        picture_url=claims.get("picture"),
    )
