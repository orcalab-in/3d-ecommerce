"""/v1/orders — checkout + order tracking.

Customers create orders from their cart and track them; admins can advance the
order status. Per-user queries are scoped by user_id; admins may pass
`scope=all` to manage every order.
"""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentUser
from api.limiter import limiter
from api.schemas.models import (
    OrderCreate,
    OrderItemResponse,
    OrderPageResponse,
    OrderResponse,
    OrderStatusUpdate,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/orders", tags=["orders"])

DEFAULT_ETA_DAYS = 7
FLAT_SHIPPING_FEE = Decimal("49.00")


def _expected_delivery(db, pincode: str | None) -> tuple[date, int]:
    eta_days = DEFAULT_ETA_DAYS
    if pincode:
        row = (
            db.table("serviceable_pincodes")
            .select("eta_days,is_active")
            .eq("pincode", pincode)
            .maybe_single()
            .execute()
        )
        if row and row.data and row.data.get("is_active"):
            eta_days = int(row.data["eta_days"])
    return date.today() + timedelta(days=eta_days), eta_days


def _attach_items(db, orders: list[dict]) -> list[OrderResponse]:
    if not orders:
        return []
    order_ids = [o["id"] for o in orders]
    items = db.table("order_items").select("*").in_("order_id", order_ids).execute().data or []
    by_order: dict[str, list[dict]] = {}
    for it in items:
        by_order.setdefault(it["order_id"], []).append(it)
    return [
        OrderResponse(**o, items=[OrderItemResponse(**i) for i in by_order.get(o["id"], [])])
        for o in orders
    ]


@router.get("", response_model=OrderPageResponse)
@limiter.limit("60/minute")
async def list_orders(
    request: Request,
    current_user: CurrentUser,
    scope: str = Query(default="mine"),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> OrderPageResponse:
    db = get_supabase()
    query = db.table("orders").select("*", count="exact")
    is_admin = current_user.get("role") == "admin"
    if not (is_admin and scope == "all"):
        query = query.eq("user_id", current_user["id"])

    result = query.order("placed_at", desc=True).range(offset, offset + limit - 1).execute()
    return OrderPageResponse(
        items=_attach_items(db, result.data),
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/{order_id}", response_model=OrderResponse)
@limiter.limit("60/minute")
async def get_order(request: Request, order_id: UUID, current_user: CurrentUser) -> OrderResponse:
    db = get_supabase()
    query = db.table("orders").select("*").eq("id", str(order_id))
    if current_user.get("role") != "admin":
        query = query.eq("user_id", current_user["id"])
    result = query.maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _attach_items(db, [result.data])[0]


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_order(request: Request, body: OrderCreate, current_user: CurrentUser) -> OrderResponse:
    db = get_supabase()
    user_id = current_user["id"]

    address = (
        db.table("addresses")
        .select("*")
        .eq("id", str(body.address_id))
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not address or not address.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")

    cart = db.table("cart_items").select("*").eq("user_id", user_id).execute().data or []
    if not cart:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    product_ids = [c["product_id"] for c in cart if c.get("product_id")]
    products = (
        db.table("products").select("id,name,est_print_minutes").in_("id", product_ids).execute().data
        if product_ids
        else []
    )
    name_by_id = {p["id"]: p["name"] for p in products}
    minutes_by_id = {p["id"]: int(p.get("est_print_minutes") or 0) for p in products}

    subtotal = sum((Decimal(str(c["unit_price"])) * int(c["quantity"]) for c in cart), Decimal("0"))
    total = subtotal + FLAT_SHIPPING_FEE
    eta_date, _ = _expected_delivery(db, address.data.get("pincode"))

    order = (
        db.table("orders")
        .insert(
            {
                "user_id": user_id,
                "address_id": str(body.address_id),
                "status": "confirmed",
                "subtotal": str(subtotal),
                "shipping_fee": str(FLAT_SHIPPING_FEE),
                "total": str(total),
                "expected_delivery_date": eta_date.isoformat(),
            }
        )
        .execute()
        .data[0]
    )

    item_rows = [
        {
            "order_id": order["id"],
            "product_id": c["product_id"],
            "name_snapshot": name_by_id.get(c["product_id"], "Custom model"),
            "quantity": int(c["quantity"]),
            "unit_price": str(c["unit_price"]),
            "selected_color_ids": c.get("selected_color_ids") or [],
            "width_mm": c.get("width_mm"),
            "depth_mm": c.get("depth_mm"),
            "height_mm": c.get("height_mm"),
        }
        for c in cart
    ]
    inserted_items = db.table("order_items").insert(item_rows).execute().data or []

    # Enqueue a print job per item so the production queue reflects new demand.
    base_pos = (
        db.table("print_jobs")
        .select("id", count="exact")
        .in_("status", ["queued", "printing"])
        .execute()
        .count
        or 0
    )
    job_rows = []
    for idx, (it, src) in enumerate(zip(inserted_items, cart)):
        est = minutes_by_id.get(src.get("product_id"), 0) * int(src["quantity"])
        job_rows.append(
            {
                "order_item_id": it["id"],
                "status": "queued",
                "queue_position": base_pos + idx + 1,
                "est_minutes": est,
            }
        )
    if job_rows:
        db.table("print_jobs").insert(job_rows).execute()

    db.table("cart_items").delete().eq("user_id", user_id).execute()
    return _attach_items(db, [order])[0]


@router.patch("/{order_id}/status", response_model=OrderResponse)
@limiter.limit("60/minute")
async def update_order_status(
    request: Request,
    order_id: UUID,
    body: OrderStatusUpdate,
    current_user: CurrentUser,
) -> OrderResponse:
    db = get_supabase()
    is_admin = current_user.get("role") == "admin"

    query = db.table("orders").update({"status": body.status}).eq("id", str(order_id))
    if not is_admin:
        # Customers may only cancel their own orders.
        if body.status != "cancelled":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
        query = query.eq("user_id", current_user["id"])
    result = query.execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _attach_items(db, [result.data[0]])[0]
