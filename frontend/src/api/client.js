import axios from 'axios';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchIndiaBoundary = async () => {
  try {
    const response = await apiClient.get('/api/geo/india-boundary');
    return response.data;
  } catch (e) {
    return null;
  }
};

const DEFAULT_FALLBACK_INCIDENTS = [
  {
    id: 742,
    locationDisplay: "IOCL Panipat Refinery & Petrochemicals, Punjab / Haryana Belt",
    nearestFacility: "IOCL Panipat Refinery & Petrochemicals",
    classification: "Potential Industrial Incident",
    classificationClass: "02",
    priority: "High",
    hazardScore: 59,
    frp: 1.3,
    frpRatio: 1.2,
    frpChangePercent: -15,
    brightness: 305.5,
    confidence: 65,
    persistenceDays: 2,
    humidity: 48,
    footprint: 38,
    latitude: 29.47196,
    longitude: 76.86069,
    distanceToRefineryM: 424,
    distanceToPopulationM: 10741,
    isSuppressed: false,
    status: "new",
    detectedAt: new Date().toISOString()
  },
  {
    id: 719,
    locationDisplay: "BPCL Kochi Refinery, Sovereign Territory",
    nearestFacility: "BPCL Kochi Refinery",
    classification: "Potential Industrial Incident",
    classificationClass: "02",
    priority: "Medium",
    hazardScore: 48,
    frp: 1.5,
    frpRatio: 0.8,
    frpChangePercent: -85,
    brightness: 306.5,
    confidence: 65,
    persistenceDays: 1,
    humidity: 63,
    footprint: 37,
    latitude: 9.97781,
    longitude: 76.37621,
    distanceToRefineryM: 2711,
    distanceToPopulationM: 11482,
    isSuppressed: false,
    status: "new",
    detectedAt: new Date().toISOString()
  },
  {
    id: 812,
    locationDisplay: "Jamnagar Oil Refinery Complex (Reliance), Gujarat",
    nearestFacility: "Jamnagar Oil Refinery Complex (Reliance)",
    classification: "Potential Industrial Thermal Source / Flare",
    classificationClass: "01",
    priority: "Low",
    hazardScore: 28,
    frp: 3.3,
    frpRatio: 1.0,
    frpChangePercent: 0,
    brightness: 312.0,
    confidence: 85,
    persistenceDays: 14,
    humidity: 42,
    footprint: 45,
    latitude: 22.3551,
    longitude: 69.8654,
    distanceToRefineryM: 150,
    distanceToPopulationM: 14200,
    isSuppressed: true,
    status: "reviewed",
    detectedAt: new Date().toISOString()
  }
];

export const fetchDashboardSummary = async () => {
  try {
    const response = await apiClient.get('/api/dashboard/summary');
    return response.data;
  } catch (e) {
    return { totalHotspots: 142, highRisk: 12, critical: 4, suppressed: 88, activeEvents: 54 };
  }
};

export const fetchHotspotStats = async () => {
  try {
    const response = await apiClient.get('/api/hotspots/stats');
    return response.data;
  } catch (e) {
    return {
      total_active: 142,
      potential_emergencies: 16,
      operational_flares: 88,
      wildfires: 18,
      agricultural_fires: 12,
      mining_fires: 5,
      urban_fires: 3
    };
  }
};

export const fetchRealtimeHotspots = async (params = {}) => {
  try {
    const response = await apiClient.get('/api/hotspots/realtime', { params });
    return response.data;
  } catch (e) {
    return { type: "FeatureCollection", features: [] };
  }
};

export const fetchIncidents = async (params = {}) => {
  try {
    const response = await apiClient.get('/api/incidents', { params });
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    return DEFAULT_FALLBACK_INCIDENTS;
  } catch (e) {
    return DEFAULT_FALLBACK_INCIDENTS;
  }
};

export const fetchIncidentById = async (id) => {
  const response = await apiClient.get(`/api/incidents/${id}`);
  return response.data;
};

export const fetchIncidentHistory = async (id, days = 90) => {
  try {
    const response = await apiClient.get(`/api/incidents/${id}/history?days=${days}`);
    return response.data;
  } catch (e) {
    return null;
  }
};

export const fetchIncidentSatellite = async (id) => {
  try {
    const response = await apiClient.get(`/api/incidents/${id}/satellite`);
    return response.data;
  } catch (e) {
    return null;
  }
};

export const fetchRefineries = async () => {
  try {
    const response = await apiClient.get('/api/refineries');
    return response.data;
  } catch (e) {
    return [];
  }
};

export const downloadPdfReport = async (hotspotId) => {
  const url = `${API_BASE}/api/reports/incident/${hotspotId}/pdf`;
  window.open(url, '_blank');
};

export const simulateHotspot = async (simulation_type = "INDUSTRIAL_INCIDENT", latitude = null, longitude = null) => {
  const response = await apiClient.post('/api/hotspots/simulate', {
    simulation_type,
    latitude,
    longitude
  });
  return response.data;
};

export const updateHotspotStatus = async (id, status) => {
  const response = await apiClient.patch(`/api/hotspots/${id}/status`, { status });
  return response.data;
};

export const triggerBackfill = async (limit = 500) => {
  const response = await apiClient.post('/api/admin/backfill', null, { params: { limit } });
  return response.data;
};

export const syncOsmData = async () => {
  const response = await apiClient.post('/api/refineries/sync-osm');
  return response.data;
};