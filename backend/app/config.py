import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "GEO-SCD Backend (NTRO — PS 26162)"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/geoscd"
    
    # NASA FIRMS API
    FIRMS_MAP_KEY: str = ""
    FIRMS_POLL_INTERVAL_SECONDS: int = 300
    # India bounding box: [min_lon, min_lat, max_lon, max_lat]
    INDIA_BBOX: List[float] = [68.0, 6.0, 97.5, 37.5]
    
    # Sentinel Hub / Copernicus
    SENTINEL_HUB_CLIENT_ID: str = ""
    SENTINEL_HUB_CLIENT_SECRET: str = ""
    
    # Geospatial Parameters
    DEFAULT_SAFETY_BUFFER_KM: float = 1.0
    HISTORICAL_DAYS_RANGE: int = 60
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
