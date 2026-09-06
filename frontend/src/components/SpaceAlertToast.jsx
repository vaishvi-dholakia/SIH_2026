import React from 'react';
import { AlertOctagon, X, Flame, Navigation } from 'lucide-react';
import { formatCoords } from '../utils/helpers';

export default function SpaceAlertToast({ alert, onClose, onInspect }) {
  if (!alert) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-command-900 p-4 rounded-sm border-2 border-tactical-red text-white shadow-[0_0_30px_rgba(255,23,68,0.3)] animate-pulse-slow">
      <div className="flex items-start justify-between gap-3">
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-tactical-red/20 border border-tactical-red/50 rounded-sm text-tactical-red">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-tactical-red text-white uppercase tracking-widest">
                CRITICAL DISASTER ALARM
              </span>
              <span className="text-[9px] font-mono text-tactical-gray uppercase tracking-wider">Live Satellite Detection</span>
            </div>

            <h4 className="text-sm font-bold font-mono text-white mt-1 uppercase tracking-wider">
              {alert.classification || 'Potential Industrial Incident'}
            </h4>

            <p className="text-[10px] font-mono text-slate-300 mt-1 uppercase tracking-wider">
              Refinery Surge Detected • FRP: <span className="text-tactical-amber font-bold">{alert.frp || alert.fire_radiative_power || 150} MW</span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-command-800 text-tactical-gray hover:text-white rounded-sm transition-colors border border-transparent hover:border-command-border"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-tactical-red/30 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-tactical-gray flex items-center gap-1">
          <Navigation className="w-3 h-3 text-tactical-cyan" />
          <span>{formatCoords(alert.latitude, alert.longitude)}</span>
        </span>

        <button
          onClick={() => onInspect(alert)}
          className="px-3 py-1.5 bg-tactical-red hover:bg-tactical-red/80 text-white font-mono font-bold text-[10px] uppercase tracking-wider rounded-sm transition-colors flex items-center gap-1 shadow-[0_0_8px_rgba(255,23,68,0.4)]"
        >
          <Flame className="w-3 h-3" />
          <span>Inspect Telemetry</span>
        </button>
      </div>
    </div>
  );
}