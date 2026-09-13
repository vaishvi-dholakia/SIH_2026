import logging
from datetime import datetime, timedelta, timezone
from typing import Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.hotspot import ActiveHotspot
from app.models.suppression import SuppressionHistory

logger = logging.getLogger("geoscd.suppression")

# FRP Surge Threshold: 3x normal baseline triggers immediate bypass of suppression & critical escalation
FRP_SURGE_RATIO_THRESHOLD = 3.0

class SuppressionEngine:
    """
    Temporal-Spatial False Alarm Suppression Engine.
    Distinguishes continuous industrial chimney flaring from genuine disasters.
    """

    # Spatial cluster tolerance in degrees (~500 meters)
    COORD_TOLERANCE_DEG = 0.005  

    @classmethod
    def evaluate(
        cls,
        lat: float,
        lon: float,
        current_frp: float,
        nearest_refinery_id: Optional[int],
        detected_at: datetime,
        db: Session
    ) -> Tuple[bool, bool, float, float, float, int, str]:
        """
        Evaluates temporal-spatial suppression and 3x FRP surge rules.
        Excludes current observation from the historical baseline.

        Returns:
            (is_suppressed, is_critical_alarm, historical_baseline_frp, frp_ratio, frp_change_percent, persistence_days, suppression_reason)
        """
        thirty_days_ago = detected_at - timedelta(days=30)

        # 1. Query past observations within spatial cluster in the last 30 days (excluding current)
        lat_min, lat_max = lat - cls.COORD_TOLERANCE_DEG, lat + cls.COORD_TOLERANCE_DEG
        lon_min, lon_max = lon - cls.COORD_TOLERANCE_DEG, lon + cls.COORD_TOLERANCE_DEG

        history_records = db.query(ActiveHotspot).filter(
            ActiveHotspot.latitude.between(lat_min, lat_max),
            ActiveHotspot.longitude.between(lon_min, lon_max),
            ActiveHotspot.detected_at >= thirty_days_ago,
            ActiveHotspot.detected_at < detected_at  # Exclude current observation
        ).all()
        
        # Calculate distinct detection dates to determine persistence_days
        distinct_dates = set(rec.detected_at.date() for rec in history_records)
        persistence_days = len(distinct_dates)

        # Compute historical baseline FRP
        if history_records:
            total_past_frp = sum(r.frp for r in history_records if r.frp is not None)
            historical_baseline_frp = total_past_frp / len(history_records)
        else:
            # First observation at coordinate
            historical_baseline_frp = current_frp

        # If connected to a refinery and no direct cluster records exist, check suppression baseline
        if nearest_refinery_id and not history_records:
            ref_hist = db.query(SuppressionHistory).filter(
                SuppressionHistory.refinery_id == nearest_refinery_id
            ).order_by(SuppressionHistory.detection_date.desc()).first()
            if ref_hist and ref_hist.average_frp > 0:
                historical_baseline_frp = ref_hist.average_frp

        historical_baseline_frp = max(10.0, round(historical_baseline_frp, 1))

        # Calculate exact FRP ratio and percentage change
        frp_ratio = round(current_frp / historical_baseline_frp, 2)
        frp_change_percent = round(((current_frp - historical_baseline_frp) / historical_baseline_frp) * 100.0, 1)

        # 2. FRP Surge Rule (3x Normal Baseline):
        # If FRP ratio >= 3.0 (i.e. 300% of baseline), suppression MUST be bypassed immediately!
        if frp_ratio >= FRP_SURGE_RATIO_THRESHOLD:
            reason = f"3x FRP Surge Detected: {frp_ratio:.2f}x historical baseline ({current_frp:.1f} MW vs baseline {historical_baseline_frp:.1f} MW)"
            logger.warning(f"CRITICAL ESCALATION: {reason}")
            return False, True, historical_baseline_frp, frp_ratio, frp_change_percent, persistence_days + 1, reason

        # 3. Operational Flare Persistence Check:
        # Suppress as routine operational flare if persistence >= 5 days or inside refinery zone with FRP <= 2.0x
        is_persistent_flare_zone = persistence_days >= 5 or (
            nearest_refinery_id is not None and persistence_days >= 2 and frp_ratio < 2.0
        )

        if is_persistent_flare_zone:
            reason = f"Normal Operational Chimney Flare (Persistent {persistence_days} days; FRP ratio {frp_ratio:.2f}x within baseline)"
            logger.info(reason)
            return True, False, historical_baseline_frp, frp_ratio, frp_change_percent, persistence_days + 1, reason

        # Not suppressed: Transient or unsuppressed thermal event
        reason = f"Unsuppressed thermal event (FRP ratio {frp_ratio:.2f}x, persistence {persistence_days} days)"
        return False, False, historical_baseline_frp, frp_ratio, frp_change_percent, persistence_days + 1, reason
