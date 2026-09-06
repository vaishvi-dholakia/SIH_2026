import React, { useState, useEffect } from 'react';
import { Satellite, Radio, Activity, RefreshCw, Volume2, VolumeX, Eye } from 'lucide-react';

export default function SpaceNavbar({ connectionStatus, onRefresh, audioEnabled, setAudioEnabled }) {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-command-950 border-b border-command-border px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="relative p-2 bg-command-900 border border-tactical-cyan shadow-[0_0_8px_rgba(0,229,255,0.2)]">
            <Satellite className="w-5 h-5 text-tactical-cyan" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tactical-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tactical-cyan"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-mono tracking-widest text-white uppercase">
                GEO-SCD COMMAND
              </h1>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest bg-tactical-cyan/10 text-tactical-cyan border border-tactical-cyan/30 rounded-sm">
                SIH / NTRO 26162
              </span>
            </div>
            <p className="text-[10px] text-tactical-gray font-mono uppercase tracking-wider">
              Space-Based Thermal & Gas Flare Intelligence
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-command-900 border border-command-border rounded-sm font-mono text-[10px] text-tactical-gray">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-tactical-green/10 text-tactical-green border border-tactical-green/30">
            <Radio className="w-3 h-3 animate-spin text-tactical-green" style={{ animationDuration: '6s' }} />
            <span className="uppercase">VIIRS SNPP</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-tactical-cyan/10 text-tactical-cyan border border-tactical-cyan/30">
            <Activity className="w-3 h-3" />
            <span className="uppercase">NOAA-20</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-tactical-cyan/10 text-tactical-cyan border border-tactical-cyan/30">
            <Eye className="w-3 h-3" />
            <span className="uppercase">SENTINEL-2 L2A</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right font-mono border-r border-command-border pr-3">
            <div className="text-[11px] text-white font-bold">{utcTime || '00:00:00 UTC'}</div>
            <div className="text-[9px] text-tactical-cyan uppercase tracking-wider">Orbital Track Active</div>
          </div>

          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[10px] font-mono font-bold uppercase transition-all ${
            connectionStatus === 'connected'
              ? 'bg-tactical-green/10 text-tactical-green border-tactical-green/50'
              : 'bg-tactical-red/10 text-tactical-red border-tactical-red/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-tactical-green animate-ping' : 'bg-tactical-red'}`} />
            <span>{connectionStatus === 'connected' ? 'LIVE FEED' : 'RECONNECTING'}</span>
          </div>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 bg-command-900 hover:bg-command-800 border border-command-border rounded-sm text-tactical-gray hover:text-tactical-amber transition-colors"
            title={audioEnabled ? 'Mute Disaster Audio Alarm' : 'Enable Disaster Audio Alarm'}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-tactical-amber" /> : <VolumeX className="w-3.5 h-3.5 text-command-border" />}
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-tactical-gold hover:bg-tactical-goldDark text-command-950 font-bold font-mono text-[10px] uppercase tracking-wider rounded-sm shadow-[0_0_8px_rgba(255,179,0,0.3)] transition-all active:scale-95"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Sync Satellite</span>
          </button>
        </div>

      </div>
    </header>
  );
}