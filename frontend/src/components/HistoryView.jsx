import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, Legend } from 'recharts';
import { AlertTriangle, ShieldCheck, CheckCircle2, Eye, Satellite, XCircle } from 'lucide-react';
import { fetchIncidentHistory, fetchIncidentSatellite } from '../api/client';

export default function HistoryView({ incidents = [] }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(incidents[0]?.id || null);
  const [historyData, setHistoryData] = useState([]);
  const [satelliteData, setSatelliteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [chartScale, setChartScale] = useState('full'); // 'full' or 'zoom'

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
            normalFrp: item.normalFrp || Math.round((item.normalMin + item.normalMax) / 2),
            normalMax: item.normalMax,
            normalMin: item.normalMin
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

  // Smart Y-Axis Domain calculation
  const maxObservedFrp = Math.max(...historyData.map(d => d.frp || 0), activeInc.frp || 0);
  const yDomain = chartScale === 'zoom' 
    ? [0, Math.max(normalMax * 2, 80)] 
    : [0, 'auto'];

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#F5F5F5] tracking-tight uppercase">30-DAY TEMPORAL ANALYSIS</h2>
          <p className="text-sm text-slate-400">Historical thermal output baselines & smart flaring suppression audit</p>
        </div>

        {/* Industrial Site Selector */}
        <div className="flex items-center gap-2 bg-[#242424] border border-[#383838] p-2 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Telemetry Site:</span>
          <select
            value={activeInc.id}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-[#161616] border border-[#383838] text-[#F5F5F5] font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500 cursor-pointer"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.locationDisplay || inc.nearestFacility} ({inc.classification})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 30-DAY THERMAL ACTIVITY CHART */}
      <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#383838] pb-4">
          <div>
            <h3 className="text-base font-extrabold text-[#F5F5F5] flex items-center gap-2">
              <span>30-Day Observed FRP vs Operational Baseline (MW)</span>
            </h3>
            <p className="text-xs text-slate-400">Green shaded band indicates normal baseline range. Red line represents actual satellite FRP detections.</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <button
              onClick={() => setChartScale(chartScale === 'zoom' ? 'full' : 'zoom')}
              className="px-2.5 py-1 bg-[#161616] hover:bg-[#383838] text-slate-300 rounded border border-[#383838] cursor-pointer transition-colors"
            >
              {chartScale === 'zoom' ? '🔍 Reset Scale' : '🔍 Zoom Baseline'}
            </button>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#383838" />
                <XAxis dataKey="day" stroke="#888888" tick={{ fontSize: 11, fill: '#888888' }} />
                <YAxis stroke="#888888" tick={{ fontSize: 11, fill: '#888888' }} domain={yDomain} allowDataOverflow={chartScale === 'zoom'} />
                <Tooltip
                  contentStyle={{ background: '#242424', borderColor: '#383838', borderRadius: '8px', color: '#F5F5F5', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <ReferenceArea y1={normalMin} y2={normalMax} fill="#10b981" fillOpacity={0.06} />
                <Line type="monotone" dataKey="frp" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444' }} name="Observed Satellite FRP (MW)" />
                <Line type="monotone" dataKey="normalFrp" stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Operational Baseline (MW)" />
                <Line type="monotone" dataKey="normalMax" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} dot={false} name="Surge Anomaly Threshold (MW)" />
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
        <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-lg">
          <div className={`inline-flex items-center gap-2 px-3 py-1 border text-xs font-bold rounded-full uppercase tracking-wider ${
            activeInc.isSuppressed 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <ShieldCheck className="w-4 h-4" />
            <span>{activeInc.isSuppressed ? '🟢 ROUTINE SUPPRESSED FLARE' : '🔴 UNSUPPRESSED ACTIVE EVENT'}</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#F5F5F5]">{activeInc.classification}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{activeInc.locationDisplay || activeInc.nearestFacility}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#161616] p-3 rounded-lg border border-[#383838]">
              <span className="text-xs text-slate-400 block">Persistence:</span>
              <strong className="text-base font-bold text-[#F5F5F5]">{activeInc.persistenceDays} Days Active</strong>
            </div>

            <div className="bg-[#161616] p-3 rounded-lg border border-[#383838]">
              <span className="text-xs text-slate-400 block">Current FRP:</span>
              <strong className="text-base font-bold text-amber-400">{activeInc.frp} MW</strong>
            </div>

            <div className="bg-[#161616] p-3 rounded-lg border border-[#383838] col-span-2">
              <span className="text-xs text-slate-400 block">Normal Baseline FRP:</span>
              <strong className="text-base font-bold text-slate-200">{activeInc.normalFrp} MW ({activeInc.frpRatio}x ratio)</strong>
            </div>
          </div>

          <div className="bg-[#161616] p-4 rounded-xl border border-[#383838] space-y-2 text-sm font-medium">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Status Audit:</span>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Priority Tier: <strong className="text-[#F5F5F5]">{activeInc.priority} ({activeInc.hazardScore}/100)</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Spatial Proximity: <strong className="text-[#F5F5F5]">{Math.round(activeInc.distanceToRefineryM)}m to registered facility</strong></span>
            </div>
            <div className={`flex items-center gap-2 ${activeInc.isSuppressed ? 'text-emerald-400' : 'text-red-400'}`}>
              {activeInc.isSuppressed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{activeInc.isSuppressed ? '✓ Alarm suppressed as routine operational flare' : '⚠ Active alarm escalated to Command Deck'}</span>
            </div>
          </div>
        </div>

        {/* SATELLITE EVIDENCE CARD */}
        <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-bold text-base border-b border-[#383838] pb-3">
              <Satellite className="w-5 h-5 text-blue-400" />
              <span>SATELLITE MULTISPECTRAL EVIDENCE</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#161616] rounded-lg border border-[#383838] text-sm">
                <span className="text-slate-400 font-medium">Sentinel-2 Verification:</span>
                <span className={`font-bold flex items-center gap-1 ${satelliteData?.sentinel2Available ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {satelliteData?.sentinel2Available ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{satelliteData?.sentinel2Available ? '✓ Available' : 'Pending Satellite Pass'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] rounded-lg border border-[#383838] text-sm">
                <span className="text-slate-400 font-medium">NDVI Vegetation Index:</span>
                <span className="text-[#F5F5F5] font-bold">
                  {satelliteData?.ndvi !== null && satelliteData?.ndvi !== undefined 
                    ? `${satelliteData.ndvi} (${satelliteData.landCover})` 
                    : 'Pending Sensor Acquisition'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#161616] rounded-lg border border-[#383838] text-sm">
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

