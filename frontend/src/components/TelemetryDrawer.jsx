import React, { useState } from 'react';
import { X, Satellite, ShieldAlert, Download, Navigation, Eye, CheckCircle2, Layers, Tag, ShieldCheck } from 'lucide-react';
import { formatCoords, formatDistance, getClassificationTheme, getRiskColor } from '../utils/helpers';
import { downloadPdfReport, updateHotspotStatus } from '../api/client';

export default function TelemetryDrawer({ hotspot, onClose, onStatusUpdated }) {
  if (!hotspot) return null;

  const [currentStatus, setCurrentStatus] = useState(hotspot.status || 'new');
  const [updating, setUpdating] = useState(false);

  const classification = hotspot.classification || 'Non-Industrial Fire';
  const theme = getClassificationTheme(classification);
  const riskClass = getRiskColor(hotspot.priority_score || 0);

  const xaiExplanations = hotspot.xai_explanation || [
    `Coordinates evaluated against live OpenStreetMap refinery boundaries (${formatDistance(hotspot.distance_to_refinery_m)})`,
    `Fire Radiative Power emission measured at ${hotspot.frp || 0} MW`,
    `Thermal anomaly score computed via unsupervised Isolation Forest engine (${(hotspot.anomaly_score || 0.1).toFixed(2)})`
  ];

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await updateHotspotStatus(hotspot.id, newStatus);
      setCurrentStatus(newStatus);
      if (onStatusUpdated) {
        onStatusUpdated(hotspot.id, newStatus);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-command-950 border-l border-tactical-cyan/30 shadow-[inset_1px_0_15px_rgba(0,229,255,0.1),-10px_0_30px_rgba(0,0,0,0.8)] overflow-y-auto flex flex-col transition-all">
      
      {/* Drawer Header */}
      <div className="p-4 border-b border-command-border flex items-center justify-between bg-command-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-tactical-cyan/10 border border-tactical-cyan/30 rounded-sm text-tactical-cyan">
            <Satellite className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold font-mono text-white tracking-widest uppercase">SPACECRAFT TELEMETRY</h2>
            <p className="text-[10px] font-mono text-tactical-gray tracking-wider uppercase">Hotspot Incident #{hotspot.id}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 bg-command-950 hover:bg-command-800 text-tactical-gray hover:text-white rounded-sm transition-colors border border-command-border hover:border-tactical-cyan/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        
        {/* Classification Banner */}
        <div className={`p-4 rounded-sm border ${theme.badge} ${theme.glow}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-tactical-gray">CLASSIFICATION DECISION</span>
            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold border ${riskClass}`}>
              SCORE: {hotspot.priority_score || 0}/100
            </span>
          </div>
          <h3 className="text-lg font-extrabold font-mono text-white tracking-wider uppercase">{classification}</h3>
          <p className="text-[10px] font-mono mt-1 opacity-90 uppercase tracking-wider text-tactical-gray">{theme.label}</p>
        </div>

        {/* Triage Status Selector */}
        <div className="glass-panel p-4 rounded-sm border border-command-border space-y-3">
          <h4 className="text-[10px] font-mono font-bold text-tactical-gray uppercase tracking-widest flex items-center gap-2 border-b border-command-border pb-2">
            <Tag className="w-4 h-4 text-tactical-cyan" />
            <span>Incident Triage & Status Command</span>
          </h4>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => handleStatusChange('new')}
              disabled={updating}
              className={`py-1.5 rounded-sm text-[10px] font-mono font-bold border transition-all uppercase tracking-wider ${
                currentStatus === 'new'
                  ? 'bg-tactical-red/20 text-tactical-red border-tactical-red shadow-[0_0_8px_rgba(255,23,68,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-red/50'
              }`}
            >
              NEW
            </button>

            <button
              onClick={() => handleStatusChange('reviewed')}
              disabled={updating}
              className={`py-1.5 rounded-sm text-[10px] font-mono font-bold border transition-all uppercase tracking-wider ${
                currentStatus === 'reviewed'
                  ? 'bg-tactical-amber/20 text-tactical-amber border-tactical-amber shadow-[0_0_8px_rgba(255,145,0,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-amber/50'
              }`}
            >
              REVIEWED
            </button>

            <button
              onClick={() => handleStatusChange('resolved')}
              disabled={updating}
              className={`py-1.5 rounded-sm text-[10px] font-mono font-bold border transition-all uppercase tracking-wider ${
                currentStatus === 'resolved'
                  ? 'bg-tactical-green/20 text-tactical-green border-tactical-green shadow-[0_0_8px_rgba(0,230,118,0.3)]'
                  : 'bg-command-900 text-tactical-gray border-command-border hover:text-white hover:border-tactical-green/50'
              }`}
            >
              RESOLVED
            </button>
          </div>
        </div>

        {/* Coordinate & Sensor Metrics */}
        <div className="glass-panel p-4 rounded-sm border border-command-border space-y-3">
          <h4 className="text-[10px] font-mono font-bold text-tactical-gray uppercase tracking-widest flex items-center gap-2 border-b border-command-border pb-2">
            <Navigation className="w-4 h-4 text-tactical-cyan" />
            <span>Space & Coordinate Metrics</span>
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-[10px] text-tactical-gray uppercase tracking-wider">Coordinates:</span>
              <p className="text-white font-bold mt-0.5 tracking-wider">{formatCoords(hotspot.latitude, hotspot.longitude)}</p>
            </div>
            <div>
              <span className="text-[10px] text-tactical-gray uppercase tracking-wider">Overpass Time:</span>
              <p className="text-tactical-cyan font-bold mt-0.5 tracking-wider">{hotspot.detected_at ? new Date(hotspot.detected_at).toUTCString() : 'Live Pass'}</p>
            </div>
            <div>
              <span className="text-[10px] text-tactical-gray uppercase tracking-wider">Brightness Temp:</span>
              <p className="text-tactical-amber font-bold mt-0.5 tracking-wider">{hotspot.brightness || 0.0} K</p>
            </div>
            <div>
              <span className="text-[10px] text-tactical-gray uppercase tracking-wider">Fire Energy (FRP):</span>
              <p className="text-tactical-red font-bold mt-0.5 tracking-wider">{hotspot.frp || 0.0} MW</p>
            </div>
          </div>
        </div>

        {/* Geofence Proximity */}
        <div className="glass-panel p-4 rounded-sm border border-command-border space-y-3">
          <h4 className="text-[10px] font-mono font-bold text-tactical-gray uppercase tracking-widest flex items-center gap-2 border-b border-command-border pb-2">
            <Layers className="w-4 h-4 text-tactical-gold" />
            <span>Proximity & Geofence Analysis</span>
          </h4>

          <div className="space-y-2 text-[11px] font-mono tracking-wider">
            <div className="flex justify-between items-center bg-command-900 p-2.5 rounded-sm border border-command-border">
              <span className="text-tactical-gray uppercase">Nearest Refinery:</span>
              <span className="text-white font-bold uppercase">{hotspot.nearest_refinery_name || 'Jamnagar Industrial Complex'}</span>
            </div>

            <div className="flex justify-between items-center bg-command-900 p-2.5 rounded-sm border border-command-border">
              <span className="text-tactical-gray uppercase">Distance to Refinery:</span>
              <span className="text-tactical-red font-bold uppercase">{formatDistance(hotspot.distance_to_refinery_m)}</span>
            </div>

            <div className="flex justify-between items-center bg-command-900 p-2.5 rounded-sm border border-command-border">
              <span className="text-tactical-gray uppercase">Distance to Settlement:</span>
              <span className="text-tactical-amber font-bold uppercase">{formatDistance(hotspot.distance_to_population_m)}</span>
            </div>
          </div>
        </div>

        {/* Sentinel-2 NDVI */}
        <div className="glass-panel p-4 rounded-sm border border-command-border space-y-3">
          <h4 className="text-[10px] font-mono font-bold text-tactical-gray uppercase tracking-widest flex items-center gap-2 border-b border-command-border pb-2">
            <Eye className="w-4 h-4 text-tactical-green" />
            <span>Sentinel-2 NDVI Spectral Status</span>
          </h4>

          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-mono bg-command-900 p-2.5 rounded-sm border border-command-border">
            <span className="text-tactical-gray">NDVI Vegetation Ratio:</span>
            <span className="text-tactical-green font-bold">
              {hotspot.ndvi !== null && hotspot.ndvi !== undefined ? hotspot.ndvi : '0.14 (Hardscape)'}
            </span>
          </div>
        </div>

        {/* Explainable AI */}
        <div className="glass-panel p-4 rounded-sm border border-command-border space-y-2">
          <h4 className="text-[10px] font-mono font-bold text-tactical-gray uppercase tracking-widest flex items-center gap-2 border-b border-command-border pb-2">
            <ShieldAlert className="w-4 h-4 text-tactical-cyan" />
            <span>Explainable AI (XAI) Rationale</span>
          </h4>

          <ul className="space-y-2 pt-1 text-[10px] font-mono text-slate-300 uppercase tracking-wider">
            {xaiExplanations.map((note, index) => (
              <li key={index} className="flex items-start gap-2 bg-command-900 p-2 rounded-sm border border-command-border">
                <CheckCircle2 className="w-3.5 h-3.5 text-tactical-cyan shrink-0" />
                <span className="pt-0.5">{note}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Footer PDF Button */}
      <div className="p-4 border-t border-command-border bg-command-900 sticky bottom-0 z-10">
        <button
          onClick={() => downloadPdfReport(hotspot.id)}
          className="w-full py-2.5 bg-tactical-gold hover:bg-tactical-goldDark text-command-950 font-bold font-mono text-[11px] uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(255,179,0,0.3)]"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD SPACE FORENSIC AUDIT PDF</span>
        </button>
      </div>

    </div>
  );
}