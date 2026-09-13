import React, { useState } from 'react';
import { Search, Filter, Clock, Eye } from 'lucide-react';

export default function AlertsView({ incidents = [], onSelectIncident }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Filtering
  const filteredIncidents = incidents.filter((item) => {
    // Search
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      !term ||
      item.nearestFacility?.toLowerCase().includes(term) ||
      item.classification?.toLowerCase().includes(term);

    // Priority filter
    const matchesPriority =
      priorityFilter === 'All' || item.priority?.toLowerCase() === priorityFilter.toLowerCase();

    // Status filter
    const matchesStatus =
      statusFilter === 'All' || item.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">LIVE ALERTS</h2>
          <p className="text-sm text-slate-400">Real-time thermal hotspot & gas flare triage feed</p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>Last 24 Hours</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search location or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Priority Pill Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            {['All', 'Critical', 'High', 'Medium', 'Routine'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  priorityFilter === p
                    ? 'bg-slate-800 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 text-sm text-white rounded-lg focus:outline-none focus:border-red-500 font-semibold cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Suppressed">Suppressed</option>
          </select>

        </div>
      </div>

      {/* Main Alerts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Priority</th>
                <th className="p-4">Event Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">FRP</th>
                <th className="p-4">Change from Normal</th>
                <th className="p-4">Hazard Score</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-500 font-medium">
                    No thermal alerts match your search or filter parameters.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    
                    {/* Priority Badge */}
                    <td className="p-4 font-semibold whitespace-nowrap">
                      {item.priority === 'Critical' && <span className="text-red-400">🔴 Critical</span>}
                      {item.priority === 'High' && <span className="text-amber-400">🟠 High</span>}
                      {item.priority === 'Medium' && <span className="text-yellow-400">🟡 Medium</span>}
                      {item.priority === 'Routine' && <span className="text-emerald-400">🟢 Routine</span>}
                    </td>

                    {/* Event Type */}
                    <td className="p-4 font-semibold text-white">
                      {item.classification}
                    </td>

                    {/* Location */}
                    <td className="p-4 text-slate-300">
                      {item.nearestFacility}
                    </td>

                    {/* FRP */}
                    <td className="p-4 font-bold text-amber-400">
                      {item.frp} MW
                    </td>

                    {/* Change from Normal */}
                    <td className="p-4 font-bold">
                      {item.frpChangePercent > 0 ? (
                        <span className="text-red-400">+{item.frpChangePercent}%</span>
                      ) : (
                        <span className="text-emerald-400">{item.frpChangePercent}%</span>
                      )}
                    </td>

                    {/* Hazard Score */}
                    <td className="p-4 font-bold text-white">
                      {item.hazardScore} / 100
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        item.status?.toLowerCase() === 'new'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : item.status?.toLowerCase() === 'reviewed'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => onSelectIncident(item)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW</span>
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
