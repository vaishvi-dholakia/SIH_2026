import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from shapely import wkt
from shapely.geometry import mapping, shape
from app.database import get_db
from app.models.refinery import Refinery
from app.models.hotspot import ActiveHotspot
from app.models.suppression import SuppressionHistory
from app.schemas.refinery import (
    RefineryGeoJSONCollection,
    RefineryGeoJSONFeature,
    RefineryCreate,
    RefineryOut,
    RefineryFRPPoint
)

router = APIRouter(prefix="/api", tags=["Refineries"])

@router.post("/refineries/sync-osm")
async def sync_osm_infrastructure(db: Session = Depends(get_db)):
    """
    Triggers live OpenStreetMap (OSM) sync to fetch all oil refineries,
    petrochemical facilities, and population settlements dynamically across India.
    """
    from app.services.osm_fetcher import OSMFetcher
    result = await OSMFetcher.sync_all_from_osm(db)
    return {
        "status": "success",
        "message": "Synchronized live infrastructure from OpenStreetMap.",
        "data": result
    }

@router.get("/refineries", response_model=RefineryGeoJSONCollection)
def get_refineries(db: Session = Depends(get_db)):
    """
    Returns GeoJSON FeatureCollection of all registered facility boundaries.
    """
    refineries = db.query(Refinery).all()
    features = []

    for ref in refineries:
        try:
            poly = wkt.loads(ref.geometry)
            geom_dict = mapping(poly)
        except Exception:
            geom_dict = {"type": "Polygon", "coordinates": []}

        features.append(RefineryGeoJSONFeature(
            type="Feature",
            geometry=geom_dict,
            properties={
                "id": ref.id,
                "name": ref.name,
                "operator": ref.operator,
                "risk_level": ref.risk_level,
                "safety_buffer_km": ref.safety_buffer_km
            }
        ))

    return RefineryGeoJSONCollection(type="FeatureCollection", features=features)

@router.post("/refinery/register", response_model=RefineryOut, status_code=status.HTTP_201_CREATED)
def register_refinery(payload: dict, db: Session = Depends(get_db)):
    """
    Registers a new facility boundary via GeoJSON Feature or direct attributes.
    Supports GeoJSON payload:
    {
      "name": "Jamnagar Refinery Complex",
      "operator": "Reliance Industries Ltd",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "risk_level": "Critical",
      "safety_buffer_km": 1.0
    }
    or WKT string format.
    """
    name = payload.get("name")
    operator = payload.get("operator", "Unknown")
    risk_level = payload.get("risk_level", "High")
    safety_buffer_km = float(payload.get("safety_buffer_km", 1.0))
    geom_input = payload.get("geometry")

    if not name or not geom_input:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name and geometry are required."
        )

    wkt_str = ""
    if isinstance(geom_input, dict):
        try:
            geom_shape = shape(geom_input)
            wkt_str = geom_shape.wkt
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid GeoJSON geometry: {e}"
            )
    elif isinstance(geom_input, str):
        try:
            wkt.loads(geom_input)
            wkt_str = geom_input
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid WKT geometry: {e}"
            )

    refinery = Refinery(
        name=name,
        operator=operator,
        geometry=wkt_str,
        risk_level=risk_level,
        safety_buffer_km=safety_buffer_km
    )
    db.add(refinery)
    db.commit()
    db.refresh(refinery)

    return refinery

@router.get("/refineries/{refinery_id}", response_model=RefineryOut)
def get_refinery_profile(refinery_id: int, db: Session = Depends(get_db)):
    """
    Returns detailed profile metadata for a specific refinery.
    """
    ref = db.query(Refinery).filter(Refinery.id == refinery_id).first()
    if not ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Refinery not found")
    return ref

@router.get("/refineries/{refinery_id}/history", response_model=List[RefineryFRPPoint])
def get_refinery_frp_history(refinery_id: int, db: Session = Depends(get_db)):
    """
    Historical FRP trend formatted directly for Recharts graphs on the frontend.
    """
    ref = db.query(Refinery).filter(Refinery.id == refinery_id).first()
    if not ref:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Refinery not found")

    # Fetch recorded suppression history or compute from active hotspots
    history_records = db.query(SuppressionHistory).filter(
        SuppressionHistory.refinery_id == refinery_id
    ).order_by(SuppressionHistory.detection_date.asc()).all()

    if history_records:
        points = []
        for h in history_records:
            points.append(RefineryFRPPoint(
                date=h.detection_date.strftime("%Y-%m-%d"),
                average_frp=h.average_frp,
                max_frp=round(h.average_frp * 1.5, 2),
                hotspot_count=5
            ))
        return points

    # Compute dynamically from hotspots linked to this refinery
    hotspots = db.query(ActiveHotspot).filter(
        ActiveHotspot.nearest_refinery_id == refinery_id
    ).order_by(ActiveHotspot.detected_at.asc()).all()

    daily_groups = {}
    for h in hotspots:
        d_str = h.detected_at.strftime("%Y-%m-%d")
        if d_str not in daily_groups:
            daily_groups[d_str] = []
        daily_groups[d_str].append(h.frp)

    points = []
    for d_str, frps in daily_groups.items():
        points.append(RefineryFRPPoint(
            date=d_str,
            average_frp=round(sum(frps) / len(frps), 2),
            max_frp=round(max(frps), 2),
            hotspot_count=len(frps)
        ))

    return points
