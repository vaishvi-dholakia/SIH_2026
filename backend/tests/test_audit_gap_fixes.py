import pytest
from app.services.vnf_service import VNFService
from app.services.weather_service import WeatherService
from app.services.scoring import calculate_priority_threat_score

def test_vnf_combustion_physics_flaring():
    """Verify NOAA VIIRS Nightfire Dual-Band Planck Curve for Industrial Flaring."""
    flare_result = VNFService.calculate_combustion_physics(
        frp=15.0,
        brightness=360.0,
        is_refinery_zone=True,
        distance_to_refinery_m=450.0
    )
    # Flares burn at ~1600K-1800K with small footprint (<60 sqm)
    assert 1400.0 <= flare_result["flame_temperature_k"] <= 2000.0
    assert flare_result["source_footprint_sqm"] <= 60.0
    assert flare_result["combustion_regime"] == "Gas Flare / Industrial High-Temperature Combustion"

def test_vnf_combustion_physics_biomass():
    """Verify NOAA VIIRS Nightfire Dual-Band Planck Curve for Biomass / Wildfires."""
    biomass_result = VNFService.calculate_combustion_physics(
        frp=40.0,
        brightness=330.0,
        is_refinery_zone=False,
        distance_to_refinery_m=35000.0
    )
    # Biomass fires burn at ~800K-1200K with wide footprint (>100 sqm)
    assert 750.0 <= biomass_result["flame_temperature_k"] <= 1200.0
    assert biomass_result["source_footprint_sqm"] >= 100.0
    assert "Biomass" in biomass_result["combustion_regime"] or "Wildfire" in biomass_result["combustion_regime"]

def test_weather_service_math_fallback():
    """Verify Open-Meteo mathematical atmospheric fallback returns valid bounded values."""
    w = WeatherService._mathematical_weather_fallback(28.61, 77.20)
    assert 15.0 <= w["relative_humidity"] <= 95.0
    assert w["wind_speed_kmh"] >= 0.0
    assert 0.0 <= w["wind_direction_deg"] <= 360.0

def test_weather_service_grid_caching():
    """Verify spatial 10km grid cell caching."""
    # Lat/Lon 18.001 and 18.004 round to the same (18.0, 83.0) grid cell
    w1 = WeatherService.get_weather(18.001, 83.002)
    w2 = WeatherService.get_weather(18.004, 83.003)
    assert w1["relative_humidity"] == w2["relative_humidity"]
    assert w1["wind_speed_kmh"] == w2["wind_speed_kmh"]

def test_scoring_class01_25_point_cap():
    """Verify Gap 4: Threat Scoring Class 01 is strictly capped at 25 points."""
    # Class 01: Routine operational flaring
    score_cls01 = calculate_priority_threat_score(
        frp=350.0,  # Extreme FRP
        anomaly_score=0.95,
        pop_proximity_km=0.5,
        facility_dist_km=0.2,
        relative_humidity=25.0,  # Dry
        classification_class="01"
    )
    assert score_cls01 <= 25, f"Class 01 routine flare must be capped at 25 points, got {score_cls01}"

def test_scoring_class02_uncapped():
    """Verify Class 02 (Industrial Incident) is NOT capped at 25 points."""
    score_cls02 = calculate_priority_threat_score(
        frp=450.0,
        anomaly_score=0.95,
        pop_proximity_km=0.5,
        facility_dist_km=0.2,
        relative_humidity=25.0,
        classification_class="02"
    )
    assert score_cls02 >= 80, f"Class 02 critical emergency should exceed 80 points, got {score_cls02}"
    assert score_cls02 > 25
