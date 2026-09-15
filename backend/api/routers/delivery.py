"""/v1/delivery — pincode serviceability + ETA.

Public availability check; admin-managed serviceable pincode list.
"""

from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentAdmin
from api.limiter import limiter
from api.schemas.models import (
    DeliveryCheckResponse,
    MessageResponse,
    ServiceablePincodeCreate,
    ServiceablePincodeResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/delivery", tags=["delivery"])


@router.get("/check", response_model=DeliveryCheckResponse)
@limiter.limit("120/minute")
async def check_delivery(request: Request, pincode: str = Query(min_length=3, max_length=12)) -> DeliveryCheckResponse:
    db = get_supabase()
    row = (
        db.table("serviceable_pincodes")
        .select("*")
        .eq("pincode", pincode)
        .maybe_single()
        .execute()
    )
    if not row or not row.data or not row.data.get("is_active"):
        return DeliveryCheckResponse(pincode=pincode, serviceable=False)
    eta_days = int(row.data["eta_days"])
    return DeliveryCheckResponse(
        pincode=pincode,
        serviceable=True,
        eta_days=eta_days,
        expected_delivery_date=date.today() + timedelta(days=eta_days),
        city=row.data["city"],
        state=row.data["state"],
    )


@router.get("/pincodes", response_model=list[ServiceablePincodeResponse])
@limiter.limit("60/minute")
async def list_pincodes(request: Request, current_admin: CurrentAdmin) -> list[ServiceablePincodeResponse]:
    db = get_supabase()
    result = db.table("serviceable_pincodes").select("*").order("pincode").execute()
    return [ServiceablePincodeResponse(**row) for row in result.data]


@router.post("/pincodes", response_model=ServiceablePincodeResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_pincode(
    request: Request,
    body: ServiceablePincodeCreate,
    current_admin: CurrentAdmin,
) -> ServiceablePincodeResponse:
    db = get_supabase()
    result = db.table("serviceable_pincodes").insert(body.model_dump()).execute()
    return ServiceablePincodeResponse(**result.data[0])


@router.delete("/pincodes/{pincode_id}", response_model=MessageResponse)
@limiter.limit("60/minute")
async def delete_pincode(request: Request, pincode_id: UUID, current_admin: CurrentAdmin) -> MessageResponse:
    db = get_supabase()
    result = db.table("serviceable_pincodes").delete().eq("id", str(pincode_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pincode not found")
    return MessageResponse(message="Pincode removed")
