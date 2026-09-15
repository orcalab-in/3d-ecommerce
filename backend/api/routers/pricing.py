"""/v1/pricing — admin pricing config + the print price calculator.

The quote formula lives in services/pricing.py:
    price = (material + electricity + labor) * (1 + margin)
"""

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request, status

from api.config import MAX_HEIGHT_MM  # noqa: F401  (kept for parity / future use)
from api.dependencies import CurrentAdmin
from api.limiter import limiter
from api.schemas.models import (
    PricingConfigResponse,
    PricingConfigUpdate,
    QuoteRequest,
    QuoteResponse,
)
from api.services.pricing import compute_quote, weight_from_volume
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/pricing", tags=["pricing"])


def _active_config(db) -> dict:
    row = (
        db.table("pricing_config")
        .select("*")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not row or not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active pricing config")
    return row.data


@router.get("/config", response_model=PricingConfigResponse)
@limiter.limit("120/minute")
async def get_pricing_config(request: Request) -> PricingConfigResponse:
    return PricingConfigResponse(**_active_config(get_supabase()))


@router.patch("/config", response_model=PricingConfigResponse)
@limiter.limit("60/minute")
async def update_pricing_config(
    request: Request,
    body: PricingConfigUpdate,
    current_admin: CurrentAdmin,
) -> PricingConfigResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    updates = {k: str(v) for k, v in updates.items()}

    db = get_supabase()
    config = _active_config(db)
    result = db.table("pricing_config").update(updates).eq("id", config["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing config not found")
    return PricingConfigResponse(**result.data[0])


@router.post("/quote", response_model=QuoteResponse)
@limiter.limit("120/minute")
async def quote(request: Request, body: QuoteRequest) -> QuoteResponse:
    db = get_supabase()
    config = _active_config(db)

    weight = body.weight_grams
    if weight is None and body.volume_cm3 is not None:
        weight = weight_from_volume(Decimal(str(body.volume_cm3)))

    # Fall back to a rough print-time estimate (~2 min/gram) when not supplied.
    print_minutes = body.print_minutes
    if print_minutes is None:
        print_minutes = int(Decimal(str(weight)) * Decimal("2"))

    result = compute_quote(
        config=config,
        weight_grams=Decimal(str(weight)),
        print_minutes=print_minutes,
        quantity=body.quantity,
    )
    return QuoteResponse(**result)
