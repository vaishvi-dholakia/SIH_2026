import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, History, ShieldAlert, Map as MapIcon, Activity, Check } from 'lucide-react';
import { updateHotspotStatus } from '../api/client';

export default function IncidentDetailsModal({ incident, onClose, onViewOnMap, onViewHistory, onInspectTelemetry, onStatusUpdated }) {
  if (!incident) return null;

  const [currentStatus, setCurrentStatus] = useState(incident.status || 'new');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarkReviewed = async () => {
    setIsUpdating(true);
    try {
      await updateHotspotStatus(incident.id, 'reviewed');
      setCurrentStatus('reviewed');
      if (onStatusUpdated) onStatusUpdated(incident.id, 'reviewed');
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isCritical = incident.priority === 'Critical' || incident.hazardScore >= 80;
  const isHigh = incident.priority === 'High' || (incident.hazardScore >= 60 && incident.hazardScore < 80);
  const isMedium = incident.priority === 'Medium' || (incident.hazardScore >= 40 && incident.hazardScore < 60);

  const priority = isCritical ? 'Critical' : isHigh ? 'High' : isMedium ? 'Medium' : 'Routine';

  const getPriorityTheme = () => {
    switch (priority) {
      case 'Critical':
        return {
          badge: 'bg-red-500/10 border-red-500/30 text-red-400',
          dot: 'bg-red-500',
          scoreText: 'text-red-500',
          scoreBadge: 'bg-red-500/10 border-red-500/30 text-red-400',
          iconColor: 'text-red-400',
          actionBox: 'bg-red-500/10 border-red-500/30 text-red-400'
        };
      case 'High':
        return {
          badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500',
          scoreText: 'text-amber-500',
          scoreBadge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          iconColor: 'text-amber-400',
          actionBox: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        };
      case 'Medium':
        return {
          badge: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          dot: 'bg-yellow-500',
          scoreText: 'text-yellow-500',
          scoreBadge: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          iconColor: 'text-yellow-400',
          actionBox: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        };
      case 'Routine':
      default:
        return {
          badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          scoreText: 'text-emerald-500',
          scoreBadge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          iconColor: 'text-emerald-400',
          actionBox: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        };
    }
  };

  const theme = getPriorityTheme();

  const reasons = (incident.reasons && incident.reasons.length > 0) ? incident.reasons : [
    `Detected FRP of ${incident.frp} MW at location (${incident.latitude}, ${incident.longitude}).`,
    `Proximity to registered facility (${incident.nearestFacility}): ${Math.round(incident.distanceToRefineryM)} meters.`
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <div className="bg-[#242424] border border-[#383838] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-[#383838] flex items-center justify-between sticky top-0 bg-[#242424] z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 ${theme.badge} border text-xs font-bold rounded-full uppercase tracking-wider`}>
                <span className={`w-2 h-2 rounded-full ${theme.dot} animate-ping`} />
                <span>
                  {isCritical ? '🔴 CRITICAL INCIDENT' : isHigh ? '🟠 HIGH RISK INCIDENT' : isMedium ? '🟡 MEDIUM RISK EVENT' : '🟢 ROUTINE SOURCE'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                currentStatus?.toLowerCase() === 'new'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : currentStatus?.toLowerCase() === 'reviewed'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                Status: {currentStatus}
              </span>
            </div>
            <h2 className="text-xl font-black text-[#F5F5F5] tracking-tight">
              {incident.classification}
            </h2>
            <p className="text-sm font-semibold text-slate-400">
              {incident.locationDisplay || incident.nearestFacility}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-[#161616] hover:bg-[#383838] rounded-lg transition-colors border border-[#383838] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* Large Visual Hazard Score */}
          <div className="bg-[#161616] border border-[#383838] p-6 rounded-xl text-center space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unified Risk Score</span>
            <div className={`text-5xl font-black ${theme.scoreText} tracking-tight`}>
              {incident.hazardScore} <span className="text-2xl text-slate-500 font-bold">/ 100</span>
            </div>
            <div className={`inline-block px-3 py-1 ${theme.scoreBadge} border text-xs font-black uppercase rounded-full`}>
              {incident.priority} RISK SEVERITY
            </div>
          </div>

          {/* WHY WAS THIS ALERT GENERATED? */}
          <div className="bg-[#161616]/60 border border-[#383838] p-5 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${theme.iconColor}`} />
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

          {/* Recommended Action Protocol */}
          <div className={`${theme.actionBox} border p-5 rounded-xl space-y-4`}>
            <div className="flex items-center justify-between font-bold text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Control Room Triage Command Protocol</span>
              </div>
              {currentStatus !== 'reviewed' && (
                <button
                  onClick={handleMarkReviewed}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isUpdating ? 'UPDATING...' : 'MARK AS REVIEWED'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                onClick={() => onInspectTelemetry ? onInspectTelemetry(incident) : onViewOnMap(incident)}
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
                className="w-full sm:w-1/3 py-3 bg-[#383838] hover:bg-[#4a4a4a] text-white font-bold text-xs rounded-lg border border-[#4a4a4a] transition-colors flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
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

