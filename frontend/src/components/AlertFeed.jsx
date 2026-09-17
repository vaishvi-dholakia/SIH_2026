import React from 'react';
import { Bell, Flame, ChevronRight, ChevronLeft } from 'lucide-react';
import { isPointInIndia } from '../utils/indiaBoundary';

export default function AlertFeed({ 
  incidents = [], 
  selectedHotspot = null, 
  onSelectHotspot, 
  collapsed = false, 
  onToggleCollapse 
}) {
  const safeIncidents = (Array.isArray(incidents) ? incidents : []).filter(inc => {
    if (!inc) return false;
    return isPointInIndia(inc.latitude, inc.longitude);
  });

  return (
    <div className={`relative transition-all duration-300 flex flex-col bg-[#242424] border-l border-[#383838] h-full font-sans select-none ${
      collapsed ? 'w-11' : 'w-64'
    }`}>
      
      {collapsed ? (
        /* Collapsed Compact Icon Rail */
        <div className="flex flex-col items-center h-full w-full relative">
          {/* Top Integrated Expand Button */}
          <button
            onClick={onToggleCollapse}
            className="w-full py-3 bg-[#161616] hover:bg-[#2c2c2c] text-slate-300 hover:text-white border-b border-[#383838] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group shrink-0"
            title="Expand Live Alert Feed"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-red-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <ChevronLeft className="w-3.5 h-3.5 text-blue-400 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          {/* Centered Rotated Vertical Strip (Unclipped) */}
          <div
            onClick={onToggleCollapse}
            className="flex-1 w-full flex items-center justify-center cursor-pointer hover:bg-[#2c2c2c] transition-colors relative"
            title="Click to expand Live Alert Feed"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[11px] font-mono font-bold tracking-widest text-slate-300 hover:text-white transition-colors flex items-center gap-2 select-none">
              <span className="uppercase">LIVE ALERTS</span>
              <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] border border-red-500/30 font-mono">
                {safeIncidents.length}
              </span>
            </div>
          </div>

          {/* Bottom Subtle Icon */}
          <div className="pb-3 text-slate-500 shrink-0">
            <Flame className="w-4 h-4 text-amber-500/70" />
          </div>
        </div>
      ) : (
        /* Expanded Compact Feed (Tight Fit Width) */
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Header Bar */}
          <div className="p-2.5 border-b border-[#383838] flex items-center justify-between bg-[#161616]/90">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
              </div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>LIVE ALERTS</span>
                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded text-[10px] border border-red-500/30 font-mono">
                  {safeIncidents.length}
                </span>
              </h3>
            </div>
            
            {/* Sleek Header Collapse Button */}
            <button
              onClick={onToggleCollapse}
              className="p-1 bg-[#242424] hover:bg-[#383838] text-slate-400 hover:text-white rounded border border-[#383838] transition-colors cursor-pointer"
              title="Collapse Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cards List (Compact Padding) */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {safeIncidents.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400 space-y-2">
                <Flame className="w-5 h-5 text-slate-500 mx-auto animate-bounce" />
                <p>Waiting for live satellite telemetry broadcast...</p>
              </div>
            ) : (
              safeIncidents.map((inc, idx) => {
                const isSelected = selectedHotspot && selectedHotspot.id === inc.id;
                const isCritical = inc.priority === 'Critical' || (inc.hazardScore != null && inc.hazardScore >= 80);

                return (
                  <div
                    key={`alert-${inc.id || idx}`}
                    onClick={() => onSelectHotspot(inc)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#383838] border-red-500 shadow-md ring-1 ring-red-500/50'
                        : 'bg-[#161616] border-[#383838] hover:border-slate-500 hover:bg-[#2c2c2c]'
                    } ${isCritical ? 'pulse-ring-crimson' : ''}`}
                  >
                    {/* Top Row: Priority Badge & FRP */}
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        inc.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                        inc.priority === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        inc.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {inc.priority || 'Routine'}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-amber-400">
                        {inc.frp || 0} MW
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-[11px] font-bold text-[#F5F5F5] line-clamp-1">
                      {inc.classification || 'Thermal Anomaly'}
                    </h4>

                    {/* Subtitle Facility & Location */}
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {inc.locationDisplay || inc.nearestFacility || 'Industrial Zone'}
                    </p>

                    {/* Footer Row: Landuse & Time */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 mt-1.5 border-t border-[#383838]/60 font-mono">
                      <span>{inc.landuse || inc.state || 'Zone'}</span>
                      <span className="text-slate-300">{inc.firstDetected || 'Live'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </div>
  );
}
