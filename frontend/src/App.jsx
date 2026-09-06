import React, { useState, useEffect, useCallback } from 'react';
import SpaceNavbar from './components/SpaceNavbar';
import OrbitalStats from './components/OrbitalStats';
import SatelliteMapView from './components/SatelliteMapView';
import LiveTelemetryConsole from './components/LiveTelemetryConsole';
import TelemetryDrawer from './components/TelemetryDrawer';
import ThermalAnalytics from './components/ThermalAnalytics';
import SpaceAlertToast from './components/SpaceAlertToast';
import { 
  fetchRealtimeHotspots, 
  fetchRefineries, 
  fetchAnalyticsSummary, 
  fetchAnalyticsTrends,
  simulateHotspot 
} from './api/client';
import { spaceWS } from './services/websocket';
import { ListFilter, Sparkles } from 'lucide-react';

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hotspots, setHotspots] = useState([]);
  const [refineries, setRefineries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [filterClass, setFilterClass] = useState('ALL');
  const [isLiveStream, setIsLiveStream] = useState(true);
  const [telemetryLogs, setTelemetryLogs] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hotspotsGeoJson, refineriesList, summaryData, trendsData] = await Promise.all([
        fetchRealtimeHotspots(),
        fetchRefineries(),
        fetchAnalyticsSummary(),
        fetchAnalyticsTrends()
      ]);

      const features = hotspotsGeoJson?.features || [];
      const parsedHotspots = features.map(f => ({
        id: f.id || f.properties?.id,
        latitude: f.geometry?.coordinates[1],
        longitude: f.geometry?.coordinates[0],
        brightness: f.properties?.brightness,
        frp: f.properties?.frp,
        confidence: f.properties?.confidence,
        classification: f.properties?.classification,
        priority_score: f.properties?.priority_score,
        is_suppressed: f.properties?.is_suppressed,
        status: f.properties?.status || 'new',
        nearest_refinery_name: f.properties?.nearest_refinery_name,
        distance_to_refinery_m: f.properties?.distance_to_refinery_m,
        distance_to_population_m: f.properties?.distance_to_population_m,
        detected_at: f.properties?.detected_at,
        xai_explanation: f.properties?.xai_explanation
      }));

      setHotspots(parsedHotspots);
      setRefineries(refineriesList || []);
      setSummary(summaryData || null);
      setTrends(trendsData || null);
    } catch (err) {
      console.error('Error fetching satellite telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addLog = (source, type, msg) => {
    setTelemetryLogs(prev => [
      ...prev,
      { id: Date.now(), time: new Date().toLocaleTimeString(), source, type, msg }
    ]);
  };

  const handleSimulate = async (type = 'INDUSTRIAL_INCIDENT', lat = null, lng = null) => {
    try {
      addLog('COMMAND_HUB', 'INFO', `Triggering dynamic satellite burst simulation (${type})...`);
      const newSpot = await simulateHotspot(type, lat, lng);
      addLog('SATELLITE_PASS', 'ALERT', `New Thermal Anomaly Ingested: ${newSpot.classification} (FRP: ${newSpot.frp} MW)`);
      loadData();
    } catch (err) {
      console.error('Simulation error:', err);
      addLog('COMMAND_HUB', 'ALERT', 'Failed to execute dynamic simulation.');
    }
  };

  useEffect(() => {
    loadData();

    spaceWS.connect();

    const unsubscribeStatus = spaceWS.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'connected') {
        addLog('WS_GATEWAY', 'OK', 'WebSocket telemetry stream connected to Space Engine.');
      } else {
        addLog('WS_GATEWAY', 'ALERT', 'WebSocket telemetry link disconnected.');
      }
    });

    const unsubscribeMessages = spaceWS.subscribe((message) => {
      if (message.event === 'CRITICAL_DISASTER_ALARM' || message.classification === 'Potential Industrial Incident') {
        setActiveAlert(message);
        addLog('ALARM_DECK', 'ALERT', message.message || 'CRITICAL INDUSTRIAL INCIDENT DETECTED!');
        if (audioEnabled) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      } else if (message.event === 'NEW_HOTSPOT_DETECTED') {
        addLog('VIIRS_FEED', 'OK', message.message || 'Thermal detection updated');
      } else if (message.event === 'STATUS_UPDATED') {
        addLog('INCIDENT_TRIAGE', 'INFO', message.message);
      }

      loadData();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
    };
  }, [loadData, audioEnabled]);

  // Periodic auto-sync when streaming is live
  useEffect(() => {
    if (!isLiveStream) return;
    const interval = setInterval(() => {
      loadData();
    }, 12000);
    return () => clearInterval(interval);
  }, [isLiveStream, loadData]);

  const filteredHotspots = hotspots.filter(h => {
    if (filterClass === 'ALL') return true;
    if (filterClass === 'INCIDENT') return h.classification === 'Potential Industrial Incident';
    if (filterClass === 'FLARE') return h.classification === 'Potential Industrial Thermal Source';
    if (filterClass === 'BIOMASS') return h.classification === 'Non-Industrial Fire';
    return true;
  });

  return (
    <div className="min-h-screen bg-grid-pattern flex flex-col font-sans text-slate-100">
      
      <SpaceNavbar
        connectionStatus={connectionStatus}
        onRefresh={loadData}
        audioEnabled={audioEnabled}
        setAudioEnabled={setAudioEnabled}
      />

      <main className="max-w-7xl mx-auto px-4 py-4 flex-1 w-full space-y-4">
        
        {/* Orbital KPI Summary */}
        <OrbitalStats summary={summary} totalRefineries={refineries.length} />

        {/* Dynamic Filter Deck */}
        <div className="glass-panel p-3 rounded-none flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <ListFilter className="w-4 h-4 text-tactical-cyan" />
            <span className="font-bold uppercase tracking-wider text-tactical-cyan">Satellite View Filter:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setFilterClass('ALL')}
              className={`px-3 py-1.5 rounded-sm border font-bold transition-all uppercase tracking-wider ${
                filterClass === 'ALL'
                  ? 'bg-tactical-cyan/10 text-tactical-cyan border-tactical-cyan shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-cyan/50'
              }`}
            >
              ALL SATELLITE DETECTIONS ({hotspots.length})
            </button>

            <button
              onClick={() => setFilterClass('INCIDENT')}
              className={`px-3 py-1.5 rounded-sm border font-bold transition-all uppercase tracking-wider ${
                filterClass === 'INCIDENT'
                  ? 'bg-tactical-red/10 text-tactical-red border-tactical-red shadow-[0_0_8px_rgba(255,23,68,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-red/50'
              }`}
            >
              DISASTERS
            </button>

            <button
              onClick={() => setFilterClass('FLARE')}
              className={`px-3 py-1.5 rounded-sm border font-bold transition-all uppercase tracking-wider ${
                filterClass === 'FLARE'
                  ? 'bg-tactical-green/10 text-tactical-green border-tactical-green shadow-[0_0_8px_rgba(0,230,118,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-green/50'
              }`}
            >
              SUPPRESSED FLARES
            </button>

            <button
              onClick={() => setFilterClass('BIOMASS')}
              className={`px-3 py-1.5 rounded-sm border font-bold transition-all uppercase tracking-wider ${
                filterClass === 'BIOMASS'
                  ? 'bg-tactical-amber/10 text-tactical-amber border-tactical-amber shadow-[0_0_8px_rgba(255,145,0,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-amber/50'
              }`}
            >
              BIOMASS / STUBBLE
            </button>
          </div>
        </div>

        {/* Dynamic Satellite Map */}
        <SatelliteMapView
          hotspots={filteredHotspots}
          refineries={refineries}
          selectedHotspot={selectedHotspot}
          onSelectHotspot={(hotspot) => setSelectedHotspot(hotspot)}
          onSimulateAtLocation={(type, lat, lng) => handleSimulate(type, lat, lng)}
        />

        {/* Real-time Telemetry Console Ticker */}
        <LiveTelemetryConsole
          logs={telemetryLogs}
          isLive={isLiveStream}
          setIsLive={setIsLiveStream}
          onTriggerSimulate={(type) => handleSimulate(type)}
        />

        {/* FRP Trends & incident Distribution Charts */}
        <ThermalAnalytics trends={trends} summary={summary} />

      </main>

      {/* Telemetry Drawer Inspection */}
      <TelemetryDrawer
        hotspot={selectedHotspot}
        onClose={() => setSelectedHotspot(null)}
        onStatusUpdated={(id, status) => {
          loadData();
        }}
      />

      {/* Real-time Disaster Alarm Toast */}
      <SpaceAlertToast
        alert={activeAlert}
        onClose={() => setActiveAlert(null)}
        onInspect={(alert) => {
          setSelectedHotspot(alert);
          setActiveAlert(null);
        }}
      />

      <footer className="border-t border-command-border py-4 px-4 text-center text-xs font-mono text-tactical-gray bg-command-950">
        GEO-SCD COMMAND CENTER • SATELLITE INTELLIGENCE & THERMAL MONITORING
      </footer>

    </div>
  );
}