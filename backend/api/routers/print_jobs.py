"""/v1/print-jobs — production queue.

The public queue status (how many jobs are queued / printing and the estimated
wait) is what the storefront surfaces on a model page. The full job list and
status transitions are admin-only.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from api.dependencies import CurrentAdmin
from api.limiter import limiter
from api.schemas.models import (
    PrintJobPageResponse,
    PrintJobResponse,
    PrintJobStatus,
    PrintJobUpdate,
    QueueStatusResponse,
)
from api.services.supabase_client import get_supabase

router = APIRouter(prefix="/v1/print-jobs", tags=["print-jobs"])


@router.get("/queue", response_model=QueueStatusResponse)
@limiter.limit("120/minute")
async def queue_status(request: Request) -> QueueStatusResponse:
    db = get_supabase()
    active = (
        db.table("print_jobs")
        .select("status,est_minutes")
        .in_("status", ["queued", "printing"])
        .execute()
        .data
        or []
    )
    queued = sum(1 for j in active if j["status"] == "queued")
    printing = sum(1 for j in active if j["status"] == "printing")
    est_wait = sum(int(j.get("est_minutes") or 0) for j in active)
    return QueueStatusResponse(queued=queued, printing=printing, est_wait_minutes=est_wait)


@router.get("", response_model=PrintJobPageResponse)
@limiter.limit("60/minute")
async def list_print_jobs(
    request: Request,
    current_admin: CurrentAdmin,
    status_filter: PrintJobStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PrintJobPageResponse:
    db = get_supabase()
    query = db.table("print_jobs").select("*", count="exact").order("queue_position")
    if status_filter:
        query = query.eq("status", status_filter)
    result = query.range(offset, offset + limit - 1).execute()
    return PrintJobPageResponse(
        items=[PrintJobResponse(**row) for row in result.data],
        total=result.count or 0,
        limit=limit,
        offset=offset,
    )


@router.patch("/{job_id}", response_model=PrintJobResponse)
@limiter.limit("60/minute")
async def update_print_job(
    request: Request,
    job_id: UUID,
    body: PrintJobUpdate,
    current_admin: CurrentAdmin,
) -> PrintJobResponse:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    now = datetime.now(timezone.utc).isoformat()
    if updates.get("status") == "printing":
        updates["started_at"] = now
    elif updates.get("status") in ("completed", "failed"):
        updates["completed_at"] = now

    db = get_supabase()
    result = db.table("print_jobs").update(updates).eq("id", str(job_id)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print job not found")
    return PrintJobResponse(**result.data[0])
