from fastapi import APIRouter
from app.services.india_boundary import MAINLAND_INDIA_POLYGON, ISLAND_BOUNDS

router = APIRouter(prefix="/api/geo", tags=["Geospatial Boundaries"])

@router.get("/india-boundary")
def get_india_boundary():
    """
    Returns the single authoritative sovereign India boundary polygon
    and island bounding boxes directly from india_boundary.py as GeoJSON.
    """
    features = [
        {
            "type": "Feature",
            "properties": {"name": "Mainland India"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [MAINLAND_INDIA_POLYGON]
            }
        }
    ]
    
    for idx, b in enumerate(ISLAND_BOUNDS):
        min_lon, min_lat, max_lon, max_lat = b
        features.append({
            "type": "Feature",
            "properties": {"name": f"Island Territory {idx + 1}"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [min_lon, min_lat],
                    [max_lon, min_lat],
                    [max_lon, max_lat],
                    [min_lon, max_lat],
                    [min_lon, min_lat]
                ]]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "mainland_polygon": MAINLAND_INDIA_POLYGON,
        "island_bounds": ISLAND_BOUNDS
    }
