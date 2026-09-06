import React from 'react';
import { Flame, ShieldCheck, AlertTriangle, Zap, Factory } from 'lucide-react';

export default function OrbitalStats({ summary, totalRefineries }) {
  const totalHotspots = summary?.total_hotspots || 0;
  const maxFrp = summary?.max_frp || 0.0;
  const avgFrp = summary?.average_frp || 0.0;

  const classifications = summary?.classifications || [];
  const incidents = classifications.find(c => c.name === 'Potential Industrial Incident')?.count || 0;
  const flares = classifications.find(c => c.name === 'Potential Industrial Thermal Source')?.count || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
      
      <div className="glass-panel p-3 rounded-none flex items-center justify-between border-l-2 border-l-tactical-cyan shadow-[inset_20px_0_20px_-20px_rgba(0,229,255,0.15)]">
        <div>
          <p className="text-[10px] font-mono text-tactical-gray uppercase tracking-widest">Satellite Hotspots</p>
          <h3 className="text-xl font-extrabold font-mono text-white mt-1">{totalHotspots}</h3>
          <span className="text-[9px] font-mono text-tactical-cyan uppercase tracking-wider">Past 24h Space Track</span>
        </div>
        <div className="p-2 bg-tactical-cyan/10 border border-tactical-cyan/30 rounded-sm text-tactical-cyan">
          <Flame className="w-4 h-4" />
        </div>
      </div>

      <div className="glass-panel p-3 rounded-none flex items-center justify-between border-l-2 border-l-tactical-red shadow-[inset_20px_0_20px_-20px_rgba(255,23,68,0.15)]">
        <div>
          <p className="text-[10px] font-mono text-tactical-gray uppercase tracking-widest">Industrial Disasters</p>
          <h3 className="text-xl font-extrabold font-mono text-tactical-red mt-1">{incidents}</h3>
          <span className="text-[9px] font-mono text-tactical-red font-bold uppercase tracking-wider">Requires Emergency Action</span>
        </div>
        <div className="p-2 bg-tactical-red/10 border border-tactical-red/30 rounded-sm text-tactical-red">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
        </div>
      </div>

      <div className="glass-panel p-3 rounded-none flex items-center justify-between border-l-2 border-l-tactical-green shadow-[inset_20px_0_20px_-20px_rgba(0,230,118,0.15)]">
        <div>
          <p className="text-[10px] font-mono text-tactical-gray uppercase tracking-widest">Suppressed Flares</p>
          <h3 className="text-xl font-extrabold font-mono text-tactical-green mt-1">{flares}</h3>
          <span className="text-[9px] font-mono text-tactical-green uppercase tracking-wider">Safe 24/7 Refinery Output</span>
        </div>
        <div className="p-2 bg-tactical-green/10 border border-tactical-green/30 rounded-sm text-tactical-green">
          <ShieldCheck className="w-4 h-4" />
        </div>
      </div>

      <div className="glass-panel p-3 rounded-none flex items-center justify-between border-l-2 border-l-tactical-amber shadow-[inset_20px_0_20px_-20px_rgba(255,145,0,0.15)]">
        <div>
          <p className="text-[10px] font-mono text-tactical-gray uppercase tracking-widest">Peak Thermal Energy</p>
          <h3 className="text-xl font-extrabold font-mono text-tactical-amber mt-1">{maxFrp} <span className="text-[10px]">MW</span></h3>
          <span className="text-[9px] font-mono text-tactical-gray uppercase tracking-wider">Avg Energy: {avgFrp} MW</span>
        </div>
        <div className="p-2 bg-tactical-amber/10 border border-tactical-amber/30 rounded-sm text-tactical-amber">
          <Zap className="w-4 h-4" />
        </div>
      </div>

      <div className="glass-panel p-3 rounded-none flex items-center justify-between border-l-2 border-l-tactical-gold shadow-[inset_20px_0_20px_-20px_rgba(255,179,0,0.15)]">
        <div>
          <p className="text-[10px] font-mono text-tactical-gray uppercase tracking-widest">Refinery Geofences</p>
          <h3 className="text-xl font-extrabold font-mono text-tactical-gold mt-1">{totalRefineries}</h3>
          <span className="text-[9px] font-mono text-tactical-gold uppercase tracking-wider">Live OSM Facilities</span>
        </div>
        <div className="p-2 bg-tactical-gold/10 border border-tactical-gold/30 rounded-sm text-tactical-gold">
          <Factory className="w-4 h-4" />
        </div>
      </div>

    </div>
  );
}
