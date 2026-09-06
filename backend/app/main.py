import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, SessionLocal
from app.models.refinery import Refinery
from app.models.population import PopulationCenter
from app.routers import (
    hotspots_router,
    refineries_router,
    analytics_router,
    reports_router,
    websockets_router,
    ws_manager
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("geoscd.main")

async def ensure_live_osm_data():
    """
    Checks if OpenStreetMap infrastructure exists in DB;
    if not, dynamically fetches live refineries and settlements from OpenStreetMap Overpass API.
    Zero static or hardcoded infrastructure.
    """
    db = SessionLocal()
    try:
        ref_count = db.query(Refinery).count()
        if ref_count == 0:
            logger.info("No infrastructure in database. Initiating live OpenStreetMap fetch...")
            from app.services.osm_fetcher import OSMFetcher
            await OSMFetcher.sync_all_from_osm(db)
    except Exception as e:
        logger.error(f"Error checking/syncing live OSM data: {e}")
    finally:
        db.close()

async def periodic_firms_ingestion(interval_seconds: int = 600):
    """Periodically fetches active fire updates from NASA FIRMS in background every 10 mins."""
    while True:
        try:
            logger.info("Executing periodic NASA FIRMS live polling cycle...")
            db = SessionLocal()
            try:
                from app.services.firms_fetcher import FIRMSFetcher
                await FIRMSFetcher.run_live_ingestion_cycle(db, ws_broadcast_callback=ws_manager.broadcast)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error during periodic FIRMS ingestion cycle: {e}")
        await asyncio.sleep(interval_seconds)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize tables and sync live OSM data
    logger.info("Initializing GEO-SCD Backend Engine...")
    init_db()
    await ensure_live_osm_data()
    bg_task = asyncio.create_task(periodic_firms_ingestion(interval_seconds=600))
    yield
    bg_task.cancel()
    # Shutdown
    logger.info("Shutting down GEO-SCD Backend Engine.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Driven Geospatial Fire & Gas Flare Classification Backend for NTRO (Problem Statement 26162)",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(hotspots_router)
app.include_router(refineries_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(websockets_router)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": "ok"}
