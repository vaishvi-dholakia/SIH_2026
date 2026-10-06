from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.hotspot import ActiveHotspot
from app.services.sentinel_ndvi import SentinelNDVIService
from app.services.historical_backfill import HistoricalBackfillService

router = APIRouter(prefix="/api/system", tags=["System Diagnostics"])

@router.get("/sentinel-status")
async def get_sentinel_status():
    """
    Lightweight diagnostic endpoint returning live Sentinel Hub connection status and last error log snippet.
    """
    token = await SentinelNDVIService.get_sentinel_token()
    is_connected = token is not None
    return {
        "sentinel_hub_connected": is_connected,
        "last_error": SentinelNDVIService._last_error if not is_connected else None
    }

@router.get("/temporal-status")
def get_temporal_status(db: Session = Depends(get_db)):
    """
    Returns live database temporal depth diagnostic metrics:
    total rows, distinct calendar days, oldest & newest records, date span, and cold start health.
    """
    stats = db.query(
        func.count(ActiveHotspot.id).label("total_rows"),
        func.count(func.distinct(func.date(ActiveHotspot.detected_at))).label("distinct_days"),
        func.min(ActiveHotspot.detected_at).label("oldest_record"),
        func.max(ActiveHotspot.detected_at).label("latest_record")
    ).first()

    total_rows = (stats.total_rows if stats else 0) or 0
    distinct_days = (stats.distinct_days if stats else 0) or 0
    oldest_record = stats.oldest_record if stats else None
    latest_record = stats.latest_record if stats else None

    is_stale = False
    date_span_days = 0

    if latest_record:
        rec_dt = latest_record
        if rec_dt.tzinfo is None:
            rec_dt = rec_dt.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - rec_dt
        if age > timedelta(hours=24):
            is_stale = True

    if latest_record and oldest_record:
        rec_max = latest_record if latest_record.tzinfo else latest_record.replace(tzinfo=timezone.utc)
        rec_min = oldest_record if oldest_record.tzinfo else oldest_record.replace(tzinfo=timezone.utc)
        date_span_days = max(0, (rec_max - rec_min).days)

    insufficient_depth = (total_rows < 100) or (distinct_days < 20) or (date_span_days < 25)
    needs_backfill = insufficient_depth or is_stale

    return {
        "status": "HEALTHY" if not needs_backfill else "INSUFFICIENT_DEPTH",
        "total_hotspots": total_rows,
        "distinct_calendar_days": distinct_days,
        "date_span_days": date_span_days,
        "oldest_record": oldest_record.isoformat() if oldest_record else None,
        "latest_record": latest_record.isoformat() if latest_record else None,
        "is_stale": is_stale,
        "needs_backfill": needs_backfill
    }

@router.post("/backfill")
async def trigger_manual_backfill(
    force: bool = Query(False, description="Force override existing records and re-process 30-day NASA archive"),
    limit: Optional[int] = Query(None, description="Maximum number of historical records to process (default: None for full archive)"),
    db: Session = Depends(get_db)
):
    """
    Triggers clean NASA 30-day historical backfill on demand without database wipes.
    Supports force_override=True for clean re-evaluations during live SIH jury presentations.
    """
    result = await HistoricalBackfillService.run_backfill(db, limit=limit, force_override=force)
    return {
        "status": "SUCCESS",
        "message": "Historical NASA FIRMS archive backfill completed successfully.",
        "details": result
    }
