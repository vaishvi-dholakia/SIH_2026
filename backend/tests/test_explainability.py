import pytest
from app.routers.analytics import get_explainability_metrics
from app.ml.classifier import classifier_service, FEATURE_NAMES

def test_explainability_feature_alignment_untrained():
    """Verify feature importances match FEATURE_NAMES length and descriptions when untrained."""
    orig_rf = classifier_service.rf_model
    try:
        classifier_service.rf_model = None
        metrics = get_explainability_metrics()
        assert len(metrics.feature_importances) == len(FEATURE_NAMES)
        for feat in metrics.feature_importances:
            assert feat.description != ""
            assert feat.feature in FEATURE_NAMES
    finally:
        classifier_service.rf_model = orig_rf

def test_explainability_feature_alignment_trained():
    """Verify feature importances match FEATURE_NAMES length and descriptions when trained."""
    from sklearn.ensemble import RandomForestClassifier
    import numpy as np

    orig_rf = classifier_service.rf_model
    try:
        # Create dummy trained RandomForest with correct feature count
        rf = RandomForestClassifier(n_estimators=10, random_state=42)
        dummy_X = np.random.rand(20, len(FEATURE_NAMES))
        dummy_y = np.random.randint(0, 2, size=20)
        rf.fit(dummy_X, dummy_y)

        classifier_service.rf_model = rf
        metrics = get_explainability_metrics()
        assert len(metrics.feature_importances) == len(FEATURE_NAMES)
        for feat in metrics.feature_importances:
            assert feat.description != ""
            assert feat.feature in FEATURE_NAMES
    finally:
        classifier_service.rf_model = orig_rf
