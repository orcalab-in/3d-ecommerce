"""/v1/categories — global catalog taxonomy.

Reads are public; mutations require an admin (CurrentAdmin). Categories are NOT
per-user, so queries are intentionally not scoped by user_id.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentAdmin
from api.limiter import limiter
from api.schemas.models import (
    CategoryCreate,
    CategoryPageResponse,
    CategoryResponse,
    CategoryUpdate,
    MessageResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/categories", tags=["categories"])


@router.get("", response_model=CategoryPageResponse)
@limiter.limit("120/minute")
async def list_categories(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> CategoryPageResponse:
    db = get_supabase()
    result = (
        db.table("categories")
        .select("*", count="exact")
        .order("sort_order")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return CategoryPageResponse(
        items=[CategoryResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_category(request: Request, body: CategoryCreate, current_admin: CurrentAdmin) -> CategoryResponse:
    db = get_supabase()
    payload = body.model_dump()
    if payload.get("parent_id") is not None:
        payload["parent_id"] = str(payload["parent_id"])
    result = db.table("categories").insert(payload).execute()
    return CategoryResponse(**result.data[0])


@router.patch("/{category_id}", response_model=CategoryResponse)
@limiter.limit("60/minute")
async def update_category(
    request: Request,
    category_id: UUID,
    body: CategoryUpdate,
    current_admin: CurrentAdmin,
) -> CategoryResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "parent_id" in updates and updates["parent_id"] is not None:
        updates["parent_id"] = str(updates["parent_id"])

    db = get_supabase()
    result = db.table("categories").update(updates).eq("id", str(category_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return CategoryResponse(**result.data[0])


@router.delete("/{category_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_category(request: Request, category_id: UUID, current_admin: CurrentAdmin) -> MessageResponse:
    db = get_supabase()
    result = db.table("categories").delete().eq("id", str(category_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return MessageResponse(message="Category deleted")
