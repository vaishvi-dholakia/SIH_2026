import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Flame, Factory, Crosshair, MapPin, Search, Sliders, Navigation, Satellite, Radio } from 'lucide-react';
import { formatCoords, getClassificationTheme } from '../utils/helpers';

function parseWktPolygon(wkt) {
  if (!wkt || typeof wkt !== 'string' || !wkt.startsWith('POLYGON')) return [];
  try {
    const rawCoords = wkt.replace('POLYGON((', '').replace('))', '').split(',');
    return rawCoords.map((pair) => {
      const parts = pair.trim().split(/\s+/);
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lat, lon];
    });
  } catch (e) {
    console.error('Error parsing WKT Polygon:', e);
    return [];
  }
}

function createCustomFireIcon(classification, priorityScore) {
  const theme = getClassificationTheme(classification);
  const color = theme.marker;
  const isCritical = classification === 'Potential Industrial Incident';

  const html = `
    <div class="relative flex items-center justify-center">
      ${isCritical ? '<div class="absolute -inset-2 rounded-none border border-[#ff1744] bg-[#ff1744]/20 animate-pulse-slow"></div>' : ''}
      <div class="w-6 h-6 flex items-center justify-center border border-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" style="background-color: ${color}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-fire-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function createSatelliteIcon(name, color = '#00e5ff') {
  const html = `
    <div class="relative flex items-center justify-center">
      <div class="absolute -inset-2 rounded-none border border-[#00e5ff]/50 animate-pulse"></div>
      <div class="w-8 h-8 bg-[#121110] border border-[#00e5ff] flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.4)] text-[#00e5ff]">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-sat-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createReticleIcon() {
  const html = `
    <div class="relative flex items-center justify-center w-8 h-8">
      <div class="absolute inset-0 border border-dashed border-[#00e5ff] animate-spin" style="animation-duration: 8s"></div>
      <div class="w-1.5 h-1.5 bg-[#00e5ff]"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-reticle-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// Controller to smoothly pan map when centerTarget changes
function MapFlyToController({ centerTarget, zoomLevel = 10 }) {
  const map = useMap();
  useEffect(() => {
    if (centerTarget && Array.isArray(centerTarget) && centerTarget.length === 2) {
      map.flyTo(centerTarget, zoomLevel, { duration: 1.5 });
    }
  }, [centerTarget, zoomLevel, map]);
  return null;
}

// Map Event listener for user clicking anywhere on map to probe coordinates
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export default function SatelliteMapView({ 
  hotspots = [], 
  refineries = [], 
  selectedHotspot, 
  onSelectHotspot,
  onSimulateAtLocation
}) {
  const defaultCenter = [22.35, 69.85];
  const [flyTarget, setFlyTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minFrpFilter, setMinFrpFilter] = useState(0);
  const [probeLocation, setProbeLocation] = useState(null);

  // Animated Satellite Positions over India / South Asia
  const [satPositions, setSatPositions] = useState([
    { id: 'VIIRS-NPP', name: 'Suomi-NPP (VIIRS)', lat: 24.5, lng: 72.8, angle: 0 },
    { id: 'SENTINEL-2', name: 'Sentinel-2A (MSI)', lat: 18.2, lng: 78.5, angle: 120 },
    { id: 'NOAA-20', name: 'NOAA-20 (VIIRS)', lat: 28.1, lng: 75.3, angle: 240 }
  ]);

  // Satellite orbit animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setSatPositions(prev => prev.map(sat => {
        const newAngle = (sat.angle + 0.5) % 360;
        const rad = (newAngle * Math.PI) / 180;
        const dLat = Math.sin(rad) * 0.08;
        const dLng = Math.cos(rad) * 0.12;
        return {
          ...sat,
          lat: sat.lat + dLat,
          lng: sat.lng + dLng,
          angle: newAngle
        };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredHotspots = hotspots.filter(h => (h.frp || 0) >= minFrpFilter);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const queryLower = searchQuery.toLowerCase();
    // Search in refineries
    const matchedRefinery = refineries.find(r => r.name?.toLowerCase().includes(queryLower));
    if (matchedRefinery) {
      const positions = parseWktPolygon(matchedRefinery.geometry);
      if (positions.length > 0) {
        setFlyTarget(positions[0]);
        return;
      }
    }

    // Search lat, lng pattern (e.g. 22.47, 70.06)
    const coordParts = searchQuery.split(',').map(p => parseFloat(p.trim()));
    if (coordParts.length === 2 && !isNaN(coordParts[0]) && !isNaN(coordParts[1])) {
      setFlyTarget([coordParts[0], coordParts[1]]);
      setProbeLocation([coordParts[0], coordParts[1]]);
    }
  };

  return (
    <div className="relative w-full h-[600px] lg:h-[720px] rounded-sm overflow-hidden border border-command-border bg-command-900 shadow-2xl flex flex-col">
      
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* Radar Status Badge */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-command-950/90 backdrop-blur-md border border-command-border rounded-sm text-[10px] font-mono text-tactical-gray shadow-xl uppercase tracking-wider">
          <Crosshair className="w-4 h-4 text-tactical-cyan animate-spin" style={{ animationDuration: '12s' }} />
          <span className="font-bold text-white hidden sm:inline">ORBITAL SURVEILLANCE RADAR</span>
          <span className="text-command-border hidden sm:inline">|</span>
          <span className="text-tactical-amber font-bold">{filteredHotspots.length} Active Hotspots</span>
        </div>

        {/* Search Bar & FRP Slider */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search target or coords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 px-3 py-1.5 pl-8 bg-command-950/90 border border-command-border rounded-sm text-[10px] text-white placeholder-tactical-gray focus:outline-none focus:border-tactical-cyan shadow-xl font-mono uppercase tracking-wider"
            />
            <Search className="w-3.5 h-3.5 text-tactical-gray absolute left-2.5 top-1.5" />
          </form>

          {/* FRP Slider */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-command-950/90 border border-command-border rounded-sm text-[10px] uppercase tracking-wider font-mono text-tactical-gray shadow-xl">
            <Sliders className="w-3.5 h-3.5 text-tactical-cyan" />
            <span>Min FRP: <strong className="text-tactical-amber">{minFrpFilter} MW</strong></span>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={minFrpFilter}
              onChange={(e) => setMinFrpFilter(Number(e.target.value))}
              className="w-20 cursor-pointer"
              style={{ accentColor: '#00e5ff' }}
            />
          </div>
        </div>
      </div>

      {/* Map Click Probe Info Box */}
      {probeLocation && (
        <div className="absolute bottom-4 left-4 z-[1000] p-3 bg-command-950/95 backdrop-blur-md border border-tactical-cyan rounded-sm text-[10px] uppercase tracking-wider font-mono text-tactical-gray shadow-[0_0_15px_rgba(0,229,255,0.2)] max-w-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-command-border">
            <span className="text-tactical-cyan font-bold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Target Probe Reticle</span>
            </span>
            <button onClick={() => setProbeLocation(null)} className="text-tactical-gray hover:text-white">✕</button>
          </div>
          <p className="text-tactical-gray">Coords: <span className="text-white font-bold">{formatCoords(probeLocation[0], probeLocation[1])}</span></p>
          <p className="text-tactical-gray mt-1">Status: <span className="text-tactical-green">Clear Space Telemetry Vector</span></p>
          
          <button
            onClick={() => {
              if (onSimulateAtLocation) {
                onSimulateAtLocation('INDUSTRIAL_INCIDENT', probeLocation[0], probeLocation[1]);
              }
              setProbeLocation(null);
            }}
            className="w-full mt-3 py-1.5 bg-tactical-red/20 border border-tactical-red/50 hover:bg-tactical-red/40 text-tactical-red font-bold rounded-sm flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Simulate Incident At Reticle</span>
          </button>
        </div>
      )}

      {/* Main Leaflet Map */}
      <MapContainer
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom={true}
        className="w-full h-full z-10"
      >
        <MapFlyToController centerTarget={flyTarget} zoomLevel={11} />
        <MapClickHandler onMapClick={(coords) => setProbeLocation(coords)} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="ESRI Satellite High-Res">
            <TileLayer
              attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="CartoDB Space Radar Dark">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Target Probe Reticle Marker */}
        {probeLocation && (
          <Marker position={probeLocation} icon={createReticleIcon()} />
        )}

        {/* Dynamic Moving Satellites */}
        {satPositions.map((sat) => (
          <Marker
            key={sat.id}
            position={[sat.lat, sat.lng]}
            icon={createSatelliteIcon(sat.name)}
          >
            <Popup>
              <div className="p-1 font-mono text-[10px] uppercase tracking-wider text-tactical-gray">
                <div className="flex items-center gap-1.5 text-tactical-cyan font-bold mb-2 pb-1 border-b border-command-border">
                  <Satellite className="w-3.5 h-3.5" />
                  <span>{sat.name}</span>
                </div>
                <p>Altitude: <span className="text-white font-bold">824 km LEO Orbit</span></p>
                <p className="mt-1">Telemetry: <span className="text-tactical-green font-bold">100% ONLINE</span></p>
                <p className="mt-1 text-[9px]">Position: {formatCoords(sat.lat, sat.lng)}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Refineries & Geofence Safety Buffers */}
        {refineries.map((refinery) => {
          const positions = parseWktPolygon(refinery.geometry);
          if (positions.length === 0) return null;

          const centerLatLon = positions[0];

          return (
            <React.Fragment key={`refinery-${refinery.id}`}>
              <Polygon
                positions={positions}
                pathOptions={{
                  color: '#ffb300',
                  fillColor: '#ffb300',
                  fillOpacity: 0.1,
                  weight: 1,
                  dashArray: '2, 2'
                }}
              >
                <Popup>
                  <div className="p-1 font-mono text-[10px] uppercase tracking-wider text-tactical-gray">
                    <div className="flex items-center gap-1.5 text-tactical-gold font-bold mb-2 pb-1 border-b border-command-border">
                      <Factory className="w-3.5 h-3.5" />
                      <span>{refinery.name}</span>
                    </div>
                    <p>Operator: <span className="text-white font-bold">{refinery.operator || 'National Facility'}</span></p>
                    <p className="mt-1">Safety Buffer: {refinery.safety_buffer_km || 1.0} km</p>
                    <p className="mt-1">Risk Profile: <span className="text-tactical-amber font-bold">{refinery.risk_level || 'Critical Infrastructure'}</span></p>
                    <button
                      onClick={() => setFlyTarget(centerLatLon)}
                      className="mt-3 w-full py-1.5 bg-tactical-cyan/10 border border-tactical-cyan/30 text-tactical-cyan hover:bg-tactical-cyan/20 rounded-sm font-bold transition-colors"
                    >
                      Focus Satellite View
                    </button>
                  </div>
                </Popup>
              </Polygon>

              <Circle
                center={centerLatLon}
                radius={(refinery.safety_buffer_km || 1.0) * 1000}
                pathOptions={{
                  color: '#ff9100',
                  fillColor: 'transparent',
                  fillOpacity: 0,
                  weight: 1,
                  dashArray: '4, 4'
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Fire Hotspots */}
        {filteredHotspots.map((hotspot) => {
          const classification = hotspot.classification || 'Non-Industrial Fire';
          const icon = createCustomFireIcon(classification, hotspot.priority_score);

          return (
            <Marker
              key={`hotspot-${hotspot.id}`}
              position={[hotspot.latitude, hotspot.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectHotspot(hotspot),
              }}
            >
              <Popup>
                <div className="p-1 font-mono text-[10px] uppercase tracking-wider max-w-xs">
                  <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-command-border">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-tactical-red" />
                      <span>Target #{hotspot.id}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-command-800 text-tactical-cyan border border-command-border">
                      Score: {hotspot.priority_score || 0}/100
                    </span>
                  </div>

                  <p className="text-tactical-gray mb-1.5">
                    Class: <span className="text-white font-bold">{classification}</span>
                  </p>
                  <p className="text-tactical-gray mb-1.5">
                    Energy: <span className="text-tactical-amber font-bold">{hotspot.frp || 0.0} MW</span>
                  </p>
                  <p className="text-tactical-gray mb-1.5">
                    Bright Temp: <span className="text-tactical-cyan font-bold">{hotspot.brightness || 0.0} K</span>
                  </p>
                  <p className="text-tactical-gray text-[9px] mb-3 border-t border-command-border pt-1.5">
                    Coords: {formatCoords(hotspot.latitude, hotspot.longitude)}
                  </p>

                  <button
                    onClick={() => onSelectHotspot(hotspot)}
                    className="w-full py-1.5 bg-tactical-cyan/10 hover:bg-tactical-cyan/20 border border-tactical-cyan/50 text-tactical-cyan font-bold rounded-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Inspect Telemetry Drawer</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}