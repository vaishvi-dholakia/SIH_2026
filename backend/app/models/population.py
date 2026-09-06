from sqlalchemy import Column, Integer, String
from app.database import Base

class PopulationCenter(Base):
    __tablename__ = "population_centers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    geometry = Column(String, nullable=False)  # WKT representation of settlement boundary
    estimated_population = Column(Integer, nullable=False, default=0)
