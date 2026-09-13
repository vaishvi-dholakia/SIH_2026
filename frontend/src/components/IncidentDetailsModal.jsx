import React from 'react';
import { X, CheckCircle2, AlertTriangle, History, ShieldAlert, Map as MapIcon, Activity } from 'lucide-react';

export default function IncidentDetailsModal({ incident, onClose, onViewOnMap, onViewHistory }) {
  if (!incident) return null;

  const isCritical = incident.priority === 'Critical' || incident.hazardScore >= 80;
  const isHigh = incident.priority === 'High' || (incident.hazardScore >= 60 && incident.hazardScore < 80);

  const reasons = (incident.reasons && incident.reasons.length > 0) ? incident.reasons : [
    `Detected FRP of ${incident.frp} MW at location (${incident.latitude}, ${incident.longitude}).`,
    `Proximity to registered facility (${incident.nearestFacility}): ${Math.round(incident.distanceToRefineryM)} meters.`
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-full uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>
                {isCritical ? '🔴 CRITICAL INCIDENT' : isHigh ? '🟠 HIGH RISK INCIDENT' : incident.priority === 'Medium' ? '🟡 MEDIUM RISK EVENT' : '🟢 ROUTINE SOURCE'}
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {incident.classification}
            </h2>
            <p className="text-sm font-semibold text-slate-400">
              {incident.nearestFacility}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* Large Visual Hazard Score */}
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl text-center space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unified Hazard Score</span>
            <div className="text-5xl font-black text-red-500 tracking-tight">
              {incident.hazardScore} <span className="text-2xl text-slate-500 font-bold">/ 100</span>
            </div>
            <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase rounded-full">
              {incident.priority} RISK SEVERITY
            </div>
          </div>

          {/* WHY WAS THIS ALERT GENERATED? */}
          <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Why Was This Alert Generated?</span>
            </h3>

            <div className="space-y-2">
              {reasons.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-200 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Event Information Cards */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event Telemetry</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Current FRP</span>
                <strong className="text-lg font-black text-amber-400">{incident.frp} MW</strong>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Normal Baseline FRP</span>
                <strong className="text-lg font-black text-slate-300">{incident.normalFrp} MW</strong>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Baseline Change</span>
                <strong className="text-lg font-black text-red-400">
                  {incident.frpChangePercent > 0 ? `+${incident.frpChangePercent}%` : `${incident.frpChangePercent}%`}
                </strong>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Sensor Confidence</span>
                <strong className="text-lg font-black text-emerald-400">{incident.confidence}%</strong>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">First Detected</span>
                <strong className="text-sm font-bold text-white">{incident.firstDetected} UTC</strong>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Last Updated</span>
                <strong className="text-sm font-bold text-white">{incident.lastUpdated} UTC</strong>
              </div>
            </div>
          </div>

          {/* AI Classification & Location Context */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classification</span>
              <div className="text-base font-bold text-white">{incident.classification}</div>
              <div className="text-xs text-slate-400">Model Confidence: <strong className="text-emerald-400">{incident.classificationConfidence}%</strong></div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location Context</span>
              <div className="text-sm font-bold text-white">{incident.locationType}</div>
              <div className="text-xs text-slate-400">Nearest Facility: <strong className="text-slate-200">{incident.nearestFacility}</strong></div>
              <div className="text-xs text-slate-400">Population Proximity: <strong className="text-amber-400">{Math.round(incident.distanceToPopulationM)} meters</strong></div>
            </div>

          </div>

          {/* Recommended Action Protocol */}
          <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Immediate verification recommended</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                onClick={() => onViewOnMap(incident)}
                className="w-full sm:w-1/3 py-3 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>INSPECT TELEMETRY</span>
              </button>

              <button
                onClick={() => onViewOnMap(incident)}
                className="w-full sm:w-1/3 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <MapIcon className="w-4 h-4" />
                <span>VIEW ON MAP</span>
              </button>

              <button
                onClick={() => onViewHistory(incident)}
                className="w-full sm:w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>VIEW HISTORY</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

