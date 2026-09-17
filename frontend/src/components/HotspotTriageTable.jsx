import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, Download, Eye, Tag, AlertTriangle, ShieldCheck, Flame, Layers } from 'lucide-react';
import { formatCoords, formatDistance, getClassificationTheme, getRiskColor } from '../utils/helpers';
import { downloadPdfReport, updateHotspotStatus } from '../api/client';

export default function HotspotTriageTable({ hotspots = [], onSelectHotspot, onStatusUpdated }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [updatingId, setUpdatingId] = useState(null);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await updateHotspotStatus(id, newStatus);
      if (onStatusUpdated) {
        onStatusUpdated(id, newStatus);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Filtering
  const filteredHotspots = hotspots.filter((h) => {
    // Search
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      h.id?.toString().includes(term) ||
      h.classification?.toLowerCase().includes(term) ||
      h.nearest_refinery_name?.toLowerCase().includes(term);

    // Status
    const matchesStatus = statusFilter === 'ALL' || h.status === statusFilter;

    // Category
    const matchesCategory =
      categoryFilter === 'ALL' ||
      (categoryFilter === 'INCIDENT' && h.classification === 'Potential Industrial Incident') ||
      (categoryFilter === 'FLARE' && h.classification === 'Potential Industrial Thermal Source') ||
      (categoryFilter === 'FOREST' && h.classification === 'Forest Fire / Wildfire') ||
      (categoryFilter === 'FARM' && h.classification === 'Agricultural / Stubble Burning') ||
      (categoryFilter === 'MINE' && h.classification === 'Mining Area / Coal Mine Fire') ||
      (categoryFilter === 'URBAN' && h.classification === 'Urban / Landfill Fire');

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Sorting
  const sortedHotspots = [...filteredHotspots].sort((a, b) => {
    let valA = a[sortBy] ?? 0;
    let valB = b[sortBy] ?? 0;

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Header Bar */}
      <div className="glass-panel p-4 rounded-sm border border-command-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-tactical-gray absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search ID, facility, class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-command-950 border border-command-border rounded-sm text-white placeholder-tactical-gray focus:outline-none focus:border-tactical-cyan uppercase tracking-wider text-xs"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-command-950 border border-command-border p-1 rounded-sm">
            <Filter className="w-3.5 h-3.5 text-tactical-cyan ml-1" />
            <span className="text-[10px] text-tactical-gray uppercase mr-1">Status:</span>
            {['ALL', 'new', 'reviewed', 'suppressed', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 text-[10px] uppercase font-bold rounded-sm border transition-all ${
                  statusFilter === st
                    ? 'bg-tactical-cyan/20 text-tactical-cyan border-tactical-cyan'
                    : 'bg-command-900 text-tactical-gray border-transparent hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Category Filter Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-command-950 border border-command-border text-white text-xs rounded-sm focus:outline-none focus:border-tactical-cyan uppercase tracking-wider font-mono cursor-pointer"
          >
            <option value="ALL">ALL CATEGORIES ({hotspots.length})</option>
            <option value="INCIDENT">INDUSTRIAL DISASTERS</option>
            <option value="FLARE">SUPPRESSED FLARES</option>
            <option value="FOREST">FOREST / WILDFIRES</option>
            <option value="FARM">AGRICULTURAL / STUBBLE</option>
            <option value="MINE">COAL / MINING FIRES</option>
            <option value="URBAN">URBAN / LANDFILL</option>
          </select>

        </div>
      </div>

      {/* Main Hotspots Data Table */}
      <div className="glass-panel rounded-sm border border-command-border overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-command-900 border-b border-command-border text-[10px] text-tactical-gray uppercase tracking-widest">
                <th className="p-3">Incident</th>
                <th className="p-3 cursor-pointer hover:text-white" onClick={() => handleSort('priority_score')}>
                  <div className="flex items-center gap-1">
                    <span>Priority Score</span>
                    <ArrowUpDown className="w-3 h-3 text-tactical-cyan" />
                  </div>
                </th>
                <th className="p-3">Classification & Context</th>
                <th className="p-3 cursor-pointer hover:text-white" onClick={() => handleSort('frp')}>
                  <div className="flex items-center gap-1">
                    <span>FRP Energy</span>
                    <ArrowUpDown className="w-3 h-3 text-tactical-amber" />
                  </div>
                </th>
                <th className="p-3">Nearest Facility</th>
                <th className="p-3 cursor-pointer hover:text-white" onClick={() => handleSort('persistence_days')}>
                  <div className="flex items-center gap-1">
                    <span>30d History</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3">Triage Command</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-command-border/50 text-slate-200">
              {sortedHotspots.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-tactical-gray uppercase tracking-wider">
                    No active satellite detections matching current search or filters.
                  </td>
                </tr>
              ) : (
                sortedHotspots.map((h) => {
                  const theme = getClassificationTheme(h.classification);
                  const riskClass = getRiskColor(h.priority_score || 0);

                  return (
                    <tr key={h.id} className="hover:bg-command-900/60 transition-colors">
                      {/* ID & Date */}
                      <td className="p-3 font-bold">
                        <div className="text-tactical-cyan">#{h.id}</div>
                        <div className="text-[9px] text-tactical-gray tracking-tight mt-0.5">
                          {h.detected_at ? new Date(h.detected_at).toLocaleTimeString() : 'Live'}
                        </div>
                      </td>

                      {/* Priority Score */}
                      <td className="p-3">
                        <span className={`px-2 py-1 text-[10px] font-extrabold border rounded-sm ${riskClass}`}>
                          {h.priority_score || 0} / 100
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="p-3">
                        <div className="font-bold text-white tracking-wider uppercase text-[11px]">
                          {h.classification || 'Non-Industrial Fire'}
                        </div>
                        <div className="text-[9px] text-tactical-gray flex items-center gap-1.5 mt-0.5">
                          <span>Confidence: {((h.model_confidence || 0.8) * 100).toFixed(0)}%</span>
                          <span>•</span>
                          <span>NDVI: {h.ndvi !== null && h.ndvi !== undefined ? h.ndvi : '0.14'}</span>
                        </div>
                      </td>

                      {/* FRP & Temp */}
                      <td className="p-3">
                        <div className="font-bold text-tactical-amber">{h.frp || 0.0} MW</div>
                        <div className="text-[9px] text-tactical-gray">{h.brightness || 0.0} K</div>
                      </td>

                      {/* Location & Facility Context */}
                      <td className="p-3">
                        <div className="font-bold text-slate-200">
                          {h.locationDisplay ? (
                            <span>{h.locationDisplay}</span>
                          ) : h.nearest_refinery_name || h.nearestRefineryName ? (
                            <span className="text-red-400 font-extrabold">{h.nearest_refinery_name || h.nearestRefineryName}</span>
                          ) : (h.classification || '').includes('Forest') ? (
                            <span className="text-emerald-400">Forest Region</span>
                          ) : (h.classification || '').includes('Agricultural') ? (
                            <span className="text-amber-400">Agricultural Belt</span>
                          ) : (h.classification || '').includes('Mining') ? (
                            <span className="text-slate-300">Mining Zone</span>
                          ) : (h.classification || '').includes('Urban') ? (
                            <span className="text-orange-400">Urban Sector</span>
                          ) : (
                            <span>Open Region</span>
                          )}
                          {h.detectionCount > 1 && (
                            <span className="ml-1 text-[9px] font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-1 py-0.5 rounded shadow-sm inline-flex items-center gap-1">
                              <span>🛰️ {h.detectionCount} Passes</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-tactical-gray tracking-tight mt-0.5">
                          {h.distance_to_refinery_m <= 1000 ? (
                            <span className="text-tactical-red font-bold">Inside OISD 1km Geofence</span>
                          ) : (
                            <span>Nearest Ref: {formatDistance(h.distance_to_refinery_m)} ({h.nearest_refinery_name || h.nearestRefineryName || 'Facility'})</span>
                          )}
                        </div>
                      </td>

                      {/* 30-Day Persistence */}
                      <td className="p-3">
                        <div className="font-bold text-white">{h.persistence_days || 1} Days</div>
                        <div className="text-[9px]">
                          {h.is_suppressed ? (
                            <span className="text-tactical-green font-bold">Suppressed Flare</span>
                          ) : (
                            <span className="text-tactical-red font-bold">Active Anomaly</span>
                          )}
                        </div>
                      </td>

                      {/* Status Selector */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {['new', 'reviewed', 'suppressed', 'resolved'].map((st) => (
                            <button
                              key={st}
                              onClick={() => handleStatusChange(h.id, st)}
                              disabled={updatingId === h.id}
                              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-sm border transition-all ${
                                h.status === st
                                  ? st === 'new'
                                    ? 'bg-tactical-red/20 text-tactical-red border-tactical-red'
                                    : st === 'reviewed'
                                    ? 'bg-tactical-amber/20 text-tactical-amber border-tactical-amber'
                                    : st === 'suppressed'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                    : 'bg-tactical-green/20 text-tactical-green border-tactical-green'
                                  : 'bg-command-950 text-tactical-gray border-command-border hover:text-white'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectHotspot(h)}
                            className="p-1.5 bg-command-900 hover:bg-tactical-cyan/20 border border-command-border hover:border-tactical-cyan text-tactical-cyan rounded-sm transition-all"
                            title="Inspect Satellite Telemetry"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => downloadPdfReport(h.id)}
                            className="p-1.5 bg-command-900 hover:bg-tactical-gold/20 border border-command-border hover:border-tactical-gold text-tactical-gold rounded-sm transition-all"
                            title="Download Space Forensic Audit PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
