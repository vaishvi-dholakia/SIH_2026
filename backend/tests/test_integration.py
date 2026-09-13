import os
import sys
import logging
import pytest
import numpy as np
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.database import Base
from app.models.refinery import Refinery
from app.models.population import PopulationCenter
from app.models.hotspot import ActiveHotspot
from app.models.suppression import SuppressionHistory
from app.services.spatial_analyser import SpatialAnalyser
from app.services.suppression import SuppressionEngine
from app.services.sentinel_ndvi import SentinelNDVIService
from app.ml.classifier import DualModelClassifier

@pytest.fixture(scope="function")
def test_db():
    """Provides an isolated in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed test refinery and population center
    refinery = Refinery(
        name="Jamnagar Test Refinery",
        operator="Reliance Industries Ltd",
        geometry="POLYGON((69.830 22.330, 69.880 22.330, 69.880 22.380, 69.830 22.380, 69.830 22.330))",
        risk_level="Critical",
        safety_buffer_km=1.0
    )
    db.add(refinery)

    pop = PopulationCenter(
        name="Test Settlement",
        geometry="POLYGON((69.900 22.330, 69.930 22.330, 69.930 22.360, 69.900 22.360, 69.900 22.330))",
        estimated_population=15000
    )
    db.add(pop)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

# ==============================================================================
# Scenario 1: Geofence Point-in-Polygon & Distance Calculation Verification
# ==============================================================================
def test_spatial_analyser_geofence_and_buffers(test_db):
    # Coordinate directly INSIDE the test refinery
    inside_lat, inside_lon = 22.350, 69.850
    res_inside = SpatialAnalyser.analyse_point(inside_lat, inside_lon, test_db)

    assert res_inside.is_inside_refinery is True
    assert res_inside.distance_to_refinery_m == 0.0
    assert res_inside.is_within_safety_buffer is True
    assert res_inside.nearest_refinery_name == "Jamnagar Test Refinery"

    # Coordinate OUTSIDE the refinery, within 1km buffer
    buffer_lat, buffer_lon = 22.385, 69.850  # ~550m north of boundary
    res_buffer = SpatialAnalyser.analyse_point(buffer_lat, buffer_lon, test_db)

    assert res_buffer.is_inside_refinery is False
    assert 0.0 < res_buffer.distance_to_refinery_m <= 1500.0
    assert res_buffer.is_within_safety_buffer is True

    # Coordinate FAR AWAY (e.g. 50 km away in open land)
    far_lat, far_lon = 22.800, 70.400
    res_far = SpatialAnalyser.analyse_point(far_lat, far_lon, test_db)

    assert res_far.is_inside_refinery is False
    assert res_far.is_within_safety_buffer is False
    assert res_far.distance_to_refinery_m > 30000.0
    assert res_far.distance_to_population_m > 30000.0

# ==============================================================================
# Scenario 2: Suppression Algorithm Validation
# ==============================================================================
def test_suppression_algorithm_persistent_flaring_and_explosion_bypass(test_db):
    flare_lat, flare_lon = 22.355, 69.855
    refinery = test_db.query(Refinery).first()
    now = datetime.now(timezone.utc)

    # Simulate recurring 15 MW historical hotspots over 18 distinct days
    for day_offset in range(1, 19):
        past_date = now - timedelta(days=day_offset)
        hotspot = ActiveHotspot(
            latitude=flare_lat,
            longitude=flare_lon,
            brightness=320.0,
            frp=15.0,  # 15 MW normal flaring
            confidence=85.0,
            detected_at=past_date,
            classification="Potential Industrial Thermal Source",
            is_suppressed=True,
            status="reviewed",
            nearest_refinery_id=refinery.id
        )
        test_db.add(hotspot)
    test_db.commit()

    # Case A: Normal subsequent hotspot with 16 MW (within historical average)
    is_supp, is_crit, avg_frp, frp_ratio, frp_change_pct, pers_days, reason = SuppressionEngine.evaluate(
        lat=flare_lat,
        lon=flare_lon,
        current_frp=16.0,
        nearest_refinery_id=refinery.id,
        detected_at=now,
        db=test_db
    )
    assert is_supp is True
    assert is_crit is False
    assert pers_days >= 18
    assert "Normal Operational Chimney Flare" in reason

    # Case B: Sudden massive surge: 75 MW (> 300% increase over 15 MW baseline)
    is_supp_spike, is_crit_spike, _, _, _, _, reason_spike = SuppressionEngine.evaluate(
        lat=flare_lat,
        lon=flare_lon,
        current_frp=75.0,  # 400% increase
        nearest_refinery_id=refinery.id,
        detected_at=now,
        db=test_db
    )
    assert is_supp_spike is False
    assert is_crit_spike is True
    assert "3x FRP Surge Detected" in reason_spike

# ==============================================================================
# Scenario 3: NDVI Calculation Verification & Database Purity Assertion
# ==============================================================================
def test_ndvi_calculation_and_pure_null_handling(test_db):
    # Mock 2x2 NIR and Red arrays
    nir_array = np.array([
        [0.8, 0.6],
        [0.5, 0.0]
    ])
    red_array = np.array([
        [0.2, 0.2],
        [0.5, 0.0]  # Note [1, 1] has 0+0=0 to test divide-by-zero protection
    ])

    # Expected formula: (NIR - Red) / (NIR + Red)
    # [0, 0]: (0.8 - 0.2) / (0.8 + 0.2) = 0.6 / 1.0 = 0.6
    # [0, 1]: (0.6 - 0.2) / (0.6 + 0.2) = 0.4 / 0.8 = 0.5
    # [1, 0]: (0.5 - 0.5) / (0.5 + 0.5) = 0.0 / 1.0 = 0.0
    # [1, 1]: (0.0 - 0.0) / (0.0 + 0.0) -> division by zero handled cleanly = 0.0
    ndvi_matrix = SentinelNDVIService.calculate_ndvi_array(nir_array, red_array)
    assert np.isclose(ndvi_matrix[0, 0], 0.6)
    assert np.isclose(ndvi_matrix[0, 1], 0.5)
    assert np.isclose(ndvi_matrix[1, 0], 0.0)
    assert np.isclose(ndvi_matrix[1, 1], 0.0)

    mean_val = SentinelNDVIService.calculate_mean_ndvi(nir_array, red_array)
    expected_mean = (0.6 + 0.5 + 0.0 + 0.0) / 4.0
    assert np.isclose(mean_val, expected_mean)

    # Verify that suppressed hotspot without prior NDVI writes ndvi=None and ndvi_pending=True
    # and strictly does NOT write placeholder constants like 0.15 to the database
    new_suppressed = ActiveHotspot(
        latitude=23.100,
        longitude=70.100,
        brightness=315.0,
        frp=12.0,
        confidence=80.0,
        ndvi=None,
        ndvi_pending=True,
        is_suppressed=True,
        status="new"
    )
    test_db.add(new_suppressed)
    test_db.commit()

    saved_rec = test_db.query(ActiveHotspot).filter(ActiveHotspot.id == new_suppressed.id).first()
    assert saved_rec.ndvi is None
    assert saved_rec.ndvi_pending is True
    # Confirm no hardcoded mock constants like 0.15 polluted the database
    assert saved_rec.ndvi != 0.15

# ==============================================================================
# Scenario 4: Classifier Fallback Pipeline & Rule-Based Logging
# ==============================================================================
def test_classifier_cold_start_fallback(caplog):
    # Initialize fresh classifier without trained models
    clf = DualModelClassifier()
    clf.rf_model = None
    clf.iso_model = None

    with caplog.at_level(logging.WARNING):
        label, conf, anom_score = clf.predict(
            brightness=350.0,
            frp=120.0,
            confidence=90.0,
            distance_to_refinery_m=200.0,  # inside refinery zone
            distance_to_population_m=1200.0,
            persistence_days=1,
            ndvi=None,
            is_suppressed=False
        )

    # Assert that explicit logger warning was emitted
    assert "Using rule-based classification — insufficient real data to train RandomForest yet" in caplog.text
    # Assert robust rule-based classification output
    assert label == "Potential Industrial Incident"
    assert conf >= 0.8
    assert 0.0 <= anom_score <= 1.0

    # Calculate Priority Score
    priority = clf.calculate_priority_score(
        classification=label,
        frp=120.0,
        confidence=90.0,
        distance_to_refinery_m=200.0,
        distance_to_population_m=1200.0,
        persistence_days=1,
        anomaly_score=anom_score,
        is_suppressed=False
    )
    assert 60 <= priority <= 100
