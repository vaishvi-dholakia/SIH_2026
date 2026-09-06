from sqlalchemy import Column, Integer, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SuppressionHistory(Base):
    __tablename__ = "suppression_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    refinery_id = Column(Integer, ForeignKey("refineries.id"), nullable=False)
    detection_date = Column(Date, nullable=False, index=True)
    average_frp = Column(Float, nullable=False, default=0.0)
    average_footprint_sqm = Column(Float, nullable=False, default=0.0)

    # Relationship
    refinery = relationship("Refinery", back_populates="suppression_logs")
