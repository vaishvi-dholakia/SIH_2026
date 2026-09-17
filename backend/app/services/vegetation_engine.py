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
        frp: float
    ) -> Tuple[str, str, Optional[float]]:
        """
        Processes a Type 0 hotspot.
        Returns:
            (classification_class, classification_label, ndvi_value)
        """
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
                # Default Forest Fire if NDVI pending
                return "03", "Forest Fire / Wildfire", 0.50

        elif osm_landcover == "farmland":
            ndvi_val = await SentinelNDVIService.fetch_sentinel2_ndvi(lat, lon)
            if ndvi_val is not None and 0.10 <= ndvi_val <= 0.35:
                return "04", "Agricultural / Stubble Burning", ndvi_val
            elif ndvi_val is not None and ndvi_val > 0.35:
                return "03", "Forest Fire / Wildfire", ndvi_val
            else:
                return "04", "Agricultural / Stubble Burning", 0.25

        elif osm_landcover == "mine":
            return "05", "Mining Area / Coal Mine Fire", 0.05

        elif osm_landcover in ["residential", "waste_disposal", "industrial"]:
            return "06", "Urban / Landfill Fire", 0.02

        else:
            # Default Vegetation Fallback
            ndvi_val = await SentinelNDVIService.fetch_sentinel2_ndvi(lat, lon)
            if ndvi_val is not None:
                if ndvi_val > 0.40:
                    return "03", "Forest Fire / Wildfire", ndvi_val
                else:
                    return "04", "Agricultural / Stubble Burning", ndvi_val
            return "03", "Forest Fire / Wildfire", 0.50
