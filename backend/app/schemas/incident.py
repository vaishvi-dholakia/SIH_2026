from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class IncidentDTO(BaseModel):
    """
    Canonical Public Incident Data Transfer Object (IncidentDTO).
    Used identically by REST API endpoints and WebSocket alert streams.
    Strictly uses camelCase JSON keys.
    """
    id: int
    latitude: float
    longitude: float
    firmsType: int = 0
    classificationClass: str = "01"
    classification: str
    classificationConfidence: float = Field(..., description="0-100 percentage")
    hazardScore: int = Field(..., description="0-100 unified hazard score")
    priority: str = Field(..., description="Routine, Medium, High, or Critical")
    frp: float = Field(..., description="Fire Radiative Power in MW")
    normalFrp: float = Field(..., description="Historical baseline FRP in MW")
    frpRatio: float = Field(..., description="Ratio of current FRP to baseline (e.g. 3.0 = 3x normal)")
    frpChangePercent: float = Field(..., description="Percentage change from baseline")
    confidence: float = Field(..., description="Satellite sensor confidence 0-100")
    anomalyScore: float = Field(..., description="Isolation Forest anomaly index 0.0-1.0")
    persistenceDays: int = Field(..., description="Distinct detection days over past 30 days")
    isSuppressed: bool = Field(..., description="True if routine operational flaring is suppressed")
    ndvi: Optional[float] = None
    ndviPending: bool = False
    sentinelVerified: bool = False
    status: str = Field("new", description="new, reviewed, or resolved")
    nearestFacility: str = Field("Open Region", description="Nearest registered facility name")
    nearestRefineryName: Optional[str] = Field(None, description="Nearest registered refinery name")
    operator: str = Field("Unspecified", description="Operating authority name")
    distanceToRefineryM: float
    distanceToPopulationM: float
    locationType: str = Field("Open Region", description="Industrial Area or Open Region / Rural")
    detectedAt: str = Field(..., description="ISO 8601 UTC timestamp")
    firstDetected: str = Field(..., description="HH:MM UTC time string")
    lastUpdated: str = Field(..., description="HH:MM UTC time string")
    reasons: List[str] = Field(default_factory=list, description="XAI contributing factors")
    dataSource: str = Field("NASA_FIRMS", description="NASA_FIRMS or SIMULATION")
    detectionCount: int = Field(1, description="Number of satellite passes in this spatial cluster")
    maxFrp: float = Field(0.0, description="Peak FRP in MW across cluster passes")
    tier: int = Field(3, description="1: Industrial, 2: Encroaching Buffer, 3: Pure Environmental")
    tierLabel: str = Field("🟢 ROUTINE ENVIRONMENTAL FIRE", description="Human readable tier label")
    subdistrict: Optional[str] = Field(None, description="Subdistrict or Tehsil name")
    district: Optional[str] = Field(None, description="District name")
    state: Optional[str] = Field(None, description="State name")
    landuse: Optional[str] = Field(None, description="Land use or zone classification")
    locationDisplay: Optional[str] = Field(None, description="Full human readable location name e.g. Patti, Tarn Taran, Punjab")

    class Config:
        from_attributes = True
        populate_by_name = True
