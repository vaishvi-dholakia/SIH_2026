import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Volume2, VolumeX, ShieldAlert, Radio, Activity, Compass, 
  Clock, MapPin, Layers, Flame, FileText, Bell
} from 'lucide-react';
import SidebarNav from './components/SidebarNav';
import DashboardView from './components/DashboardView';
import AlertsView from './components/AlertsView';
import IncidentDetailsModal from './components/IncidentDetailsModal';
import MapView from './components/MapView';
import FilterPanel from './components/FilterPanel';
import AlertFeed from './components/AlertFeed';
import TelemetryPanel from './components/TelemetryPanel';
import ForensicPdfModal from './components/ForensicPdfModal';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import SpaceAlertToast from './components/SpaceAlertToast';
import { 
  fetchDashboardSummary, 
  fetchIncidents, 
  fetchRefineries 
} from './api/client';
import { spaceWS } from './services/websocket';
import { isPointInIndia } from './utils/indiaBoundary';

export default function App() {
  const [activePage, setActivePage] = useState('map'); // Default to GIS Map Command Deck
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [refineries, setRefineries] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [targetMapIncident, setTargetMapIncident] = useState(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [pdfHotspot, setPdfHotspot] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Panel collapse states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [alertFeedCollapsed, setAlertFeedCollapsed] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    minFrp: 0,
    minScore: 0,
    hideSuppressed: false,
    categories: [
      'Potential Industrial Incident',
      'Potential Industrial Thermal Source',
      'Forest Fire / Wildfire',
      'Agricultural / Stubble Burning',
      'Mining Area / Coal Mine Fire',
      'Urban / Landfill Fire'
    ]
  });

  // Live Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [sumData, incList, refList] = await Promise.all([
        fetchDashboardSummary(),
        fetchIncidents(),
        fetchRefineries()
      ]);

      setSummary(sumData || null);
      const loadedIncidents = incList || [];
      setIncidents(loadedIncidents);
      setRefineries(refList || []);

      // Auto-select first incident for Telemetry Panel if none selected yet
      if (!selectedHotspot && loadedIncidents.length > 0) {
        setSelectedHotspot(loadedIncidents[0]);
      }
    } catch (err) {
      console.error('Error loading FLAREFILTER telemetry:', err);
    }
  }, [selectedHotspot]);

  useEffect(() => {
    loadData();

    spaceWS.connect();

    const unsubscribeStatus = spaceWS.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubscribeMessages = spaceWS.subscribe((message) => {
      if (message.event === 'CRITICAL_DISASTER_ALARM' || message.classification === 'Potential Industrial Incident') {
        setActiveAlert(message);
        if (audioEnabled) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      }
      loadData();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
    };
  }, [loadData, audioEnabled]);

  // Filtered Incidents based on FilterPanel settings & Strict Indian Sovereign Territory Boundary
  const filteredIncidents = useMemo(() => {
    return (incidents || []).filter(inc => {
      if (!inc) return false;
      if (!isPointInIndia(inc.latitude, inc.longitude)) return false;
      const frp = inc.frp || 0;
      const score = inc.hazardScore || 50;
      if (frp < filters.minFrp) return false;
      if (score < filters.minScore) return false;
      if (filters.hideSuppressed && inc.isSuppressed) return false;
      if (filters.categories.length > 0 && inc.classification && !filters.categories.includes(inc.classification)) return false;
      return true;
    });
  }, [incidents, filters]);

  const criticalCount = incidents.filter(i => i.priority === 'Critical').length;

  const resetFilters = () => {
    setFilters({
      minFrp: 0,
      minScore: 0,
      hideSuppressed: false,
      categories: [
        'Potential Industrial Incident',
        'Potential Industrial Thermal Source',
        'Forest Fire / Wildfire',
        'Agricultural / Stubble Burning',
        'Mining Area / Coal Mine Fire',
        'Urban / Landfill Fire'
      ]
    });
  };

  const handleSelectHotspot = (hotspot) => {
    setSelectedHotspot(hotspot);
    setTargetMapIncident(hotspot);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col font-sans antialiased select-none selection:bg-red-500 selection:text-white">
      
      {/* Top Header Bar - National Tactical Operations Deck */}
      <header className="bg-[#151A26] border-b border-[#262F40] px-4 py-2.5 flex items-center justify-between shadow-lg z-30 shrink-0">
        
        {/* Left: Branding & Problem Statement */}
        <div className="flex items-center gap-3">
          <div className="bg-[#1D4ED8] p-2 rounded-lg text-white shadow-md">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white uppercase tracking-wider font-mono flex items-center gap-1">
                🔥 FLAREFILTER
              </h1>
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                INDIAN COMMAND DECK
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Satellite Fire & Thermal Intelligence
            </p>
          </div>
        </div>

        {/* Right: Telemetry Controls, Audio Mute & Clock */}
        <div className="flex items-center gap-4 text-xs font-mono">
          
          {/* UTC Clock */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#0B0E14] border border-[#262F40] px-3 py-1.5 rounded-lg text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentTime.toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
          </div>

          {/* Audio Speaker Mute Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              audioEnabled 
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={audioEnabled ? "Mute Incident Alarm Audio" : "Enable Incident Alarm Audio"}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio Alert ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Audio Muted</span>
              </>
            )}
          </button>

          {/* WebSocket Status Indicator */}
          <div className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#262F40] px-3 py-1.5 rounded-lg">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
            }`} />
            <span className={connectionStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {connectionStatus === 'connected' ? 'WS STREAM ACTIVE' : 'POLLING MODE'}
            </span>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Navigation */}
        <SidebarNav
          activePage={activePage}
          setActivePage={(page) => {
            setActivePage(page);
            if (page !== 'map') setTargetMapIncident(null);
          }}
          criticalCount={criticalCount}
          connectionStatus={connectionStatus}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Dynamic Page Views */}
        {activePage === 'map' ? (
          /* Main 3-Column Interactive GIS Command Deck Layout */
          <main className="flex-1 flex min-w-0 overflow-hidden">
            
            {/* Collapsible Left Filter Panel */}
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              collapsed={filterCollapsed}
              onToggleCollapse={() => setFilterCollapsed(!filterCollapsed)}
              onReset={resetFilters}
            />

            {/* Center Viewport: GIS Map + Telemetry Panel */}
            <div className="flex-1 flex flex-col min-w-0 p-4 space-y-4 overflow-y-auto bg-[#0B0E14]">
              
              {/* GIS Satellite Map */}
              <MapView
                incidents={filteredIncidents}
                refineries={refineries}
                selectedHotspot={selectedHotspot || filteredIncidents[0]}
                targetIncident={targetMapIncident}
                onSelectHotspot={handleSelectHotspot}
                backendOffline={connectionStatus === 'disconnected'}
              />

              {/* Bottom Incident Telemetry Panel */}
              <TelemetryPanel
                selectedHotspot={selectedHotspot || filteredIncidents[0]}
                onOpenExportPdf={(hotspot) => setPdfHotspot(hotspot)}
              />
            </div>

            {/* Collapsible Right Alert Feed */}
            <AlertFeed
              incidents={filteredIncidents}
              selectedHotspot={selectedHotspot || filteredIncidents[0]}
              onSelectHotspot={handleSelectHotspot}
              collapsed={alertFeedCollapsed}
              onToggleCollapse={() => setAlertFeedCollapsed(!alertFeedCollapsed)}
            />

          </main>
        ) : (
          /* Alternative Full Page Views */
          <main className="flex-1 min-w-0 p-6 md:p-8 overflow-y-auto bg-[#0B0E14]">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {activePage === 'dashboard' && (
                <DashboardView
                  summary={summary}
                  incidents={incidents}
                  onSelectIncident={(inc) => setSelectedIncident(inc)}
                />
              )}

              {activePage === 'alerts' && (
                <AlertsView
                  incidents={incidents}
                  onSelectIncident={(inc) => setSelectedIncident(inc)}
                />
              )}

              {activePage === 'history' && (
                <HistoryView
                  incidents={incidents}
                />
              )}

              {activePage === 'settings' && (
                <SettingsView />
              )}

            </div>
          </main>
        )}

      </div>

      {/* Incident Details Decision Modal */}
      {selectedIncident && (
        <IncidentDetailsModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onViewOnMap={(inc) => {
            setTargetMapIncident(inc);
            setSelectedHotspot(inc);
            setSelectedIncident(null);
            setActivePage('map');
          }}
          onViewHistory={() => {
            setSelectedIncident(null);
            setActivePage('history');
          }}
        />
      )}

      {/* Forensic PDF Report Modal */}
      {pdfHotspot && (
        <ForensicPdfModal
          hotspot={pdfHotspot}
          onClose={() => setPdfHotspot(null)}
        />
      )}

      {/* Real-time Space Alert Toast Notification */}
      <SpaceAlertToast
        alert={activeAlert}
        onClose={() => setActiveAlert(null)}
        onInspect={(alert) => {
          setSelectedHotspot(alert);
          setTargetMapIncident(alert);
          setActiveAlert(null);
          setActivePage('map');
        }}
      />

    </div>
  );
}