import logging
import math
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from app.models.refinery import Refinery
from app.models.population import PopulationCenter

logger = logging.getLogger("geoscd.osm_fetcher")

OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"

class OSMFetcher:
    """
    Live OpenStreetMap (OSM) Ingestion Engine.
    Dynamically pulls authentic industrial refinery complexes, petrochemical facilities,
    and populated settlements across India directly from OpenStreetMap Overpass API.
    Zero static or hardcoded infrastructure assets.
    """

    @classmethod
    async def query_overpass(cls, query_ql: str) -> Optional[List[Dict[str, Any]]]:
        headers = {
            "User-Agent": "GEOSCD-NTRO-FireMonitor/1.0 (contact: student@sih.gov.in)"
        }
        try:
            logger.info("Querying live OpenStreetMap Overpass API...")
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(OVERPASS_ENDPOINT, data={"data": query_ql}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("elements", [])
                else:
                    logger.warning(f"Overpass API returned status {resp.status_code}")
                    return None
        except Exception as e:
            logger.warning(f"Failed querying Overpass API: {e}")
            return None

    @staticmethod
    def create_bounding_polygon_wkt(lat: float, lon: float, radius_km: float = 1.0) -> str:
        """
        Creates a closed boundary polygon WKT around a facility center.
        """
        d_lat = radius_km / 111.0
        d_lon = radius_km / (111.0 * math.cos(math.radians(lat)))
        num_points = 8
        coords = []
        for i in range(num_points):
            angle = 2.0 * math.pi * i / num_points
            pt_lat = lat + d_lat * math.sin(angle)
            pt_lon = lon + d_lon * math.cos(angle)
            coords.append(f"{pt_lon:.6f} {pt_lat:.6f}")
        coords.append(coords[0])  # Close polygon ring
        return f"POLYGON(({', '.join(coords)}))"

    @classmethod
    async def fetch_and_sync_refineries(cls, db: Session) -> int:
        """
        Queries OpenStreetMap live for real Oil Refineries, Petrochemical Complexes,
        and major hydrocarbon processing facilities across India.
        """
        query_ql = """
        [out:json][timeout:25];
        (
          nwr["industrial"="oil_refinery"](6.0,68.0,37.5,97.5);
          nwr["industrial"="petrochemical"](6.0,68.0,37.5,97.5);
          nwr["man_made"="works"]["product"~"petroleum|oil|fuel"](6.0,68.0,37.5,97.5);
        );
        out center tags 40;
        """
        elements = await cls.query_overpass(query_ql)
        if not elements:
            logger.warning("No elements returned from OSM Overpass query for refineries.")
            return 0

        count = 0
        for el in elements:
            tags = el.get("tags", {})
            name = (
                tags.get("name")
                or tags.get("name:en")
                or tags.get("description")
                or tags.get("operator")
            )
            if not name or len(name.strip()) < 3:
                continue

            operator = (
                tags.get("operator")
                or tags.get("brand")
                or tags.get("owner")
                or "Indian Industrial Operator"
            )

            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            if not lat or not lon:
                continue

            # Determine risk level based on facility tags
            is_critical = any(k in name.lower() for k in ["refinery", "petrochemical", "crude", "oil", "complex"])
            risk_level = "Critical" if is_critical else "High"
            safety_buffer_km = 1.5 if is_critical else 1.0

            wkt_geom = cls.create_bounding_polygon_wkt(lat, lon, radius_km=1.2)

            existing = db.query(Refinery).filter(Refinery.name == name.strip()).first()
            if existing:
                existing.operator = operator
                existing.geometry = wkt_geom
                existing.risk_level = risk_level
                existing.safety_buffer_km = safety_buffer_km
            else:
                ref = Refinery(
                    name=name.strip(),
                    operator=operator,
                    geometry=wkt_geom,
                    risk_level=risk_level,
                    safety_buffer_km=safety_buffer_km
                )
                db.add(ref)
                count += 1

        db.commit()
        logger.info(f"Successfully synced {count} live industrial facilities from OpenStreetMap.")
        return count

    @classmethod
    async def fetch_and_sync_settlements(cls, db: Session) -> int:
        """
        Queries OpenStreetMap live for real populated settlements (towns, suburbs, villages)
        within 15km of registered industrial facilities to measure community vulnerability.
        """
        refineries = db.query(Refinery).limit(10).all()
        if not refineries:
            return 0

        # Query around coordinates of facilities
        around_clauses = []
        for r in refineries:
            try:
                from shapely import wkt
                poly = wkt.loads(r.geometry)
                centroid = poly.centroid
                around_clauses.append(f'node["place"](around:15000, {centroid.y:.4f}, {centroid.x:.4f});')
            except Exception:
                continue

        query_ql = f"""
        [out:json][timeout:25];
        (
          {" ".join(around_clauses[:6])}
        );
        out body 40;
        """
        elements = await cls.query_overpass(query_ql)
        if not elements:
            logger.warning("No settlement elements returned from OSM Overpass query.")
            return 0

        count = 0
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en")
            if not name or len(name.strip()) < 2:
                continue

            lat = el.get("lat")
            lon = el.get("lon")
            if not lat or not lon:
                continue

            # Parse population
            pop_str = tags.get("population", "0")
            try:
                population = int(pop_str.replace(",", "").strip())
                if population <= 0:
                    place_type = tags.get("place", "village")
                    population = 45000 if place_type in ["city", "town", "suburb"] else 15000
            except ValueError:
                place_type = tags.get("place", "village")
                population = 45000 if place_type in ["city", "town", "suburb"] else 15000

            wkt_geom = cls.create_bounding_polygon_wkt(lat, lon, radius_km=1.5)

            existing = db.query(PopulationCenter).filter(PopulationCenter.name == name.strip()).first()
            if existing:
                existing.geometry = wkt_geom
                existing.estimated_population = population
            else:
                pop_center = PopulationCenter(
                    name=name.strip(),
                    geometry=wkt_geom,
                    estimated_population=population
                )
                db.add(pop_center)
                count += 1

        db.commit()
        logger.info(f"Successfully synced {count} live population settlements from OpenStreetMap.")
        return count

    @classmethod
    async def sync_all_from_osm(cls, db: Session) -> Dict[str, Any]:
        """Runs full live synchronization from OpenStreetMap for all infrastructure."""
        ref_count = await cls.fetch_and_sync_refineries(db)
        pop_count = await cls.fetch_and_sync_settlements(db)
        return {
            "refineries_synced": ref_count,
            "population_centers_synced": pop_count,
            "total_refineries_in_db": db.query(Refinery).count(),
            "total_population_centers_in_db": db.query(PopulationCenter).count()
        }
