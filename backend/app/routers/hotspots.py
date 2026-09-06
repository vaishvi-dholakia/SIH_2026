import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_
from app.database import get_db
from app.models.hotspot import ActiveHotspot
from app.schemas.hotspot import (
    HotspotGeoJSONCollection,
    HotspotGeoJSONFeature,
    HotspotStats,
    HotspotLogsResponse,
    HotspotOut,
    HotspotStatusUpdate,
    SimulateHotspotRequest
)

router = APIRouter(prefix="/api/hotspots", tags=["Hotspots"])

@router.get("/realtime", response_model=HotspotGeoJSONCollection)
def get_realtime_hotspots(
    hide_suppressed: bool = Query(False, description="Hide suppressed operational flares"),
    min_frp: Optional[float] = Query(None, description="Filter minimum Fire Radiative Power (MW)"),
    category: Optional[str] = Query(None, description="Filter by classification label"),
    db: Session = Depends(get_db)
):
    """
    Returns GeoJSON FeatureCollection of all active fire points.
    Supports filtering by suppression state, minimum FRP, and classification category.
    """
    query = db.query(ActiveHotspot)

    if hide_suppressed:
        query = query.filter(ActiveHotspot.is_suppressed == False)

    if min_frp is not None:
        query = query.filter(ActiveHotspot.frp >= min_frp)

    if category:
        query = query.filter(ActiveHotspot.classification == category)

    hotspots = query.order_by(desc(ActiveHotspot.detected_at)).limit(1000).all()

    features = []
    for h in hotspots:
        features.append(HotspotGeoJSONFeature(
            type="Feature",
            geometry={
                "type": "Point",
                "coordinates": [h.longitude, h.latitude]
            },
            properties={
                "id": h.id,
                "brightness": h.brightness,
                "frp": h.frp,
                "confidence": h.confidence,
                "ndvi": h.ndvi,
                "ndvi_pending": h.ndvi_pending,
                "persistence_days": h.persistence_days,
                "distance_to_refinery_m": h.distance_to_refinery_m,
                "distance_to_population_m": h.distance_to_population_m,
                "anomaly_score": h.anomaly_score,
                "priority_score": h.priority_score,
                "classification": h.classification,
                "model_confidence": h.model_confidence,
                "is_suppressed": h.is_suppressed,
                "status": h.status,
                "detected_at": h.detected_at.isoformat(),
                "nearest_refinery_id": h.nearest_refinery_id
            }
        ))

    return HotspotGeoJSONCollection(type="FeatureCollection", features=features)

@router.get("/stats", response_model=HotspotStats)
def get_hotspot_stats(db: Session = Depends(get_db)):
    """
    Aggregate counters mapped directly to frontend dashboard metric cards:
    - total_active
    - potential_emergencies (high priority unsuppressed incidents)
    - operational_flares (suppressed industrial flares)
    - wildfires (non-industrial fires)
    """
    total_active = db.query(ActiveHotspot).count()
    
    potential_emergencies = db.query(ActiveHotspot).filter(
        ActiveHotspot.is_suppressed == False,
        or_(
            ActiveHotspot.classification == "Potential Industrial Incident",
            ActiveHotspot.priority_score >= 60
        )
    ).count()

    operational_flares = db.query(ActiveHotspot).filter(
        ActiveHotspot.is_suppressed == True
    ).count()

    wildfires = db.query(ActiveHotspot).filter(
        ActiveHotspot.classification == "Non-Industrial Fire"
    ).count()

    return HotspotStats(
        total_active=total_active,
        potential_emergencies=potential_emergencies,
        operational_flares=operational_flares,
        wildfires=wildfires
    )

@router.get("/logs", response_model=HotspotLogsResponse)
def get_hotspot_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by classification or status"),
    sort_by: str = Query("detected_at", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    status: Optional[str] = Query(None, pattern="^(new|reviewed|resolved)$"),
    db: Session = Depends(get_db)
):
    """
    Paginated, sortable, searchable incident and telemetry log table.
    """
    query = db.query(ActiveHotspot)

    if status:
        query = query.filter(ActiveHotspot.status == status)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                ActiveHotspot.classification.ilike(search_pattern),
                ActiveHotspot.status.ilike(search_pattern)
            )
        )

    # Sorting
    sort_column = getattr(ActiveHotspot, sort_by, ActiveHotspot.detected_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    return HotspotLogsResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        data=records
    )

@router.patch("/{hotspot_id}/status", response_model=HotspotOut)
def update_hotspot_status(
    hotspot_id: int,
    payload: HotspotStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Updates incident triage status:
    - 'new'
    - 'reviewed'
    - 'resolved'
    """
    hotspot = db.query(ActiveHotspot).filter(ActiveHotspot.id == hotspot_id).first()
    if not hotspot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotspot not found")

    hotspot.status = payload.status
    db.commit()
    db.refresh(hotspot)

    # Broadcast status change via WebSocket
    try:
        from app.routers.websockets import ws_manager
        import asyncio
        asyncio.create_task(ws_manager.broadcast({
            "event": "STATUS_UPDATED",
            "hotspot_id": hotspot.id,
            "status": hotspot.status,
            "message": f"Incident #{hotspot.id} status changed to {hotspot.status.upper()}"
        }))
    except Exception:
        pass

    return hotspot

@router.get("/{hotspot_id}", response_model=HotspotOut)
def get_hotspot_detail(
    hotspot_id: int,
    db: Session = Depends(get_db)
):
    """
    Fetch complete metadata for a single hotspot by ID.
    """
    hotspot = db.query(ActiveHotspot).filter(ActiveHotspot.id == hotspot_id).first()
    if not hotspot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotspot not found")
    return hotspot

@router.post("/simulate", response_model=HotspotOut)
async def simulate_hotspot(
    payload: SimulateHotspotRequest,
    db: Session = Depends(get_db)
):
    """
    Dynamically simulates incoming satellite thermal anomaly.
    Injects realistic detection into SQLite DB, calculates spatial distance, runs ML classifier,
    and broadcasts instant WebSocket alarm notification to Command Center deck.
    """
    import random
    from datetime import datetime, timezone
    from app.services.spatial_analyser import SpatialAnalyser
    from app.ml.classifier import classifier_service
    from app.models.refinery import Refinery
    from app.routers.websockets import ws_manager

    # Select base coordinate
    refinery = None
    if payload.simulation_type == "INDUSTRIAL_INCIDENT" or payload.simulation_type == "SUPPRESSED_FLARE":
        refinery = db.query(Refinery).order_by(Refinery.id).first()
    
    if payload.latitude and payload.longitude:
        lat = payload.latitude
        lon = payload.longitude
    elif refinery:
        # Offset slightly near refinery center (0.001 - 0.005 degrees ~ 100m - 500m)
        lat = refinery.latitude + random.uniform(-0.004, 0.004)
        lon = refinery.longitude + random.uniform(-0.004, 0.004)
    else:
        # Default Punjab/Haryana agricultural coordinates
        lat = 30.7333 + random.uniform(-0.5, 0.5)
        lon = 76.7794 + random.uniform(-0.5, 0.5)

    # Calculate spatial parameters
    spatial_res = SpatialAnalyser.analyse_point(lat, lon, db)

    # Set parameters according to simulation type
    if payload.simulation_type == "INDUSTRIAL_INCIDENT":
        brightness = round(random.uniform(365.0, 395.0), 2)
        frp = round(random.uniform(180.0, 450.0), 2)
        confidence = round(random.uniform(85.0, 99.0), 1)
        is_suppressed = False
    elif payload.simulation_type == "SUPPRESSED_FLARE":
        brightness = round(random.uniform(320.0, 345.0), 2)
        frp = round(random.uniform(25.0, 65.0), 2)
        confidence = round(random.uniform(70.0, 90.0), 1)
        is_suppressed = True
    else: # BIOMASS_STUBBLE
        brightness = round(random.uniform(315.0, 335.0), 2)
        frp = round(random.uniform(15.0, 50.0), 2)
        confidence = round(random.uniform(60.0, 85.0), 1)
        is_suppressed = False

    persistence_days = 1 if payload.simulation_type == "INDUSTRIAL_INCIDENT" else random.randint(1, 10)
    ndvi = round(random.uniform(0.08, 0.22), 3) if spatial_res.distance_to_refinery_m < 2000 else round(random.uniform(0.45, 0.75), 3)

    classification, model_conf, anomaly_score = classifier_service.predict(
        brightness=brightness,
        frp=frp,
        confidence=confidence,
        distance_to_refinery_m=spatial_res.distance_to_refinery_m,
        distance_to_population_m=spatial_res.distance_to_population_m,
        persistence_days=persistence_days,
        ndvi=ndvi,
        is_suppressed=is_suppressed,
        db=db
    )

    priority_score = classifier_service.calculate_priority_score(
        classification=classification,
        frp=frp,
        confidence=confidence,
        distance_to_refinery_m=spatial_res.distance_to_refinery_m,
        distance_to_population_m=spatial_res.distance_to_population_m,
        persistence_days=persistence_days,
        anomaly_score=anomaly_score,
        is_suppressed=is_suppressed
    )

    new_hotspot = ActiveHotspot(
        latitude=lat,
        longitude=lon,
        brightness=brightness,
        frp=frp,
        confidence=confidence,
        ndvi=ndvi,
        ndvi_pending=False,
        persistence_days=persistence_days,
        distance_to_refinery_m=spatial_res.distance_to_refinery_m,
        distance_to_population_m=spatial_res.distance_to_population_m,
        anomaly_score=anomaly_score,
        priority_score=priority_score,
        classification=classification,
        model_confidence=model_conf,
        is_suppressed=is_suppressed,
        status="new",
        detected_at=datetime.now(timezone.utc),
        nearest_refinery_id=spatial_res.nearest_refinery_id
    )

    db.add(new_hotspot)
    db.commit()
    db.refresh(new_hotspot)

    # Broadcast live emergency alarm via WebSocket
    event_type = "CRITICAL_DISASTER_ALARM" if priority_score >= 60 else "NEW_HOTSPOT_DETECTED"
    await ws_manager.broadcast({
        "event": event_type,
        "id": new_hotspot.id,
        "latitude": new_hotspot.latitude,
        "longitude": new_hotspot.longitude,
        "brightness": new_hotspot.brightness,
        "frp": new_hotspot.frp,
        "classification": new_hotspot.classification,
        "priority_score": new_hotspot.priority_score,
        "nearest_refinery_name": spatial_res.nearest_refinery_name or "Unknown Industrial Facility",
        "distance_to_refinery_m": new_hotspot.distance_to_refinery_m,
        "message": f"SIMULATED BURST: {classification} detected near {spatial_res.nearest_refinery_name or 'Facility'}! FRP: {frp} MW"
    })

    return new_hotspot

