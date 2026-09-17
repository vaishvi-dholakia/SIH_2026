import React, { useState } from 'react';
import { Filter, Sliders, RotateCcw, ShieldCheck, Flame, X } from 'lucide-react';

export default function FilterPanel({ filters, setFilters, onReset }) {
  const [isOpen, setIsOpen] = useState(false);

  const categories = [
    { id: 'Potential Industrial Incident', label: 'Class 01: Industrial Incident', color: 'text-red-400' },
    { id: 'Potential Industrial Thermal Source', label: 'Class 02: Industrial Flare', color: 'text-emerald-400' },
    { id: 'Forest Fire / Wildfire', label: 'Class 03: Forest Wildfire', color: 'text-green-400' },
    { id: 'Agricultural / Stubble Burning', label: 'Class 04: Agricultural Stubble', color: 'text-amber-400' },
    { id: 'Mining Area / Coal Mine Fire', label: 'Class 05: Mining / Coal Fire', color: 'text-slate-300' },
    { id: 'Urban / Landfill Fire', label: 'Class 06: Urban / Landfill Fire', color: 'text-orange-400' }
  ];

  let activeFiltersCount = 0;
  if (filters.minFrp > 0) activeFiltersCount++;
  if (filters.minScore > 0) activeFiltersCount++;
  if (filters.hideSuppressed) activeFiltersCount++;
  if (filters.categories.length < 6) activeFiltersCount++;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-[#242424]/95 hover:bg-[#383838] text-white border border-[#383838] px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-[10px] font-mono font-bold shadow-2xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
        title="Open GIS Filters Drawer"
      >
        <Filter className="w-3 h-3 text-blue-400 shrink-0" />
        <span>GIS FILTERS</span>
        {activeFiltersCount > 0 && (
          <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-[#242424]/95 backdrop-blur-md border border-[#383838] p-3 rounded-xl shadow-2xl text-xs font-mono space-y-2.5 min-w-[260px] max-w-[290px] animate-in fade-in zoom-in-95 duration-150">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-2">
        <div className="flex items-center gap-1.5 font-bold text-[#F5F5F5] uppercase text-[11px]">
          <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>GIS FILTERS</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#383838] rounded transition-colors cursor-pointer"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#383838] rounded transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Min FRP Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-500" />
            <span>Min FRP:</span>
          </span>
          <strong className="text-amber-400 font-mono text-[11px]">{filters.minFrp} MW</strong>
        </div>
        <input
          type="range"
          min="0"
          max="300"
          step="10"
          value={filters.minFrp}
          onChange={(e) => setFilters({ ...filters, minFrp: Number(e.target.value) })}
          className="w-full h-1 bg-[#161616] rounded appearance-none cursor-pointer accent-amber-500"
        />
      </div>

      {/* Min Hazard Score Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-blue-400" />
            <span>Min Score:</span>
          </span>
          <strong className="text-blue-400 font-mono text-[11px]">{filters.minScore}/100</strong>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={filters.minScore}
          onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) })}
          className="w-full h-1 bg-[#161616] rounded appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Hide Suppressed Flares Checkbox */}
      <label className="flex items-center gap-2 cursor-pointer bg-[#161616] border border-[#383838] p-2 rounded-lg text-[11px] text-slate-300 font-medium hover:border-slate-500 transition-colors">
        <input
          type="checkbox"
          checked={filters.hideSuppressed}
          onChange={(e) => setFilters({ ...filters, hideSuppressed: e.target.checked })}
          className="accent-red-500 rounded cursor-pointer"
        />
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Hide Routine Flares</span>
      </label>

      {/* Taxonomy Class Filter */}
      <div className="space-y-1.5 pt-1.5 border-t border-[#383838]">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>TAXONOMY CLASSES ({filters.categories.length}/6)</span>
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-[10px] hover:bg-[#161616] p-1 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFilters({ ...filters, categories: [...filters.categories, cat.id] });
                  } else {
                    setFilters({ ...filters, categories: filters.categories.filter(c => c !== cat.id) });
                  }
                }}
                className="accent-blue-600 rounded cursor-pointer"
              />
              <span className={`font-semibold ${cat.color}`}>{cat.label}</span>
            </label>
          ))}
        </div>
      </div>

    </div>
  );
}
