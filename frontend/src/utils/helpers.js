export function formatCoords(lat, lon) {
  if (lat === undefined || lon === undefined) return 'N/A';
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined) return 'Unknown';
  if (meters === 0) return 'Inside Facility Boundary';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function getRiskColor(score) {
  if (score >= 80) return 'text-tactical-red bg-tactical-red/10 border-tactical-red/30';
  if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-tactical-green bg-tactical-green/10 border-tactical-green/30';
}

export function getClassificationTheme(classification, classificationClass) {
  const code = classificationClass || '';
  if (code === '02' || classification === 'Potential Industrial Incident' || classification === 'Industrial Incident') {
    return {
      code: '02',
      badge: 'bg-red-500/10 text-red-400 border-red-500/50',
      marker: '#EF4444',
      label: 'Class 02 | Industrial Incident',
      glow: 'shadow-[inset_0_0_15px_rgba(239,68,68,0.2),0_0_10px_rgba(239,68,68,0.3)]'
    };
  }
  if (code === '01' || classification === 'Potential Industrial Thermal Source' || classification === 'Industrial Thermal Source' || classification === 'Industrial Source') {
    return {
      code: '01',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
      marker: '#10B981',
      label: 'Class 01 | Industrial Source',
      glow: 'shadow-[inset_0_0_15px_rgba(16,185,129,0.2),0_0_10px_rgba(16,185,129,0.3)]'
    };
  }
  if (code === '03' || classification === 'Forest Fire / Wildfire' || classification === 'Forest Fire') {
    return {
      code: '03',
      badge: 'bg-emerald-600/10 text-emerald-300 border-emerald-600/50',
      marker: '#059669',
      label: 'Class 03 | Forest Fire',
      glow: 'shadow-[inset_0_0_15px_rgba(5,150,105,0.2),0_0_10px_rgba(5,150,105,0.3)]'
    };
  }
  if (code === '04' || classification === 'Agricultural / Stubble Burning' || classification === 'Agricultural Fire') {
    return {
      code: '04',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/50',
      marker: '#F59E0B',
      label: 'Class 04 | Agricultural Fire',
      glow: 'shadow-[inset_0_0_15px_rgba(245,158,11,0.2),0_0_10px_rgba(245,158,11,0.3)]'
    };
  }
  if (code === '05' || classification === 'Mining Area / Coal Mine Fire' || classification === 'Mining Fire') {
    return {
      code: '05',
      badge: 'bg-slate-500/10 text-slate-300 border-slate-500/50',
      marker: '#6B7280',
      label: 'Class 05 | Mining Fire',
      glow: 'shadow-[inset_0_0_15px_rgba(107,114,128,0.2),0_0_10px_rgba(107,114,128,0.3)]'
    };
  }
  if (code === '06' || classification === 'Urban / Landfill Fire' || classification === 'Urban Fire') {
    return {
      code: '06',
      badge: 'bg-orange-600/10 text-orange-400 border-orange-600/50',
      marker: '#EA580C',
      label: 'Class 06 | Urban / Landfill Fire',
      glow: 'shadow-[inset_0_0_15px_rgba(234,88,12,0.2),0_0_10px_rgba(234,88,12,0.3)]'
    };
  }
  return {
    code: '01',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
    marker: '#10B981',
    label: 'Class 01 | Industrial Source',
    glow: 'shadow-[inset_0_0_15px_rgba(16,185,129,0.2),0_0_10px_rgba(16,185,129,0.3)]'
  };
}