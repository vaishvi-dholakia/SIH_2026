import React, { useState } from 'react';
import { 
  Flame, ShieldAlert, ShieldCheck, Compass, Activity, CheckCircle2, 
  Search, ChevronDown, Eye, AlertTriangle, Building2, Trees, Tractor, FlaskConical, Filter
} from 'lucide-react';

export default function DashboardView({ 
  summary, 
  incidents = [], 
  onSelectIncident, 
  onNavigateMap,
  onNavigateHistory,
  onOpenPdfDossier
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');

  const safeIncidents = Array.isArray(incidents) ? incidents.filter(i => i && typeof i === 'object') : [];

  // Helper for Classification Category Icons & Subtitles
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

  // Helper for Location Name Formatting (Dynamic API Location)
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

  // Filtered Incidents List
  const filteredIncidents = safeIncidents.filter((inc) => {
    const term = searchTerm.toLowerCase();
    const facilityInfo = getLocationDisplay(inc);
    const matchesSearch =
      !term ||
      inc.classification?.toLowerCase().includes(term) ||
      facilityInfo.facilityName.toLowerCase().includes(term) ||
      facilityInfo.districtState.toLowerCase().includes(term);

    const matchesClass =
      selectedClassFilter === 'ALL' ||
      (selectedClassFilter === '01' && (inc.classificationClass === '01' || inc.classification?.includes('Source') || inc.classification?.includes('Thermal'))) ||
      (selectedClassFilter === '02' && (inc.classificationClass === '02' || inc.classification?.includes('Incident') || inc.classification?.includes('Emergency'))) ||
      (selectedClassFilter === '03' && (inc.classificationClass === '03' || inc.classification?.includes('Forest') || inc.classification?.includes('Wildfire'))) ||
      (selectedClassFilter === '04' && (inc.classificationClass === '04' || inc.classification?.includes('Agricultural') || inc.classification?.includes('Stubble'))) ||
      (selectedClassFilter === '05' && (inc.classificationClass === '05' || inc.classification?.includes('Mining') || inc.classification?.includes('Coalfield'))) ||
      (selectedClassFilter === '06' && (inc.classificationClass === '06' || inc.classification?.includes('Urban') || inc.classification?.includes('Landfill')));

    return matchesSearch && matchesClass;
  });

  const totalActiveCount = summary?.totalHotspots || safeIncidents.length;
  const highRiskCount = summary?.highRisk || safeIncidents.filter(i => i.priority === 'High').length;
  const criticalCount = summary?.critical || safeIncidents.filter(i => i.priority === 'Critical').length;
  const suppressedCount = summary?.suppressed || safeIncidents.filter(i => i.isSuppressed).length;

  return (
    <div className="space-y-6 font-sans max-w-7xl mx-auto">
      
      {/* SECTION 1: TOP 4 EXECUTIVE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Hotspots */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">Total Hotspots</span>
            <div className="text-3xl font-black text-[#F5F5F5] font-mono">{totalActiveCount}</div>
            <span className="text-[11px] font-medium text-slate-400">Active Detections</span>
          </div>
          <div className="p-3 bg-red-600/20 border border-red-500/40 rounded-2xl text-red-500 shadow-md">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Card 2: High Risk */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">High Risk</span>
            <div className="text-3xl font-black text-[#F5F5F5] font-mono">{highRiskCount}</div>
            <span className="text-[11px] font-medium text-slate-400">Needs Attention</span>
          </div>
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-2xl text-red-400 shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Critical */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">Critical</span>
            <div className="text-3xl font-black text-[#F5F5F5] font-mono">{criticalCount}</div>
            <span className="text-[11px] font-medium text-slate-400">Immediate Action</span>
          </div>
          <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 shadow-md">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Suppressed */}
        <div className="bg-[#242424] border border-[#383838] rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">Suppressed</span>
            <div className="text-3xl font-black text-[#F5F5F5] font-mono">{suppressedCount}</div>
            <span className="text-[11px] font-medium text-slate-400">Under Control</span>
          </div>
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* SECTION 2: MAIN RECENT HOTSPOTS DATA TABLE CONTAINER */}
      <div className="bg-[#242424] border border-[#383838] rounded-2xl p-5 shadow-2xl space-y-4">
        
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#383838] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-base font-extrabold text-[#F5F5F5] tracking-wide">Recent Hotspots</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Class Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="appearance-none bg-[#161616] border border-[#383838] text-[#F5F5F5] text-xs font-bold px-4 py-2 pr-8 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Classes (01-06)</option>
                <option value="01">Class 01 | Industrial Source</option>
                <option value="02">Class 02 | Industrial Emergency</option>
                <option value="03">Class 03 | Forest Wildfire</option>
                <option value="04">Class 04 | Agricultural Stubble</option>
                <option value="05">Class 05 | Mining Coalfield</option>
                <option value="06">Class 06 | Urban Landfill</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search location / facility..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#161616] border border-[#383838] rounded-xl text-xs text-[#F5F5F5] placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#383838] text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-2">Priority</th>
                <th className="py-3 px-2">Classification</th>
                <th className="py-3 px-2">Facility / Location</th>
                <th className="py-3 px-2 font-mono">FRP (MW)</th>
                <th className="py-3 px-2 font-mono">Risk Score</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#383838]/60 text-[#F5F5F5] font-medium">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400 text-xs font-mono">
                    No active satellite hotspots match your filter parameters.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc, idx) => {
                  const clsDisplay = getClassificationDisplay(inc.classification, inc.classificationClass);
                  const locDisplay = getLocationDisplay(inc);
                  const isMedium = inc.priority === 'Medium' || (inc.hazardScore >= 40 && inc.hazardScore < 60);
                  const isCritical = inc.priority === 'Critical' || inc.hazardScore >= 80;

                  return (
                    <tr key={inc.id || `inc-${idx}`} className="hover:bg-[#2c2c2c] transition-colors">
                      
                      {/* Priority Badge */}
                      <td className="py-3.5 px-2 whitespace-nowrap">
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
                      <td className="py-3.5 px-2 whitespace-nowrap">
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
                      <td className="py-3.5 px-2">
                        <div className="font-bold text-white text-xs">{locDisplay.facilityName}</div>
                        <div className="text-[11px] text-slate-400">{locDisplay.districtState}</div>
                      </td>

                      {/* FRP MW */}
                      <td className="py-3.5 px-2 font-mono font-black text-amber-400 text-sm whitespace-nowrap">
                        {inc.frp || 0.0} MW
                      </td>

                      {/* Risk Score */}
                      <td className="py-3.5 px-2 font-mono font-black text-sm whitespace-nowrap">
                        <span className={inc.hazardScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}>
                          {inc.hazardScore || 0}
                        </span>
                        <span className="text-slate-500 text-xs font-sans font-bold"> / 100</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-2 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {inc.status || 'New'}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectIncident(inc)}
                          className="px-3.5 py-1.5 bg-[#383838] hover:bg-[#4a4a4a] text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
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
