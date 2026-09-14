"""
DB Reclassification Migration Script.
Reclassifies existing SQLite database records using DualModelClassifier & calculate_unified_hazard_score.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.hotspot import ActiveHotspot
from app.ml.classifier import classifier_service
from app.services.scoring import calculate_unified_hazard_score

import asyncio

async def reclassify_all():
    db = SessionLocal()
    try:
        from app.services.osm_fetcher import OSMFetcher
        from app.services.spatial_analyser import SpatialAnalyser
        from app.services.sentinel_ndvi import SentinelNDVIService

        print("Seeding environmental geofences (Forests, Farmlands, Mines, Landfills)...")
        OSMFetcher.seed_environmental_zones(db)

        hotspots = db.query(ActiveHotspot).all()
        print(f"Loaded {len(hotspots)} hotspots from DB for full spatial & NDVI reclassification...")

        updated = 0
        ndvi_updated = 0
        for h in hotspots:
            # Re-evaluate accurate spatial distances against all geofences
            spatial_res = SpatialAnalyser.analyse_point(h.latitude, h.longitude, db)

            h.distance_to_refinery_m = spatial_res.distance_to_refinery_m
            h.distance_to_population_m = spatial_res.distance_to_population_m
            h.distance_to_forest_m = spatial_res.distance_to_forest_m
            h.distance_to_farmland_m = spatial_res.distance_to_farmland_m
            h.distance_to_mining_m = spatial_res.distance_to_mining_m
            h.distance_to_landfill_m = spatial_res.distance_to_landfill_m
            h.nearest_refinery_id = spatial_res.nearest_refinery_id

            # If NDVI is pending, None, or stale 0.0, attempt Sentinel-2 fetch
            if h.ndvi is None or h.ndvi == 0.0:
                new_ndvi, bands_dict, pending = await SentinelNDVIService.fetch_and_calculate_ndvi(h.latitude, h.longitude, h.id)
                if new_ndvi is not None:
                    h.ndvi = new_ndvi
                    h.ndvi_pending = False
                    if bands_dict:
                        h.b2_reflectance = bands_dict.get("b2")
                        h.b4_reflectance = bands_dict.get("b4")
                        h.b8_reflectance = bands_dict.get("b8")
                        h.b11_reflectance = bands_dict.get("b11")
                        h.b12_reflectance = bands_dict.get("b12")
                    ndvi_updated += 1
                else:
                    h.ndvi = None
                    h.ndvi_pending = True

            eff_ndvi = h.ndvi if (h.ndvi is not None and h.ndvi != 0.0) else None

            cls_name, conf, anomaly_score = classifier_service.predict(
                brightness=h.brightness or 320.0,
                frp=h.frp or 20.0,
                confidence=h.confidence or 80.0,
                distance_to_refinery_m=spatial_res.distance_to_refinery_m,
                distance_to_population_m=spatial_res.distance_to_population_m,
                distance_to_forest_m=spatial_res.distance_to_forest_m,
                distance_to_farmland_m=spatial_res.distance_to_farmland_m,
                distance_to_mining_m=spatial_res.distance_to_mining_m,
                distance_to_landfill_m=spatial_res.distance_to_landfill_m,
                persistence_days=h.persistence_days or 1,
                ndvi=eff_ndvi,
                is_suppressed=bool(h.is_suppressed),
                db=db
            )

            score = calculate_unified_hazard_score(
                classification=cls_name,
                frp=h.frp or 20.0,
                distance_to_refinery_m=spatial_res.distance_to_refinery_m,
                distance_to_population_m=spatial_res.distance_to_population_m,
                anomaly_score=anomaly_score,
                is_suppressed=bool(h.is_suppressed)
            )

            h.classification = cls_name
            h.model_confidence = conf
            h.anomaly_score = anomaly_score
            h.priority_score = score
            updated += 1

        db.commit()
        print(f"Successfully reclassified {updated} hotspots in DB! Updated {ndvi_updated} pending NDVI values.")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(reclassify_all())
