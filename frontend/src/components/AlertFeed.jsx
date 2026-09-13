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
    <div className={`relative transition-all duration-300 flex flex-col bg-[#151A26] border-l border-[#262F40] h-full font-sans ${
      collapsed ? 'w-12' : 'w-80'
    }`}>
      
      {/* Collapse Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className="absolute -left-3 top-4 z-40 bg-[#1D4ED8] hover:bg-blue-600 text-white p-1 rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer"
        title={collapsed ? 'Show Alert Feed' : 'Hide Alert Feed'}
      >
        {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {collapsed ? (
        /* Collapsed Thin Rail */
        <div className="py-6 flex flex-col items-center gap-6 text-slate-400">
          <div className="relative">
            <Bell className="w-5 h-5 text-red-500" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          </div>
          <span className="writing-mode-vertical text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
            LIVE ALERTS ({safeIncidents.length})
          </span>
        </div>
      ) : (
        /* Full Expanded Right Feed */
        <div className="flex flex-col h-full overflow-hidden">
          
          {/* Header */}
          <div className="p-4 border-b border-[#262F40] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                LIVE ALERT FEED
              </h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40 rounded-full">
              {safeIncidents.length} Telemetries
            </span>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {safeIncidents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <Flame className="w-6 h-6 text-slate-500 mx-auto animate-bounce" />
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
                    className={`p-3 rounded-lg border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-800 border-red-500 shadow-md ring-1 ring-red-500/50'
                        : 'bg-[#0B0E14] border-[#262F40] hover:border-slate-700 hover:bg-slate-900/60'
                    } ${isCritical ? 'pulse-ring-crimson' : ''}`}
                  >
                    {/* Top Row: Priority Badge & FRP */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        inc.priority === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                        inc.priority === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                        inc.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {inc.priority || 'Routine'}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {inc.frp || 0} MW
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {inc.classification || 'Thermal Anomaly'}
                    </h4>

                    {/* Subtitle Facility */}
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {inc.nearestFacility || 'Industrial Zone'}
                    </p>

                    {/* Footer Row: Coordinates & Time */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-[#262F40]/60 font-mono">
                      <span>{inc.latitude ? Number(inc.latitude).toFixed(3) : '22.350'}°, {inc.longitude ? Number(inc.longitude).toFixed(3) : '69.850'}°</span>
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
