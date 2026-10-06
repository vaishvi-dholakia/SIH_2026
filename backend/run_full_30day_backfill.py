import asyncio
import time
import logging
from sqlalchemy import text
from app.database import SessionLocal, init_db
from app.models.hotspot import ActiveHotspot
from app.services.historical_backfill import HistoricalBackfillService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("geoscd.full_backfill")

async def main():
    logger.info("=================================================================")
    logger.info("STARTING FULL 30-DAY HISTORICAL BACKFILL (16,582 AUTHENTIC RECORDS)")
    logger.info("=================================================================")
    
    start_time = time.time()
    db = SessionLocal()
    
    try:
        # Step 1: Clean slate truncate active_hotspots for pristine chronological ingestion
        logger.info("[STEP 1] Truncating active_hotspots table for pristine persistence tracking...")
        db.execute(text("TRUNCATE TABLE active_hotspots RESTART IDENTITY CASCADE;"))
        db.commit()
        logger.info("[STEP 1] active_hotspots table truncated successfully.")
        
        # Step 2: Run Full Chronological Backfill
        logger.info("[STEP 2] Running HistoricalBackfillService with limit=None...")
        await HistoricalBackfillService.run_backfill(db, limit=None, force_override=True)
        
        elapsed = time.time() - start_time
        logger.info(f"[STEP 2] Full backfill completed in {elapsed:.1f} seconds ({elapsed/60:.2f} minutes)!")
        
        # Step 3: Run Comprehensive SQL Audits
        logger.info("=================================================================")
        logger.info("DATABASE VERIFICATION AUDIT")
        logger.info("=================================================================")
        
        # 1. Total records & NDVI count
        result = db.execute(text("""
            SELECT 
                count(*) as total,
                count(ndvi) as with_ndvi,
                count(DISTINCT ndvi) as distinct_ndvi,
                min(detected_at) as min_date,
                max(detected_at) as max_date
            FROM active_hotspots;
        """)).fetchone()
        
        logger.info(f"Total Hotspots in DB: {result[0]}")
        logger.info(f"Hotspots with Sentinel-2 NDVI: {result[1]}")
        logger.info(f"Distinct Unique Sentinel-2 NDVIs: {result[2]}")
        logger.info(f"Min Detected At: {result[3]}")
        logger.info(f"Max Detected At: {result[4]}")
        
        # Check vegetation nulls
        veg_nulls = db.execute(text("""
            SELECT count(*) 
            FROM active_hotspots 
            WHERE classification IN ('Agricultural / Stubble Burning', 'Forest Fire / Wildfire') AND ndvi IS NULL;
        """)).scalar()
        logger.info(f"===> Vegetation Hotspots with NULL NDVI: {veg_nulls} (TARGET: 0) <===")
        
        # 2. Date-by-date distribution (All 31 days)
        logger.info("\n--- DAY-BY-DAY HOTSPOT COUNTS (06-SEP to 06-OCT) ---")
        date_rows = db.execute(text("""
            SELECT CAST(detected_at AS DATE) as d, count(*) as cnt
            FROM active_hotspots
            GROUP BY d
            ORDER BY d ASC;
        """)).fetchall()
        
        for r in date_rows:
            logger.info(f"  {r[0]}: {r[1]} hotspots")
            
        logger.info(f"Total Unique Days in DB: {len(date_rows)} / 31")
        
        # 3. Persistence Days Distribution
        logger.info("\n--- PERSISTENCE DAYS DISTRIBUTION ---")
        pers_rows = db.execute(text("""
            SELECT persistence_days, count(*) 
            FROM active_hotspots 
            GROUP BY persistence_days 
            ORDER BY persistence_days ASC;
        """)).fetchall()
        for r in pers_rows:
            logger.info(f"  Persistence = {r[0]} day(s): {r[1]} hotspots")
            
        # 4. Classification Breakdown
        logger.info("\n--- ML CLASSIFICATION BREAKDOWN ---")
        cls_rows = db.execute(text("""
            SELECT classification, count(*)
            FROM active_hotspots
            GROUP BY classification
            ORDER BY count(*) DESC;
        """)).fetchall()
        for r in cls_rows:
            logger.info(f"  {r[0]}: {r[1]} hotspots")

    except Exception as e:
        logger.error(f"Fatal error during full backfill: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
