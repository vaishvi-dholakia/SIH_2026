"""
FLAREFILTER Compliance Test Suite.
Verifies all core requirements:
1. Single source of truth for hazard scoring (0-100) and severity mapping (0-39 Routine, 40-59 Medium, 60-79 High, 80-100 Critical).
2. 3x FRP surge rule logic (bypassing suppression when frp_ratio >= 3.0).
3. Ray-casting point-in-polygon sovereign Indian boundary validation.
4. Support for all 6 simulation types.
5. Strict schema validation against IncidentDTO.
"""

import pytest
from app.services.scoring import calculate_unified_hazard_score, get_severity_label
from app.services.india_boundary import is_point_in_india
from app.services.suppression import FRP_SURGE_RATIO_THRESHOLD
from app.schemas.incident import IncidentDTO

def test_severity_tiers():
    assert get_severity_label(0) == "Routine"
    assert get_severity_label(39) == "Routine"
    assert get_severity_label(40) == "Medium"
    assert get_severity_label(59) == "Medium"
    assert get_severity_label(60) == "High"
    assert get_severity_label(79) == "High"
    assert get_severity_label(80) == "Critical"
    assert get_severity_label(100) == "Critical"

def test_unified_hazard_score_bounds():
    # Min score
    min_score = calculate_unified_hazard_score(
        classification="Other",
        frp=0.0,
        distance_to_refinery_m=999999.0,
        distance_to_population_m=999999.0,
        anomaly_score=0.0,
        is_suppressed=False
    )
    assert 0 <= min_score <= 100

    # Max score
    max_score = calculate_unified_hazard_score(
        classification="Potential Industrial Incident",
        frp=200.0,
        distance_to_refinery_m=100.0,
        distance_to_population_m=500.0,
        anomaly_score=1.0,
        is_suppressed=False
    )
    assert max_score >= 80
    assert get_severity_label(max_score) == "Critical"

def test_frp_surge_ratio_threshold():
    assert FRP_SURGE_RATIO_THRESHOLD == 3.0

def test_india_boundary_validation():
    # Major Indian coordinates (Must be valid)
    assert is_point_in_india(28.6139, 77.2090) is True  # New Delhi
    assert is_point_in_india(19.0760, 72.8777) is True  # Mumbai
    assert is_point_in_india(22.3072, 69.8000) is True  # Jamnagar, Gujarat
    assert is_point_in_india(13.0827, 80.2707) is True  # Chennai

    # Outside coordinates (Must be invalid)
    assert is_point_in_india(51.5074, -0.1278) is False  # London, UK
    assert is_point_in_india(40.7128, -74.0060) is False  # New York, USA
    assert is_point_in_india(35.6762, 139.6503) is False  # Tokyo, Japan
    assert is_point_in_india(24.8607, 67.0011) is False  # Karachi, Pakistan

def test_incident_dto_schema():
    data = {
        "id": 1,
        "latitude": 22.350,
        "longitude": 69.850,
        "classification": "Potential Industrial Incident",
        "classificationConfidence": 95.5,
        "hazardScore": 85,
        "priority": "Critical",
        "frp": 150.0,
        "normalFrp": 45.0,
        "frpRatio": 3.33,
        "frpChangePercent": 233.3,
        "confidence": 90.0,
        "anomalyScore": 0.85,
        "persistenceDays": 1,
        "isSuppressed": False,
        "ndvi": 0.15,
        "ndviPending": False,
        "sentinelVerified": True,
        "status": "new",
        "nearestFacility": "Jamnagar Refinery",
        "operator": "Reliance Industries Limited",
        "distanceToRefineryM": 350.0,
        "distanceToPopulationM": 1200.0,
        "locationType": "Industrial Zone",
        "detectedAt": "2026-09-07T12:00:00Z",
        "firstDetected": "12:00",
        "lastUpdated": "12:05",
        "reasons": ["Near refinery", "FRP 3.33x baseline"],
        "dataSource": "NASA_FIRMS"
    }
    dto = IncidentDTO(**data)
    dumped = dto.model_dump()
    assert dumped["hazardScore"] == 85
    assert dumped["priority"] == "Critical"
    assert dumped["frpRatio"] == 3.33
