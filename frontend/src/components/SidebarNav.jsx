import React from 'react';
import { LayoutDashboard, Bell, Map, History, Settings, Menu, Flame, Radio } from 'lucide-react';

export default function SidebarNav({ 
  activePage, 
  setActivePage, 
  criticalCount = 3, 
  connectionStatus = 'connected',
  collapsed = false,
  onToggleCollapse
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'alerts', label: 'Live Alerts', icon: Bell, badge: criticalCount },
    { id: 'map', label: 'Satellite Map', icon: Map },
    { id: 'history', label: 'History & Trends', icon: History },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className={`bg-[#151A26] border-r border-[#262F40] flex flex-col justify-between shrink-0 h-screen sticky top-0 font-sans z-40 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      
      <div>
        {/* Brand & Collapse Header */}
        <div className="p-4 border-b border-[#262F40] flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black tracking-wider text-white uppercase font-mono leading-none truncate flex items-center gap-1">
                  🔥 FLAREFILTER
                </h1>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  Satellite Fire Intelligence
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer mx-auto"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!collapsed && <span>{item.label}</span>}
                </div>

                {!collapsed && item.badge > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-3 border-t border-[#262F40] bg-[#0B0E14]">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            {!collapsed && <span className="text-slate-300 font-mono text-[10px]">FastAPI Live</span>}
          </div>
          {!collapsed && <Radio className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </div>

    </aside>
  );
}
