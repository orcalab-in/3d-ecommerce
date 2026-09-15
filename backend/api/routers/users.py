"""/v1/users — current-user profile management."""

from fastapi import APIRouter, HTTPException, Request, status

from api.dependencies import CurrentUser
from api.limiter import limiter
from api.schemas.models import UserResponse, UserUpdate
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
@limiter.limit("60/minute")
async def get_me(request: Request, current_user: CurrentUser) -> UserResponse:
    db = get_supabase()
    result = (
        db.table("users")
        .select("*")
        .eq("id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(**result.data)


@router.patch("/me", response_model=UserResponse)
@limiter.limit("60/minute")
async def update_me(request: Request, body: UserUpdate, current_user: CurrentUser) -> UserResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    db = get_supabase()
    result = (
        db.table("users")
        .update(updates)
        .eq("id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(**result.data[0])
