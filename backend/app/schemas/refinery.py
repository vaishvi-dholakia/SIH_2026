from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class RefineryBase(BaseModel):
    name: str = Field(..., example="Jamnagar Refinery Complex")
    operator: str = Field(..., example="Reliance Industries Ltd")
    geometry: str = Field(..., description="WKT representation of refinery boundary polygon")
    risk_level: str = Field("High", example="Critical")
    safety_buffer_km: float = Field(1.0, example=1.0)

class RefineryCreate(RefineryBase):
    pass

class RefineryOut(RefineryBase):
    id: int

    class Config:
        from_attributes = True

class RefineryGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

class RefineryGeoJSONCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[RefineryGeoJSONFeature]

class RefineryFRPPoint(BaseModel):
    date: str
    average_frp: float
    max_frp: float
    hotspot_count: int
