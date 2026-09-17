import React, { useState } from 'react';
import { Settings, Bell, Shield, Sliders, CheckCircle2, RefreshCw, Lock, LogOut } from 'lucide-react';
import { syncOsmData, triggerBackfill } from '../api/client';

export default function SettingsView({ onLogout }) {
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
        <h2 className="text-xl font-black text-[#F5F5F5] tracking-tight uppercase">SETTINGS</h2>
        <p className="text-sm text-slate-400">System configuration & notification parameters</p>
      </div>

      <div className="space-y-4">
        
        {/* Notification Settings */}
        <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#F5F5F5] font-bold text-base border-b border-[#383838] pb-3">
            <Bell className="w-5 h-5 text-red-500" />
            <span>Alert & Sound Notifications</span>
          </div>

          <div className="space-y-4 text-sm text-slate-300">

            <label className="flex items-center justify-between cursor-pointer p-3 bg-[#161616] rounded-lg border border-[#383838]">
              <div>
                <strong className="text-[#F5F5F5] block font-semibold">Live Telemetry Auto-Stream</strong>
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
        <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#F5F5F5] font-bold text-base border-b border-[#383838] pb-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>Geospatial Data Operations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSyncOsm}
              disabled={syncing}
              className="p-4 bg-[#161616] border border-[#383838] hover:border-slate-500 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>SYNC LIVE OPENSTREETMAP DATA</span>
            </button>

            <button
              onClick={handleBackfill}
              disabled={syncing}
              className="p-4 bg-[#161616] border border-[#383838] hover:border-slate-500 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 text-emerald-400 ${syncing ? 'animate-spin' : ''}`} />
              <span>RUN NASA FIRMS BACKFILL</span>
            </button>
          </div>

          {statusMsg && (
            <div className="p-3 bg-[#161616] rounded-lg border border-[#383838] text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Admin Authentication & Security Control */}
        <div className="bg-[#242424] border border-[#383838] rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#F5F5F5] font-bold text-base border-b border-[#383838] pb-3">
            <Lock className="w-5 h-5 text-blue-400" />
            <span>Admin Authentication & Terminal Security</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#161616] rounded-lg border border-[#383838] gap-2">
              <div>
                <strong className="text-[#F5F5F5] block font-semibold">Active Terminal Operator</strong>
                <span className="text-xs text-slate-400">Authenticated Admin Session (NTRO Lead Operator | Badge PS-26162)</span>
              </div>
              <div className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded border border-cyan-500/30">
                USER: admin
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#161616] rounded-lg border border-[#383838] gap-2">
              <div>
                <strong className="text-[#F5F5F5] block font-semibold">Terminal Session Access</strong>
                <span className="text-xs text-slate-400">Strict NTRO Admin Terminal Authentication Enforced</span>
              </div>
              <button
                type="button"
                onClick={() => onLogout && onLogout()}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>LOCK TERMINAL / LOGOUT</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
