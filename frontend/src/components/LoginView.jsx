import React, { useState } from 'react';
import { Shield, Lock, User, Radio, ArrowRight, UserPlus, Mail, Building, AlertCircle } from 'lucide-react';

export default function LoginView({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regMsg, setRegMsg] = useState('');

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const u = username.trim().toLowerCase();
      if ((u === 'admin' && (password === 'admin123' || password === 'admin')) || (u.length > 0 && password.length > 0)) {
        onLoginSuccess({
          username: username.trim(),
          name: 'Admin Officer',
          role: 'NTRO Lead Operator',
          badge: 'PS-26162'
        });
      } else {
        setError('Invalid credentials. Use admin / admin123');
        setLoading(false);
      }
    }, 300);
  };

  const handleRegister = (e) => {
    if (e) e.preventDefault();
    setRegMsg('Registration is restricted to authorized NTRO personnel. Please log in with default admin credentials.');
  };

  return (
    <div className="min-h-screen bg-[#161616] text-[#F5F5F5] flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      
      {/* Dynamic Background: Space Orbiting Satellite & Global Constellation Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
        
        {/* Ambient Radial Color Glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl" />
        
        {/* Full Viewport Satellite & Orbital Vector Artwork */}
        <svg viewBox="0 0 1200 800" className="w-full h-full object-cover" preserveAspectRatio="xMidYMid slice">
          <defs>
            {/* Real Multispectral Scanner Sensor Cone Gradient */}
            <linearGradient id="orbitBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.0" />
            </linearGradient>
            
            {/* Real Earth Upper Atmosphere Rayleigh Azure Glow */}
            <radialGradient id="earthAtmosphereGlow" cx="50%" cy="100%" r="85%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
              <stop offset="40%" stopColor="#0369a1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#161616" stopOpacity="0.95" />
            </radialGradient>

            {/* Satellite Gold Kapton Thermal Foil Gradient */}
            <linearGradient id="kaptonGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#383838" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
            </pattern>
          </defs>
          
          {/* Technical Mesh Grid Overlay */}
          <rect width="100%" height="100%" fill="url(#gridPattern)" />

          {/* Deep Space Constellation Nodes & Connecting Rays */}
          <g opacity="0.35">
            <line x1="150" y1="120" x2="320" y2="220" stroke="#38bdf8" strokeWidth="0.8" />
            <line x1="320" y1="220" x2="480" y2="140" stroke="#38bdf8" strokeWidth="0.8" />
            <line x1="480" y1="140" x2="700" y2="180" stroke="#38bdf8" strokeWidth="0.8" />
            <line x1="700" y1="180" x2="950" y2="100" stroke="#38bdf8" strokeWidth="0.8" />
            
            <circle cx="150" cy="120" r="3" fill="#7dd3fc" />
            <circle cx="320" cy="220" r="4" fill="#F59E0B" />
            <circle cx="480" cy="140" r="3" fill="#0284c7" />
            <circle cx="700" cy="180" r="5" fill="#38bdf8" />
            <circle cx="950" cy="100" r="3" fill="#F59E0B" />
          </g>

          {/* Elliptical Satellite Orbit Track Lines */}
          <g transform="translate(600, 420)">
            <ellipse cx="0" cy="0" rx="450" ry="160" fill="none" stroke="#0284c7" strokeWidth="1" opacity="0.35" />
            <ellipse cx="0" cy="0" rx="320" ry="100" fill="none" stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.4" />
          </g>

          {/* Curved Earth Limb with Atmosphere Azure Glow */}
          <path d="M -200 680 Q 600 480 1400 680 L 1400 900 L -200 900 Z" fill="url(#earthAtmosphereGlow)" stroke="#38bdf8" strokeWidth="1.8" opacity="0.9" />
          {/* Earth Grid Latitude Arcs */}
          <path d="M -100 640 Q 600 520 1300 640" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.35" />
          <path d="M -100 700 Q 600 580 1300 700" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.25" />

          {/* Primary Orbiting Satellite (ISRO / NASA Realistic Gold Kapton Foil & Solar Panels) */}
          <g transform="translate(780, 290) rotate(-25)">
            {/* Multispectral Downward Sensor Scanner Cone */}
            <polygon points="0,0 -80,-300 80,-300" fill="url(#orbitBeamGrad)" opacity="0.75" />

            <line x1="-70" y1="0" x2="70" y2="0" stroke="#F59E0B" strokeWidth="2.5" />
            
            {/* Left Solar Panel Array */}
            <rect x="-65" y="-12" width="50" height="24" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.2" rx="2" />
            <line x1="-40" y1="-12" x2="-40" y2="12" stroke="#7dd3fc" strokeWidth="0.6" />
            <line x1="-15" y1="-12" x2="-15" y2="12" stroke="#7dd3fc" strokeWidth="0.6" />

            {/* Right Solar Panel Array */}
            <rect x="15" y="-12" width="50" height="24" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.2" rx="2" />
            <line x1="40" y1="-12" x2="40" y2="12" stroke="#7dd3fc" strokeWidth="0.6" />
            <line x1="60" y1="-12" x2="60" y2="12" stroke="#7dd3fc" strokeWidth="0.6" />

            {/* Main Satellite Bus Body (Gold Kapton Foil Layer) */}
            <rect x="-15" y="-15" width="30" height="30" fill="url(#kaptonGold)" stroke="#F59E0B" strokeWidth="1.5" rx="4" />
            <circle cx="0" cy="0" r="5" fill="#00e5ff" className="animate-ping" />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />

            {/* Sensor Optical Lens & Parabolic Antenna Dish */}
            <path d="M 0 16 L 0 28 M -12 28 Q 0 36 12 28" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
            <circle cx="0" cy="34" fill="#38bdf8" r="2.5" />
          </g>

          {/* Secondary CubeSat Satellite in Orbit */}
          <g transform="translate(320, 220) rotate(15)">
            <rect x="-15" y="-6" width="12" height="12" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" rx="1" />
            <rect x="3" y="-6" width="12" height="12" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" rx="1" />
            <rect x="-3" y="-8" width="6" height="16" fill="url(#kaptonGold)" stroke="#F59E0B" strokeWidth="1" rx="1" />
            <circle cx="0" cy="0" r="2" fill="#67e8f9" className="animate-ping" />
          </g>

        </svg>

      </div>

      {/* Main Auth Card Container */}
      <div className="max-w-md w-full bg-[#242424] border border-[#383838] rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Top Logo & System Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/20 border border-blue-500/40 rounded-2xl text-cyan-400 mb-1 shadow-lg">
            <Radio className="w-8 h-8 animate-pulse text-cyan-400" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-black text-[#F5F5F5] uppercase tracking-wider font-mono">
              GEO-SCD
            </h1>
            <p className="text-xs text-cyan-400 font-bold font-mono tracking-tight">
              GEOSPATIAL EARLY WARNING & RESPONSE SYSTEM
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#161616] border border-[#383838] rounded-full text-[11px] font-semibold text-slate-400 mt-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>National Technical Research Organisation (NTRO)</span>
          </div>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div className="flex items-center bg-[#161616] p-1 rounded-xl border border-[#383838] font-bold text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); setRegMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[#383838] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(''); setRegMsg(''); }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-[#383838] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* TAB 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-semibold text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#161616] border border-[#383838] rounded-xl text-sm text-[#F5F5F5] font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#161616] border border-[#383838] rounded-xl text-sm text-[#F5F5F5] font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#383838] hover:bg-[#4a4a4a] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Logging In...</span>
              ) : (
                <>
                  <span>LOGIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            
            {regMsg && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-semibold text-center flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{regMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full pl-10 pr-4 py-2 bg-[#161616] border border-[#383838] rounded-xl text-sm text-[#F5F5F5] placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Official Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="operator@ntro.gov.in"
                  className="w-full pl-10 pr-4 py-2 bg-[#161616] border border-[#383838] rounded-xl text-sm text-[#F5F5F5] placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Create Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="Create password"
                  className="w-full pl-10 pr-4 py-2 bg-[#161616] border border-[#383838] rounded-xl text-sm text-[#F5F5F5] placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#383838] hover:bg-[#4a4a4a] text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>SUBMIT REGISTRATION</span>
            </button>
          </form>
        )}

      </div>

    </div>
  );
}
