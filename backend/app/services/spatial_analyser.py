import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from shapely import wkt
from shapely.geometry import Point, Polygon, MultiPolygon
from shapely.ops import transform
import pyproj
from sqlalchemy.orm import Session
from app.models.refinery import Refinery
from app.models.population import PopulationCenter
from app.models.forest import Forest
from app.models.farmland import Farmland
from app.models.mine import Mine
from app.models.landfill import Landfill

logger = logging.getLogger("geoscd.spatial_analyser")

# Metric transformer: EPSG:4326 (lon/lat) to EPSG:3857 (meters Web Mercator)
project_to_meters = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
geod = pyproj.Geod(ellps="WGS84")

class SpatialResult:
    def __init__(
        self,
        is_inside_refinery: bool,
        is_within_safety_buffer: bool,
        nearest_refinery_id: Optional[int],
        distance_to_refinery_m: float,
        distance_to_population_m: float,
        distance_to_forest_m: float = 999999.0,
        distance_to_farmland_m: float = 999999.0,
        distance_to_mining_m: float = 999999.0,
        distance_to_landfill_m: float = 999999.0,
        nearest_refinery_name: Optional[str] = None
    ):
        self.is_inside_refinery = is_inside_refinery
        self.is_within_safety_buffer = is_within_safety_buffer
        self.nearest_refinery_id = nearest_refinery_id
        self.distance_to_refinery_m = distance_to_refinery_m
        self.distance_to_population_m = distance_to_population_m
        self.distance_to_forest_m = distance_to_forest_m
        self.distance_to_farmland_m = distance_to_farmland_m
        self.distance_to_mining_m = distance_to_mining_m
        self.distance_to_landfill_m = distance_to_landfill_m
        self.nearest_refinery_name = nearest_refinery_name

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_inside_refinery": self.is_inside_refinery,
            "is_within_safety_buffer": self.is_within_safety_buffer,
            "nearest_refinery_id": self.nearest_refinery_id,
            "distance_to_refinery_m": self.distance_to_refinery_m,
            "distance_to_population_m": self.distance_to_population_m,
            "distance_to_forest_m": self.distance_to_forest_m,
            "distance_to_farmland_m": self.distance_to_farmland_m,
            "distance_to_mining_m": self.distance_to_mining_m,
            "distance_to_landfill_m": self.distance_to_landfill_m,
            "nearest_refinery_name": self.nearest_refinery_name,
        }

class SpatialAnalyser:
    """
    Spatial engine for geofence analysis, point-in-polygon checks,
    and accurate metric distance calculation to industrial assets and population centers.
    """

    @staticmethod
    def parse_wkt_safe(wkt_str: str):
        try:
            return wkt.loads(wkt_str)
        except Exception as e:
            logger.error(f"Error parsing WKT '{wkt_str[:50]}...': {e}")
            return None

    @staticmethod
    def calculate_metric_distance(pt: Point, geom) -> float:
        """
        Calculates accurate distance in meters between a WGS84 Point and a Shapely Geometry.
        Uses true WGS84 geodesic distance to nearest point on polygon boundary.
        """
        if geom is None or pt is None:
            return 999999.0
        
        # If point is inside polygon or intersects, distance is 0
        if geom.contains(pt) or geom.intersects(pt):
            return 0.0

        try:
            from shapely.ops import nearest_points
            p1, p2 = nearest_points(pt, geom)
            _, _, dist_geod = geod.inv(p1.x, p1.y, p2.x, p2.y)
            return float(dist_geod)
        except Exception as e:
            try:
                centroid = geom.centroid
                _, _, dist_geod = geod.inv(pt.x, pt.y, centroid.x, centroid.y)
                return float(dist_geod)
            except Exception:
                return 999999.0

    @classmethod
    def get_cached_geofences(cls, db: Session) -> Dict[str, Any]:
        """Pre-loads and parses WKT geometries into memory as plain Python dicts for ultra-fast, thread-safe batch processing."""
        refineries = []
        valid_refinery_ids = set()
        for ref in db.query(Refinery).all():
            wkt_poly = cls.parse_wkt_safe(ref.geometry)
            if wkt_poly:
                refineries.append({
                    "id": ref.id,
                    "name": ref.name,
                    "safety_buffer_km": ref.safety_buffer_km or 1.0,
                    "poly": wkt_poly
                })
                valid_refinery_ids.add(ref.id)

        def load_parsed(model_cls):
            geoms = []
            for rec in db.query(model_cls).all():
                g = cls.parse_wkt_safe(rec.geometry)
                if g: geoms.append(g)
            return geoms

        return {
            "refineries": refineries,
            "valid_refinery_ids": valid_refinery_ids,
            "population_centers": load_parsed(PopulationCenter),
            "forests": load_parsed(Forest),
            "farmlands": load_parsed(Farmland),
            "mines": load_parsed(Mine),
            "landfills": load_parsed(Landfill),
        }

    @classmethod
    def analyse_point(
        cls,
        lat: float,
        lon: float,
        db: Session,
        geofence_cache: Optional[Dict[str, Any]] = None
    ) -> SpatialResult:
        """
        Evaluates a thermal anomaly coordinate against:
        1. All registered Refinery geofences (inside polygon check, safety buffer, nearest distance)
        2. All registered PopulationCenter boundaries (nearest distance)
        3. All environmental boundaries (Forests, Farmlands, Mines, Landfills)
        """
        pt = Point(lon, lat)

        if geofence_cache is not None:
            refineries_with_poly = geofence_cache["refineries"]
            population_centers = geofence_cache["population_centers"]
            forests = geofence_cache["forests"]
            farmlands = geofence_cache["farmlands"]
            mines = geofence_cache["mines"]
            landfills = geofence_cache["landfills"]
        else:
            refineries_with_poly = []
            for ref in db.query(Refinery).all():
                p = cls.parse_wkt_safe(ref.geometry)
                if p:
                    refineries_with_poly.append({
                        "id": ref.id,
                        "name": ref.name,
                        "safety_buffer_km": ref.safety_buffer_km or 1.0,
                        "poly": p
                    })
            population_centers = [cls.parse_wkt_safe(rec.geometry) for rec in db.query(PopulationCenter).all() if rec.geometry]
            forests = [cls.parse_wkt_safe(rec.geometry) for rec in db.query(Forest).all() if rec.geometry]
            farmlands = [cls.parse_wkt_safe(rec.geometry) for rec in db.query(Farmland).all() if rec.geometry]
            mines = [cls.parse_wkt_safe(rec.geometry) for rec in db.query(Mine).all() if rec.geometry]
            landfills = [cls.parse_wkt_safe(rec.geometry) for rec in db.query(Landfill).all() if rec.geometry]

        is_inside_refinery = False
        is_within_safety_buffer = False
        nearest_refinery_id = None
        nearest_refinery_name = None
        min_refinery_dist = 999999.0

        for item in refineries_with_poly:
            poly = item["poly"]
            ref_id = item["id"]
            ref_name = item["name"]
            buffer_km = item["safety_buffer_km"]

            if not poly:
                continue

            dist_m = cls.calculate_metric_distance(pt, poly)

            if dist_m == 0.0 or poly.contains(pt):
                is_inside_refinery = True
                is_within_safety_buffer = True
                min_refinery_dist = 0.0
                nearest_refinery_id = ref_id
                nearest_refinery_name = ref_name
                break  # Point is directly inside this refinery
            else:
                buffer_m = buffer_km * 1000.0
                if dist_m <= buffer_m:
                    is_within_safety_buffer = True

                if dist_m < min_refinery_dist:
                    min_refinery_dist = dist_m
                    nearest_refinery_id = ref_id
                    nearest_refinery_name = ref_name

        def get_min_dist(geoms):
            min_dist = 999999.0
            for geom in geoms:
                if not geom: continue
                d = cls.calculate_metric_distance(pt, geom)
                if d < min_dist: min_dist = d
            return min_dist

        min_pop_dist = get_min_dist(population_centers)
        min_forest_dist = get_min_dist(forests)
        min_farm_dist = get_min_dist(farmlands)
        min_mine_dist = get_min_dist(mines)
        min_landfill_dist = get_min_dist(landfills)

        return SpatialResult(
            is_inside_refinery=is_inside_refinery,
            is_within_safety_buffer=is_within_safety_buffer,
            nearest_refinery_id=nearest_refinery_id,
            distance_to_refinery_m=round(min_refinery_dist, 2),
            distance_to_population_m=round(min_pop_dist, 2),
            distance_to_forest_m=round(min_forest_dist, 2),
            distance_to_farmland_m=round(min_farm_dist, 2),
            distance_to_mining_m=round(min_mine_dist, 2),
            distance_to_landfill_m=round(min_landfill_dist, 2),
            nearest_refinery_name=nearest_refinery_name
        )
