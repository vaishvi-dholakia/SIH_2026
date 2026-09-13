import axios from 'axios';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE,
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

export const fetchDashboardSummary = async () => {
  try {
    const response = await apiClient.get('/api/dashboard/summary');
    return response.data;
  } catch (e) {
    return { totalHotspots: 0, highRisk: 0, critical: 0, suppressed: 0 };
  }
};

export const fetchHotspotStats = async () => {
  try {
    const response = await apiClient.get('/api/hotspots/stats');
    return response.data;
  } catch (e) {
    return {
      total_active: 0,
      potential_emergencies: 0,
      operational_flares: 0,
      wildfires: 0,
      agricultural_fires: 0,
      mining_fires: 0,
      urban_fires: 0
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
    return response.data;
  } catch (e) {
    return [];
  }
};

export const fetchIncidentById = async (id) => {
  const response = await apiClient.get(`/api/incidents/${id}`);
  return response.data;
};

export const fetchIncidentHistory = async (id) => {
  try {
    const response = await apiClient.get(`/api/incidents/${id}/history`);
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

export const triggerBackfill = async (limit = 200) => {
  const response = await apiClient.post('/api/admin/backfill', null, { params: { limit } });
  return response.data;
};

export const syncOsmData = async () => {
  const response = await apiClient.post('/api/refineries/sync-osm');
  return response.data;
};