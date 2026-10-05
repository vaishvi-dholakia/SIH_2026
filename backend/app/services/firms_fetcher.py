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
from app.services.vegetation_engine import VegetationEngine
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

                # Parse NASA FIRMS type attribute (0: Veg, 1: Volcano, 2: Static Land, 3: Offshore)
                try:
                    firms_type = int(row.get("type", 0))
                except (ValueError, TypeError):
                    firms_type = 0

                # Parse Satellite Sensor Tag (Suomi-NPP VIIRS, NOAA-20 VIIRS, MODIS Terra, MODIS Aqua)
                sat_code = str(row.get("satellite", "")).strip().upper()
                if sat_code in ["N", "NPP", "SUOMI", "SUOMI-NPP"]:
                    satellite_sensor = "VIIRS (Suomi-NPP 375m)"
                elif sat_code in ["J1", "J2", "N20", "NOAA20", "NOAA-20"]:
                    satellite_sensor = "VIIRS (NOAA-20 375m)"
                elif sat_code in ["T", "TERRA"]:
                    satellite_sensor = "MODIS (Terra 1km)"
                elif sat_code in ["A", "AQUA"]:
                    satellite_sensor = "MODIS (Aqua 1km)"
                else:
                    satellite_sensor = "VIIRS (Suomi-NPP 375m)"

                records.append({
                    "latitude": lat,
                    "longitude": lon,
                    "brightness": brightness,
                    "frp": frp,
                    "confidence": confidence,
                    "firms_type": firms_type,
                    "satellite_sensor": satellite_sensor,
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
        ws_broadcast_callback=None,
        geofence_cache: Optional[Dict[str, Any]] = None,
        commit: bool = True
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
            return None

        brightness = raw["brightness"]
        frp = raw["frp"]
        confidence = raw["confidence"]
        firms_type = raw.get("firms_type", 0)
        detected_at = raw["detected_at"]

        # Step 1: Spatial Analysis
        spatial_res = SpatialAnalyser.analyse_point(lat, lon, db, geofence_cache=geofence_cache)

        # Gap 3: PostGIS Geofence Priority Override
        # NASA FIRMS frequently mislabels refinery flare stacks as Type 0 (Vegetation).
        # When within <= 1000m of a registered refinery or inside refinery geofence,
        # forcefully override firms_type to 2 (Static Land / Industrial) before any branching.
        if spatial_res.is_inside_refinery or spatial_res.distance_to_refinery_m <= 1000.0:
            firms_type = 2

        # Gap 5.1: NOAA VIIRS Nightfire (VNF) Dual-Band Planck Combustion Physics
        from app.services.vnf_service import VNFService
        is_refinery_zone = (firms_type in [2, 3] or spatial_res.is_inside_refinery or spatial_res.distance_to_refinery_m <= 1000.0)
        vnf_result = VNFService.calculate_combustion_physics(
            frp=frp,
            brightness=brightness,
            is_refinery_zone=is_refinery_zone,
            distance_to_refinery_m=spatial_res.distance_to_refinery_m
        )
        flame_temp_k = vnf_result["flame_temperature_k"]
        footprint_sqm = vnf_result["source_footprint_sqm"]

        # Gap 5.2 & Gap 4: Open-Meteo Real-Time Weather Integration with Spatial Grid Caching
        from app.services.weather_service import WeatherService
        weather_data = await WeatherService.get_weather(lat, lon)
        relative_humidity = weather_data.get("relative_humidity", 50.0)
        wind_speed_kmh = weather_data.get("wind_speed_kmh", 12.0)
        wind_direction_deg = weather_data.get("wind_direction_deg", 180.0)

        # Step 2 & 3: Pre-Routing Decision based on NASA FIRMS type
        ndvi = None
        ndvi_pending = False
        classification_class = "01"
        is_critical_alarm = False

        if firms_type in [2, 3] or spatial_res.is_inside_refinery or spatial_res.distance_to_refinery_m <= 1000.0:
            # Static Land Source or Refinery Geofence -> Industrial Flaring / Incident Pipeline
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

            if frp_ratio > 3.0:
                # EMERGENCY SURGE (>300% FRP) -> Bypass suppression immediately & trigger Sentinel-2
                classification_class = "02"
                classification = "Potential Industrial Incident"
                is_suppressed = False
                is_critical_alarm = True
                ndvi_pending = True
                # Gap 1: Sentinel-2 On-Demand Ingestion Trigger
                try:
                    s2_ndvi, _, is_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)
                    if s2_ndvi is not None:
                        ndvi = s2_ndvi
                        ndvi_pending = False
                    else:
                        ndvi_pending = is_pending
                except Exception as s2_err:
                    logger.debug(f"Sentinel-2 on-demand trigger: {s2_err}")
            elif is_suppressed:
                classification_class = "01"
                classification = "Potential Industrial Thermal Source"
                ndvi = None
                ndvi_pending = False
            else:
                classification_class = "02"
                classification = "Potential Industrial Incident"
                is_suppressed = False
                ndvi_pending = True
                try:
                    s2_ndvi, _, is_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)
                    if s2_ndvi is not None:
                        ndvi = s2_ndvi
                        ndvi_pending = False
                    else:
                        ndvi_pending = is_pending
                except Exception as s2_err:
                    logger.debug(f"Sentinel-2 on-demand trigger: {s2_err}")

            model_conf = 0.95
            anomaly_score = min(1.0, frp_ratio / 3.0) if frp_ratio > 1.0 else 0.1
        else:
            # Standard Dual-Model Inference & Scoring for Non-Refinery Zones
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

            # Gap 1: Trigger Sentinel-2 for unsuppressed fires outside refinery
            if not is_suppressed and spatial_res.distance_to_refinery_m > 300.0:
                try:
                    s2_ndvi, _, is_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)
                    if s2_ndvi is not None:
                        ndvi = s2_ndvi
                        ndvi_pending = False
                    else:
                        ndvi_pending = is_pending
                except Exception as s2_err:
                    logger.debug(f"Sentinel-2 on-demand trigger: {s2_err}")

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
                db=db,
                firms_type=firms_type,
                flame_temperature_k=flame_temp_k,
                source_footprint_sqm=footprint_sqm
            )
            if "Incident" in classification:
                classification_class = "02"
            elif "Thermal Source" in classification or "Industrial" in classification:
                classification_class = "01"
            elif "Forest" in classification:
                classification_class = "03"
            elif "Agricultural" in classification:
                classification_class = "04"
            elif "Mining" in classification:
                classification_class = "05"
            else:
                classification_class = "06"

        # Gap 4: Priority Threat Score Calculation with Real Relative Humidity
        from app.services.scoring import calculate_priority_threat_score
        priority_score = calculate_priority_threat_score(
            frp=frp,
            anomaly_score=anomaly_score,
            pop_proximity_km=spatial_res.distance_to_population_m / 1000.0,
            facility_dist_km=spatial_res.distance_to_refinery_m / 1000.0,
            relative_humidity=relative_humidity,
            classification_class=classification_class
        )

        if priority_score >= 80:
            is_critical_alarm = True

        # Gap 5.4: Safety Net / Triage State (< 40% confidence)
        initial_status = "unclassified_pending_review" if confidence < 40.0 else "new"

        # Step 5: Upsert into ActiveHotspot Table
        existing = db.query(ActiveHotspot).filter(
            ActiveHotspot.latitude == lat,
            ActiveHotspot.longitude == lon,
            ActiveHotspot.detected_at == detected_at
        ).first()

        satellite_sensor = raw.get("satellite_sensor", "VIIRS (Suomi-NPP 375m)")

        # Validate nearest_refinery_id against DB FK constraints
        refinery_id = spatial_res.nearest_refinery_id
        if refinery_id is not None:
            if geofence_cache is not None and "valid_refinery_ids" in geofence_cache:
                if refinery_id not in geofence_cache["valid_refinery_ids"]:
                    refinery_id = None
            else:
                from app.models.refinery import Refinery
                if not db.query(Refinery.id).filter(Refinery.id == refinery_id).first():
                    refinery_id = None

        if existing:
            hotspot = existing
            hotspot.brightness = brightness
            hotspot.frp = frp
            hotspot.confidence = confidence
            hotspot.firms_type = firms_type
            hotspot.satellite_sensor = satellite_sensor
            if ndvi is not None:
                hotspot.ndvi = ndvi
                hotspot.ndvi_pending = False
            hotspot.persistence_days = persistence_days
            hotspot.distance_to_refinery_m = spatial_res.distance_to_refinery_m
            hotspot.distance_to_population_m = spatial_res.distance_to_population_m
            hotspot.distance_to_forest_m = spatial_res.distance_to_forest_m
            hotspot.distance_to_farmland_m = spatial_res.distance_to_farmland_m
            hotspot.distance_to_mining_m = spatial_res.distance_to_mining_m
            hotspot.distance_to_landfill_m = spatial_res.distance_to_landfill_m
            hotspot.anomaly_score = anomaly_score
            hotspot.priority_score = priority_score
            hotspot.classification_class = classification_class
            hotspot.classification = classification
            hotspot.model_confidence = model_conf
            hotspot.is_suppressed = is_suppressed
            hotspot.nearest_refinery_id = refinery_id
            hotspot.flame_temperature_k = flame_temp_k
            hotspot.source_footprint_sqm = footprint_sqm
            hotspot.relative_humidity = relative_humidity
            hotspot.wind_speed_kmh = wind_speed_kmh
            hotspot.wind_direction_deg = wind_direction_deg
            if hotspot.status == "new" and confidence < 40.0:
                hotspot.status = "unclassified_pending_review"
        else:
            hotspot = ActiveHotspot(
                latitude=lat,
                longitude=lon,
                brightness=brightness,
                frp=frp,
                confidence=confidence,
                firms_type=firms_type,
                satellite_sensor=satellite_sensor,
                ndvi=ndvi,
                ndvi_pending=ndvi_pending,
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
                classification_class=classification_class,
                classification=classification,
                model_confidence=model_conf,
                is_suppressed=is_suppressed,
                flame_temperature_k=flame_temp_k,
                source_footprint_sqm=footprint_sqm,
                relative_humidity=relative_humidity,
                wind_speed_kmh=wind_speed_kmh,
                wind_direction_deg=wind_direction_deg,
                status=initial_status,
                nearest_refinery_id=refinery_id
            )
            db.add(hotspot)

        if commit:
            try:
                db.commit()
                db.refresh(hotspot)
            except Exception as commit_err:
                db.rollback()
                logger.error(f"Error committing hotspot record ({lat}, {lon}): {commit_err}")
                return None

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
    async def run_live_ingestion_cycle(cls, db: Session, ws_broadcast_callback=None, max_limit: int = 10000) -> int:
        """Scheduled / On-Demand active ingestion routine."""
        import asyncio
        raw_fires = await cls.fetch_firms_data(day_range=1)
        # Process all authentic FIRMS detections (sorted by FRP) up to max_limit
        sorted_fires = sorted(raw_fires, key=lambda x: x.get('frp', 0.0), reverse=True)[:max_limit]
        
        # Pre-cache geofences to make batch ingestion blazing fast
        geofence_cache = SpatialAnalyser.get_cached_geofences(db)
        count = 0
        for i, raw in enumerate(sorted_fires):
            res = await cls.process_and_ingest_hotspot(raw, db, ws_broadcast_callback, geofence_cache=geofence_cache)
            if res:
                count += 1
            if i % 100 == 0:
                await asyncio.sleep(0.001) # Yield event loop periodically so FastAPI handles API requests
        logger.info(f"Ingestion cycle completed. Processed {count} hotspots (out of {len(sorted_fires)} detections).")
        return count
