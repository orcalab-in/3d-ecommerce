"""Reusable FastAPI dependencies."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from api.config import settings

bearer_scheme = HTTPBearer()

ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(user_id: str, role: str = "customer") -> tuple[str, int]:
    """Return (encoded_jwt, expires_in_seconds). `role` is embedded so admin
    gating does not require a DB round-trip on every request."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": user_id, "role": role, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, settings.jwt_expire_hours * 3600


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------
async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict:
    """Decode the JWT and return the current user.

    Raises HTTP 401 on any auth failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        role: str = payload.get("role", "customer")
    except JWTError:
        raise credentials_exception

    # JWT is already cryptographically verified above — no DB round-trip needed.
    # All endpoints only use current_user["id"]; GET /v1/users/me fetches the row itself.
    request.state.user_id = user_id
    return {"id": user_id, "role": role}


CurrentUser = Annotated[dict, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Admin-only dependency — catalog mutations are gated by role='admin'.
# ---------------------------------------------------------------------------
async def get_current_admin(current_user: CurrentUser) -> dict:
    """Require an authenticated user with role='admin'. Raises 403 otherwise."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


CurrentAdmin = Annotated[dict, Depends(get_current_admin)]


# ---------------------------------------------------------------------------
# Optional user — for catalog GETs that work signed-in OR anonymously.
# ---------------------------------------------------------------------------
async def get_optional_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))],
) -> dict | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        request.state.user_id = user_id
        return {"id": user_id, "role": payload.get("role", "customer")}
    except JWTError:
        return None


OptionalUser = Annotated[dict | None, Depends(get_optional_user)]
