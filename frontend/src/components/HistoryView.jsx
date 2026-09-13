import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from 'recharts';
import { AlertTriangle, ShieldCheck, CheckCircle2, Eye, Satellite, XCircle } from 'lucide-react';
import { fetchIncidentHistory, fetchIncidentSatellite } from '../api/client';

export default function HistoryView({ incidents = [] }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(incidents[0]?.id || null);
  const [historyData, setHistoryData] = useState([]);
  const [satelliteData, setSatelliteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyMeta, setHistoryMeta] = useState(null);

  useEffect(() => {
    if (incidents.length > 0 && !selectedIncidentId) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  const activeInc = incidents.find(i => String(i.id) === String(selectedIncidentId)) || incidents[0] || null;

  useEffect(() => {
    if (!activeInc?.id) return;
    setLoading(true);

    Promise.all([
      fetchIncidentHistory(activeInc.id),
      fetchIncidentSatellite(activeInc.id)
    ]).then(([histRes, satRes]) => {
      if (histRes) {
        setHistoryMeta(histRes);
        if (histRes.dailyHistory) {
          setHistoryData(histRes.dailyHistory.map((item, idx) => ({
            day: item.date ? item.date.substring(5) : `Day ${idx + 1}`,
            frp: item.frp,
            normalMin: item.normalMin,
            normalMax: item.normalMax
          })));
        }
      }
      if (satRes) {
        setSatelliteData(satRes);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error loading incident telemetry:", err);
      setLoading(false);
    });
  }, [activeInc?.id]);

  if (!activeInc) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <p className="text-base font-semibold">No live thermal events available for 30-day temporal analysis.</p>
      </div>
    );
  }

  const normalMin = historyMeta?.normalMin ?? Math.max(5, Math.round((activeInc.normalFrp || 20) * 0.7));
  const normalMax = historyMeta?.normalMax ?? Math.round((activeInc.normalFrp || 20) * 1.4);
  const isAbnormal = historyMeta?.isAbnormal ?? (activeInc.priority === 'Critical' || activeInc.frpRatio >= 3.0);
  const limitedHistory = historyMeta?.limitedHistory ?? false;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">30-DAY TEMPORAL ANALYSIS</h2>
          <p className="text-sm text-slate-400">Historical thermal output baselines & smart flaring suppression audit</p>
        </div>

        {/* Industrial Site Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Telemetry Site:</span>
          <select
            value={activeInc.id}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.nearestFacility} ({inc.classification})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 30-DAY THERMAL ACTIVITY CHART */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">30-DAY THERMAL ACTIVITY</h3>
            <p className="text-xs text-slate-400">Facility / Location: <strong className="text-slate-200">{activeInc.nearestFacility}</strong></p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="text-slate-400">Normal Range: <strong className="text-slate-200">{normalMin}–{normalMax} MW</strong></span>
            <span className="text-red-400">Current FRP: <strong className="text-red-500 font-black text-sm">{activeInc.frp} MW</strong></span>
          </div>
        </div>

        {/* Line Chart */}
        <div className="h-72 w-full pt-2">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono animate-pulse">
              Loading 30-day temporal baseline telemetry...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <ReferenceArea y1={normalMin} y2={normalMax} fill="#10b981" fillOpacity={0.08} label={{ value: `Baseline Range (${normalMin}-${normalMax} MW)`, fill: '#10b981', fontSize: 11, position: 'insideTopLeft' }} />
                <Line type="monotone" dataKey="frp" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444' }} name="FRP (MW)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Temporal Banner */}
        {limitedHistory ? (
          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between text-xs text-blue-300">
            <span>ℹ️ Limited historical satellite observations (&lt; 5 passes) available for this coordinate. Baseline initialized from local sensor calibration.</span>
          </div>
        ) : isAbnormal ? (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>⚠️ Abnormal FRP surge detected</span>
            </div>
            <span className="text-xs text-slate-400">
              FRP is {activeInc.frpRatio}x historical baseline ({activeInc.frpChangePercent > 0 ? `+${activeInc.frpChangePercent}%` : `${activeInc.frpChangePercent}%`})
            </span>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between text-xs text-emerald-400 font-bold">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              <span>✓ Thermal energy output within expected historical baseline range.</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Suppression Audit + Satellite Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* THERMAL SOURCE STATUS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
          <div className={`inline-flex items-center gap-2 px-3 py-1 border text-xs font-bold rounded-full uppercase tracking-wider ${
            activeInc.isSuppressed 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <ShieldCheck className="w-4 h-4" />
            <span>{activeInc.isSuppressed ? '🟢 ROUTINE SUPPRESSED FLARE' : '🔴 UNSUPPRESSED ACTIVE EVENT'}</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">{activeInc.classification}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{activeInc.nearestFacility}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Persistence:</span>
              <strong className="text-base font-bold text-white">{activeInc.persistenceDays} Days Active</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Current FRP:</span>
              <strong className="text-base font-bold text-amber-400">{activeInc.frp} MW</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 col-span-2">
              <span className="text-xs text-slate-400 block">Normal Baseline FRP:</span>
              <strong className="text-base font-bold text-slate-200">{activeInc.normalFrp} MW ({activeInc.frpRatio}x ratio)</strong>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-sm font-medium">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status Audit:</span>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Priority Tier: <strong className="text-white">{activeInc.priority} ({activeInc.hazardScore}/100)</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Spatial Proximity: <strong className="text-white">{Math.round(activeInc.distanceToRefineryM)}m to registered facility</strong></span>
            </div>
            <div className={`flex items-center gap-2 ${activeInc.isSuppressed ? 'text-emerald-400' : 'text-red-400'}`}>
              {activeInc.isSuppressed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{activeInc.isSuppressed ? '✓ Alarm suppressed as routine operational flare' : '⚠ Active alarm escalated to Command Deck'}</span>
            </div>
          </div>
        </div>

        {/* SATELLITE EVIDENCE CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold text-base border-b border-slate-800 pb-3">
              <Satellite className="w-5 h-5 text-blue-400" />
              <span>SATELLITE MULTISPECTRAL EVIDENCE</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 text-sm">
                <span className="text-slate-400 font-medium">Sentinel-2 Verification:</span>
                <span className={`font-bold flex items-center gap-1 ${satelliteData?.sentinel2Available ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {satelliteData?.sentinel2Available ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{satelliteData?.sentinel2Available ? '✓ Available' : 'Pending Satellite Pass'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 text-sm">
                <span className="text-slate-400 font-medium">NDVI Vegetation Index:</span>
                <span className="text-white font-bold">
                  {satelliteData?.ndvi !== null && satelliteData?.ndvi !== undefined 
                    ? `${satelliteData.ndvi} (${satelliteData.landCover})` 
                    : 'Pending Sensor Acquisition'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 text-sm">
                <span className="text-slate-400 font-medium">Evidence Diagnostic:</span>
                <span className="text-slate-300 font-mono text-xs max-w-[240px] text-right">
                  {satelliteData?.evidenceSummary || 'Awaiting Sentinel-2 overpass verification.'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

