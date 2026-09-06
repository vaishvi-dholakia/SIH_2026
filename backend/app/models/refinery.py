from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship
from app.database import Base

class Refinery(Base):
    __tablename__ = "refineries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    operator = Column(String(255), nullable=False)
    geometry = Column(String, nullable=False)  # WKT representation of polygon boundary
    risk_level = Column(String(50), default="High")  # Critical, High, Medium
    safety_buffer_km = Column(Float, default=1.0)

    # Relationships
    hotspots = relationship("ActiveHotspot", back_populates="nearest_refinery")
    suppression_logs = relationship("SuppressionHistory", back_populates="refinery")
