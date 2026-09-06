import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchRealtimeHotspots = async (params = {}) => {
  const response = await apiClient.get('/api/hotspots/realtime', { params });
  return response.data;
};

export const fetchHotspotDetail = async (id) => {
  const response = await apiClient.get(`/api/hotspots/${id}`);
  return response.data;
};

export const fetchRefineries = async () => {
  const response = await apiClient.get('/api/refineries');
  return response.data;
};

export const fetchAnalyticsSummary = async () => {
  const response = await apiClient.get('/api/analytics/summary');
  return response.data;
};

export const fetchAnalyticsTrends = async () => {
  const response = await apiClient.get('/api/analytics/trends');
  return response.data;
};

export const downloadPdfReport = async (hotspotId) => {
  const url = `${API_BASE}/api/reports/pdf/${hotspotId}`;
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