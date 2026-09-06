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
  if (score >= 70) return 'text-tactical-red bg-tactical-red/10 border-tactical-red/30';
  if (score >= 40) return 'text-tactical-amber bg-tactical-amber/10 border-tactical-amber/30';
  return 'text-tactical-green bg-tactical-green/10 border-tactical-green/30';
}

export function getClassificationTheme(classification) {
  switch (classification) {
    case 'Potential Industrial Incident':
      return {
        badge: 'bg-tactical-red/10 text-tactical-red border-tactical-red/50',
        marker: '#ff1744',
        label: 'CRITICAL DISASTER',
        glow: 'shadow-[inset_0_0_15px_rgba(255,23,68,0.2),0_0_10px_rgba(255,23,68,0.3)]'
      };
    case 'Potential Industrial Thermal Source':
      return {
        badge: 'bg-tactical-green/10 text-tactical-green border-tactical-green/50',
        marker: '#00e676',
        label: 'ROUTINE FLARE (SUPPRESSED)',
        glow: 'shadow-[inset_0_0_15px_rgba(0,230,118,0.2),0_0_10px_rgba(0,230,118,0.3)]'
      };
    case 'Non-Industrial Fire':
    default:
      return {
        badge: 'bg-tactical-amber/10 text-tactical-amber border-tactical-amber/50',
        marker: '#ff9100',
        label: 'NON-INDUSTRIAL / BIOMASS',
        glow: 'shadow-[inset_0_0_15px_rgba(255,145,0,0.2),0_0_10px_rgba(255,145,0,0.3)]'
      };
  }
}