from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from app.database import Base

class SimulatedHotspot(Base):
    __tablename__ = "simulated_hotspots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    brightness = Column(Float, nullable=False)
    frp = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    ndvi = Column(Float, nullable=True)
    persistence_days = Column(Integer, default=1)
    distance_to_refinery_m = Column(Float, default=999999.0)
    distance_to_population_m = Column(Float, default=999999.0)
    anomaly_score = Column(Float, default=0.0)
    priority_score = Column(Integer, default=0)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    classification = Column(String(100), default="Unknown")
    model_confidence = Column(Float, default=0.0)
    is_suppressed = Column(Boolean, default=False)
    status = Column(String(50), default="new")
    data_source = Column(String(50), default="SIMULATION")
    nearest_refinery_id = Column(Integer, nullable=True)
