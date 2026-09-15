"""/v1/products — the 3D-print model catalog.

Catalog products are GLOBAL (admin-owned). Reads are public and only surface
`status='active'` models to non-admins; admins may filter by any status (or
`all`). Mutations require an admin. The many-to-many category/color links are
maintained in `product_categories` / `product_colors`.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentAdmin, OptionalUser
from api.limiter import limiter
from api.schemas.models import (
    CategoryResponse,
    ColorResponse,
    MessageResponse,
    ProductCreate,
    ProductDetailResponse,
    ProductPageResponse,
    ProductResponse,
    ProductStatus,
    ProductUpdate,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/products", tags=["products"])

_SORTS = {
    "newest": ("created_at", True),
    "price_asc": ("base_price", False),
    "price_desc": ("base_price", True),
    "name": ("name", False),
    "featured": ("featured", True),
}

_MONEY_FIELDS = ("weight_grams", "base_price", "width_mm", "depth_mm", "height_mm")


def _convert_money(payload: dict) -> dict:
    for field in _MONEY_FIELDS:
        if payload.get(field) is not None:
            payload[field] = str(payload[field])
    return payload


def _sync_links(db, table: str, fk_col: str, product_id: str, ids: list[UUID]) -> None:
    db.table(table).delete().eq("product_id", product_id).execute()
    if ids:
        db.table(table).insert(
            [{"product_id": product_id, fk_col: str(i)} for i in ids]
        ).execute()


@router.get("", response_model=ProductPageResponse)
@limiter.limit("120/minute")
async def list_products(
    request: Request,
    current_user: OptionalUser,
    q: Optional[str] = Query(default=None, description="Search by model name"),
    category: Optional[str] = Query(default=None, description="Category id or slug"),
    sort: str = Query(default="newest"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ProductPageResponse:
    db = get_supabase()
    is_admin = bool(current_user and current_user.get("role") == "admin")

    query = db.table("products").select("*", count="exact")

    # Visibility: non-admins only ever see active models.
    if is_admin and status_filter:
        if status_filter != "all":
            query = query.eq("status", status_filter)
    else:
        query = query.eq("status", "active")

    if q:
        query = query.ilike("name", f"%{q}%")

    if category:
        cat = (
            db.table("categories")
            .select("id")
            .or_(f"id.eq.{category},slug.eq.{category}")
            .maybe_single()
            .execute()
        )
        cat_id = cat.data["id"] if cat and cat.data else None
        link = (
            db.table("product_categories").select("product_id").eq("category_id", cat_id).execute()
            if cat_id
            else None
        )
        product_ids = [r["product_id"] for r in link.data] if link and link.data else ["__none__"]
        query = query.in_("id", product_ids)

    col, desc = _SORTS.get(sort, _SORTS["newest"])
    result = query.order(col, desc=desc).range(offset, offset + limit - 1).execute()
    return ProductPageResponse(
        items=[ProductResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/{product_id}", response_model=ProductDetailResponse)
@limiter.limit("120/minute")
async def get_product(
    request: Request,
    product_id: UUID,
    current_user: OptionalUser,
) -> ProductDetailResponse:
    db = get_supabase()
    is_admin = bool(current_user and current_user.get("role") == "admin")

    result = db.table("products").select("*").eq("id", str(product_id)).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product = result.data
    if not is_admin and product["status"] != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    cat_links = db.table("product_categories").select("category_id").eq("product_id", str(product_id)).execute()
    cat_ids = [r["category_id"] for r in cat_links.data] if cat_links.data else []
    categories = (
        db.table("categories").select("*").in_("id", cat_ids).execute().data if cat_ids else []
    )

    color_links = db.table("product_colors").select("color_id").eq("product_id", str(product_id)).execute()
    color_ids = [r["color_id"] for r in color_links.data] if color_links.data else []
    colors = (
        db.table("color_palette").select("*").in_("id", color_ids).execute().data if color_ids else []
    )

    return ProductDetailResponse(
        **product,
        categories=[CategoryResponse(**c) for c in categories],
        colors=[ColorResponse(**c) for c in colors],
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_product(request: Request, body: ProductCreate, current_admin: CurrentAdmin) -> ProductResponse:
    db = get_supabase()
    data = body.model_dump()
    category_ids = data.pop("category_ids", [])
    color_ids = data.pop("color_ids", [])
    _convert_money(data)

    result = db.table("products").insert(data).execute()
    product = result.data[0]
    _sync_links(db, "product_categories", "category_id", product["id"], category_ids)
    _sync_links(db, "product_colors", "color_id", product["id"], color_ids)
    return ProductResponse(**product)


@router.patch("/{product_id}", response_model=ProductResponse)
@limiter.limit("60/minute")
async def update_product(
    request: Request,
    product_id: UUID,
    body: ProductUpdate,
    current_admin: CurrentAdmin,
) -> ProductResponse:
    updates = body.model_dump(exclude_none=True)
    category_ids = updates.pop("category_ids", None)
    color_ids = updates.pop("color_ids", None)
    _convert_money(updates)

    db = get_supabase()
    if updates:
        result = db.table("products").update(updates).eq("id", str(product_id)).execute()
    else:
        result = db.table("products").select("*").eq("id", str(product_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if category_ids is not None:
        _sync_links(db, "product_categories", "category_id", str(product_id), category_ids)
    if color_ids is not None:
        _sync_links(db, "product_colors", "color_id", str(product_id), color_ids)
    return ProductResponse(**result.data[0])


@router.delete("/{product_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_product(request: Request, product_id: UUID, current_admin: CurrentAdmin) -> MessageResponse:
    db = get_supabase()
    result = db.table("products").delete().eq("id", str(product_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return MessageResponse(message="Product deleted")
