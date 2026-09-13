"""
Unified Hazard Scoring & Severity Engine.
Provides ONE authoritative 0 - 100 Hazard Score calculation and severity tier mapping
used identically across all API endpoints, WebSocket streams, reports, and UI views.
"""

CLASSIFICATION_WEIGHT = 40
REFINERY_PROXIMITY_WEIGHT = 20
POPULATION_WEIGHT = 20
FRP_WEIGHT = 10
ANOMALY_WEIGHT = 10

TOTAL_MAX_POINTS = 100

def get_severity_label(hazard_score: int) -> str:
    """
    Authoritative single source of truth for severity mapping:
    - 0  to 39  -> Routine
    - 40 to 59  -> Medium
    - 60 to 79  -> High
    - 80 to 100 -> Critical
    """
    score = max(0, min(100, int(hazard_score)))
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 40:
        return "Medium"
    else:
        return "Routine"

def calculate_unified_hazard_score(
    classification: str,
    frp: float,
    distance_to_refinery_m: float,
    distance_to_population_m: float,
    anomaly_score: float,
    is_suppressed: bool = False
) -> int:
    """
    Computes a normalized 0-100 hazard score using exact component weights.
    """
    if is_suppressed:
        # Suppressed routine operational flaring has low alert score
        raw_score = min(25.0, 10.0 + (frp / 20.0))
        return int(max(0, min(100, round(raw_score))))

    score = 0.0

    # 1. Classification Weight (up to 40 pts)
    cls_str = (classification or "").strip()
    if cls_str == "Potential Industrial Incident":
        score += 40.0
    elif cls_str == "Potential Industrial Thermal Source":
        score += 25.0
    elif cls_str in ["Mining Area / Coal Mine Fire", "Forest Fire / Wildfire"]:
        score += 20.0
    elif cls_str == "Urban / Landfill Fire":
        score += 15.0
    elif cls_str == "Agricultural / Stubble Burning":
        score += 10.0
    else:
        score += 5.0

    # 2. Refinery Proximity Weight (up to 20 pts)
    dist_ref = float(distance_to_refinery_m or 999999.0)
    if dist_ref <= 500.0:
        score += 20.0
    elif dist_ref <= 1500.0:
        score += 14.0
    elif dist_ref <= 3000.0:
        score += 8.0

    # 3. Population Proximity Weight (up to 20 pts)
    dist_pop = float(distance_to_population_m or 999999.0)
    if dist_pop <= 1000.0:
        score += 20.0
    elif dist_pop <= 3000.0:
        score += 12.0
    elif dist_pop <= 5000.0:
        score += 6.0

    # 4. Fire Radiative Power (FRP) Weight (up to 10 pts)
    frp_val = max(0.0, float(frp or 0.0))
    score += min(10.0, (frp_val / 15.0))

    # 5. Anomaly Score Weight (up to 10 pts)
    anom_val = max(0.0, min(1.0, float(anomaly_score or 0.0)))
    score += anom_val * 10.0

    # Cap strictly between 0 and 100
    return int(max(0, min(100, round(score))))
