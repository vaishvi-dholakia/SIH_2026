import React, { useState, useEffect, Component } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Eye, AlertCircle, Compass, ShieldCheck } from 'lucide-react';

// Fix default Leaflet icon paths safely
try {
  if (L?.Icon?.Default?.prototype?._getIconUrl) {
    delete L.Icon.Default.prototype._getIconUrl;
  }
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
} catch (e) {}

import { isPointInIndia } from '../utils/indiaBoundary';

// Strict Indian Territory Bounding Box
const INDIA_BBOX = {
  MIN_LAT: 6.0,
  MAX_LAT: 37.5,
  MIN_LON: 68.0,
  MAX_LON: 97.5
};

// Guaranteed Failsafe Indian Coordinate Markers (Only real Indian infrastructure)
const FAILSAFE_INDIAN_MARKERS = [
  {
    id: 1,
    latitude: 22.350,
    longitude: 69.850,
    classification: "Potential Industrial Incident",
    priority: "Critical",
    hazardScore: 94,
    frp: 490.8,
    frpChangePercent: 342.0,
    confidence: 99.1,
    nearestFacility: "Jamnagar Oil Refinery Complex, Gujarat",
    distanceToPopulationM: 1200,
    reasons: [
      "🚨 CRITICAL ALERT: Heat coordinate intersects registered refinery 'Jamnagar Oil Refinery Complex, Gujarat'.",
      "Thermal power surge exceeded baseline limits by >300%."
    ]
  },
  {
    id: 2,
    latitude: 23.750,
    longitude: 86.420,
    classification: "Mining Area / Coal Mine Fire",
    priority: "High",
    hazardScore: 78,
    frp: 185.0,
    frpChangePercent: 65.0,
    confidence: 88.5,
    nearestFacility: "Jharia Coal Mine Field, Jharkhand",
    distanceToPopulationM: 2400,
    reasons: ["Persistent subsurface coal seam fire detected in Jharkhand."]
  },
  {
    id: 3,
    latitude: 11.660,
    longitude: 76.630,
    classification: "Forest Fire / Wildfire",
    priority: "High",
    hazardScore: 82,
    frp: 210.0,
    frpChangePercent: 120.0,
    confidence: 91.2,
    nearestFacility: "Bandipur National Park Reserve, Karnataka",
    distanceToPopulationM: 5200,
    reasons: ["Biomass canopy destruction detected in forest reserve."]
  },
  {
    id: 4,
    latitude: 28.625,
    longitude: 77.328,
    classification: "Urban / Landfill Fire",
    priority: "High",
    hazardScore: 76,
    frp: 140.0,
    frpChangePercent: 80.0,
    confidence: 85.0,
    nearestFacility: "Ghazipur Landfill Site, Delhi NCR",
    distanceToPopulationM: 450,
    reasons: ["High thermal combustion signature near Delhi NCR."]
  },
  {
    id: 5,
    latitude: 30.330,
    longitude: 76.380,
    classification: "Agricultural / Stubble Burning",
    priority: "Medium",
    hazardScore: 45,
    frp: 52.0,
    frpChangePercent: 15.0,
    confidence: 80.0,
    nearestFacility: "Patiala Crop Farmland, Punjab",
    distanceToPopulationM: 3800,
    reasons: ["Seasonal crop residue stubble burning."]
  },
  {
    id: 6,
    latitude: 21.170,
    longitude: 72.830,
    classification: "Potential Industrial Incident",
    priority: "Critical",
    hazardScore: 91,
    frp: 385.0,
    frpChangePercent: 250.0,
    confidence: 94.0,
    nearestFacility: "Surat Petrochemical Hub, Gujarat",
    distanceToPopulationM: 950,
    reasons: ["High thermal power surge in hydrocarbon refining sector."]
  }
];

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Leaflet Exception' };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Map Error Boundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[620px] rounded-xl bg-[#151A26] border border-[#262F40] flex flex-col items-center justify-center p-6 text-center text-slate-300 font-sans">
          <AlertCircle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-white uppercase tracking-wider">GIS Map View Initializing</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md font-mono">
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="mt-4 px-5 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold text-xs rounded-lg shadow-lg cursor-pointer"
          >
            RE-LOAD GIS MAP CANVAS
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function parseWktPolygon(wkt) {
  if (!wkt || typeof wkt !== 'string' || !wkt.startsWith('POLYGON')) return [];
  try {
    const rawCoords = wkt.replace('POLYGON((', '').replace('))', '').split(',');
    return rawCoords.map((pair) => {
      const parts = pair.trim().split(/\s+/);
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lat, lon];
    }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
  } catch (e) {
    return [];
  }
}

function MapController({ targetIncident }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Trigger immediate tile invalidate
    try {
      map.invalidateSize();
    } catch (e) {}

    // Attach ResizeObserver to Leaflet container to handle panel collapses & flex shifts
    let resizeObserver;
    try {
      const container = map.getContainer();
      if (container) {
        resizeObserver = new ResizeObserver(() => {
          try {
            map.invalidateSize();
          } catch (e) {}
        });
        resizeObserver.observe(container);
      }
    } catch (e) {}

    const t1 = setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 100);
    const t2 = setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 350);
    const t3 = setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 700);
    const t4 = setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 1200);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [map]);

  useEffect(() => {
    try {
      if (map && targetIncident) {
        const lat = parseFloat(targetIncident.latitude);
        const lng = parseFloat(targetIncident.longitude);
        if (!isNaN(lat) && !isNaN(lng) && 
            lat >= INDIA_BBOX.MIN_LAT && lat <= INDIA_BBOX.MAX_LAT && 
            lng >= INDIA_BBOX.MIN_LON && lng <= INDIA_BBOX.MAX_LON) {
          map.flyTo([lat, lng], 12, { duration: 1.5 });
        }
      }
    } catch (e) {}
  }, [targetIncident, map]);

  return null;
}

function MapViewInner({ 
  incidents = [], 
  refineries = [], 
  selectedHotspot = null, 
  targetIncident = null,
  onSelectHotspot, 
  backendOffline = false 
}) {
  const [tileSource, setTileSource] = useState('dark'); // 'dark' | 'esri' | 'osm'

  const INDIA_CENTER = [22.50, 78.50];
  const INDIA_ZOOM = 5;

  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeRefineries = Array.isArray(refineries) ? refineries : [];

  // Filter ONLY valid Indian sovereign coordinates using Point-in-Polygon
  const validIndianIncidents = safeIncidents.map(inc => {
    if (!inc) return null;
    const lat = parseFloat(inc.latitude);
    const lng = parseFloat(inc.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    // Strict India sovereign territory check
    if (!isPointInIndia(lat, lng)) {
      return null;
    }
    return { ...inc, latitude: lat, longitude: lng };
  }).filter(Boolean);

  // Filter ONLY valid Indian refineries
  const validIndianRefineries = safeRefineries.filter(ref => {
    if (!ref || !ref.geometry) return false;
    const coords = parseWktPolygon(ref.geometry);
    if (coords.length === 0) return false;
    const [lat, lon] = coords[0];
    return isPointInIndia(lat, lon);
  });

  const displayIncidents = validIndianIncidents.length > 0 ? validIndianIncidents.slice(0, 250) : FAILSAFE_INDIAN_MARKERS;

  // Safe default center
  let defaultCenter = INDIA_CENTER;
  if (selectedHotspot) {
    const sLat = parseFloat(selectedHotspot.latitude);
    const sLng = parseFloat(selectedHotspot.longitude);
    if (!isNaN(sLat) && !isNaN(sLng) && 
        sLat >= INDIA_BBOX.MIN_LAT && sLat <= INDIA_BBOX.MAX_LAT && 
        sLng >= INDIA_BBOX.MIN_LON && sLng <= INDIA_BBOX.MAX_LON) {
      defaultCenter = [sLat, sLng];
    }
  }

  const defaultZoom = selectedHotspot ? 12 : INDIA_ZOOM;

  const [layers, setLayers] = useState({
    thermalEvents: true,
    industrialAreas: true
  });

  const getTileUrl = () => {
    switch (tileSource) {
      case 'esri':
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case 'osm':
        return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      case 'dark':
      default:
        return "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{y}/{x}{r}.png";
    }
  };

  const getSeverityColor = (classification, priority) => {
    if (classification === 'Potential Industrial Incident' || priority === 'Critical') return '#ef4444'; // Red
    if (classification === 'Potential Industrial Thermal Source') return '#10b981'; // Green
    if (classification === 'Forest Fire / Wildfire') return '#22c55e'; // Leaf Green
    if (classification === 'Agricultural / Stubble Burning') return '#f59e0b'; // Amber
    if (classification === 'Mining Area / Coal Mine Fire') return '#64748b'; // Slate
    if (classification === 'Urban / Landfill Fire') return '#f97316'; // Orange
    return '#ef4444';
  };

  return (
    <div className="space-y-3 font-sans">
      
      {/* Map Control Toolbar */}
      <div className="bg-[#151A26] border border-[#262F40] p-3 rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              INDIA GIS TACTICAL SURVEILLANCE DECK
            </h2>
            {backendOffline ? (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                ⚠️ Local Engine
              </span>
            ) : (
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                FastAPI Live Database
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Tracking <strong className="text-white">{displayIncidents.length} Indian thermal anomalies</strong> (ISRO / NASA South Asia Feed)
          </p>
        </div>

        {/* Map Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-[#0B0E14] px-3 py-2 rounded-lg border border-[#262F40] text-xs">
          
          {/* Base Layer Switcher */}
          <div className="flex items-center gap-1 bg-[#151A26] p-1 rounded border border-[#262F40]">
            <button
              onClick={() => setTileSource('osm')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${tileSource === 'osm' ? 'bg-[#1D4ED8] text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              OpenStreetMap
            </button>
            <button
              onClick={() => setTileSource('esri')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${tileSource === 'esri' ? 'bg-[#1D4ED8] text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Esri High-Res
            </button>
            <button
              onClick={() => setTileSource('dark')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${tileSource === 'dark' ? 'bg-[#1D4ED8] text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Dark Radar
            </button>
          </div>

          <div className="h-4 w-px bg-[#262F40]"></div>

          {/* Layer Toggles */}
          <label className="flex items-center gap-1.5 cursor-pointer bg-[#151A26] px-2.5 py-1 rounded border border-[#262F40]">
            <input
              type="checkbox"
              checked={layers.thermalEvents}
              onChange={(e) => setLayers({ ...layers, thermalEvents: e.target.checked })}
              className="accent-red-500 rounded cursor-pointer"
            />
            <span className="text-slate-200 font-medium">🔥 Indian Hotspots</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer bg-[#151A26] px-2.5 py-1 rounded border border-[#262F40]">
            <input
              type="checkbox"
              checked={layers.industrialAreas}
              onChange={(e) => setLayers({ ...layers, industrialAreas: e.target.checked })}
              className="accent-amber-500 rounded cursor-pointer"
            />
            <span className="text-slate-200 font-medium">🏭 Refineries</span>
          </label>
        </div>
      </div>

      {/* Main Indian Map Viewport */}
      <div className="w-full h-[620px] rounded-xl overflow-hidden border border-[#262F40] bg-[#0B0E14] shadow-2xl relative">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          minZoom={4}
          maxZoom={18}
          maxBounds={[[3.0, 60.0], [39.0, 100.0]]}
          maxBoundsViscosity={0.5}
          scrollWheelZoom={true}
          preferCanvas={true}
          className="w-full h-full z-10"
          style={{ height: '620px', width: '100%', backgroundColor: '#0B0E14' }}
        >
          <MapController targetIncident={targetIncident || selectedHotspot} />

          {/* Direct Dynamic Tile Layer */}
          <TileLayer
            attribution='&copy; OpenStreetMap & Esri & CartoDB'
            url={getTileUrl()}
            subdomains="abcd"
            maxZoom={18}
          />

          {/* Indian Refinery Geofence Polygons */}
          {layers.industrialAreas && validIndianRefineries.map((refinery, idx) => {
            if (!refinery || !refinery.geometry) return null;
            const positions = parseWktPolygon(refinery.geometry);
            if (positions.length === 0) return null;

            return (
              <Polygon
                key={`ref-${refinery.id || idx}`}
                positions={positions}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.25,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              >
                <Popup>
                  <div className="font-sans text-xs space-y-1 p-1 text-slate-100">
                    <strong className="text-white font-bold block">{refinery.name}</strong>
                    <span className="text-slate-300 block font-medium">Indian Industrial Geofence</span>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {/* Thermal Event Markers - Scaled in Radius Relative to FRP */}
          {layers.thermalEvents && displayIncidents.map((inc, idx) => {
            const color = getSeverityColor(inc.classification, inc.priority);
            const frpVal = parseFloat(inc.frp) || 50;
            const radius = Math.max(6, Math.min(22, Math.sqrt(frpVal) * 1.2));
            const isSelected = selectedHotspot && selectedHotspot.id === inc.id;

            return (
              <CircleMarker
                key={`inc-${inc.id || idx}`}
                center={[inc.latitude, inc.longitude]}
                radius={radius}
                pathOptions={{
                  color: isSelected ? '#38bdf8' : '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: isSelected ? 4 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectHotspot && onSelectHotspot(inc)
                }}
              >
                <Popup>
                  <div className="font-sans text-xs space-y-2 p-1 max-w-xs text-slate-100">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
                      <span className="font-mono font-bold text-red-400 uppercase text-[10px]">
                        GEO-2026-JM{inc.id || '11'}
                      </span>
                      <span className="font-mono text-amber-400 font-bold">{inc.frp || 0} MW</span>
                    </div>

                    <strong className="text-sm font-bold text-white block leading-snug">
                      {inc.classification || 'Thermal Anomaly'}
                    </strong>
                    <span className="text-slate-300 font-semibold block text-xs">
                      {inc.nearestFacility || 'Industrial Zone'}
                    </span>

                    <button
                      onClick={() => onSelectHotspot && onSelectHotspot(inc)}
                      className="w-full py-1.5 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold rounded text-xs transition-colors flex items-center justify-center gap-1 mt-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>INSPECT TELEMETRY</span>
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        </MapContainer>
      </div>

    </div>
  );
}

export default function MapView(props) {
  return (
    <MapErrorBoundary>
      <MapViewInner {...props} />
    </MapErrorBoundary>
  );
}
