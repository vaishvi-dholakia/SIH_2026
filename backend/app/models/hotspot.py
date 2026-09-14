from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base

class ActiveHotspot(Base):
    __tablename__ = "active_hotspots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    brightness = Column(Float, nullable=False)  # Brightness Temperature in Kelvin
    frp = Column(Float, nullable=False, index=True)  # Fire Radiative Power in MW
    confidence = Column(Float, nullable=False)  # 0 - 100%
    
    # Real Sentinel-2 calculated NDVI value at hotspot location, Null if pending/unavailable
    ndvi = Column(Float, nullable=True)
    ndvi_pending = Column(Boolean, default=False, nullable=False)

    # Sentinel-2 Spectral Band Reflectances (B02, B04, B08, B11, B12)
    b2_reflectance = Column(Float, nullable=True)
    b4_reflectance = Column(Float, nullable=True)
    b8_reflectance = Column(Float, nullable=True)
    b11_reflectance = Column(Float, nullable=True)
    b12_reflectance = Column(Float, nullable=True)
    
    persistence_days = Column(Integer, default=1, nullable=False)
    distance_to_refinery_m = Column(Float, nullable=False, default=999999.0)
    distance_to_population_m = Column(Float, nullable=False, default=999999.0)
    distance_to_forest_m = Column(Float, nullable=True, default=999999.0)
    distance_to_farmland_m = Column(Float, nullable=True, default=999999.0)
    distance_to_mining_m = Column(Float, nullable=True, default=999999.0)
    distance_to_landfill_m = Column(Float, nullable=True, default=999999.0)
    
    anomaly_score = Column(Float, default=0.0, nullable=False)
    priority_score = Column(Integer, default=0, nullable=False, index=True)  # 0 - 100 unified hazard score
    
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Canonical String representation:
    # "Potential Industrial Incident", "Potential Industrial Thermal Source", "Forest Fire / Wildfire",
    # "Agricultural / Stubble Burning", "Mining Area / Coal Mine Fire", "Urban / Landfill Fire", "Unknown"
    classification = Column(String(100), default="Unknown", nullable=False, index=True)
    model_confidence = Column(Float, default=0.0, nullable=False)
    is_suppressed = Column(Boolean, default=False, nullable=False, index=True)
    
    # Status: new, reviewed, resolved
    status = Column(String(50), default="new", nullable=False, index=True)
    
    # Data source identifier: "NASA_FIRMS" or "SIMULATION"
    data_source = Column(String(50), default="NASA_FIRMS", nullable=False, index=True)
    
    nearest_refinery_id = Column(Integer, ForeignKey("refineries.id"), nullable=True, index=True)

    # Relationships
    nearest_refinery = relationship("Refinery", back_populates="hotspots")

    __table_args__ = (
        Index("ix_active_hotspots_lat_lon", "latitude", "longitude"),
        Index("ix_active_hotspots_detected_suppressed", "detected_at", "is_suppressed"),
    )
