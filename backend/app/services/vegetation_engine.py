import logging
from typing import Tuple, Optional
from app.services.osm_fetcher import OSMFetcher
from app.services.sentinel_ndvi import SentinelNDVIService

logger = logging.getLogger("geoscd.vegetation_engine")

class VegetationEngine:
    """
    Module 4: Vegetation & Landcover Processing Engine for NASA FIRMS Type 0 Detections.
    Routes Presumed Vegetation hotspots into:
    - Class 03: Forest Fire (NDVI > 0.45 in Forest landcover)
    - Class 04: Agricultural Fire (NDVI 0.10 - 0.35 in Farmland)
    - Class 05: Mining Fire (Mine landcover, default NDVI = 0.05)
    - Class 06: Urban / Landfill Fire (Residential/Waste landcover, default NDVI = 0.02)
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
    ) -> Tuple[str, str, Optional[float]]:
        """
        Processes a Type 0 hotspot with optional fast_mode (uses local spatial geofence distances).
        When fast_mode=True, avoids synchronous HTTP requests to Copernicus during batch ingestion.
        Returns:
            (classification_class, classification_label, ndvi_value)
        """
        if fast_mode:
            if distance_to_forest_m <= 3000.0:
                return "03", "Forest Fire / Wildfire", None
            elif distance_to_farmland_m <= 3000.0:
                return "04", "Agricultural / Stubble Burning", None
            elif distance_to_mining_m <= 3000.0:
                return "05", "Mining Area / Coal Mine Fire", 0.05
            elif distance_to_landfill_m <= 3000.0:
                return "06", "Urban / Landfill Fire", 0.02
            else:
                return "03", "Forest Fire / Wildfire", None

        try:
            # 1. Query OpenStreetMap for landcover classification at coordinate
            osm_landcover = OSMFetcher.query_osm_landcover(lat, lon)
        except Exception as e:
            logger.warning(f"OSM landcover query failed for ({lat}, {lon}): {e}. Using default fallback.")
            osm_landcover = "unknown"

        if osm_landcover == "forest":
            ndvi_val = await SentinelNDVIService.fetch_sentinel2_ndvi(lat, lon)
            if ndvi_val is not None and ndvi_val > 0.45:
                return "03", "Forest Fire / Wildfire", ndvi_val
            elif ndvi_val is not None:
                return "04", "Agricultural / Stubble Burning", ndvi_val
            else:
                return "03", "Forest Fire / Wildfire", None

        elif osm_landcover == "farmland":
            ndvi_val = await SentinelNDVIService.fetch_sentinel2_ndvi(lat, lon)
            if ndvi_val is not None and 0.10 <= ndvi_val <= 0.35:
                return "04", "Agricultural / Stubble Burning", ndvi_val
            elif ndvi_val is not None and ndvi_val > 0.35:
                return "03", "Forest Fire / Wildfire", ndvi_val
            else:
                return "04", "Agricultural / Stubble Burning", None

        elif osm_landcover == "mine":
            return "05", "Mining Area / Coal Mine Fire", 0.05

        elif osm_landcover in ["residential", "waste_disposal", "industrial"]:
            return "06", "Urban / Landfill Fire", 0.02

        else:
            ndvi_val = await SentinelNDVIService.fetch_sentinel2_ndvi(lat, lon)
            if ndvi_val is not None:
                if ndvi_val > 0.40:
                    return "03", "Forest Fire / Wildfire", ndvi_val
                else:
                    return "04", "Agricultural / Stubble Burning", ndvi_val
            return "03", "Forest Fire / Wildfire", None
