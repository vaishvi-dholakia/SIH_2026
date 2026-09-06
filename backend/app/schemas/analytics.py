from typing import List, Dict, Any
from pydantic import BaseModel

class ClassificationBreakdown(BaseModel):
    name: str
    count: int
    percentage: float

class StatusBreakdown(BaseModel):
    status: str
    count: int

class AnalyticsSummary(BaseModel):
    total_hotspots: int
    classifications: List[ClassificationBreakdown]
    status_distribution: List[StatusBreakdown]
    average_frp: float
    max_frp: float

class FeatureWeight(BaseModel):
    feature: str
    weight: float
    description: str

class ExplainabilityResponse(BaseModel):
    model_name: str
    feature_importances: List[FeatureWeight]
    decision_thresholds: Dict[str, Any]
