import React, { useState } from 'react';
import { Settings, Bell, Shield, Sliders, CheckCircle2, RefreshCw } from 'lucide-react';
import { syncOsmData, triggerBackfill } from '../api/client';

export default function SettingsView() {
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('12');
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSyncOsm = async () => {
    setSyncing(true);
    setStatusMsg('Synchronizing OpenStreetMap facilities...');
    try {
      const res = await syncOsmData();
      setStatusMsg(`Successfully synced ${res.refineries_synced || 0} refineries from OpenStreetMap.`);
    } catch (e) {
      setStatusMsg('Error syncing OpenStreetMap data.');
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    setSyncing(true);
    setStatusMsg('Executing NASA FIRMS historical archive backfill...');
    try {
      const res = await triggerBackfill(200);
      setStatusMsg(`Ingested ${res.processed || 0} NASA FIRMS historical detections.`);
    } catch (e) {
      setStatusMsg('Error executing historical backfill.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-white tracking-tight uppercase">SETTINGS</h2>
        <p className="text-sm text-slate-400">System configuration & notification parameters</p>
      </div>

      <div className="space-y-4">
        
        {/* Notification Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-white font-bold text-base border-b border-slate-800 pb-3">
            <Bell className="w-5 h-5 text-red-500" />
            <span>Alert & Sound Notifications</span>
          </div>

          <div className="space-y-4 text-sm text-slate-300">
            <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div>
                <strong className="text-white block font-semibold">Audible Disaster Alarm</strong>
                <span className="text-xs text-slate-400">Play high-priority sound alarm when a critical industrial incident is detected.</span>
              </div>
              <input
                type="checkbox"
                checked={audioAlerts}
                onChange={(e) => setAudioAlerts(e.target.checked)}
                className="w-5 h-5 accent-red-500 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div>
                <strong className="text-white block font-semibold">Live Telemetry Auto-Stream</strong>
                <span className="text-xs text-slate-400">Automatically refresh thermal hotspot data periodically in the background.</span>
              </div>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-5 h-5 accent-red-500 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Data Sync & Operations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-white font-bold text-base border-b border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>Geospatial Data Operations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSyncOsm}
              disabled={syncing}
              className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>SYNC LIVE OPENSTREETMAP DATA</span>
            </button>

            <button
              onClick={handleBackfill}
              disabled={syncing}
              className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 text-emerald-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>RUN NASA FIRMS BACKFILL</span>
            </button>
          </div>

          {statusMsg && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
