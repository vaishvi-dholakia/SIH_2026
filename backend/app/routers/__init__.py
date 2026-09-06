from app.routers.hotspots import router as hotspots_router
from app.routers.refineries import router as refineries_router
from app.routers.analytics import router as analytics_router
from app.routers.reports import router as reports_router
from app.routers.websockets import router as websockets_router, ws_manager

__all__ = [
    "hotspots_router",
    "refineries_router",
    "analytics_router",
    "reports_router",
    "websockets_router",
    "ws_manager"
]
