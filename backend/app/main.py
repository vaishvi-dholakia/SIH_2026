import asyncio
import logging
from datetime import datetime, timezone
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
    incidents_router,
    geo_router,
    system_router,
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
    Also ensures initial active hotspots exist in database for immediate visualization.
    """
    db = SessionLocal()
    try:
        from app.models.hotspot import ActiveHotspot
        from app.services.india_boundary import is_point_in_india

        # Purge any legacy records outside Indian sovereign territory
        all_hotspots = db.query(ActiveHotspot).all()
        purged_hs = 0
        for h in all_hotspots:
            if not is_point_in_india(h.latitude, h.longitude):
                db.delete(h)
                purged_hs += 1
        
        all_refineries = db.query(Refinery).all()
        purged_ref = 0
        from app.models.suppression import SuppressionHistory
        for r in all_refineries:
            try:
                from shapely import wkt
                poly = wkt.loads(r.geometry)
                centroid = poly.centroid
                if not is_point_in_india(centroid.y, centroid.x):
                    db.query(SuppressionHistory).filter(SuppressionHistory.refinery_id == r.id).delete()
                    db.delete(r)
                    purged_ref += 1
            except Exception:
                pass
        
        # Clean orphan suppression history
        db.query(SuppressionHistory).filter(SuppressionHistory.refinery_id.is_(None)).delete()

        if purged_hs > 0 or purged_ref > 0:
            db.commit()
            logger.info(f"Purged {purged_hs} hotspots and {purged_ref} refineries outside Indian territory.")

        from app.services.osm_fetcher import OSMFetcher
        OSMFetcher.seed_environmental_zones(db)

        ref_count = db.query(Refinery).count()
        if ref_count == 0:
            logger.info("No infrastructure in database. Initiating live OpenStreetMap fetch...")
            await OSMFetcher.sync_all_from_osm(db)

        hotspot_count = db.query(ActiveHotspot).count()
        if hotspot_count == 0:
            logger.info("No hotspots in database. Ingesting initial thermal detections...")
            from app.services.historical_backfill import HistoricalBackfillService
            await HistoricalBackfillService.run_backfill(db, limit=50)

            # If NASA open feed returned no current fires, seed initial representative hotspots across India
            if db.query(ActiveHotspot).count() == 0:
                logger.info("Seeding initial thermal detections for live radar map visualization...")
                from app.services.firms_fetcher import FIRMSFetcher
                sample_fires = [
                    {"latitude": 22.350, "longitude": 69.850, "brightness": 355.0, "frp": 165.0, "confidence": 95.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 22.355, "longitude": 69.855, "brightness": 315.0, "frp": 18.0, "confidence": 85.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 29.470, "longitude": 76.960, "brightness": 345.0, "frp": 125.0, "confidence": 90.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 20.400, "longitude": 78.100, "brightness": 325.0, "frp": 45.0, "confidence": 80.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 30.300, "longitude": 75.800, "brightness": 318.0, "frp": 32.0, "confidence": 75.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 23.800, "longitude": 86.320, "brightness": 330.0, "frp": 60.0, "confidence": 88.0, "detected_at": datetime.now(timezone.utc)},
                    {"latitude": 28.700, "longitude": 77.100, "brightness": 322.0, "frp": 25.0, "confidence": 70.0, "detected_at": datetime.now(timezone.utc)},
                ]
                for raw in sample_fires:
                    await FIRMSFetcher.process_and_ingest_hotspot(raw, db)
    except Exception as e:
        logger.error(f"Error checking/syncing live data: {e}")
    finally:
        db.close()

async def periodic_firms_ingestion():
    """Periodically fetches active fire updates from NASA FIRMS and pushes live telemetry broadcasts."""
    poll_interval = getattr(settings, "FIRMS_POLL_INTERVAL_SECONDS", 300)
    heartbeat_interval = 30
    seconds_since_last_poll = poll_interval  # Trigger poll on initial execution

    while True:
        try:
            db = SessionLocal()
            try:
                from app.services.firms_fetcher import FIRMSFetcher
                from app.models.hotspot import ActiveHotspot

                if seconds_since_last_poll >= poll_interval:
                    logger.info("Executing periodic NASA FIRMS live polling cycle...")
                    await FIRMSFetcher.run_live_ingestion_cycle(db, ws_broadcast_callback=ws_manager.broadcast)
                    seconds_since_last_poll = 0

                # Push real-time telemetry pulse to all connected frontend clients
                total_hs = db.query(ActiveHotspot).count()
                critical_hs = db.query(ActiveHotspot).filter(ActiveHotspot.priority_score >= 60).count()
                await ws_manager.broadcast({
                    "type": "RADAR_STREAM_HEARTBEAT",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "active_hotspots": total_hs,
                    "critical_alerts": critical_hs,
                    "status": "LIVE_SATELLITE_FEED_ACTIVE"
                })
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error during periodic FIRMS ingestion cycle: {e}")

        await asyncio.sleep(heartbeat_interval)
        seconds_since_last_poll += heartbeat_interval

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize tables and launch background data sync tasks
    logger.info("Initializing GEO-SCD Backend Engine...")
    init_db()

    # Startup Diagnostic Check for Sentinel Hub Authentication
    from app.services.sentinel_ndvi import SentinelNDVIService
    token = await SentinelNDVIService.get_sentinel_token()
    if token:
        logger.info("[STARTUP CHECK] Sentinel Hub authentication: SUCCESS")
    else:
        err_msg = SentinelNDVIService._last_error or "Unknown authentication failure"
        logger.error(f"[STARTUP CHECK] Sentinel Hub authentication: FAILED - {err_msg[:200]}")

    osm_task = asyncio.create_task(ensure_live_osm_data())
    bg_task = asyncio.create_task(periodic_firms_ingestion())
    yield
    osm_task.cancel()
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
app.include_router(incidents_router)
app.include_router(hotspots_router)
app.include_router(refineries_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(websockets_router)
app.include_router(geo_router)
app.include_router(system_router)

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
