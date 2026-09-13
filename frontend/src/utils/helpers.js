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

export function getClassificationTheme(classification) {
  switch (classification) {
    case 'Potential Industrial Incident':
      return {
        badge: 'bg-tactical-red/10 text-tactical-red border-tactical-red/50',
        marker: '#ff1744',
        label: 'CRITICAL INDUSTRIAL INCIDENT',
        glow: 'shadow-[inset_0_0_15px_rgba(255,23,68,0.2),0_0_10px_rgba(255,23,68,0.3)]'
      };
    case 'Potential Industrial Thermal Source':
      return {
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50',
        marker: '#10b981',
        label: 'ROUTINE INDUSTRIAL FLARE',
        glow: 'shadow-[inset_0_0_15px_rgba(16,185,129,0.2),0_0_10px_rgba(16,185,129,0.3)]'
      };
    case 'Forest Fire / Wildfire':
      return {
        badge: 'bg-green-500/10 text-green-400 border-green-500/50',
        marker: '#22c55e',
        label: 'FOREST FIRE / WILDFIRE',
        glow: 'shadow-[inset_0_0_15px_rgba(34,197,94,0.2),0_0_10px_rgba(34,197,94,0.3)]'
      };
    case 'Agricultural / Stubble Burning':
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/50',
        marker: '#f59e0b',
        label: 'AGRICULTURAL / STUBBLE',
        glow: 'shadow-[inset_0_0_15px_rgba(245,158,11,0.2),0_0_10px_rgba(245,158,11,0.3)]'
      };
    case 'Mining Area / Coal Mine Fire':
      return {
        badge: 'bg-purple-500/10 text-purple-400 border-purple-500/50',
        marker: '#a855f7',
        label: 'COAL MINE FIRE',
        glow: 'shadow-[inset_0_0_15px_rgba(168,85,247,0.2),0_0_10px_rgba(168,85,247,0.3)]'
      };
    case 'Urban / Landfill Fire':
      return {
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/50',
        marker: '#f43f5e',
        label: 'URBAN / LANDFILL FIRE',
        glow: 'shadow-[inset_0_0_15px_rgba(244,63,94,0.2),0_0_10px_rgba(244,63,94,0.3)]'
      };
    case 'Open Region Thermal Anomaly':
    case 'Non-Industrial Fire':
    default:
      return {
        badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50',
        marker: '#06b6d4',
        label: 'OPEN REGION ANOMALY',
        glow: 'shadow-[inset_0_0_15px_rgba(6,182,212,0.2),0_0_10px_rgba(6,182,212,0.3)]'
      };
  }
}