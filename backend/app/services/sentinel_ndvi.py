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

    _cached_token: Optional[str] = None
    _token_expiry: float = 0.0
    _auth_failed_until: float = 0.0
    _active_process_url: str = "https://sh.dataspace.copernicus.eu/api/v1/process"

    @classmethod
    async def get_sentinel_token(cls) -> Optional[str]:
        """
        Obtains OAuth2 access token.
        Supports both Copernicus Data Space Ecosystem (CDSE) and Legacy Sentinel Hub OAuth endpoints.
        """
        import time

        # Return cached token if still valid
        if cls._cached_token and time.time() < cls._token_expiry:
            return cls._cached_token

        # Don't retry immediately if authentication failed recently (cache failure for 5 mins)
        if time.time() < cls._auth_failed_until:
            return None

        client_id = settings.SENTINEL_HUB_CLIENT_ID
        client_secret = settings.SENTINEL_HUB_CLIENT_SECRET

        if not client_id or not client_secret or client_id.startswith("YOUR_") or client_secret.startswith("YOUR_"):
            return None

        # Auth endpoints list: CDSE Official Identity Server first, then Legacy Sentinel Hub
        auth_endpoints = [
            ("https://identity.dataspace.copernicus.eu/auth/realms/cdse/protocol/openid-connect/token", "https://sh.dataspace.copernicus.eu/api/v1/process"),
            ("https://services.sentinel-hub.com/oauth/token", "https://services.sentinel-hub.com/api/v1/process")
        ]

        data = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            for token_url, proc_url in auth_endpoints:
                try:
                    res = await client.post(token_url, data=data)
                    if res.status_code == 200:
                        json_data = res.json()
                        cls._cached_token = json_data.get("access_token")
                        expires_in = float(json_data.get("expires_in", 3600))
                        cls._token_expiry = time.time() + max(300.0, expires_in - 60.0)
                        cls._auth_failed_until = 0.0
                        cls._active_process_url = proc_url
                        logger.info(f"Successfully authenticated with Copernicus/Sentinel OAuth ({token_url}). Cached for 1 hour.")
                        return cls._cached_token
                except Exception as e:
                    logger.debug(f"Auth endpoint {token_url} failed: {e}")
                    continue

        cls._auth_failed_until = time.time() + 300.0  # Cache failure for 5 minutes
        logger.warning("Copernicus/Sentinel Hub authentication failed. Check CLIENT_ID and CLIENT_SECRET in .env.")
        return None

    @classmethod
    async def fetch_and_calculate_ndvi(
        cls,
        lat: float,
        lon: float,
        hotspot_id: Optional[int] = None
    ) -> Tuple[Optional[float], bool]:
        """
        Conditionally triggered for unsuppressed / emergency hotspots.
        Pulls actual Sentinel-2 bands (Red B4, NIR B8, SWIR B11/B12, Blue B2)
        and computes true pixel-level NDVI.

        Returns:
            (ndvi_value, ndvi_pending)
            If credentials or imagery are unavailable, returns (None, True).
            NEVER fabricates or mocks placeholder values.
        """
        token = await cls.get_sentinel_token()
        if not token:
            logger.info(
                f"Sentinel Hub credentials not active or not configured. "
                f"Preserving data purity for coordinate ({lat}, {lon}): ndvi=None, ndvi_pending=True"
            )
            return None, True

        # If token is available, request 2km x 2km window around coordinates
        # 0.01 deg is approximately 1.11 km, so +/- 0.009 deg ~= 2km box
        delta = 0.009
        bbox = [lon - delta, lat - delta, lon + delta, lat + delta]

        process_url = cls._active_process_url
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
                            b11 = src.read(4) # SWIR
                            b12 = src.read(5) # SWIR

                            mean_ndvi = cls.calculate_mean_ndvi(b8, b4)
                            
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

                            logger.info(f"Computed real Sentinel-2 NDVI: {mean_ndvi:.4f} for ({lat}, {lon})")
                            return round(mean_ndvi, 4), False
                    except Exception as err:
                        logger.error(f"Error decoding Sentinel-2 TIFF with rasterio: {err}")
                        return None, True
                else:
                    logger.warning(f"Sentinel Hub Process API returned HTTP {res.status_code}: {res.text[:100]}")
                    return None, True
        except Exception as e:
            logger.error(f"Exception fetching Sentinel imagery: {e}")
            return None, True
