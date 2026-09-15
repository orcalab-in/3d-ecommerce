"""/v1/addresses — per-user delivery addresses. Every query is scoped by user_id."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentUser
from api.limiter import limiter
from api.schemas.models import (
    AddressCreate,
    AddressPageResponse,
    AddressResponse,
    AddressUpdate,
    MessageResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/addresses", tags=["addresses"])


def _clear_other_defaults(db, user_id: str, keep_id: str | None = None) -> None:
    query = db.table("addresses").update({"is_default": False}).eq("user_id", user_id).eq("is_default", True)
    if keep_id:
        query = query.neq("id", keep_id)
    query.execute()


@router.get("", response_model=AddressPageResponse)
@limiter.limit("60/minute")
async def list_addresses(
    request: Request,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AddressPageResponse:
    db = get_supabase()
    result = (
        db.table("addresses")
        .select("*", count="exact")
        .eq("user_id", current_user["id"])
        .order("is_default", desc=True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return AddressPageResponse(
        items=[AddressResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_address(request: Request, body: AddressCreate, current_user: CurrentUser) -> AddressResponse:
    db = get_supabase()
    payload = {**body.model_dump(), "user_id": current_user["id"]}
    result = db.table("addresses").insert(payload).execute()
    address = result.data[0]
    if address["is_default"]:
        _clear_other_defaults(db, current_user["id"], keep_id=address["id"])
    return AddressResponse(**address)


@router.patch("/{address_id}", response_model=AddressResponse)
@limiter.limit("60/minute")
async def update_address(
    request: Request,
    address_id: UUID,
    body: AddressUpdate,
    current_user: CurrentUser,
) -> AddressResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    db = get_supabase()
    result = (
        db.table("addresses")
        .update(updates)
        .eq("id", str(address_id))
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    if updates.get("is_default"):
        _clear_other_defaults(db, current_user["id"], keep_id=str(address_id))
    return AddressResponse(**result.data[0])


@router.delete("/{address_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_address(request: Request, address_id: UUID, current_user: CurrentUser) -> MessageResponse:
    db = get_supabase()
    result = (
        db.table("addresses")
        .delete()
        .eq("id", str(address_id))
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    return MessageResponse(message="Address deleted")
