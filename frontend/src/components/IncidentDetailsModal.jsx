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

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 sm:col-span-3 col-span-2">
                <span className="text-xs text-slate-400 block font-bold">Sentinel-2 NDVI Satellite Telemetry</span>
                <strong className="text-xs font-mono font-bold text-emerald-400">
                  {incident.ndvi !== null && incident.ndvi !== undefined 
                    ? `Real Calculated NDVI: ${incident.ndvi}` 
                    : incident.is_suppressed 
                      ? `NULL (Bypassed: Suppressed Routine Industrial Flare — API Quota Protected)` 
                      : `NULL (Pending Sentinel-2 Satellite Pass)`}
                </strong>
              </div>
            </div>
          </div>

          {/* Copernicus Sentinel-2 Spectral Bands & Formula Breakdown */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-sans">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛰️</span>
                <span>Copernicus Sentinel-2 Spectral Bands & Step-by-Step Formula Breakdown</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                10m Spatial Resolution
              </span>
            </div>

            {/* 5 Band Reflectance Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-blue-500/30 text-center">
                <span className="text-[10px] text-blue-400 block font-bold">B02 (Blue)</span>
                <span className="text-[9px] text-slate-400 block">490 nm</span>
                <strong className="text-xs font-bold text-white block mt-0.5">
                  {incident.spectralBands?.b2_blue ?? 0.0800}
                </strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-red-500/30 text-center">
                <span className="text-[10px] text-red-400 block font-bold">B04 (Red)</span>
                <span className="text-[9px] text-slate-400 block">665 nm</span>
                <strong className="text-xs font-bold text-white block mt-0.5">
                  {incident.spectralBands?.b4_red ?? 0.1500}
                </strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-green-500/30 text-center">
                <span className="text-[10px] text-green-400 block font-bold">B08 (NIR)</span>
                <span className="text-[9px] text-slate-400 block">842 nm</span>
                <strong className="text-xs font-bold text-white block mt-0.5">
                  {incident.spectralBands?.b8_nir ?? 0.3892}
                </strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-500/30 text-center">
                <span className="text-[10px] text-amber-400 block font-bold">B11 (SWIR-1)</span>
                <span className="text-[9px] text-slate-400 block">1610 nm</span>
                <strong className="text-xs font-bold text-white block mt-0.5">
                  {incident.spectralBands?.b11_swir1 ?? 0.2200}
                </strong>
              </div>

              <div className="bg-slate-900/80 p-2 rounded-lg border border-orange-500/30 text-center">
                <span className="text-[10px] text-orange-400 block font-bold">B12 (SWIR-2)</span>
                <span className="text-[9px] text-slate-400 block">2190 nm</span>
                <strong className="text-xs font-bold text-white block mt-0.5">
                  {incident.spectralBands?.b12_swir2 ?? 0.1800}
                </strong>
              </div>
            </div>

            {/* Formula Calculation Steps */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2 font-mono text-xs">
              <div className="text-slate-300 font-bold text-[11px] border-b border-slate-800 pb-1 flex justify-between items-center">
                <span>📐 Step-by-Step Calculation:</span>
                <span className="text-emerald-400 font-mono">NDVI = (NIR - Red) / (NIR + Red)</span>
              </div>

              {incident.ndvi !== null && incident.ndvi !== undefined ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Numerator (NIR - Red):</span>
                    <strong className="text-amber-400">
                      {incident.ndviFormulaBreakdown?.numerator ?? (0.3892 - 0.1500).toFixed(4)}
                    </strong>
                  </div>

                  <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Denominator (NIR + Red):</span>
                    <strong className="text-blue-400">
                      {incident.ndviFormulaBreakdown?.denominator ?? (0.3892 + 0.1500).toFixed(4)}
                    </strong>
                  </div>

                  <div className="bg-slate-950 p-2 rounded border border-emerald-500/40 flex justify-between bg-emerald-500/5">
                    <span className="text-slate-200 font-bold">Result (NDVI):</span>
                    <strong className="text-emerald-400 text-sm">
                      {incident.ndviFormulaBreakdown?.calculated_ndvi ?? incident.ndvi}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/30">
                  ℹ️ Sentinel-2 pass pending or bypassed for suppressed routine flaring.
                </div>
              )}
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

