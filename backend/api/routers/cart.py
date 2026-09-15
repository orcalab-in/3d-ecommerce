"""/v1/cart — per-user shopping cart. Every query is scoped by user_id.

Customisation rules enforced here:
  * at most MAX_COLORS colors, and never more than the product's own max_colors
  * size (width/depth/height) is clamped to the Bambu Lab A1 build volume
"""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from api.config import BUILD_PLATE_DEPTH_MM, BUILD_PLATE_WIDTH_MM, MAX_COLORS, MAX_HEIGHT_MM
from api.dependencies import CurrentUser
from api.limiter import limiter
from api.schemas.models import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
    MessageResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/cart", tags=["cart"])

_SIZE_LIMITS = {
    "width_mm": Decimal(str(BUILD_PLATE_WIDTH_MM)),
    "depth_mm": Decimal(str(BUILD_PLATE_DEPTH_MM)),
    "height_mm": Decimal(str(MAX_HEIGHT_MM)),
}


def _validate_size(payload: dict) -> None:
    for field, limit in _SIZE_LIMITS.items():
        value = payload.get(field)
        if value is not None and Decimal(str(value)) > limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field} exceeds the {limit} mm build-volume limit",
            )


def _convert(payload: dict) -> dict:
    for field in ("scale", "width_mm", "depth_mm", "height_mm", "unit_price"):
        if payload.get(field) is not None:
            payload[field] = str(payload[field])
    if "selected_color_ids" in payload and payload["selected_color_ids"] is not None:
        payload["selected_color_ids"] = [str(c) for c in payload["selected_color_ids"]]
    return payload


@router.get("", response_model=CartResponse)
@limiter.limit("60/minute")
async def get_cart(request: Request, current_user: CurrentUser) -> CartResponse:
    db = get_supabase()
    result = (
        db.table("cart_items")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    items = [CartItemResponse(**row) for row in result.data]
    subtotal = sum((it.unit_price * it.quantity for it in items), Decimal("0"))
    return CartResponse(items=items, subtotal=subtotal, count=len(items))


@router.post("", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def add_to_cart(request: Request, body: CartItemCreate, current_user: CurrentUser) -> CartItemResponse:
    db = get_supabase()
    product = (
        db.table("products").select("*").eq("id", str(body.product_id)).maybe_single().execute()
    )
    if not product or not product.data or product.data["status"] != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not available")

    max_colors = min(int(product.data.get("max_colors", 1)), MAX_COLORS)
    if len(body.selected_color_ids) > max_colors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {max_colors} color(s) allowed for this model",
        )

    payload = _convert({**body.model_dump(), "user_id": current_user["id"]})
    payload["product_id"] = str(body.product_id)
    _validate_size(payload)
    payload["unit_price"] = str(Decimal(str(product.data["base_price"])))

    result = db.table("cart_items").insert(payload).execute()
    return CartItemResponse(**result.data[0])


@router.patch("/{item_id}", response_model=CartItemResponse)
@limiter.limit("60/minute")
async def update_cart_item(
    request: Request,
    item_id: UUID,
    body: CartItemUpdate,
    current_user: CurrentUser,
) -> CartItemResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if len(updates.get("selected_color_ids", [])) > MAX_COLORS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"At most {MAX_COLORS} colors allowed")
    _validate_size(updates)
    _convert(updates)

    db = get_supabase()
    result = (
        db.table("cart_items")
        .update(updates)
        .eq("id", str(item_id))
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    return CartItemResponse(**result.data[0])


@router.delete("/{item_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def remove_cart_item(request: Request, item_id: UUID, current_user: CurrentUser) -> MessageResponse:
    db = get_supabase()
    result = (
        db.table("cart_items")
        .delete()
        .eq("id", str(item_id))
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    return MessageResponse(message="Cart item removed")


@router.delete("", response_model=MessageResponse)
@limiter.limit("60/minute")
async def clear_cart(request: Request, current_user: CurrentUser) -> MessageResponse:
    db = get_supabase()
    db.table("cart_items").delete().eq("user_id", current_user["id"]).execute()
    return MessageResponse(message="Cart cleared")
