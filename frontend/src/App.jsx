import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, Radio, Activity, Compass, 
  Clock, MapPin, Layers, Flame, FileText, Bell, LogOut, UserCheck, Shield
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
import LoginView from './components/LoginView';
import { 
  fetchDashboardSummary, 
  fetchIncidents, 
  fetchRefineries,
  fetchIndiaBoundary
} from './api/client';
import { spaceWS } from './services/websocket';
import { isPointInIndia, setIndiaBoundaryData } from './utils/indiaBoundary';

export default function App() {
  // Always require Admin Login on initial launch / page load
  const [currentUser, setCurrentUser] = useState(null);

  const [activePage, setActivePage] = useState('dashboard'); // Default to Executive Dashboard Landing Page
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

  // Panel collapse states (Default collapsed on start for maximum GIS map viewport width)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [alertFeedCollapsed, setAlertFeedCollapsed] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    minFrp: 0,
    minScore: 0,
    dateRange: '30d',
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

  // Fetch India boundary GeoJSON once on load
  useEffect(() => {
    fetchIndiaBoundary().then(data => {
      if (data) setIndiaBoundaryData(data);
    });
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
          playAlarmSound();
        }
      }
      loadData();
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
    };
  }, [loadData, audioEnabled]);

  // Memoized Filtered Incidents (Real India coordinates filtering + date scrubber)
  const filteredIncidents = useMemo(() => {
    if (!Array.isArray(incidents)) return [];
    return incidents.filter((inc) => {
      if (!inc) return false;
      if (!isPointInIndia(inc.latitude, inc.longitude)) return false;
      const frp = inc.frp || 0;
      const score = inc.hazardScore || 50;
      if (frp < filters.minFrp) return false;
      if (score < filters.minScore) return false;
      if (filters.hideSuppressed && inc.isSuppressed) return false;
      if (filters.categories.length > 0 && inc.classification && !filters.categories.includes(inc.classification)) return false;

      // Real acquisition timestamp filtering by date range
      if (filters.dateRange && filters.dateRange !== 'all') {
        const dateStr = inc.detectedAt || inc.acqDateTime || inc.acquisitionTime || inc.timestamp || inc.acq_date;
        if (dateStr) {
          const incDate = new Date(dateStr);
          if (!isNaN(incDate.getTime())) {
            const diffHours = (new Date() - incDate) / (1000 * 60 * 60);
            if (filters.dateRange === '24h' && diffHours > 24) return false;
            if (filters.dateRange === '7d' && diffHours > 24 * 7) return false;
            if (filters.dateRange === '15d' && diffHours > 24 * 15) return false;
            if (filters.dateRange === '30d' && diffHours > 24 * 30) return false;
          }
        }
      }

      return true;
    });
  }, [incidents, filters]);

  const criticalCount = incidents.filter(i => i.priority === 'Critical').length;

  const resetFilters = () => {
    setFilters({
      minFrp: 0,
      minScore: 0,
      dateRange: '30d',
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

  const handleLoginSuccess = (user) => {
    try {
      localStorage.setItem('geoscd_user', JSON.stringify(user));
    } catch (e) {}
    setCurrentUser(user);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('geoscd_user');
    } catch (e) {}
    setCurrentUser(null);
  };

  // Mandatory Admin Authentication Screen Requirement
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#161616] text-[#F5F5F5] flex flex-col font-sans antialiased select-none selection:bg-blue-600 selection:text-white">
      
      {/* Top Header Bar - Geospatial Early Warning System Header */}
      <header className="bg-[#242424] border-b border-[#383838] px-6 py-3 flex items-center justify-between shadow-xl z-30 shrink-0 relative overflow-hidden">
        
        {/* Decorative Top-Right Satellite Earth Background Graphic Overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-25 pointer-events-none overflow-hidden hidden sm:block">
          <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <radialGradient id="earthGlow" cx="70%" cy="100%" r="80%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#0284c7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#161616" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="satelliteBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Curved Earth Horizon */}
            <path d="M 150 100 Q 280 40 400 60 L 400 100 Z" fill="url(#earthGlow)" />

            {/* Light Beam Cone from Satellite */}
            <polygon points="200,10 380,90 280,100" fill="url(#satelliteBeam)" />

            {/* Orbit Lines */}
            <path d="M 120 10 Q 260 25 380 70" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.6" />

            {/* Satellite Icon Graphic in Orbit */}
            <g transform="translate(190, 5) scale(0.7)">
              <rect x="10" y="10" width="14" height="8" rx="2" fill="#38bdf8" />
              <line x1="0" y1="14" x2="10" y2="14" stroke="#7dd3fc" strokeWidth="2" />
              <line x1="24" y1="14" x2="34" y2="14" stroke="#7dd3fc" strokeWidth="2" />
              <rect x="-6" y="9" width="6" height="10" fill="#0284c7" stroke="#7dd3fc" strokeWidth="0.5" />
              <rect x="34" y="9" width="6" height="10" fill="#0284c7" stroke="#7dd3fc" strokeWidth="0.5" />
            </g>
          </svg>
        </div>

        {/* Left: Official GEO-SCD Branding & Tagline */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-blue-600/20 border border-blue-500/40 p-2 rounded-xl text-blue-400 shadow-md">
            <Radio className="w-5 h-5 animate-pulse text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-black text-white uppercase tracking-wider font-mono">
                GEO-SCD
              </h1>
              <span className="hidden lg:inline-block text-xs font-mono font-bold text-cyan-400 pl-3 border-l border-[#383838]">
                Beyond Heat Dots: Precision Fire Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Geospatial Early Warning & Response System
            </p>
          </div>
        </div>

        {/* Right: Satellite Graphic Illustration + System Online Pill + Clock + Admin Profile */}
        <div className="flex items-center gap-3.5 text-xs font-sans relative z-10">

          {/* System Online Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full font-mono font-bold text-emerald-400 text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>System Online</span>
          </div>

          {/* Live Timestamp */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#161616] border border-[#383838] px-3.5 py-1.5 rounded-xl text-slate-300 font-mono text-xs shadow-inner">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} | {currentTime.toLocaleTimeString()}</span>
          </div>

          {/* Logged-in Admin User Profile & Lock Console */}
          <div className="flex items-center gap-2 bg-[#161616] border border-[#383838] px-3 py-1 rounded-xl shadow-inner">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline-block font-mono text-cyan-300">{currentUser?.username || 'admin'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Lock Terminal & Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
          /* Main Interactive GIS Command Deck Layout */
          <main className="flex-1 flex min-w-0 overflow-hidden">
            
            {/* Center Viewport: Top Horizontal Filter Bar + GIS Map + Telemetry Panel */}
            <div className="flex-1 flex flex-col min-w-0 p-4 space-y-3 overflow-y-auto bg-[#161616]">
              
              {/* GIS Satellite Map with Floating Collapsible Left Filters */}
              <MapView
                incidents={filteredIncidents}
                refineries={refineries}
                selectedHotspot={selectedHotspot || filteredIncidents[0]}
                targetIncident={targetMapIncident}
                onSelectHotspot={handleSelectHotspot}
                backendOffline={connectionStatus === 'disconnected'}
                filters={filters}
                setFilters={setFilters}
                resetFilters={resetFilters}
              />

              {/* Bottom Incident Telemetry Panel */}
              <div id="telemetry-panel">
                <TelemetryPanel
                  selectedHotspot={selectedHotspot || filteredIncidents[0]}
                  onOpenExportPdf={(hotspot) => setPdfHotspot(hotspot)}
                />
              </div>
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
          <main className="flex-1 min-w-0 p-6 md:p-8 overflow-y-auto bg-[#161616]">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {activePage === 'dashboard' && (
                <DashboardView
                  summary={summary}
                  incidents={incidents}
                  onSelectIncident={(inc) => setSelectedIncident(inc)}
                  onNavigateMap={() => setActivePage('map')}
                  onNavigateHistory={() => setActivePage('history')}
                  onOpenPdfDossier={(inc) => setPdfHotspot(inc || incidents[0])}
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
                <SettingsView onLogout={handleLogout} />
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
          onInspectTelemetry={(inc) => {
            setTargetMapIncident(inc);
            setSelectedHotspot(inc);
            setSelectedIncident(null);
            setActivePage('map');
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
            }, 150);
          }}
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