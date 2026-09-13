import os
import logging
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sqlalchemy.orm import Session
from app.models.hotspot import ActiveHotspot

logger = logging.getLogger("geoscd.ml.classifier")

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_assets")
os.makedirs(MODEL_DIR, exist_ok=True)

RF_MODEL_PATH = os.path.join(MODEL_DIR, "rf_classifier.joblib")
ISO_MODEL_PATH = os.path.join(MODEL_DIR, "isolation_forest.joblib")

FEATURE_NAMES = [
    "brightness",
    "frp",
    "confidence",
    "distance_to_refinery_m",
    "distance_to_population_m",
    "distance_to_forest_m",
    "distance_to_farmland_m",
    "distance_to_mining_m",
    "persistence_days",
    "ndvi",
    "ndbi",
    "anomaly_score"
]

CLASSES = [
    "Potential Industrial Incident",
    "Potential Industrial Thermal Source",
    "Forest Fire / Wildfire",
    "Agricultural / Stubble Burning",
    "Mining Area / Coal Mine Fire",
    "Urban / Landfill Fire"
]

class DualModelClassifier:
    """
    Dual Machine Learning Model Engine:
    1. Isolation Forest: Anomaly detection on thermal intensity & baseline deviation.
    2. RandomForestClassifier: Spatial-spectral multi-class categorization.
    Includes runtime NDVI imputation, cold-start rule-based fallback, 0-100 Priority Scorer, and XAI.
    """

    def __init__(self):
        self.rf_model: Optional[RandomForestClassifier] = None
        self.iso_model: Optional[IsolationForest] = None
        self.load_models()

    def load_models(self):
        """Loads serialized models if they exist."""
        if os.path.exists(RF_MODEL_PATH) and os.path.exists(ISO_MODEL_PATH):
            try:
                self.rf_model = joblib.load(RF_MODEL_PATH)
                self.iso_model = joblib.load(ISO_MODEL_PATH)
                logger.info("Loaded trained ML models from model_assets.")
            except Exception as e:
                logger.warning(f"Failed loading stored model checkpoints: {e}")
                self.rf_model = None
                self.iso_model = None
        else:
            self.rf_model = None
            self.iso_model = None

    def compute_anomaly_score(self, brightness: float, frp: float, persistence_days: int) -> float:
        """
        Computes Isolation Forest anomaly score.
        Score normalized: 0.0 (normal) to 1.0 (highly anomalous).
        """
        if self.iso_model is not None:
            try:
                # Raw decision function: lower means more anomalous
                features = np.array([[brightness, frp, persistence_days]])
                raw_score = self.iso_model.decision_function(features)[0]
                # Normalize raw_score to roughly 0.0 - 1.0
                norm_score = 1.0 / (1.0 + np.exp(raw_score * 3.0))
                return float(np.clip(norm_score, 0.0, 1.0))
            except Exception as e:
                logger.warning(f"Error calculating IsolationForest score: {e}")

        # Cold-start baseline anomaly heuristic:
        # High FRP (> 150 MW) or high brightness (> 360K) with low persistence is anomalous
        score = 0.1
        if frp > 100:
            score += 0.4
        elif frp > 50:
            score += 0.2
        if brightness > 360:
            score += 0.3
        elif brightness > 340:
            score += 0.15
        if persistence_days == 1 and frp > 80:
            score += 0.2  # Sudden flare explosion
        return float(min(1.0, score))

    def get_imputed_ndvi(self, db: Optional[Session]) -> float:
        """
        Runtime-only imputation for missing NDVI.
        Computes median NDVI of real recorded industrial hotspots in DB.
        This value is used ONLY in-memory for this inference step and NEVER written to DB.
        """
        if db is not None:
            try:
                records = db.query(ActiveHotspot.ndvi).filter(
                    ActiveHotspot.ndvi.isnot(None),
                    ActiveHotspot.distance_to_refinery_m <= 2000.0
                ).limit(50).all()
                valid_ndvis = [r[0] for r in records if r[0] is not None]
                if valid_ndvis:
                    return float(np.median(valid_ndvis))
            except Exception:
                pass
        # Standard industrial bare-ground / concrete median baseline (~0.12 - 0.18)
        return 0.15

    def get_imputed_ndbi(self, db: Optional[Session]) -> float:
        """
        Runtime-only imputation for missing NDBI.
        Computes median NDBI of real recorded industrial hotspots in DB.
        This value is used ONLY in-memory for this inference step and NEVER written to DB.
        """
        if db is not None:
            try:
                records = db.query(ActiveHotspot.ndbi).filter(
                    ActiveHotspot.ndbi.isnot(None),
                    ActiveHotspot.distance_to_refinery_m <= 2000.0
                ).limit(50).all()
                valid_ndbis = [r[0] for r in records if r[0] is not None]
                if valid_ndbis:
                    return float(np.median(valid_ndbis))
            except Exception:
                pass
        # Standard industrial bare-ground / built-up median baseline (~0.25 - 0.35)
        return 0.30

    def classify_rule_based(
        self,
        brightness: float,
        frp: float,
        confidence: float,
        distance_to_refinery_m: float,
        distance_to_population_m: float,
        distance_to_forest_m: float,
        distance_to_farmland_m: float,
        distance_to_mining_m: float,
        distance_to_landfill_m: float,
        persistence_days: int,
        ndvi: Optional[float],
        ndbi: Optional[float],
        is_suppressed: bool,
        anomaly_score: float
    ) -> Tuple[str, float]:
        """
        Deterministic cold-start rule-based fallback when model is untrained.
        Emits explicit warning as required.
        """
        logger.warning("Using rule-based classification — insufficient real data to train RandomForest yet")

        # 1. Industrial Zone (Refinery / Petrochemical)
        if distance_to_refinery_m <= 5000.0 or (ndbi is not None and ndbi > 0.35 and distance_to_refinery_m <= 15000.0):
            if persistence_days > 15:
                return "Potential Industrial Thermal Source", 0.92
            elif frp > 80.0 or anomaly_score > 0.60 or persistence_days <= 2:
                return "Potential Industrial Incident", 0.95
            else:
                return "Potential Industrial Thermal Source", 0.85
        
        # 2. Agricultural / Stubble Burning (Check farmland proximity before forest fire override)
        if distance_to_farmland_m <= 30000.0 or (distance_to_farmland_m <= distance_to_forest_m and distance_to_forest_m > 15000.0):
            return "Agricultural / Stubble Burning", 0.90

        # 3. Forest Fire / Wildfire
        if distance_to_forest_m <= 30000.0 or (distance_to_forest_m < distance_to_farmland_m and ndvi is not None and ndvi > 0.40):
            return "Forest Fire / Wildfire", 0.90

        # 4. Mining Fire
        if distance_to_mining_m <= 30000.0:
            return "Mining Area / Coal Mine Fire", 0.88

        # 5. Urban / Landfill Fire
        if distance_to_landfill_m <= 15000.0 or distance_to_population_m <= 5000.0:
            return "Urban / Landfill Fire", 0.85

        # 6. Fallback based on nearest regional geofence & thermal intensity
        if frp > 100.0 or anomaly_score > 0.65:
            return "Potential Industrial Incident", 0.88
        
        min_dist_map = {
            "Agricultural / Stubble Burning": distance_to_farmland_m,
            "Forest Fire / Wildfire": distance_to_forest_m,
            "Mining Area / Coal Mine Fire": distance_to_mining_m,
            "Urban / Landfill Fire": distance_to_landfill_m,
            "Potential Industrial Thermal Source": distance_to_refinery_m
        }
        closest_type = min(min_dist_map, key=min_dist_map.get)
        if min_dist_map[closest_type] < 999999.0:
            return closest_type, 0.82
        else:
            return "Open Region Thermal Anomaly", 0.75

    def predict(
        self,
        brightness: float,
        frp: float,
        confidence: float,
        distance_to_refinery_m: float,
        distance_to_population_m: float,
        distance_to_forest_m: float = 999999.0,
        distance_to_farmland_m: float = 999999.0,
        distance_to_mining_m: float = 999999.0,
        distance_to_landfill_m: float = 999999.0,
        persistence_days: int = 1,
        ndvi: Optional[float] = None,
        ndbi: Optional[float] = None,
        is_suppressed: bool = False,
        db: Optional[Session] = None
    ) -> Tuple[str, float, float]:
        """
        Performs dual-model inference:
        1. Calculates anomaly_score via IsolationForest
        2. Imputes NDVI/NDBI in-memory if Null/pending
        3. Predicts classification and probability via RandomForest or rule-based fallback
        
        Returns:
            (classification_label, model_confidence, anomaly_score)
        """
        anomaly_score = self.compute_anomaly_score(brightness, frp, persistence_days)

        # Cold start check
        if self.rf_model is None:
            label, conf = self.classify_rule_based(
                brightness, frp, confidence,
                distance_to_refinery_m, distance_to_population_m,
                distance_to_forest_m, distance_to_farmland_m,
                distance_to_mining_m, distance_to_landfill_m,
                persistence_days, ndvi, ndbi, is_suppressed, anomaly_score
            )
            return label, conf, anomaly_score

        # Prepare feature vector with in-memory imputation if ndvi/ndbi is None
        runtime_ndvi = ndvi if ndvi is not None else self.get_imputed_ndvi(db)
        runtime_ndbi = ndbi if ndbi is not None else self.get_imputed_ndbi(db)

        features = np.array([[
            brightness,
            frp,
            confidence,
            distance_to_refinery_m,
            distance_to_population_m,
            distance_to_forest_m,
            distance_to_farmland_m,
            distance_to_mining_m,
            persistence_days,
            runtime_ndvi,
            runtime_ndbi,
            anomaly_score
        ]])

        try:
            pred_idx = self.rf_model.predict(features)[0]
            probs = self.rf_model.predict_proba(features)[0]
            label = CLASSES[pred_idx] if isinstance(pred_idx, (int, np.integer)) else str(pred_idx)
            model_conf = float(np.max(probs))
            return label, model_conf, anomaly_score
        except Exception as e:
            logger.error(f"Error during RandomForest inference: {e}")
            label, conf = self.classify_rule_based(
                brightness, frp, confidence,
                distance_to_refinery_m, distance_to_population_m,
                distance_to_forest_m, distance_to_farmland_m,
                distance_to_mining_m, distance_to_landfill_m,
                persistence_days, ndvi, ndbi, is_suppressed, anomaly_score
            )
            return label, conf, anomaly_score

    @staticmethod
    def generate_xai_explanations(
        classification: str,
        frp: float,
        distance_to_refinery_m: float,
        distance_to_population_m: float,
        persistence_days: int,
        ndvi: Optional[float],
        ndbi: Optional[float] = None,
        anomaly_score: float = 0.0,
        refinery_name: Optional[str] = None
    ) -> List[str]:
        """
        Explainable AI (XAI) Engine:
        Produces dynamic, context-aware contributing reasons based on feature values and weights.
        """
        reasons = []

        cls_str = (classification or "").strip()

        # 1. Classification-specific context
        if cls_str == "Agricultural / Stubble Burning":
            reasons.append("Thermal signature matches open agricultural crop residue burning in rural farm zone")
        elif cls_str == "Forest Fire / Wildfire":
            reasons.append("High-intensity thermal detection in forested vegetation reserve")
        elif cls_str == "Potential Industrial Incident":
            reasons.append("High-risk thermal anomaly in critical proximity to industrial hydrocarbon facility")
        elif cls_str == "Potential Industrial Thermal Source":
            reasons.append("Operational thermal source / gas flare detected within industrial refinery perimeter")
        elif cls_str == "Mining Area / Coal Mine Fire":
            reasons.append("Thermal detection within open-cast coal mine / mineral extraction zone")
        elif cls_str == "Urban / Landfill Fire":
            reasons.append("Thermal signature detected near urban landfill or waste disposal site")

        # 2. Refinery Proximity Context
        ref_label = refinery_name or "Industrial Facility"
        if distance_to_refinery_m == 0.0:
            reasons.append(f"Located directly within {ref_label} boundary")
        elif distance_to_refinery_m <= 1000.0:
            reasons.append(f"Critical proximity to {ref_label} ({int(distance_to_refinery_m)} meters)")
        elif distance_to_refinery_m <= 5000.0:
            reasons.append(f"Located in safety buffer zone of {ref_label} ({int(distance_to_refinery_m)} meters)")
        elif distance_to_refinery_m >= 50000.0:
            reasons.append(f"Safe distance ({int(distance_to_refinery_m / 1000)} km) from industrial refineries and petrochemical plants")

        # 3. Population Vulnerability
        if distance_to_population_m <= 2000.0:
            reasons.append(f"Severe community vulnerability: {int(distance_to_population_m)} meters to nearest population center")
        elif distance_to_population_m >= 50000.0:
            reasons.append("Low community risk: No dense urban population centers within 50+ km")

        # 4. Fire Radiative Power (FRP) Energy
        if frp > 150.0:
            reasons.append(f"Extreme Fire Radiative Power ({frp:.1f} MW) indicates catastrophic combustion/flare surge")
        elif frp > 50.0:
            reasons.append(f"Elevated Fire Radiative Power ({frp:.1f} MW)")
        elif frp < 10.0:
            reasons.append(f"Low Fire Radiative Power ({frp:.1f} MW) represents a small localized surface fire")

        # 5. Temporal Persistence
        if persistence_days > 15:
            reasons.append(f"High temporal persistence ({persistence_days} days detected over last 30 days)")
        elif persistence_days == 1 and frp > 80.0:
            reasons.append("Sudden acute thermal onset (0 past detections in 30 days)")

        # 6. Sentinel-2 Multispectral Indices (NDVI & NDBI)
        if ndvi is not None:
            if ndvi < 0.2:
                reasons.append(f"Low NDVI ({ndvi:.3f}) matches non-vegetated industrial hardscape/flare pad")
            elif ndvi > 0.4:
                reasons.append(f"High NDVI ({ndvi:.3f}) indicates surrounding biomass or active agricultural crop canopy")
        else:
            reasons.append("NDVI computation pending or bypassed for normal flaring suppression")

        if ndbi is not None:
            if ndbi > 0.25:
                reasons.append(f"High NDBI ({ndbi:.3f}) confirms non-vegetated built-up/industrial surface")
            elif ndbi < 0.10:
                reasons.append(f"Low NDBI ({ndbi:.3f}) confirms low built-up density rural surface")

        if anomaly_score > 0.7:
            reasons.append(f"Isolation Forest flags high anomaly index ({anomaly_score:.2f}) relative to baseline")

        if not reasons:
            reasons.append("Thermal signature consistent with standard regional observations")

        return reasons

    def train_models_from_records(self, records: List[ActiveHotspot]) -> bool:
        """
        Trains and persists the RandomForest and Isolation Forest models
        once sufficient real historical NASA FIRMS data has been ingested.
        """
        if len(records) < 30:
            logger.info(f"Insufficient real samples ({len(records)}/30) to train ML models yet.")
            return False

        X = []
        y = []
        iso_X = []

        class_map = {
            "Potential Industrial Incident": 0,
            "Potential Industrial Thermal Source": 1,
            "Forest Fire / Wildfire": 2,
            "Agricultural / Stubble Burning": 3,
            "Mining Area / Coal Mine Fire": 4,
            "Urban / Landfill Fire": 5
        }

        # Calculate median NDVI and NDBI of available records for clean training
        known_ndvis = [r.ndvi for r in records if r.ndvi is not None]
        median_ndvi = float(np.median(known_ndvis)) if known_ndvis else 0.15

        known_ndbis = [getattr(r, 'ndbi', None) for r in records if getattr(r, 'ndbi', None) is not None]
        median_ndbi = float(np.median(known_ndbis)) if known_ndbis else 0.30

        for r in records:
            cls_target = r.classification
            if cls_target not in class_map:
                continue

            eff_ndvi = r.ndvi if r.ndvi is not None else median_ndvi
            eff_ndbi = getattr(r, 'ndbi', None) if getattr(r, 'ndbi', None) is not None else median_ndbi
            anom = r.anomaly_score or 0.1

            feat = [
                r.brightness,
                r.frp,
                r.confidence,
                r.distance_to_refinery_m,
                r.distance_to_population_m,
                r.distance_to_forest_m,
                r.distance_to_farmland_m,
                r.distance_to_mining_m,
                r.persistence_days,
                eff_ndvi,
                eff_ndbi,
                anom
            ]
            X.append(feat)
            y.append(class_map[cls_target])
            iso_X.append([r.brightness, r.frp, r.persistence_days])

        if len(set(y)) < 2:
            logger.warning("Need at least 2 distinct classes in dataset to train RandomForest.")
            return False

        try:
            # Train Isolation Forest
            iso = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
            iso.fit(iso_X)
            joblib.dump(iso, ISO_MODEL_PATH)
            self.iso_model = iso

            # Train Random Forest Classifier
            rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
            rf.fit(X, y)
            joblib.dump(rf, RF_MODEL_PATH)
            self.rf_model = rf

            logger.info(f"Successfully trained & saved Dual ML models with {len(X)} real FIRMS samples.")
            return True
        except Exception as e:
            logger.error(f"Failed to train ML models: {e}")
            return False

# Singleton instance
classifier_service = DualModelClassifier()
