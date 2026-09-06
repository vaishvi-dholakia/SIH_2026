from sqlalchemy import Column, Integer, String
from app.database import Base

class Landfill(Base):
    __tablename__ = "landfills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=True)
    geometry = Column(String, nullable=False)  # WKT representation of polygon boundary
