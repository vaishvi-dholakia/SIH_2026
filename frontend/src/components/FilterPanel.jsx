import React from 'react';
import { Filter, Sliders, ChevronLeft, ChevronRight, RotateCcw, ShieldCheck, Flame } from 'lucide-react';

export default function FilterPanel({ 
  filters, 
  setFilters, 
  collapsed, 
  onToggleCollapse, 
  onReset 
}) {
  const categories = [
    { id: 'Potential Industrial Incident', label: 'Industrial Incident', color: 'text-red-400' },
    { id: 'Potential Industrial Thermal Source', label: 'Industrial Flare', color: 'text-emerald-400' },
    { id: 'Forest Fire / Wildfire', label: 'Forest Wildfire', color: 'text-green-400' },
    { id: 'Agricultural / Stubble Burning', label: 'Agricultural Stubble', color: 'text-amber-400' },
    { id: 'Mining Area / Coal Mine Fire', label: 'Mining / Coal Fire', color: 'text-slate-300' },
    { id: 'Urban / Landfill Fire', label: 'Urban / Landfill Fire', color: 'text-orange-400' }
  ];

  return (
    <div className={`relative transition-all duration-300 flex flex-col bg-[#151A26] border-r border-[#262F40] h-full font-sans ${
      collapsed ? 'w-12' : 'w-72'
    }`}>
      
      {/* Collapse Toggle Button on Right Edge */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-4 z-40 bg-[#1D4ED8] hover:bg-blue-600 text-white p-1 rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer"
        title={collapsed ? 'Show Filters' : 'Hide Filters'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {collapsed ? (
        /* Collapsed Thin Rail */
        <div className="py-6 flex flex-col items-center gap-6 text-slate-400">
          <Filter className="w-5 h-5 text-blue-400" />
          <span className="writing-mode-vertical text-xs font-black uppercase tracking-widest text-slate-400 font-mono">
            GIS FILTERS
          </span>
        </div>
      ) : (
        /* Full Expanded Filter Drawer */
        <div className="flex flex-col h-full overflow-y-auto p-4 space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#262F40] pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                GIS FILTERS
              </h3>
            </div>
            <button
              onClick={onReset}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Min FRP Slider */}
          <div className="space-y-2 bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Min FRP Power</span>
              </span>
              <span className="font-mono font-bold text-amber-400 text-xs">
                {filters.minFrp} MW
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="10"
              value={filters.minFrp}
              onChange={(e) => setFilters({ ...filters, minFrp: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Priority Score Slider */}
          <div className="space-y-2 bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Min Hazard Priority</span>
              </span>
              <span className="font-mono font-bold text-blue-400 text-xs">
                {filters.minScore}/100
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.minScore}
              onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Suppression Mask Checkbox */}
          <div className="bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={filters.hideSuppressed}
                onChange={(e) => setFilters({ ...filters, hideSuppressed: e.target.checked })}
                className="accent-red-500 rounded cursor-pointer"
              />
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Hide Operational Flares</span>
            </label>
          </div>

          {/* Category Checkboxes */}
          <div className="space-y-2.5 bg-[#0B0E14] border border-[#262F40] p-3 rounded-lg">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Classification Categories
            </span>
            <div className="space-y-2">
              {categories.map((cat) => {
                const isChecked = filters.categories.includes(cat.id);
                return (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, categories: [...filters.categories, cat.id] });
                        } else {
                          setFilters({ ...filters, categories: filters.categories.filter(c => c !== cat.id) });
                        }
                      }}
                      className="accent-blue-600 rounded cursor-pointer"
                    />
                    <span className={cat.color}>{cat.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
