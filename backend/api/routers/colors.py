"""/v1/colors — global filament color palette.

Reads are public; mutations require an admin.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentAdmin
from api.limiter import limiter
from api.schemas.models import (
    ColorCreate,
    ColorPageResponse,
    ColorResponse,
    ColorUpdate,
    MessageResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/colors", tags=["colors"])


@router.get("", response_model=ColorPageResponse)
@limiter.limit("120/minute")
async def list_colors(
    request: Request,
    in_stock: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ColorPageResponse:
    db = get_supabase()
    query = db.table("color_palette").select("*", count="exact").order("name")
    if in_stock is not None:
        query = query.eq("in_stock", in_stock)
    result = query.range(offset, offset + limit - 1).execute()
    return ColorPageResponse(
        items=[ColorResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ColorResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_color(request: Request, body: ColorCreate, current_admin: CurrentAdmin) -> ColorResponse:
    db = get_supabase()
    result = db.table("color_palette").insert(body.model_dump()).execute()
    return ColorResponse(**result.data[0])


@router.patch("/{color_id}", response_model=ColorResponse)
@limiter.limit("60/minute")
async def update_color(
    request: Request,
    color_id: UUID,
    body: ColorUpdate,
    current_admin: CurrentAdmin,
) -> ColorResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    db = get_supabase()
    result = db.table("color_palette").update(updates).eq("id", str(color_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    return ColorResponse(**result.data[0])


@router.delete("/{color_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_color(request: Request, color_id: UUID, current_admin: CurrentAdmin) -> MessageResponse:
    db = get_supabase()
    result = db.table("color_palette").delete().eq("id", str(color_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Color not found")
    return MessageResponse(message="Color deleted")
