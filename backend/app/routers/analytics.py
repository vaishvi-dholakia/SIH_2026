from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.hotspot import ActiveHotspot
from app.ml.classifier import classifier_service, FEATURE_NAMES
from app.schemas.analytics import (
    AnalyticsSummary,
    ExplainabilityResponse,
    FeatureWeight,
    ClassificationBreakdown,
    StatusBreakdown
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics & AI"])

@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    """
    Returns telemetry aggregations, classification shares, and status distributions.
    """
    total = db.query(ActiveHotspot).count()

    # Classification counts
    cls_query = db.query(
        ActiveHotspot.classification,
        func.count(ActiveHotspot.id)
    ).group_by(ActiveHotspot.classification).all()

    classifications = []
    for cls_name, count in cls_query:
        pct = (count / total * 100.0) if total > 0 else 0.0
        classifications.append(ClassificationBreakdown(
            name=cls_name,
            count=count,
            percentage=round(pct, 1)
        ))

    # Status breakdown
    status_query = db.query(
        ActiveHotspot.status,
        func.count(ActiveHotspot.id)
    ).group_by(ActiveHotspot.status).all()

    status_distribution = [
        StatusBreakdown(status=s, count=c) for s, c in status_query
    ]

    # FRP stats
    frp_stats = db.query(
        func.avg(ActiveHotspot.frp),
        func.max(ActiveHotspot.frp)
    ).first()

    avg_frp = float(frp_stats[0] or 0.0)
    max_frp = float(frp_stats[1] or 0.0)

    return AnalyticsSummary(
        total_hotspots=total,
        classifications=classifications,
        status_distribution=status_distribution,
        average_frp=round(avg_frp, 2),
        max_frp=round(max_frp, 2)
    )

@router.get("/explainability", response_model=ExplainabilityResponse)
def get_explainability_metrics():
    """
    Returns global ML model feature importance weights and explainability parameters.
    """
    feature_weights = []

    if classifier_service.rf_model is not None:
        importances = classifier_service.rf_model.feature_importances_
        model_name = "RandomForestClassifier (Trained on authentic NASA FIRMS Data)"
    else:
        # Standard geospatial physics weight priors
        importances = [0.15, 0.22, 0.10, 0.25, 0.10, 0.08, 0.05, 0.05]
        model_name = "Rule-Based Spatial-Spectral Inference Engine"

    descriptions = {
        "brightness": "Brightness Temperature (Kelvin) measured by satellite sensor",
        "frp": "Fire Radiative Power (MW) indicating combustion intensity",
        "confidence": "Detection confidence metric from satellite processing algorithm",
        "distance_to_refinery_m": "Proximity to nearest critical industrial facility boundary",
        "distance_to_population_m": "Proximity to nearest vulnerable residential population zone",
        "persistence_days": "Number of days hotspot recurred at coordinate in last 30 days",
        "ndvi": "Real Sentinel-2 satellite vegetation index (NIR-Red)/(NIR+Red)",
        "anomaly_score": "Isolation Forest deviation score relative to coordinate baseline"
    }

    for name, imp in zip(FEATURE_NAMES, importances):
        feature_weights.append(FeatureWeight(
            feature=name,
            weight=round(float(imp), 4),
            description=descriptions.get(name, "")
        ))

    # Sort descending by importance weight
    feature_weights.sort(key=lambda x: x.weight, reverse=True)

    thresholds = {
        "suppression_persistence_days": 15,
        "frp_explosion_spike_pct": 300.0,
        "refinery_safety_buffer_default_m": 1000.0,
        "critical_priority_threshold": 60,
        "anomaly_score_alert_threshold": 0.65
    }

    return ExplainabilityResponse(
        model_name=model_name,
        feature_importances=feature_weights,
        decision_thresholds=thresholds
    )
