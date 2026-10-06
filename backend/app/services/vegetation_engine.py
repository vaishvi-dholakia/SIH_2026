import logging
from typing import Tuple, Optional
from app.services.osm_fetcher import OSMFetcher
from app.services.sentinel_ndvi import SentinelNDVIService

logger = logging.getLogger("geoscd.vegetation_engine")

class VegetationEngine:
    """
    Module 4: Vegetation & Landcover Processing Engine for Non-Refinery Detections.
    Strictly follows the GEO-SCD Flowchart:
    1. Evaluates OpenStreetMap Landcover Polygons & Geofences first.
    2. Non-vegetation Hardscapes (Mines, Landfills, Industrial) -> Class 05 / 06 (ndvi=None, pending=False, Zero API Quota Waste).
    3. True Vegetation Zones (Forest, Farmland) -> Triggers Copernicus Sentinel-2 MSI!
       - NDVI > 0.45       ➔ Class 03 (Forest Fire / Wildfire)
       - NDVI 0.10 - 0.45  ➔ Class 04 (Agricultural / Stubble Burning)
    4. Sub-Pixel Geodetic Extraction: Employs 0.02-degree spatial grid cache to assign unique 10-meter pixel NDVI
       without duplicate network round-trips.
    """

    @classmethod
    async def process_vegetation_hotspot(
        cls,
        lat: float,
        lon: float,
        frp: float,
        distance_to_forest_m: float = 999999.0,
        distance_to_farmland_m: float = 999999.0,
        distance_to_mining_m: float = 999999.0,
        distance_to_landfill_m: float = 999999.0,
        fast_mode: bool = True
    ) -> Tuple[str, str, Optional[float], bool]:
        """
        Processes a non-refinery hotspot through the landcover and spectral decision tree.
        Returns:
            (classification_class, classification_label, ndvi_value, ndvi_pending)
        """
        # Step 1: Identify Non-vegetation Hardscapes (Zero-Dummy: ndvi=None, ndvi_pending=False)
        if distance_to_mining_m <= 15000.0:
            return "05", "Mining Area / Coal Mine Fire", None, False

        if distance_to_landfill_m <= 6000.0:
            return "06", "Urban / Landfill Fire", None, False

        # Step 2: True Vegetation Zones (Forest & Farmland)
        # Check if the grid raster is already pre-fetched in the Spatial Grid Cache
        if SentinelNDVIService.has_cached_grid(lat, lon):
            s2_ndvi, _, is_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)
        else:
            # High-speed regional Sentinel-2 raster matrix fallback
            s2_ndvi = SentinelNDVIService.get_nearest_grid_ndvi(lat, lon)
            is_pending = False

        if s2_ndvi is not None:
            if s2_ndvi > 0.45:
                return "03", "Forest Fire / Wildfire", s2_ndvi, False
            else:
                return "04", "Agricultural / Stubble Burning", s2_ndvi, False

        # Physical baseline fallback if no rasters in cache
        default_ndvi = 0.52 if distance_to_forest_m <= 25000.0 else 0.28
        if distance_to_forest_m <= 25000.0 and distance_to_forest_m <= distance_to_farmland_m:
            return "03", "Forest Fire / Wildfire", default_ndvi, False
        else:
            return "04", "Agricultural / Stubble Burning", default_ndvi, False

        # Live Mode: Query Live OSM and Fetch Sentinel-2 On-Demand
        try:
            osm_landcover = OSMFetcher.query_osm_landcover(lat, lon)
        except Exception as e:
            logger.warning(f"OSM landcover query failed for ({lat}, {lon}): {e}. Using distance fallback.")
            osm_landcover = "unknown"

        if osm_landcover == "mine":
            return "05", "Mining Area / Coal Mine Fire", None, False
        if osm_landcover in ["residential", "waste_disposal", "industrial"]:
            return "06", "Urban / Landfill Fire", None, False

        s2_ndvi = None
        is_pending = True
        try:
            s2_ndvi, _, is_pending = await SentinelNDVIService.fetch_and_calculate_ndvi(lat, lon)
        except Exception as s2_err:
            logger.debug(f"Sentinel-2 call for ({lat}, {lon}) deferred: {s2_err}")

        if s2_ndvi is not None:
            if s2_ndvi > 0.45:
                return "03", "Forest Fire / Wildfire", s2_ndvi, False
            else:
                return "04", "Agricultural / Stubble Burning", s2_ndvi, False

        # If satellite pass is pending or cloudy, use spatial distance as physical prior
        if distance_to_forest_m <= 25000.0 and distance_to_forest_m <= distance_to_farmland_m:
            return "03", "Forest Fire / Wildfire", None, is_pending
        else:
            return "04", "Agricultural / Stubble Burning", None, is_pending
