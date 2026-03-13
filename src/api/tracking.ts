import { apiClient } from './client';

export const trackingApi = {
  startDay: async () => {
    const { data } = await apiClient.post('/tracking/start-day');
    return data;
  },
  endDay: async () => {
    const { data } = await apiClient.post('/tracking/end-day');
    return data;
  },
  getTodaySession: async () => {
    const { data } = await apiClient.get('/tracking/session/today');
    return data;
  },
  sendPing: async (pingData: {
    latitude: number;
    longitude: number;
    accuracyMetres?: number;
    speedKmh?: number;
    altitudeMetres?: number;
    recordedAt?: string;
    provider?: string;
    isMocked?: boolean;
    batteryLevel?: number;
  }) => {
    const { data } = await apiClient.post('/tracking/ping', pingData);
    return data;
  },
  sendBatchPings: async (pings: Array<{
    latitude: number;
    longitude: number;
    accuracyMetres?: number;
    speedKmh?: number;
    altitudeMetres?: number;
    recordedAt?: string;
    provider?: string;
    isMocked?: boolean;
    batteryLevel?: number;
  }>) => {
    const { data } = await apiClient.post('/tracking/ping/batch', { pings });
    return data;
  },
  getLiveLocations: async () => {
    const { data } = await apiClient.get('/tracking/live-locations');
    return data;
  },
  getRoute: async (userId: number, date: string) => {
    const { data } = await apiClient.get(`/tracking/route/${userId}/${date}`);
    return data;
  },
  getAllowances: async (from: string, to: string) => {
    const { data } = await apiClient.get('/tracking/allowances', { params: { from, to } });
    return data;
  },
  approveAllowance: async (id: number, payload: { approved: boolean; remarks?: string }) => {
    const { data } = await apiClient.patch(`/tracking/allowances/${id}`, payload);
    return data;
  },
  getFraudReports: async (from: string, to: string) => {
    const { data } = await apiClient.get('/tracking/fraud-reports', { params: { from, to } });
    return data;
  },
};
