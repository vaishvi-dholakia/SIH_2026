import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Activity, BarChart2 } from 'lucide-react';

export default function ThermalAnalytics({ trends, summary }) {
  const trendData = trends?.daily_trends?.map((item) => ({
    date: item.date || item.detection_date,
    avgFrp: item.average_frp || item.avg_frp || 4.2,
    count: item.count || item.hotspot_count || 1,
  })) || [
    { date: '2026-08-30', avgFrp: 3.8, count: 12 },
    { date: '2026-08-31', avgFrp: 4.1, count: 18 },
    { date: '2026-09-01', avgFrp: 3.9, count: 24 },
    { date: '2026-09-02', avgFrp: 5.2, count: 45 },
    { date: '2026-09-03', avgFrp: 4.0, count: 227 }
  ];

  const classifications = summary?.classifications || [
    { name: 'Non-Industrial Fire', count: 227 },
    { name: 'Potential Industrial Incident', count: 0 },
    { name: 'Potential Industrial Thermal Source', count: 0 }
  ];

  // Tactical Colors: Amber (Biomass), Red (Incident), Green (Flare)
  const COLORS = ['#ff9100', '#ff1744', '#00e676'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      
      <div className="lg:col-span-2 glass-panel p-4 rounded-sm border border-command-border">
        <div className="flex items-center justify-between mb-4 border-b border-command-border pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-tactical-cyan" />
            <h3 className="text-[13px] font-bold font-mono text-white uppercase tracking-wider">THERMAL ENERGY EMISSION TREND (FRP MW)</h3>
          </div>
          <span className="text-[10px] font-mono text-tactical-gray uppercase tracking-wider">30-Day Satellite History</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="frpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#33312e" />
              <XAxis dataKey="date" stroke="#8f939c" tick={{ fontSize: 10, fill: '#8f939c', fontFamily: 'monospace' }} />
              <YAxis stroke="#8f939c" tick={{ fontSize: 10, fill: '#8f939c', fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{ background: '#121110', borderColor: '#00e5ff', borderRadius: '0px', color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#00e5ff' }}
              />
              <Area type="monotone" dataKey="avgFrp" stroke="#00e5ff" strokeWidth={2} fillOpacity={1} fill="url(#frpGradient)" name="Avg Energy (MW)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel p-4 rounded-sm border border-command-border">
        <div className="flex items-center justify-between mb-4 border-b border-command-border pb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-tactical-gold" />
            <h3 className="text-[13px] font-bold font-mono text-white uppercase tracking-wider">AI INCIDENT DISTRIBUTION</h3>
          </div>
        </div>

        <div className="h-48 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={classifications}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="count"
                stroke="none"
              >
                {classifications.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#121110', borderColor: '#ffb300', borderRadius: '0px', color: '#fff', fontSize: '11px', fontFamily: 'monospace' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-1.5 pt-2 font-mono text-[10px] uppercase tracking-wider">
          {classifications.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span>{item.name}</span>
              </span>
              <span className="font-bold text-white">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}