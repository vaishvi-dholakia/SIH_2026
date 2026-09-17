import React, { useState } from 'react';
import { Search, Filter, Clock, Eye, ChevronDown, Building2, Tractor, Trees, FlaskConical, Flame } from 'lucide-react';

export default function AlertsView({ incidents = [], onSelectIncident }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(10);

  // Helper for Classification Category Icons & Subtitles (Matches Dashboard 100%)
  const getClassificationDisplay = (classification, classificationClass) => {
    const cls = classification || '';
    const clsCode = classificationClass || '01';

    if (clsCode === '02' || cls.includes('Incident')) {
      return {
        icon: <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
        code: 'Class 02',
        sub: 'Industrial / Emergency'
      };
    }
    if (clsCode === '04' || cls.includes('Agricultural') || cls.includes('Stubble')) {
      return {
        icon: <Tractor className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
        code: 'Class 04',
        sub: 'Agricultural / Stubble Fire'
      };
    }
    if (clsCode === '03' || cls.includes('Forest')) {
      return {
        icon: <Trees className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
        code: 'Class 03',
        sub: 'Forest / Wildfire'
      };
    }
    if (clsCode === '05' || cls.includes('Mining')) {
      return {
        icon: <FlaskConical className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />,
        code: 'Class 05',
        sub: 'Mining / Coalfield Fire'
      };
    }
    if (clsCode === '06' || cls.includes('Urban')) {
      return {
        icon: <Building2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />,
        code: 'Class 06',
        sub: 'Urban / Landfill Fire'
      };
    }
    return {
      icon: <Flame className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
      code: 'Class 01',
      sub: 'Industrial / Normal Flare'
    };
  };

  // Helper for Location Name Formatting (Matches Dashboard 100%)
  const getLocationDisplay = (inc) => {
    let rawFacility = inc.nearestFacility || inc.nearestRefineryName || inc.classification || 'Industrial Asset';
    if (rawFacility) {
      rawFacility = rawFacility.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
      if (rawFacility.includes('km')) {
        rawFacility = rawFacility.split('(')[0].trim();
      }
    }

    if (inc.locationDisplay) {
      const parts = inc.locationDisplay.split(',');
      if (parts.length >= 3) {
        return {
          facilityName: parts[0].replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim(),
          districtState: parts.slice(1).join(',').trim()
        };
      }
      return {
        facilityName: rawFacility,
        districtState: inc.locationDisplay
      };
    }
    const districtState = [inc.district, inc.state].filter(Boolean).join(', ') || 'India';
    return { facilityName: rawFacility, districtState };
  };

  // Filtering
  const filteredIncidents = incidents.filter((item) => {
    // Search
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      !term ||
      item.nearestFacility?.toLowerCase().includes(term) ||
      item.nearestRefineryName?.toLowerCase().includes(term) ||
      item.classification?.toLowerCase().includes(term);

    // Priority filter
    const matchesPriority =
      priorityFilter === 'All' || item.priority?.toLowerCase() === priorityFilter.toLowerCase();

    // Status filter
    const matchesStatus =
      statusFilter === 'All' || item.status?.toLowerCase() === statusFilter.toLowerCase();

    // Class filter
    const matchesClass =
      classFilter === 'ALL' || classFilter === 'All' ||
      (classFilter === '01' && (item.classification?.includes('Source') || item.classification?.includes('Thermal') || item.classificationClass === '01')) ||
      (classFilter === '02' && (item.classification?.includes('Incident') || item.classification?.includes('Emergency') || item.classificationClass === '02')) ||
      (classFilter === '03' && (item.classification?.includes('Forest') || item.classification?.includes('Wildfire') || item.classificationClass === '03')) ||
      (classFilter === '04' && (item.classification?.includes('Agricultural') || item.classification?.includes('Stubble') || item.classificationClass === '04')) ||
      (classFilter === '05' && (item.classification?.includes('Mining') || item.classification?.includes('Coalfield') || item.classificationClass === '05')) ||
      (classFilter === '06' && (item.classification?.includes('Urban') || item.classification?.includes('Landfill') || item.classificationClass === '06'));

    return matchesSearch && matchesPriority && matchesStatus && matchesClass;
  });

  // Strict Chronological Sequence (Latest Detection First)
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    const dateA = new Date(a.acqDateTime || a.acquisitionTime || a.timestamp || a.acq_date || 0);
    const dateB = new Date(b.acqDateTime || b.acquisitionTime || b.timestamp || b.acq_date || 0);
    return dateB - dateA;
  });

  const displayedIncidents = sortedIncidents.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#F5F5F5] tracking-tight uppercase">LIVE ALERTS</h2>
          <p className="text-sm text-slate-400">Real-time thermal hotspot & gas flare triage feed (Chronological Sequence)</p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#242424] border border-[#383838] rounded-lg text-xs font-semibold text-slate-300">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>Showing {displayedIncidents.length} of {sortedIncidents.length} Live Detections</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search location or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#161616] border border-[#383838] rounded-lg text-sm text-[#F5F5F5] placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Class Filter Dropdown */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 bg-[#161616] border border-[#383838] text-xs text-[#F5F5F5] rounded-lg focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
          >
            <option value="ALL">All Classes (01-06)</option>
            <option value="01">Class 01 | Industrial Source</option>
            <option value="02">Class 02 | Industrial Emergency</option>
            <option value="03">Class 03 | Forest Wildfire</option>
            <option value="04">Class 04 | Agricultural Stubble</option>
            <option value="05">Class 05 | Mining Coalfield</option>
            <option value="06">Class 06 | Urban Landfill</option>
          </select>

          {/* Priority Pill Selector */}
          <div className="flex items-center gap-1 bg-[#161616] p-1 rounded-lg border border-[#383838] text-xs font-semibold">
            {['All', 'Critical', 'High', 'Medium', 'Routine'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  priorityFilter === p
                    ? 'bg-[#383838] text-white font-bold shadow-sm'
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
            className="px-3.5 py-2 bg-[#161616] border border-[#383838] text-xs text-[#F5F5F5] rounded-lg focus:outline-none focus:border-red-500 font-semibold cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Suppressed">Suppressed</option>
          </select>

        </div>
      </div>

      {/* Main Alerts Table */}
      <div className="bg-[#242424] border border-[#383838] rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#161616] border-b border-[#383838] text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Priority</th>
                <th className="p-4">Event Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">FRP</th>
                <th className="p-4">Change from Normal</th>
                <th className="p-4">Risk Score</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#383838]/60 text-slate-300">
              {displayedIncidents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-500 font-medium">
                    No thermal alerts match your search or filter parameters.
                  </td>
                </tr>
              ) : (
                displayedIncidents.map((item) => {
                  const clsDisplay = getClassificationDisplay(item.classification, item.classificationClass);
                  const locDisplay = getLocationDisplay(item);
                  const isCritical = item.priority === 'Critical';
                  const isMedium = item.priority === 'High' || item.priority === 'Medium';

                  return (
                    <tr key={item.id} className="hover:bg-[#2c2c2c] transition-colors border-b border-[#383838]/60">
                      
                      {/* Priority Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isCritical ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/50 shadow-sm inline-block">
                            Critical
                          </span>
                        ) : isMedium ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm inline-block">
                            Medium
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm inline-block">
                            Routine
                          </span>
                        )}
                      </td>

                      {/* Classification Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-[#161616] border border-[#383838] rounded-lg shrink-0">
                            {clsDisplay.icon}
                          </div>
                          <div>
                            <div className="font-extrabold text-white text-xs">{clsDisplay.sub}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">{clsDisplay.code}</div>
                          </div>
                        </div>
                      </td>

                      {/* Location Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{locDisplay.facilityName}</div>
                        <div className="text-[11px] text-slate-400">{locDisplay.districtState}</div>
                      </td>

                      {/* FRP */}
                      <td className="py-3.5 px-4 font-mono font-black text-amber-400 text-sm whitespace-nowrap">
                        {item.frp || 0.0} MW
                      </td>

                      {/* Change from Normal */}
                      <td className="py-3.5 px-4 font-bold text-xs">
                        {item.frpChangePercent > 0 ? (
                          <span className="text-red-400">+{item.frpChangePercent}%</span>
                        ) : (
                          <span className="text-emerald-400">{item.frpChangePercent}%</span>
                        )}
                      </td>

                      {/* Hazard Score */}
                      <td className="py-3.5 px-4 font-mono font-black text-sm whitespace-nowrap">
                        <span className={item.hazardScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}>
                          {item.hazardScore || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
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
                        className="px-4 py-2 bg-[#383838] hover:bg-[#4a4a4a] text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW</span>
                      </button>
                    </td>

                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Top 10 + See More Toggle Bar */}
        {sortedIncidents.length > 10 && (
          <div className="p-3 bg-[#161616] border-t border-[#383838] text-center">
            <button
              onClick={() => setVisibleCount(visibleCount > 10 ? 10 : sortedIncidents.length)}
              className="px-5 py-2 bg-[#242424] hover:bg-[#383838] text-blue-400 hover:text-white font-mono font-bold text-xs rounded-lg transition-all inline-flex items-center gap-2 cursor-pointer border border-[#383838]"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${visibleCount > 10 ? 'rotate-180' : ''}`} />
              <span>{visibleCount > 10 ? 'SHOW TOP 10 ONLY' : `VIEW ALL LIVE ALERTS (${sortedIncidents.length} TOTAL)`}</span>
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
