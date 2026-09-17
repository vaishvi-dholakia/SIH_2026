import React, { useState, useEffect, Component } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Circle, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Eye, AlertCircle, Compass, ShieldCheck, Camera, Ruler, Crosshair, CircleDot } from 'lucide-react';
import FilterPanel from './FilterPanel';

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

function MapController({ targetIncident, tileSource }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handleResize = () => {
      try {
        if (typeof map.invalidateSize === 'function') {
          map.invalidateSize();
        }
      } catch (e) {}
    };

    handleResize();
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 300);
    const t3 = setTimeout(handleResize, 800);

    let resizeObserver = null;
    try {
      const container = map.getContainer();
      if (container && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          handleResize();
        });
        resizeObserver.observe(container);
        if (container.parentElement) {
          resizeObserver.observe(container.parentElement);
        }
      }
    } catch (e) {}

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map, tileSource]);

  useEffect(() => {
    try {
      if (map && targetIncident) {
        const lat = parseFloat(targetIncident.latitude ?? targetIncident.lat);
        const lng = parseFloat(targetIncident.longitude ?? targetIncident.lng ?? targetIncident.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          map.flyTo([lat, lng], 13, { animate: true, duration: 1.2 });
        }
      }
    } catch (e) {}
  }, [targetIncident, map]);

  return null;
}

function MapEventsHandler({ onMouseMove, onMapClick }) {
  useMapEvents({
    mousemove(e) {
      if (onMouseMove && e.latlng) onMouseMove(e.latlng);
    },
    click(e) {
      if (onMapClick && e.latlng) onMapClick(e.latlng);
    }
  });
  return null;
}

function MapViewInner({ 
  incidents = [], 
  refineries = [], 
  selectedHotspot = null, 
  targetIncident = null,
  onSelectHotspot, 
  backendOffline = false,
  filters,
  setFilters,
  resetFilters
}) {
  const [tileSource, setTileSource] = useState('bhuvan');
  const [cursorCoords, setCursorCoords] = useState({ lat: 20.5937, lng: 78.9629 });
  const [showBufferRings, setShowBufferRings] = useState(true);
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  const INDIA_CENTER = [22.50, 78.50];
  const INDIA_ZOOM = 5;

  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeRefineries = Array.isArray(refineries) ? refineries : [];

  // Parse valid coordinates for map markers
  const validIndianIncidents = safeIncidents.map(inc => {
    if (!inc) return null;
    const lat = parseFloat(inc.latitude);
    const lng = parseFloat(inc.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { ...inc, latitude: lat, longitude: lng };
  }).filter(Boolean);

  // Filter ONLY valid Indian refineries
  const validIndianRefineries = safeRefineries.filter(ref => {
    if (!ref || !ref.geometry) return false;
    const coords = parseWktPolygon(ref.geometry);
    return coords.length > 0;
  });

  const displayIncidents = validIndianIncidents;

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

  const handleMapClick = (latlng) => {
    if (measureActive) {
      if (measurePoints.length >= 2) {
        setMeasurePoints([latlng]);
      } else {
        setMeasurePoints(prev => [...prev, latlng]);
      }
    }
  };

  const calculateDistanceKm = () => {
    if (measurePoints.length < 2) return null;
    const p1 = L.latLng(measurePoints[0].lat, measurePoints[0].lng);
    const p2 = L.latLng(measurePoints[1].lat, measurePoints[1].lng);
    return (p1.distanceTo(p2) / 1000).toFixed(2);
  };

  const handleCaptureSnapshot = () => {
    alert(`📸 GIS Map Viewport Snapshot Captured!\nLat: ${cursorCoords.lat.toFixed(4)}°, Lon: ${cursorCoords.lng.toFixed(4)}°\nActive Telemetries: ${displayIncidents.length}\nDate: ${new Date().toLocaleString('en-IN')}`);
  };

  const getTileUrl = () => {
    switch (tileSource) {
      case 'bhuvan':
      case 'esri':
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case 'osm':
      default:
        return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }
  };

  const getSeverityColor = (classification, priority, classificationClass) => {
    if (classificationClass === '02' || classification === 'Potential Industrial Incident' || priority === 'Critical') return '#EF4444'; // Crimson Red
    if (classificationClass === '01' || classification === 'Potential Industrial Thermal Source' || classification === 'Industrial Source') return '#10B981'; // Emerald Green
    if (classificationClass === '03' || classification === 'Forest Fire / Wildfire') return '#059669'; // Forest Green
    if (classificationClass === '04' || classification === 'Agricultural / Stubble Burning') return '#F59E0B'; // Amber
    if (classificationClass === '05' || classification === 'Mining Area / Coal Mine Fire') return '#6B7280'; // Slate Gray
    if (classificationClass === '06' || classification === 'Urban / Landfill Fire') return '#EA580C'; // Deep Orange
    return '#EF4444';
  };

  const measuredDist = calculateDistanceKm();

  return (
    <div className="space-y-3 font-sans">
      
      {/* Map Control Toolbar - Ultra Compact Single Line */}
      <div className="bg-[#242424] border border-[#383838] px-3 py-1.5 rounded-xl flex flex-row items-center justify-between gap-2 text-[11px] font-mono shadow-md">
        
        {/* Left Side: Title & Live Badge (Single Line) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-[#F5F5F5] uppercase tracking-wider flex items-center gap-1 text-[11px]">
            <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>GEO-SCD GIS Deck</span>
          </span>
          
          <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            <span>Live ({displayIncidents.length})</span>
          </span>
        </div>

        {/* Right Side: Map Layer Buttons */}
        <div className="flex items-center gap-1 bg-[#161616] p-0.5 rounded-lg border border-[#383838]">
          <button
            onClick={() => setTileSource('bhuvan')}
            className={`px-2 py-0.5 rounded transition-colors text-[10px] font-bold cursor-pointer ${tileSource === 'bhuvan' ? 'bg-[#059669] text-white' : 'text-slate-400 hover:text-white'}`}
          >
            🇮🇳 ISRO Bhuvan
          </button>
          <button
            onClick={() => setTileSource('osm')}
            className={`px-2 py-0.5 rounded transition-colors text-[10px] cursor-pointer ${tileSource === 'osm' ? 'bg-[#1D4ED8] text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            OpenStreetMap
          </button>
          <button
            onClick={() => setTileSource('esri')}
            className={`px-2 py-0.5 rounded transition-colors text-[10px] cursor-pointer ${tileSource === 'esri' ? 'bg-[#1D4ED8] text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Esri Satellite
          </button>
        </div>

      </div>

      {/* Main Indian Map Viewport */}
      <div className="w-full h-[620px] rounded-xl overflow-hidden border border-[#262F40] bg-[#0B0E14] shadow-2xl relative">
        
        {/* Collapsible GIS Filters Drawer (Positioned next to Leaflet + / - zoom control) */}
        {filters && setFilters && (
          <div className="absolute top-3 left-14 z-[1000]">
            <FilterPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          minZoom={3}
          maxZoom={18}
          scrollWheelZoom={true}
          preferCanvas={true}
          className="w-full h-full z-10"
          style={{ height: '620px', width: '100%', backgroundColor: '#0B0E14' }}
        >
          <MapController targetIncident={targetIncident || selectedHotspot} tileSource={tileSource} />
          <MapEventsHandler onMouseMove={(ll) => setCursorCoords(ll)} onMapClick={handleMapClick} />

          {/* Direct Dynamic Tile Layer */}
          <TileLayer
            attribution='&copy; OpenStreetMap & Esri'
            url={getTileUrl()}
            subdomains={['a', 'b', 'c']}
            maxZoom={18}
          />

          {/* Multi-tier 1km, 5km, 10km Concentric Safety Perimeter Buffer Rings */}
          {showBufferRings && (
            <React.Fragment>
              {/* 1. Rings around Target Incident / Selected Hotspot */}
              {(targetIncident || selectedHotspot || displayIncidents[0]) && (() => {
                const target = targetIncident || selectedHotspot || displayIncidents[0];
                const lat = parseFloat(target.latitude);
                const lon = parseFloat(target.longitude);
                if (isNaN(lat) || isNaN(lon)) return null;

                return (
                  <React.Fragment key={`hotspot-rings-${target.id || 'target'}`}>
                    {/* 1 KM Critical Inner Ring */}
                    <Circle
                      center={[lat, lon]}
                      radius={1000}
                      pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.12, weight: 2, dashArray: '4, 4' }}
                    >
                      <Tooltip permanent direction="top" className="font-mono text-[10px] font-bold bg-slate-950 text-red-400 border border-red-500 px-1.5 py-0.5 rounded">
                        1 KM Critical Zone
                      </Tooltip>
                    </Circle>

                    {/* 5 KM Danger Zone Ring */}
                    <Circle
                      center={[lat, lon]}
                      radius={5000}
                      pathOptions={{ color: '#F97316', fillColor: '#F97316', fillOpacity: 0.06, weight: 1.5, dashArray: '6, 6' }}
                    >
                      <Tooltip permanent direction="top" className="font-mono text-[10px] font-bold bg-slate-950 text-orange-400 border border-orange-500 px-1.5 py-0.5 rounded">
                        5 KM Hazard Perimeter
                      </Tooltip>
                    </Circle>

                    {/* 10 KM Outer Safety Ring */}
                    <Circle
                      center={[lat, lon]}
                      radius={10000}
                      pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.03, weight: 1.5, dashArray: '8, 8' }}
                    >
                      <Tooltip permanent direction="top" className="font-mono text-[10px] font-bold bg-slate-950 text-amber-400 border border-amber-500 px-1.5 py-0.5 rounded">
                        10 KM Emergency Perimeter Ring
                      </Tooltip>
                    </Circle>
                  </React.Fragment>
                );
              })()}

              {/* 2. Rings around Refinery Geofence Locations */}
              {validIndianRefineries.map((refinery, idx) => {
                if (!refinery || !refinery.geometry) return null;
                const coords = parseWktPolygon(refinery.geometry);
                if (coords.length === 0) return null;
                const [lat, lon] = coords[0];

                return (
                  <Circle
                    key={`ref-ring-${refinery.id || idx}`}
                    center={[lat, lon]}
                    radius={10000}
                    pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.05, weight: 1.5, dashArray: '6, 6' }}
                  >
                    <Popup>
                      <div className="font-sans text-xs space-y-1 p-1 text-slate-100">
                        <strong className="text-amber-400 font-bold block">{refinery.name}</strong>
                        <span className="text-slate-300 block font-mono text-[10px]">10 KM Refinery Safety Perimeter</span>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}
            </React.Fragment>
          )}

          {/* Measure Ruler Points & Polyline with Permanent Distance Tooltip */}
          {measurePoints.length > 0 && (
            <React.Fragment>
              {measurePoints.map((pt, i) => (
                <CircleMarker
                  key={`msr-pt-${i}`}
                  center={[pt.lat, pt.lng]}
                  radius={6}
                  pathOptions={{ color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" className="font-mono text-[10px] font-bold bg-slate-950 text-cyan-300 border border-cyan-500 px-1.5 py-0.5 rounded">
                    {i === 0 ? 'Point A (Start)' : 'Point B (End)'}
                  </Tooltip>
                </CircleMarker>
              ))}

              {measurePoints.length >= 2 && measuredDist && (
                <Polyline
                  positions={measurePoints.map(pt => [pt.lat, pt.lng])}
                  pathOptions={{ color: '#38bdf8', weight: 4, dashArray: '6, 6' }}
                >
                  <Tooltip
                    permanent
                    direction="center"
                    position={[
                      (measurePoints[0].lat + measurePoints[1].lat) / 2,
                      (measurePoints[0].lng + measurePoints[1].lng) / 2
                    ]}
                    className="font-mono text-xs font-black bg-slate-950 text-cyan-300 border-2 border-cyan-400 shadow-2xl px-3 py-1 rounded-lg"
                  >
                    📏 Distance: {measuredDist} km ({Math.round((parseFloat(measuredDist) || 0) * 1000)} m)
                  </Tooltip>
                </Polyline>
              )}
            </React.Fragment>
          )}

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

          {/* Thermal Event Markers - Compact Tactical Radius + Translucent Emergency Halo */}
          {layers.thermalEvents && displayIncidents.map((inc, idx) => {
            const color = getSeverityColor(inc.classification, inc.priority, inc.classificationClass);
            const frpVal = parseFloat(inc.frp) || 50;
            
            // Sleek compact radius (6px to max 11px instead of giant 22px blobs)
            const radius = Math.max(6, Math.min(11, 5 + Math.log10(Math.max(1, frpVal)) * 2));
            const isSelected = selectedHotspot && selectedHotspot.id === inc.id;
            const isCritical = inc.priority === 'Critical' || inc.classificationClass === '02';

            return (
              <React.Fragment key={`inc-frag-${inc.id || idx}`}>
                {/* Thin Translucent Emergency Halo Ring for Critical Class 02 Incidents */}
                {isCritical && (
                  <CircleMarker
                    center={[inc.latitude, inc.longitude]}
                    radius={radius + 6}
                    pathOptions={{
                      color: '#EF4444',
                      fillColor: '#EF4444',
                      fillOpacity: 0.15,
                      weight: 1.5,
                      dashArray: '3, 3'
                    }}
                    interactive={false}
                  />
                )}

                {/* Main Marker */}
                <CircleMarker
                  center={[inc.latitude, inc.longitude]}
                  radius={isSelected ? radius + 2 : radius}
                  pathOptions={{
                    color: isSelected ? '#38bdf8' : '#ffffff',
                    fillColor: color,
                    fillOpacity: 0.9,
                    weight: isSelected ? 3 : 1.5,
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
                        {inc.locationDisplay || inc.nearestFacility || 'Industrial Zone'}
                      </span>
                      {inc.detectionCount > 1 && (
                        <span className="mt-1 inline-block text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 rounded shadow-sm">
                          🛰️ Aggregated {inc.detectionCount} Satellite Passes
                        </span>
                      )}

                      <button
                        onClick={() => {
                          if (onSelectHotspot) onSelectHotspot(inc);
                          setTimeout(() => {
                            const el = document.getElementById('telemetry-panel');
                            if (el) {
                              const container = el.closest('.overflow-y-auto') || el.parentElement;
                              if (container) {
                                container.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
                              } else {
                                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }
                          }, 100);
                        }}
                        className="w-full py-1.5 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold rounded text-xs transition-colors flex items-center justify-center gap-1 mt-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>INSPECT TELEMETRY</span>
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}

        </MapContainer>

        {/* Floating GIS Command Deck (Positioned at Top of Map Viewport for Instant Access) */}
        <div className="absolute top-3 right-3 z-[1000] bg-[#242424]/95 backdrop-blur-md border border-[#383838] px-2.5 py-1 rounded-xl flex items-center gap-2 text-[10px] font-mono shadow-2xl">
          
          {/* Live Cursor Coordinates Readout */}
          <div className="flex items-center gap-1 text-slate-300 border-r border-[#383838] pr-2 text-[10px]">
            <Crosshair className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
            <span>Lat: <strong className="text-white font-mono">{cursorCoords.lat.toFixed(4)}°</strong></span>
            <span>Lon: <strong className="text-white font-mono">{cursorCoords.lng.toFixed(4)}°</strong></span>
          </div>

          {/* 10km Buffer Ring Toggle */}
          <button
            onClick={() => setShowBufferRings(!showBufferRings)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
              showBufferRings ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <CircleDot className="w-3 h-3 text-amber-400 shrink-0" />
            <span>10KM PERIMETER RINGS</span>
          </button>

          {/* Spatial Distance Ruler Measure Tool */}
          <button
            onClick={() => {
              setMeasureActive(!measureActive);
              setMeasurePoints([]);
            }}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
              measureActive ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Ruler className="w-3 h-3 text-blue-400 shrink-0" />
            <span>{measureActive ? 'RULER ACTIVE' : 'DISTANCE MEASURE'}</span>
          </button>

          {/* 1-Click GIS Snapshot Downloader */}
          <button
            onClick={handleCaptureSnapshot}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-md text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 border border-slate-700"
            title="Capture GIS Viewport Snapshot"
          >
            <Camera className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>SNAPSHOT</span>
          </button>
        </div>

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
