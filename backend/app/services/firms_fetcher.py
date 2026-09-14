import csv
import io
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from app.config import settings
from app.models.hotspot import ActiveHotspot
from app.services.spatial_analyser import SpatialAnalyser
from app.services.suppression import SuppressionEngine
from app.services.sentinel_ndvi import SentinelNDVIService
from app.ml.classifier import classifier_service

logger = logging.getLogger("geoscd.firms_fetcher")

# India Bounding Box
BBOX_WEST, BBOX_SOUTH, BBOX_EAST, BBOX_NORTH = settings.INDIA_BBOX

class FIRMSFetcher:
    """
    Asynchronous NASA FIRMS Ingestion Pipeline.
    Strictly pulls real thermal anomaly data from official NASA endpoints.
    Executes the required conditional ingestion sequence with zero mock fallbacks.
    """

    @classmethod
    async def fetch_firms_data(
        cls,
        day_range: int = 1,
        source: str = "VIIRS_SNPP_NRT"
    ) -> List[Dict[str, Any]]:
        """
        Fetches authentic NASA FIRMS thermal detections asynchronously.
        If FIRMS_MAP_KEY is provided, queries the official NASA FIRMS Country/Area API.
        If MAP_KEY is not yet configured, queries NASA's official open active fire South Asia feed.
        """
        map_key = settings.FIRMS_MAP_KEY
        csv_text = ""

        async with httpx.AsyncClient(timeout=30.0) as client:
            if map_key and len(map_key) > 5 and map_key != "YOUR_NASA_FIRMS_MAP_KEY_HERE":
                # Official Keyed Area API for India
                bbox_str = f"{int(BBOX_WEST)},{int(BBOX_SOUTH)},{int(BBOX_EAST)},{int(BBOX_NORTH)}"
                url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{bbox_str}/{day_range}"
                logger.info(f"Querying NASA FIRMS Keyed Area API: {url.replace(map_key, '***')}")
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200 and not resp.text.startswith("Invalid"):
                        csv_text = resp.text
                    else:
                        logger.error(f"NASA FIRMS API returned status {resp.status_code}: {resp.text[:120]}")
                        return []
                except Exception as e:
                    logger.error(f"Failed to connect to NASA FIRMS API: {e}")
                    return []
            else:
                # Official NASA FIRMS Open Data Feed for South Asia (filtered strictly to India)
                logger.info("FIRMS_MAP_KEY not configured. Pulling from official NASA FIRMS public regional archive...")
                open_url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv"
                try:
                    resp = await client.get(open_url)
                    if resp.status_code == 200:
                        csv_text = resp.text
                    else:
                        # Backup open feed
                        backup_url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_Asia_24h.csv"
                        b_resp = await client.get(backup_url)
                        if b_resp.status_code == 200:
                            csv_text = b_resp.text
                        else:
                            logger.error("Could not reach official NASA FIRMS open feeds.")
                            return []
                except Exception as e:
                    logger.error(f"Error fetching NASA FIRMS open feed: {e}")
                    return []

        if not csv_text:
            return []

        records = cls.parse_firms_csv(csv_text)
        logger.info(f"Retrieved {len(records)} authentic NASA FIRMS detections within India.")
        return records

    @classmethod
    def parse_firms_csv(cls, csv_text: str) -> List[Dict[str, Any]]:
        """Parses NASA FIRMS CSV stream and extracts detections inside India."""
        records = []
        reader = csv.DictReader(io.StringIO(csv_text))

        for row in reader:
            try:
                lat = float(row.get("latitude", 0))
                lon = float(row.get("longitude", 0))

                # Filter strictly inside Indian Sovereign Territory
                from app.services.india_boundary import is_point_in_india
                if not is_point_in_india(lat, lon):
                    continue

                # Parse brightness (VIIRS bright_ti4 or MODIS brightness)
                brightness = float(
                    row.get("bright_ti4") or row.get("brightness") or row.get("bright_ti5") or 300.0
                )
                
                # Parse FRP (Fire Radiative Power in MW)
                frp = float(row.get("frp", 0.0) or 0.0)

                # Parse confidence: VIIRS can be 'l', 'n', 'h', MODIS is 0-100
                conf_raw = row.get("confidence", "50")
                if conf_raw == "l":
                    confidence = 30.0
                elif conf_raw == "n":
                    confidence = 65.0
                elif conf_raw == "h":
                    confidence = 95.0
                else:
                    try:
                        confidence = float(conf_raw)
                    except ValueError:
                        confidence = 50.0

                # Parse acquisition date and time
                acq_date = row.get("acq_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
                acq_time = row.get("acq_time", "0000").zfill(4)
                hour = int(acq_time[:2])
                minute = int(acq_time[2:4])
                
                dt_str = f"{acq_date} {hour:02d}:{minute:02d}:00"
                detected_at = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

                records.append({
                    "latitude": lat,
                    "longitude": lon,
                    "brightness": brightness,
                    "frp": frp,
                    "confidence": confidence,
                    "detected_at": detected_at
                })
            except Exception as parse_err:
                continue

        return records

    @classmethod
    async def process_and_ingest_hotspot(
        cls,
        raw: Dict[str, Any],
        db: Session,
        ws_broadcast_callback=None
    ) -> Optional[ActiveHotspot]:
        """
        Executes the mandatory 5-step conditional ingestion sequence:
        1. Spatial Analysis: metric distances to nearest refinery and population center
        2. Suppression Check: temporal-spatial baseline & FRP surge checks
        3. Conditional Satellite Trigger:
           - Suppressed: Check DB for historical real NDVI at coordinate; else ndvi=None, ndvi_pending=True
           - Unsuppressed: Trigger Sentinel-2 download for true NDVI and SWIR composite
        4. Dual-Model Inference & Scoring:
           - Isolation Forest + Random Forest
           - 0-100 Priority Risk Score
           - XAI Explanation generation
        5. Upsert: Save to ActiveHotspot table and broadcast critical events
        """
        lat = raw["latitude"]
        lon = raw["longitude"]

        from app.services.india_boundary import is_point_in_india
        if not is_point_in_india(lat, lon):
            logger.info(f"Skipping hotspot at ({lat}, {lon}) - outside Indian sovereign territory.")
            return None

        brightness = raw["brightness"]
        frp = raw["frp"]
        confidence = raw["confidence"]
        detected_at = raw["detected_at"]

        # Step 1: Spatial Analysis
        spatial_res = SpatialAnalyser.analyse_point(lat, lon, db)

        # Step 2: Suppression Check
        is_suppressed, is_critical_alarm, hist_baseline_frp, frp_ratio, frp_change_pct, persistence_days, suppression_reason = (
            SuppressionEngine.evaluate(
                lat=lat,
                lon=lon,
                current_frp=frp,
                nearest_refinery_id=spatial_res.nearest_refinery_id,
                detected_at=detected_at,
                db=db
            )
        )

        # Step 3: Conditional Satellite Trigger
        ndvi = None
        ndvi_pending = False

        bands_dict = None
        if is_suppressed:
            # Check historical database for any previously recorded real NDVI value at this exact coordinate
            coord_tol = 0.002
            past_rec = db.query(ActiveHotspot.ndvi).filter(
                ActiveHotspot.latitude.between(lat - coord_tol, lat + coord_tol),
                ActiveHotspot.longitude.between(lon - coord_tol, lon + coord_tol),
                ActiveHotspot.ndvi.isnot(None)
            ).first()

            if past_rec and past_rec[0] is not None:
                ndvi = past_rec[0]
                ndvi_pending = False
            else:
                ndvi = None
                ndvi_pending = True
        else:
            # Unsuppressed: Trigger real Sentinel-2 multispectral pipeline
            ndvi, bands_dict, ndvi_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)

        b2_val = bands_dict.get("b2") if bands_dict else None
        b4_val = bands_dict.get("b4") if bands_dict else None
        b8_val = bands_dict.get("b8") if bands_dict else None
        b11_val = bands_dict.get("b11") if bands_dict else None
        b12_val = bands_dict.get("b12") if bands_dict else None

        # Step 4: Dual-Model Inference & Unified Scoring
        classification, model_conf, anomaly_score = classifier_service.predict(
            brightness=brightness,
            frp=frp,
            confidence=confidence,
            distance_to_refinery_m=spatial_res.distance_to_refinery_m,
            distance_to_population_m=spatial_res.distance_to_population_m,
            distance_to_forest_m=spatial_res.distance_to_forest_m,
            distance_to_farmland_m=spatial_res.distance_to_farmland_m,
            distance_to_mining_m=spatial_res.distance_to_mining_m,
            distance_to_landfill_m=spatial_res.distance_to_landfill_m,
            persistence_days=persistence_days,
            ndvi=ndvi,
            is_suppressed=is_suppressed,
            db=db
        )

        from app.services.scoring import calculate_unified_hazard_score
        priority_score = calculate_unified_hazard_score(
            classification=classification,
            frp=frp,
            distance_to_refinery_m=spatial_res.distance_to_refinery_m,
            distance_to_population_m=spatial_res.distance_to_population_m,
            anomaly_score=anomaly_score,
            is_suppressed=is_suppressed
        )

        # Step 5: Upsert into ActiveHotspot Table
        # Check if record at same coordinate and acquisition timestamp already exists
        existing = db.query(ActiveHotspot).filter(
            ActiveHotspot.latitude == lat,
            ActiveHotspot.longitude == lon,
            ActiveHotspot.detected_at == detected_at
        ).first()

        if existing:
            hotspot = existing
            hotspot.brightness = brightness
            hotspot.frp = frp
            hotspot.confidence = confidence
            if ndvi is not None:
                hotspot.ndvi = ndvi
                hotspot.ndvi_pending = False
            if b2_val is not None:
                hotspot.b2_reflectance = b2_val
                hotspot.b4_reflectance = b4_val
                hotspot.b8_reflectance = b8_val
                hotspot.b11_reflectance = b11_val
                hotspot.b12_reflectance = b12_val
            hotspot.persistence_days = persistence_days
            hotspot.distance_to_refinery_m = spatial_res.distance_to_refinery_m
            hotspot.distance_to_population_m = spatial_res.distance_to_population_m
            hotspot.distance_to_forest_m = spatial_res.distance_to_forest_m
            hotspot.distance_to_farmland_m = spatial_res.distance_to_farmland_m
            hotspot.distance_to_mining_m = spatial_res.distance_to_mining_m
            hotspot.distance_to_landfill_m = spatial_res.distance_to_landfill_m
            hotspot.anomaly_score = anomaly_score
            hotspot.priority_score = priority_score
            hotspot.classification = classification
            hotspot.model_confidence = model_conf
            hotspot.is_suppressed = is_suppressed
            hotspot.nearest_refinery_id = spatial_res.nearest_refinery_id
        else:
            hotspot = ActiveHotspot(
                latitude=lat,
                longitude=lon,
                brightness=brightness,
                frp=frp,
                confidence=confidence,
                ndvi=ndvi,
                ndvi_pending=ndvi_pending,
                b2_reflectance=b2_val,
                b4_reflectance=b4_val,
                b8_reflectance=b8_val,
                b11_reflectance=b11_val,
                b12_reflectance=b12_val,
                persistence_days=persistence_days,
                distance_to_refinery_m=spatial_res.distance_to_refinery_m,
                distance_to_population_m=spatial_res.distance_to_population_m,
                distance_to_forest_m=spatial_res.distance_to_forest_m,
                distance_to_farmland_m=spatial_res.distance_to_farmland_m,
                distance_to_mining_m=spatial_res.distance_to_mining_m,
                distance_to_landfill_m=spatial_res.distance_to_landfill_m,
                anomaly_score=anomaly_score,
                priority_score=priority_score,
                detected_at=detected_at,
                classification=classification,
                model_confidence=model_conf,
                is_suppressed=is_suppressed,
                status="new",
                nearest_refinery_id=spatial_res.nearest_refinery_id
            )
            db.add(hotspot)

        db.commit()
        db.refresh(hotspot)

        # Auto-update SuppressionHistory baseline for nearest refinery if within 10km
        if spatial_res.nearest_refinery_id and spatial_res.distance_to_refinery_m <= 10000.0:
            try:
                from app.models.suppression import SuppressionHistory
                today_date = detected_at.date()
                supp_rec = db.query(SuppressionHistory).filter(
                    SuppressionHistory.refinery_id == spatial_res.nearest_refinery_id,
                    SuppressionHistory.detection_date == today_date
                ).first()
                if supp_rec:
                    supp_rec.average_frp = round((supp_rec.average_frp + frp) / 2.0, 2)
                else:
                    supp_rec = SuppressionHistory(
                        refinery_id=spatial_res.nearest_refinery_id,
                        detection_date=today_date,
                        average_frp=round(frp, 2),
                        average_footprint_sqm=50000.0
                    )
                    db.add(supp_rec)
                db.commit()
            except Exception as e:
                logger.debug(f"Could not auto-update suppression history: {e}")

        # Broadcast critical or unsuppressed incidents over WebSockets
        if ws_broadcast_callback and (not is_suppressed or is_critical_alarm or priority_score >= 60):
            try:
                alert_payload = {
                    "type": "FIRE_ALERT",
                    "id": hotspot.id,
                    "latitude": hotspot.latitude,
                    "longitude": hotspot.longitude,
                    "frp": hotspot.frp,
                    "classification": hotspot.classification,
                    "priority_score": hotspot.priority_score,
                    "is_critical": is_critical_alarm,
                    "is_suppressed": hotspot.is_suppressed,
                    "refinery_name": spatial_res.nearest_refinery_name,
                    "distance_to_refinery_m": hotspot.distance_to_refinery_m,
                    "detected_at": hotspot.detected_at.isoformat()
                }
                await ws_broadcast_callback(alert_payload)
            except Exception as ws_err:
                logger.warning(f"Failed broadcasting alert to WebSocket clients: {ws_err}")

        return hotspot

    @classmethod
    async def run_live_ingestion_cycle(cls, db: Session, ws_broadcast_callback=None) -> int:
        """Scheduled / On-Demand active ingestion routine."""
        import asyncio
        raw_fires = await cls.fetch_firms_data(day_range=1)
        # Sort by Fire Radiative Power (FRP) and process top 50 most critical detections per cycle
        top_fires = sorted(raw_fires, key=lambda x: x.get('frp', 0.0), reverse=True)[:50]
        count = 0
        for raw in top_fires:
            res = await cls.process_and_ingest_hotspot(raw, db, ws_broadcast_callback)
            if res:
                count += 1
            await asyncio.sleep(0.01) # Yield event loop so FastAPI handles incoming API requests instantly
        logger.info(f"Ingestion cycle completed. Processed {count} high-priority hotspots.")
        return count
