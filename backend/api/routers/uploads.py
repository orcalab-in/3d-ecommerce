"""/v1/uploads — per-user STL model uploads for the custom price calculator.

The mobile client uploads the binary to Supabase Storage and registers the
metadata here; we estimate weight from the provided solid volume and attach a
price quote. Every query is scoped by user_id.
"""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentUser
from api.limiter import limiter
from api.schemas.models import (
    MessageResponse,
    StlUploadCreate,
    StlUploadPageResponse,
    StlUploadResponse,
)
from api.services.pricing import compute_quote, weight_from_volume
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/uploads", tags=["uploads"])


@router.get("", response_model=StlUploadPageResponse)
@limiter.limit("60/minute")
async def list_uploads(
    request: Request,
    current_user: CurrentUser,
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> StlUploadPageResponse:
    db = get_supabase()
    result = (
        db.table("stl_uploads")
        .select("*", count="exact")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return StlUploadPageResponse(
        items=[StlUploadResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=StlUploadResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_upload(request: Request, body: StlUploadCreate, current_user: CurrentUser) -> StlUploadResponse:
    db = get_supabase()
    payload = {
        **body.model_dump(),
        "user_id": current_user["id"],
        "status": "uploaded",
    }
    if payload.get("volume_cm3") is not None:
        payload["volume_cm3"] = str(payload["volume_cm3"])

    # If a volume was supplied, immediately attach an estimate + quote.
    if body.volume_cm3 is not None:
        config = (
            db.table("pricing_config")
            .select("*")
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if config and config.data:
            weight = weight_from_volume(Decimal(str(body.volume_cm3)))
            minutes = int(weight * Decimal("2"))
            q = compute_quote(config=config.data, weight_grams=weight, print_minutes=minutes)
            payload["est_weight_grams"] = str(q["weight_grams"])
            payload["est_print_minutes"] = q["print_minutes"]
            payload["quoted_price"] = str(q["unit_price"])
            payload["status"] = "quoted"

    result = db.table("stl_uploads").insert(payload).execute()
    return StlUploadResponse(**result.data[0])


@router.delete("/{upload_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_upload(request: Request, upload_id: UUID, current_user: CurrentUser) -> MessageResponse:
    db = get_supabase()
    result = (
        db.table("stl_uploads")
        .delete()
        .eq("id", str(upload_id))
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    return MessageResponse(message="Upload deleted")
