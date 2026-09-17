import React from 'react';
import { Flame, MapPin, BarChart3, FileText, Settings, Radio, Satellite } from 'lucide-react';

export default function SidebarNav({ 
  activePage, 
  setActivePage, 
  criticalCount = 0, 
  connectionStatus = 'connected',
  collapsed = false,
  onToggleCollapse
}) {
  const navItems = [
    { id: 'dashboard', label: 'Hotspots', icon: Flame },
    { id: 'map', label: 'Map View', icon: MapPin },
    { id: 'alerts', label: 'Analytics', icon: BarChart3 },
    { id: 'history', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`bg-[#242424] border-r border-[#383838] flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans z-40 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-56'
    }`}>
      
      <div>
        {/* Top Logo Bar */}
        <div className="p-4 border-b border-[#383838] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400 shrink-0">
              <Satellite className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-base font-black text-[#F5F5F5] tracking-wider font-mono">GEO-SCD</h1>
                <p className="text-[10px] font-semibold text-slate-400 leading-tight">Geospatial System</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = (activePage === item.id) || (activePage === 'dashboard' && item.id === 'dashboard');

            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#383838] text-white shadow-lg border border-[#4a4a4a]'
                    : 'text-slate-400 hover:text-[#F5F5F5] hover:bg-[#2c2c2c]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate tracking-wide">{item.label}</span>}
                </div>

                {!collapsed && item.id === 'alerts' && criticalCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded-full font-mono shadow-sm">
                    {criticalCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Forest Graphic & Branding */}
      {!collapsed ? (
        <div className="relative p-4 border-t border-[#383838] bg-[#1c1c1c] overflow-hidden group">
          {/* Glowing Red & Amber Fire Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-amber-600/30 via-red-600/15 to-transparent opacity-80 pointer-events-none" />
          
          {/* Pine Tree Silhouettes SVG Overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-16 opacity-40 pointer-events-none overflow-hidden">
            <svg viewBox="0 0 200 60" className="w-full h-full fill-[#161616]" preserveAspectRatio="none">
              {/* Layered Pine Trees */}
              <polygon points="10,60 25,20 40,60" />
              <polygon points="30,60 45,15 60,60" />
              <polygon points="50,60 62,30 74,60" />
              <polygon points="68,60 82,10 96,60" />
              <polygon points="90,60 102,25 114,60" />
              <polygon points="110,60 125,18 140,60" />
              <polygon points="135,60 148,28 161,60" />
              <polygon points="155,60 170,12 185,60" />
              <polygon points="178,60 190,32 202,60" />
            </svg>
          </div>

          <div className="relative z-10 space-y-1">
            <div className="text-xs font-bold text-slate-300 tracking-wider">From Space</div>
            <div className="text-xs font-bold text-cyan-400 font-mono tracking-tight">— to Ground</div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-[#383838] text-center">
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
        </div>
      )}

    </aside>
  );
}
