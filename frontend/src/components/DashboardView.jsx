import React from 'react';
import { Flame, AlertTriangle, ShieldAlert, ShieldCheck, ArrowUpRight, Eye } from 'lucide-react';

export default function DashboardView({ summary, incidents = [], onSelectIncident, onRetry }) {
  const totalHotspots = summary?.totalHotspots ?? 0;
  const highRisk = summary?.highRisk ?? 0;
  const critical = summary?.critical ?? 0;
  const suppressed = summary?.suppressed ?? 0;

  // Find top critical or highest risk incident for prominent card
  const topCritical = incidents.find(i => i.priority === 'Critical') || incidents[0] || null;

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">FLAREFILTER</h2>
          <p className="text-sm text-slate-400">Satellite Fire & Thermal Intelligence</p>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Hotspots */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Hotspots</span>
            <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalHotspots}</div>
          <p className="text-xs text-slate-400 mt-1">Detected thermal events</p>
        </div>

        {/* High Risk */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-amber-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">High Risk</span>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-400">{highRisk}</div>
          <p className="text-xs text-slate-400 mt-1">Score 60-79</p>
        </div>

        {/* Critical */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-red-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical</span>
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-red-500">{critical}</div>
          <p className="text-xs text-slate-400 mt-1">Score 80-100</p>
        </div>

        {/* Suppressed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Suppressed</span>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400">{suppressed}</div>
          <p className="text-xs text-slate-400 mt-1">Routine operational flares</p>
        </div>

      </div>

      {/* Prominent Critical Alert Section */}
      {topCritical && (
        <div className="bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-full uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>
                  {topCritical.priority === 'Critical' ? '🔴 CRITICAL ALERT' :
                   topCritical.priority === 'High' ? '🟠 HIGH RISK ALERT' :
                   topCritical.priority === 'Medium' ? '🟡 MEDIUM RISK ALERT' :
                   '🟢 ROUTINE SOURCE'}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">
                {topCritical.classification}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-sm font-sans">
                <div>
                  <span className="text-xs text-slate-400 block">Location:</span>
                  <strong className="text-white font-semibold">{topCritical.nearestFacility}</strong>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Hazard Score:</span>
                  <strong className="text-red-400 font-bold">{topCritical.hazardScore} / 100</strong>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">FRP Energy:</span>
                  <strong className="text-amber-400 font-bold">{topCritical.frp} MW</strong>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Change from Normal:</span>
                  <strong className="text-red-400 font-bold">
                    {topCritical.frpChangePercent > 0 ? `+${topCritical.frpChangePercent}%` : `${topCritical.frpChangePercent}%`} relative to baseline
                  </strong>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <button
                onClick={() => onSelectIncident(topCritical)}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg shadow-lg hover:shadow-red-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>VIEW INCIDENT</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Recent Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">Recent Detections</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3">Priority</th>
                <th className="pb-3">Event</th>
                <th className="pb-3">Location</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 text-sm">
                    No live thermal events available in database.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-semibold">
                      {inc.priority === 'Critical' && <span className="text-red-400">🔴 Critical</span>}
                      {inc.priority === 'High' && <span className="text-amber-400">🟠 High</span>}
                      {inc.priority === 'Medium' && <span className="text-yellow-400">🟡 Medium</span>}
                      {inc.priority === 'Routine' && <span className="text-emerald-400">🟢 Routine</span>}
                    </td>
                    <td className="py-3 font-medium text-white">{inc.classification}</td>
                    <td className="py-3 text-slate-300">{inc.nearestFacility}</td>
                    <td className="py-3 font-bold">{inc.hazardScore}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${
                        inc.status === 'new' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        inc.status === 'reviewed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onSelectIncident(inc)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

