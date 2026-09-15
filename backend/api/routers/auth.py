"""Auth — exchange a Google identity token for a first-party JWT."""

from fastapi import APIRouter, Request

from api.config import settings
from api.dependencies import create_access_token
from api.limiter import limiter
from api.schemas.models import GoogleTokenRequest, TokenResponse
from api.services.google_auth import verify_google_token
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleTokenRequest) -> TokenResponse:
    profile = await verify_google_token(body.access_token)

    db = get_supabase()
    # Bootstrap admins via config; everyone else is a customer.
    role = "admin" if profile["email"].lower() in settings.admin_emails_list else "customer"

    payload = {
        "google_id": profile["google_id"],
        "name": profile["name"],
        "email": profile["email"],
        "picture_url": profile.get("picture_url"),
        "role": role,
    }
    result = (
        db.table("users")
        .upsert(payload, on_conflict="google_id")
        .execute()
    )
    user = result.data[0]

    token, expires_in = create_access_token(str(user["id"]), role=user.get("role", role))
    return TokenResponse(access_token=token, expires_in=expires_in, role=user.get("role", role))
