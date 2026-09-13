from fastapi import APIRouter
from app.services.sentinel_ndvi import SentinelNDVIService

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
