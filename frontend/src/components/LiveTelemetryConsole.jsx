import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Radio, Play, Pause, Zap, ShieldAlert, Cpu } from 'lucide-react';

export default function LiveTelemetryConsole({ logs = [], isLive = true, setIsLive, onTriggerSimulate }) {
  const [consoleLogs, setConsoleLogs] = useState([]);
  const consoleEndRef = useRef(null);

  useEffect(() => {
    // Initial system boot log entries
    const initialLogs = [
      { id: 1, time: new Date().toLocaleTimeString(), source: 'ORBIT_HUB', type: 'INFO', msg: 'GEO-SCD Space Command Telemetry Deck Initialized.' },
      { id: 2, time: new Date().toLocaleTimeString(), source: 'VIIRS_C2', type: 'OK', msg: 'Suomi-NPP Thermal Sensor Active. Spatial Resolution: 375m.' },
      { id: 3, time: new Date().toLocaleTimeString(), source: 'SENTINEL_2', type: 'OK', msg: 'ESA Sentinel-2 MSI Bands 11/12 (SWIR) synchronized.' },
      { id: 4, time: new Date().toLocaleTimeString(), source: 'ISRO_OVERPASS', type: 'INFO', msg: 'OpenStreetMap Industrial Refinery Geofences loaded.' }
    ];
    setConsoleLogs(initialLogs);
  }, []);

  useEffect(() => {
    if (logs && logs.length > 0) {
      setConsoleLogs(prev => [...prev.slice(-30), ...logs]);
    }
  }, [logs]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  return (
    <div className="glass-panel rounded-sm border border-command-border overflow-hidden text-xs font-mono">
      {/* Console Header */}
      <div className="bg-command-900 px-4 py-2 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-tactical-cyan font-bold">
          <Terminal className="w-4 h-4 text-tactical-cyan animate-pulse" />
          <span className="tracking-wider uppercase">Live Satellite Telemetry Console Stream</span>
          <span className="flex h-2 w-2 relative ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tactical-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tactical-cyan"></span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Simulation Triggers */}
          <button
            onClick={() => onTriggerSimulate('INDUSTRIAL_INCIDENT')}
            className="px-2.5 py-1 rounded-sm bg-tactical-red/10 hover:bg-tactical-red/30 text-tactical-red border border-tactical-red/50 flex items-center gap-1 transition-all active:scale-95 shadow-sm uppercase tracking-wider text-[10px] font-bold"
            title="Simulate dynamic high-priority refinery flare emergency"
          >
            <ShieldAlert className="w-3 h-3 text-tactical-red" />
            <span className="hidden sm:inline">Simulate Disaster</span>
          </button>

          <button
            onClick={() => onTriggerSimulate('SUPPRESSED_FLARE')}
            className="px-2.5 py-1 rounded-sm bg-tactical-green/10 hover:bg-tactical-green/30 text-tactical-green border border-tactical-green/50 flex items-center gap-1 transition-all active:scale-95 shadow-sm uppercase tracking-wider text-[10px] font-bold"
            title="Simulate dynamic operational flare"
          >
            <Zap className="w-3 h-3 text-tactical-green" />
            <span className="hidden sm:inline">Simulate Flare</span>
          </button>

          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-2.5 py-1 rounded-sm border flex items-center gap-1 font-bold uppercase tracking-wider text-[10px] transition-all ${
              isLive 
                ? 'bg-tactical-cyan/10 text-tactical-cyan border-tactical-cyan/50' 
                : 'bg-tactical-amber/10 text-tactical-amber border-tactical-amber/50'
            }`}
          >
            {isLive ? <Pause className="w-3 h-3 text-tactical-cyan" /> : <Play className="w-3 h-3 text-tactical-amber" />}
            <span>{isLive ? 'STREAMING' : 'PAUSED'}</span>
          </button>
        </div>
      </div>

      {/* Log Feed Display */}
      <div className="p-3 bg-command-950 h-32 overflow-y-auto space-y-1 text-slate-300 font-mono text-[11px]">
        {consoleLogs.map((log, idx) => (
          <div key={idx} className="flex items-start gap-2 hover:bg-command-800 p-0.5 rounded-sm transition-colors">
            <span className="text-tactical-gray select-none font-bold">[{log.time}]</span>
            <span className={`px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider font-bold ${
              log.type === 'ALERT' ? 'bg-tactical-red/20 text-tactical-red border border-tactical-red/40' :
              log.type === 'OK' ? 'bg-tactical-green/20 text-tactical-green border border-tactical-green/40' :
              'bg-tactical-cyan/20 text-tactical-cyan border border-tactical-cyan/40'
            }`}>
              {log.source}
            </span>
            <span className={`flex-1 break-all ${log.type === 'ALERT' ? 'text-tactical-red font-bold' : 'text-slate-300'}`}>
              {log.msg}
            </span>
          </div>
        ))}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}
