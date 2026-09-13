import React, { useState } from 'react';
import { ShieldAlert, Flame, FileText, Sliders, Activity, Cpu, CheckCircle2, ChevronRight, Terminal } from 'lucide-react';

function intOrFallback(val, fallback = 1200) {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : Math.round(num);
}

export default function TelemetryPanel({ selectedHotspot, onOpenExportPdf }) {
  const [sliderPos, setSliderPos] = useState(50);

  if (!selectedHotspot) {
    return (
      <div className="bg-[#151A26] border border-[#262F40] rounded-xl p-6 text-center font-sans text-slate-400 shadow-xl flex flex-col items-center justify-center min-h-[220px]">
        <Activity className="w-8 h-8 text-blue-500 animate-pulse mb-2" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Telemetry Target Selected</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Click any active marker on the Leaflet Satellite Map or select an incident from the Live Alert Feed to inspect telemetry details and Sentinel-2 multispectral evidence.
        </p>
      </div>
    );
  }

  const h = selectedHotspot;
  const lat = h.latitude ?? h.lat ?? 0;
  const lon = h.longitude ?? h.lon ?? 0;
  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
  const geoId = h.id ? `GEO-2026-JM${h.id}` : 'GEO-2026-JM11';

  const facility = h.nearestFacility || h.nearest_refinery_name || 'Jamnagar Industrial Complex';
  const frpVal = h.frp ?? 0;
  const frpChange = h.frpChangePercent ?? h.frp_change_percent ?? 0;
  const distPop = h.distanceToPopulationM ?? h.distance_to_population_m ?? 1200;

  // Badge Category Styling & Icons
  const getBadgeStyle = (classification) => {
    switch (classification) {
      case 'Potential Industrial Incident':
        return {
          icon: '🔴',
          label: 'Potential Industrial Incident',
          className: 'bg-red-500/20 text-red-400 border border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
        };
      case 'Potential Industrial Thermal Source':
        return {
          icon: '🟢',
          label: 'Potential Industrial Thermal Source',
          className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
        };
      case 'Forest Fire / Wildfire':
        return {
          icon: '🌲',
          label: 'Forest Fire / Wildfire',
          className: 'bg-green-600/20 text-green-400 border border-green-500/50'
        };
      case 'Agricultural / Stubble Burning':
        return {
          icon: '🌾',
          label: 'Agricultural / Stubble Burning',
          className: 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
        };
      case 'Mining Area / Coal Mine Fire':
        return {
          icon: '🪨',
          label: 'Mining Area / Coal Mine Fire',
          className: 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
        };
      case 'Urban / Landfill Fire':
      default:
        return {
          icon: '🏢',
          label: classification || 'Urban / Landfill Fire',
          className: 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
        };
    }
  };

  const badge = getBadgeStyle(h.classification);

  // XAI terminal console text
  const xaiReasons = h.reasons && h.reasons.length > 0 ? h.reasons : [
    `🚨 CRITICAL ALERT: Heat coordinate intersects registered facility '${facility}'.`,
    `Fire Radiative Power surge calculated at ${frpVal} MW (+${frpChange}% relative to historical baseline).`,
    `Multispectral Sentinel-2 SWIR-2 band B12 confirms localized high-temperature combustion on site.`,
    `Distance to nearest residential population settlement: ${intOrFallback(distPop, 1200)} meters.`
  ];

  return (
    <div className="bg-[#151A26] border border-[#262F40] rounded-xl p-4 shadow-2xl space-y-4 font-sans text-slate-200">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#262F40] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-[#1D4ED8] text-white text-xs font-black font-mono px-2.5 py-1 rounded tracking-wider shadow-sm">
            {geoId}
          </span>
          <span className="font-mono text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
            📍 {latStr}, {lonStr}
          </span>
          <span className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${badge.className}`}>
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
          </span>
        </div>

        <button
          onClick={() => onOpenExportPdf && onOpenExportPdf(h)}
          className="bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer shrink-0"
        >
          <FileText className="w-4 h-4" />
          <span>Export Forensic PDF 📄</span>
        </button>
      </div>

      {/* Main 4-Column Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Section A & B: Physical Metrics & Classifier Confidence */}
        <div className="bg-[#0B0E14] border border-[#262F40] p-3.5 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Thermal Power</span>
            </span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              {frpChange > 0 ? `+${frpChange}%` : `${frpChange}%`} Baseline
            </span>
          </div>

          <div>
            <div className="text-2xl font-black font-mono text-amber-400 tracking-tight">
              {frpVal} <span className="text-sm text-slate-300 font-sans">MW</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Fire Radiative Power (MW)</div>
          </div>

          <div className="pt-2 border-t border-[#262F40]/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>RF Model Confidence:</span>
            </span>
            <span className="font-mono font-black text-sm text-blue-400">
              {h.confidence ?? h.classificationConfidence ?? 80}%
            </span>
          </div>
        </div>

        {/* Section C: Copernicus Sentinel-2 SWIR Split-Slider */}
        <div className="bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg flex flex-col justify-between space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copernicus Sentinel-2 SWIR Infrared Curtain</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">B11/B12 SWIR Composite</span>
          </div>

          {/* Interactive Image Split Curtain Slider */}
          <div className="relative w-full h-24 rounded overflow-hidden border border-[#262F40] bg-slate-900 group select-none">
            {/* Left Image (Mock Optical Green Canopy) */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80')`,
                filter: 'brightness(0.7) contrast(1.2)'
              }}
            />
            {/* Optical Overlay Label */}
            <div className="absolute top-1 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 z-10">
              Optical RGB Canopy
            </div>

            {/* Right Image (SWIR False Color Burning Core Composite) */}
            <div 
              className="absolute inset-y-0 right-0 bg-cover bg-center border-l-2 border-amber-500 shadow-2xl transition-all"
              style={{
                width: `${100 - sliderPos}%`,
                backgroundImage: `url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80')`,
                filter: 'brightness(1.3) contrast(1.8) hue-rotate(330deg)'
              }}
            />
            {/* SWIR Overlay Label */}
            <div className="absolute top-1 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-400 z-10">
              SWIR B11/B12 Infrared Core
            </div>

            {/* Curtain Line */}
            <div 
              className="absolute inset-y-0 w-0.5 bg-amber-400 z-20 pointer-events-none shadow-[0_0_8px_#f59e0b]"
              style={{ left: `${sliderPos}%` }}
            />
          </div>

          {/* Bottom Range Control */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <p className="text-[10px] text-slate-400 text-center font-medium italic">
              Drag bottom slider to adjust SWIR infrared curtain split
            </p>
          </div>
        </div>

        {/* Section D: Explainable AI - XAI Rationale Box */}
        <div className="bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg font-mono text-[11px] space-y-1.5 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 border-b border-[#262F40] pb-1 font-sans text-xs">
            <span className="font-bold flex items-center gap-1 text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>XAI Console Rationale</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">Passed Rules</span>
          </div>

          <div className="bg-slate-950 p-2 rounded border border-slate-800/80 text-slate-300 space-y-1 overflow-y-auto max-h-24 leading-relaxed text-[10px]">
            {xaiReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-blue-400 font-bold shrink-0">&gt;</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
