import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Index, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class HotspotClass(str, enum.Enum):
    INDUSTRIAL_INCIDENT = "Potential Industrial Incident"
    INDUSTRIAL_SOURCE = "Potential Industrial Thermal Source"
    FOREST_FIRE = "Forest Fire / Wildfire"
    AGRICULTURAL_FIRE = "Agricultural / Stubble Burning"
    MINING_FIRE = "Mining Area / Coal Mine Fire"
    URBAN_LANDFILL_FIRE = "Urban / Landfill Fire"
    UNKNOWN = "Unknown"

class ActiveHotspot(Base):
    __tablename__ = "active_hotspots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    brightness = Column(Float, nullable=False)  # Brightness Temperature in Kelvin
    frp = Column(Float, nullable=False, index=True)  # Fire Radiative Power in MW
    confidence = Column(Float, nullable=False)  # 0 - 100%
    
    # Real Sentinel-2 calculated NDVI value at hotspot location, Null if bypassed for suppressed flaring
    ndvi = Column(Float, nullable=True)
    # True if NDVI lookup was bypassed for suppression or satellite quota, False otherwise
    ndvi_pending = Column(Boolean, default=False, nullable=False)
    
    persistence_days = Column(Integer, default=1, nullable=False)
    distance_to_refinery_m = Column(Float, nullable=False, default=999999.0)
    distance_to_population_m = Column(Float, nullable=False, default=999999.0)
    distance_to_forest_m = Column(Float, nullable=True, default=999999.0)
    distance_to_farmland_m = Column(Float, nullable=True, default=999999.0)
    distance_to_mining_m = Column(Float, nullable=True, default=999999.0)
    distance_to_landfill_m = Column(Float, nullable=True, default=999999.0)
    
    anomaly_score = Column(Float, default=0.0, nullable=False)
    priority_score = Column(Integer, default=0, nullable=False, index=True)  # 0 - 100
    
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Classification: Potential Industrial Incident, Potential Industrial Thermal Source, Forest Fire / Wildfire, Agricultural / Stubble Burning, Mining Area / Coal Mine Fire, Urban / Landfill Fire, Unknown
    classification = Column(Enum(HotspotClass), default=HotspotClass.UNKNOWN, nullable=False, index=True)
    model_confidence = Column(Float, default=0.0, nullable=False)
    is_suppressed = Column(Boolean, default=False, nullable=False, index=True)
    
    # Status: new, reviewed, resolved
    status = Column(String(50), default="new", nullable=False, index=True)
    
    nearest_refinery_id = Column(Integer, ForeignKey("refineries.id"), nullable=True, index=True)

    # Relationships
    nearest_refinery = relationship("Refinery", back_populates="hotspots")

    __table_args__ = (
        Index("ix_active_hotspots_lat_lon", "latitude", "longitude"),
        Index("ix_active_hotspots_detected_suppressed", "detected_at", "is_suppressed"),
    )
