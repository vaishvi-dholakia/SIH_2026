import os
import logging
from typing import Optional, Tuple
import numpy as np
import httpx
from app.config import settings

logger = logging.getLogger("geoscd.sentinel_ndvi")

# Ensure scratch directory exists for false-color composites
SCRATCH_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scratch")
os.makedirs(SCRATCH_DIR, exist_ok=True)

class SentinelNDVIService:
    """
    Sentinel-2 Multispectral Ingestion and Dynamic NDVI Calculation Engine.
    Computes true surface NDVI and generates SWIR false-color composites.
    """

    @staticmethod
    def calculate_ndvi_array(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
        """
        Dynamically computes the Normalized Difference Vegetation Index (NDVI)
        NDVI = (NIR - Red) / (NIR + Red)
        Safely handles division-by-zero bounds using numpy.where.
        """
        nir_f = nir.astype(float)
        red_f = red.astype(float)
        denom = nir_f + red_f
        numer = nir_f - red_f
        
        # Zero-division protection without emitting RuntimeWarning
        out_arr = np.zeros_like(numer, dtype=float)
        ndvi = np.divide(numer, denom, out=out_arr, where=denom != 0.0)
        # Clip to scientific range [-1.0, 1.0]
        return np.clip(ndvi, -1.0, 1.0)

    @classmethod
    def calculate_mean_ndvi(cls, nir: np.ndarray, red: np.ndarray) -> float:
        """Calculates mean NDVI value across the cropped matrix."""
        ndvi_arr = cls.calculate_ndvi_array(nir, red)
        return float(np.nanmean(ndvi_arr))

    @staticmethod
    def calculate_ndbi_array(swir: np.ndarray, nir: np.ndarray) -> np.ndarray:
        """
        Dynamically computes the Normalized Difference Built-up Index (NDBI)
        NDBI = (SWIR - NIR) / (SWIR + NIR) using B11 (SWIR) and B08 (NIR).
        Safely handles division-by-zero bounds using numpy.where.
        """
        swir_f = swir.astype(float)
        nir_f = nir.astype(float)
        denom = swir_f + nir_f
        numer = swir_f - nir_f
        out_arr = np.zeros_like(numer, dtype=float)
        ndbi = np.divide(numer, denom, out=out_arr, where=denom != 0.0)
        return np.clip(ndbi, -1.0, 1.0)

    @classmethod
    def calculate_mean_ndbi(cls, swir: np.ndarray, nir: np.ndarray) -> float:
        """Calculates mean NDBI value across the cropped matrix."""
        ndbi_arr = cls.calculate_ndbi_array(swir, nir)
        return float(np.nanmean(ndbi_arr))

    _cached_token: Optional[str] = None
    _token_expiry: float = 0.0
    _last_error: Optional[str] = None
    _active_endpoint: Optional[str] = None

    @classmethod
    async def get_sentinel_token(cls) -> Optional[str]:
        """Obtains OAuth2 access token for Sentinel Hub API with in-memory caching and CDSE support."""
        import time

        # Return cached token if still valid
        if cls._cached_token and time.time() < cls._token_expiry:
            return cls._cached_token

        client_id = settings.SENTINEL_HUB_CLIENT_ID
        client_secret = settings.SENTINEL_HUB_CLIENT_SECRET

        if not client_id or not client_secret:
            cls._last_error = "SENTINEL_HUB_CLIENT_ID or SENTINEL_HUB_CLIENT_SECRET not configured in .env"
            return None

        # Prepare client ID variants (CDSE credentials often require 'sh-' prefix)
        cids_to_try = [client_id]
        if not client_id.startswith("sh-"):
            cids_to_try.append(f"sh-{client_id}")

        # Copernicus Data Space Ecosystem (CDSE) primary & Sentinel Hub legacy fallback endpoints
        auth_urls = [
            ("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", "https://sh.dataspace.copernicus.eu/api/v1/process"),
            ("https://services.sentinel-hub.com/oauth/token", "https://services.sentinel-hub.com/api/v1/process")
        ]

        last_err_msg = ""
        async with httpx.AsyncClient(timeout=15.0) as client:
            for auth_url, proc_url in auth_urls:
                for cid in cids_to_try:
                    data = {
                        "grant_type": "client_credentials",
                        "client_id": cid,
                        "client_secret": client_secret
                    }
                    try:
                        res = await client.post(auth_url, data=data)
                        if res.status_code == 200:
                            json_data = res.json()
                            cls._cached_token = json_data.get("access_token")
                            expires_in = float(json_data.get("expires_in", 3600))
                            cls._token_expiry = time.time() + max(300.0, expires_in - 60.0)
                            cls._active_endpoint = proc_url
                            cls._last_error = None
                            logger.info(f"Successfully refreshed Sentinel Hub OAuth token via {auth_url} (cached for 1 hour).")
                            return cls._cached_token
                        else:
                            resp_snippet = res.text[:200].replace('\n', ' ')
                            last_err_msg = f"HTTP {res.status_code} from {auth_url}: {resp_snippet}"
                            logger.warning(f"Sentinel Hub authentication failed: {last_err_msg}")
                    except Exception as e:
                        last_err_msg = f"Network error connecting to {auth_url}: {e}"
                        logger.warning(last_err_msg)

        cls._last_error = last_err_msg
        return None

    @classmethod
    async def fetch_and_calculate_ndvi(
        cls,
        lat: float,
        lon: float,
        hotspot_id: Optional[int] = None
    ) -> Tuple[Optional[float], Optional[float], bool]:
        """
        Conditionally triggered for unsuppressed / emergency hotspots.
        Pulls actual Sentinel-2 bands (Red B4, NIR B8, SWIR B11/B12, Blue B2)
        and computes true pixel-level NDVI and NDBI.

        Returns:
            (ndvi_value, ndbi_value, pending)
            If credentials or imagery are unavailable, returns (None, None, True).
            NEVER fabricates or mocks placeholder values.
        """
        token = await cls.get_sentinel_token()
        if not token:
            logger.info(
                f"Sentinel Hub credentials not active or not configured. "
                f"Preserving data purity for coordinate ({lat}, {lon}): ndvi=None, ndbi=None, pending=True"
            )
            return None, None, True

        # Request 2km x 2km window around coordinates
        delta = 0.009
        bbox = [lon - delta, lat - delta, lon + delta, lat + delta]

        process_url = cls._active_endpoint or "https://sh.dataspace.copernicus.eu/api/v1/process"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "image/tiff"
        }

        # Request bands B02, B04, B08, B11, B12
        evalscript = """
        //VERSION=3
        function setup() {
          return {
            input: ["B02", "B04", "B08", "B11", "B12"],
            output: { bands: 5, sampleType: "FLOAT32" }
          };
        }
        function evaluatePixel(sample) {
          return [sample.B02, sample.B04, sample.B08, sample.B11, sample.B12];
        }
        """

        payload = {
            "input": {
                "bounds": {
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                    "bbox": bbox
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 30
                    }
                }]
            },
            "output": {
                "width": 100,
                "height": 100,
                "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]
            },
            "evalscript": evalscript
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(process_url, json=payload, headers=headers)
                if res.status_code == 200:
                    import io
                    import tarfile
                    try:
                        import rasterio
                        raw_bytes = res.content
                        # If response is a TAR archive, extract the TIFF member
                        try:
                            tar = tarfile.open(fileobj=io.BytesIO(raw_bytes))
                            for member in tar.getmembers():
                                if member.name.endswith(".tif") or member.name.endswith(".tiff"):
                                    f = tar.extractfile(member)
                                    if f:
                                        raw_bytes = f.read()
                                        break
                        except Exception:
                            pass  # Not a tar archive, treat as direct TIFF bytes

                        with rasterio.open(io.BytesIO(raw_bytes)) as src:
                            b2 = src.read(1)
                            b4 = src.read(2)  # Red
                            b8 = src.read(3)  # NIR
                            b11 = src.read(4) # SWIR-1
                            b12 = src.read(5) # SWIR-2

                            mean_ndvi = cls.calculate_mean_ndvi(b8, b4)
                            mean_ndbi = cls.calculate_mean_ndbi(b11, b8)
                            
                            # Stack and save SWIR composite to scratch
                            composite_path = os.path.join(
                                SCRATCH_DIR,
                                f"swir_composite_{hotspot_id or 'latest'}_{lat:.4f}_{lon:.4f}.tif"
                            )
                            with rasterio.open(
                                composite_path,
                                "w",
                                driver="GTiff",
                                height=src.height,
                                width=src.width,
                                count=3,
                                dtype=b12.dtype,
                                crs=src.crs,
                                transform=src.transform,
                            ) as dst:
                                dst.write(b12, 1)  # Red channel = SWIR-2
                                dst.write(b11, 2)  # Green channel = SWIR-1
                                dst.write(b2, 3)   # Blue channel = Blue

                            logger.info(f"Computed real Sentinel-2 NDVI: {mean_ndvi:.4f}, NDBI: {mean_ndbi:.4f} for ({lat}, {lon})")
                            return round(mean_ndvi, 4), round(mean_ndbi, 4), False
                    except Exception as err:
                        logger.error(f"Error decoding Sentinel-2 TIFF with rasterio: {err}")
                        return None, None, True
                else:
                    logger.warning(f"Sentinel Hub Process API returned HTTP {res.status_code}: {res.text[:100]}")
                    return None, None, True
        except Exception as e:
            logger.error(f"Exception fetching Sentinel imagery: {e}")
            return None, None, True
