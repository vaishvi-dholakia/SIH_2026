from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class HotspotBase(BaseModel):
    latitude: float
    longitude: float
    brightness: float
    frp: float
    confidence: float
    firms_type: int = 0
    ndvi: Optional[float] = None
    ndvi_pending: bool = False
    persistence_days: int = 1
    distance_to_refinery_m: float
    distance_to_population_m: float
    distance_to_forest_m: Optional[float] = 999999.0
    distance_to_farmland_m: Optional[float] = 999999.0
    distance_to_mining_m: Optional[float] = 999999.0
    distance_to_landfill_m: Optional[float] = 999999.0
    anomaly_score: float = 0.0
    priority_score: int = 0
    detected_at: datetime
    classification_class: str = "01"
    classification: str
    model_confidence: float = 0.0
    is_suppressed: bool = False
    status: str = "new"
    nearest_refinery_id: Optional[int] = None
    nearest_refinery_name: Optional[str] = None

class HotspotOut(HotspotBase):
    id: int

    class Config:
        from_attributes = True

class HotspotStatusUpdate(BaseModel):
    status: str = Field(..., example="reviewed", pattern="^(new|reviewed|suppressed|resolved)$")

class HotspotGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class HotspotGeoJSONCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[HotspotGeoJSONFeature]

class HotspotStats(BaseModel):
    total_active: int
    potential_emergencies: int
    operational_flares: int
    wildfires: int
    agricultural_fires: int
    mining_fires: int
    urban_fires: int

class HotspotLogsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    data: List[HotspotOut]

class SimulateHotspotRequest(BaseModel):
    simulation_type: str = Field(
        "INDUSTRIAL_INCIDENT",
        description="INDUSTRIAL_INCIDENT, SUPPRESSED_FLARE, FOREST_FIRE, AGRICULTURAL_FIRE, MINING_FIRE, or URBAN_LANDFILL_FIRE"
    )
    latitude: Optional[float] = None
    longitude: Optional[float] = None

