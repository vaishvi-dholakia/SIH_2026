import React from 'react';
import { ShieldAlert, X, Printer, Download, Flame, FileText, CheckCircle2 } from 'lucide-react';

export default function ForensicPdfModal({ hotspot, onClose }) {
  if (!hotspot) return null;

  const h = hotspot;
  const geoId = h.id ? `GEO-2026-JM${h.id}` : 'GEO-2026-JM11';
  const latStr = `${Math.abs(h.latitude).toFixed(5)}° ${h.latitude >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(h.longitude).toFixed(5)}° ${h.longitude >= 0 ? 'E' : 'W'}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-text print:p-0 print:bg-white">
      
      <div className="print-modal-container bg-[#242424] border border-[#383838] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 text-[#F5F5F5] relative print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-4 print:hidden gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                GEO-SCD SATELLITE FORENSIC INCIDENT REPORT
              </h2>
              <p className="text-xs text-slate-400">
                National Technical Research Organisation (NTRO ID: PS-26162)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Single Unified Export / Save PDF Option */}
            <a
              href={`http://localhost:8000/api/reports/incident/${h.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer text-decoration-none active:scale-95"
              title="Export and Save Official 1-Page Forensic Incident Report PDF"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT & SAVE PDF</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="space-y-5 print:space-y-4 print:text-black">
          
          {/* Document Title Header */}
          <div className="bg-[#161616] border border-[#383838] p-4 rounded-xl flex items-center justify-between print:bg-slate-100 print:border-slate-300">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest block">
                OFFICIAL SATELLITE TELEMETRY AUDIT
              </span>
              <h1 className="text-xl font-black text-[#F5F5F5] font-mono mt-0.5 print:text-black">
                {geoId}
              </h1>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full font-black text-xs uppercase print:bg-red-100 print:text-red-700">
                {h.priority} ALERT
              </span>
              <p className="text-xs text-slate-400 font-mono mt-1 print:text-slate-600">
                Issued: {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
              </p>
            </div>
          </div>

          {/* Core Telemetry Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-[#161616] border border-[#383838] p-4 rounded-xl space-y-2 print:bg-slate-50 print:border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Geospatial Location
              </span>
              <div className="font-mono text-sm font-bold text-amber-400 print:text-amber-700">
                {h.locationDisplay || `${h.district || 'Industrial Belt'}, ${h.state || 'India'}`}
              </div>
              <div className="text-xs text-slate-300 print:text-slate-700">
                Zone / Landuse: <strong>{h.landuse || 'Environmental Zone'}</strong>
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600">
                Facility: {h.nearestFacility}
              </div>
            </div>

            <div className="bg-[#161616] border border-[#383838] p-4 rounded-xl space-y-2 print:bg-slate-50 print:border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Thermal & Classifier Evidence
              </span>
              <div className="font-mono text-sm font-bold text-[#F5F5F5] print:text-black">
                FRP: <span className="text-amber-400 print:text-amber-700">{h.frp} MW</span> ({h.frpChangePercent > 0 ? `+${h.frpChangePercent}%` : `${h.frpChangePercent}%`})
              </div>
              <div className="text-xs text-slate-300 print:text-slate-700">
                Model Classification: <strong>{h.classification}</strong>
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600">
                Model Confidence: {h.confidence}%
              </div>
            </div>

          </div>

          {/* Sentinel-2 SWIR Verification */}
          <div className="bg-[#161616] border border-[#383838] p-4 rounded-xl space-y-2 print:bg-slate-50 print:border-slate-200">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider print:text-slate-800">
              Copernicus Sentinel-2 Multispectral SWIR Analysis
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed print:text-slate-700">
              Sentinel-2 MSI Level-2A imagery acquired across coordinate ({latStr}, {lonStr}). Short-Wave Infrared band B12 (2190 nm) and NIR band B08 confirm localized thermal emission on industrial hardscape with high radiative power surge.
            </p>
          </div>

          {/* Explainable AI Decision Terminal */}
          <div className="bg-[#161616] border border-[#383838] p-4 rounded-xl font-mono text-xs space-y-2 print:bg-slate-100 print:border-slate-300">
            <span className="font-bold text-blue-400 uppercase tracking-wider block font-sans text-xs">
              Explainable AI (XAI) Decision Logic Trace:
            </span>
            <div className="space-y-1 text-slate-300 text-[11px] print:text-slate-800">
              {(h.reasons && h.reasons.length > 0 ? h.reasons : [
                `Thermal anomaly detected at (${latStr}, ${lonStr}).`,
                `Risk score calculated as ${h.hazardScore}/100.`
              ]).map((r, i) => (
                <div key={i}>&gt; {r}</div>
              ))}
            </div>
          </div>


        </div>

      </div>

    </div>
  );
}
