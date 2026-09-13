from app.routers.hotspots import router as hotspots_router
from app.routers.refineries import router as refineries_router
from app.routers.analytics import router as analytics_router
from app.routers.reports import router as reports_router
from app.routers.websockets import router as websockets_router, ws_manager
from app.routers.incidents import router as incidents_router
from app.routers.geo import router as geo_router
from app.routers.system import router as system_router

__all__ = [
    "hotspots_router",
    "refineries_router",
    "analytics_router",
    "reports_router",
    "websockets_router",
    "incidents_router",
    "geo_router",
    "system_router",
    "ws_manager"
]
