import logging
from datetime import datetime, timedelta, timezone
from typing import Tuple, Dict, Any, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.hotspot import ActiveHotspot
from app.models.suppression import SuppressionHistory

logger = logging.getLogger("geoscd.suppression")

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
    ) -> Tuple[bool, bool, float, int, str]:
        """
        Evaluates whether a thermal anomaly should be suppressed as a normal operational flare
        or escalated as an anomalous disaster/incident.

        Returns:
            (is_suppressed, is_critical_alarm, historical_avg_frp, persistence_days, suppression_reason)
        """
        thirty_days_ago = detected_at - timedelta(days=30)

        # 1. Query past detections within spatial cluster in the last 30 days
        lat_min, lat_max = lat - cls.COORD_TOLERANCE_DEG, lat + cls.COORD_TOLERANCE_DEG
        lon_min, lon_max = lon - cls.COORD_TOLERANCE_DEG, lon + cls.COORD_TOLERANCE_DEG

        query = db.query(ActiveHotspot).filter(
            ActiveHotspot.latitude.between(lat_min, lat_max),
            ActiveHotspot.longitude.between(lon_min, lon_max),
            ActiveHotspot.detected_at >= thirty_days_ago
        )

        history_records = query.all()
        
        # Calculate distinct detection dates to determine persistence_days
        distinct_dates = set(rec.detected_at.date() for rec in history_records)
        persistence_days = len(distinct_dates) + 1  # include today

        # Compute historical average FRP
        if history_records:
            total_past_frp = sum(r.frp for r in history_records)
            historical_avg_frp = total_past_frp / len(history_records)
        else:
            historical_avg_frp = current_frp

        # If connected to a refinery, also check refinery suppression history if available
        if nearest_refinery_id and not history_records:
            ref_hist = db.query(SuppressionHistory).filter(
                SuppressionHistory.refinery_id == nearest_refinery_id
            ).order_by(SuppressionHistory.detection_date.desc()).first()
            if ref_hist and ref_hist.average_frp > 0:
                historical_avg_frp = ref_hist.average_frp

        # 2. Temporal Baseline Check:
        # If coordinate consistently reports a hotspot for > 15 out of the last 30 days
        is_operational_flare_zone = persistence_days > 15 or (
            nearest_refinery_id is not None and persistence_days >= 8
        )

        if not is_operational_flare_zone:
            # Not an established flare zone -> Cannot be suppressed as normal flare
            return False, False, round(historical_avg_frp, 2), persistence_days, "New or transient thermal event (Not a persistent flare zone)"

        # 3. Spatial Footprint / FRP Expansion Check:
        # Compare current FRP against historical average.
        # If current FRP exceeds historical average by >300% (i.e. > 4x the baseline):
        frp_ratio = (current_frp / historical_avg_frp) if historical_avg_frp > 0 else 1.0
        pct_increase = (frp_ratio - 1.0) * 100.0

        if pct_increase > 300.0:
            # Flare explosion or spreading ground fire!
            reason = f"CRITICAL DISASTER ALARM: FRP exceeds historical baseline by {int(pct_increase)}% ({current_frp:.1f} MW vs avg {historical_avg_frp:.1f} MW)"
            logger.warning(reason)
            return False, True, round(historical_avg_frp, 2), persistence_days, reason
        else:
            # Normal parameters -> Mark as suppressed
            reason = f"Normal Operational Chimney Flare (Persistent {persistence_days} days; FRP {current_frp:.1f} MW within baseline {historical_avg_frp:.1f} MW)"
            logger.info(reason)
            return True, False, round(historical_avg_frp, 2), persistence_days, reason
