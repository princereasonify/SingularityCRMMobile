import { apiClient } from './client';

export const trackingApi = {
  startDay: () => apiClient.post('/tracking/start-day'),
  endDay: () => apiClient.post('/tracking/end-day'),
  getTodaySession: () => apiClient.get('/tracking/session/today'),
  sendPing: (data: {
    latitude: number;
    longitude: number;
    accuracyMetres?: number;
    speedKmh?: number;
    altitudeMetres?: number;
    recordedAt?: string;
    provider?: string;
    isMocked?: boolean;
    batteryLevel?: number;
  }) => apiClient.post('/tracking/ping', data),
  sendBatchPings: (pings: Array<{
    latitude: number;
    longitude: number;
    accuracyMetres?: number;
    speedKmh?: number;
    altitudeMetres?: number;
    recordedAt?: string;
    provider?: string;
    isMocked?: boolean;
    batteryLevel?: number;
  }>) => apiClient.post('/tracking/ping/batch', { pings }),
  getLiveLocations: () => apiClient.get('/tracking/live-locations'),
  getRoute: (userId: number, date: string) => apiClient.get(`/tracking/route/${userId}/${date}`),
  getAllowances: (from: string, to: string) => apiClient.get('/tracking/allowances', { params: { from, to } }),
  approveAllowance: (id: number, data: { approved: boolean; remarks?: string }) => apiClient.patch(`/tracking/allowances/${id}`, data),
  getFraudReports: (from: string, to: string) => apiClient.get('/tracking/fraud-reports', { params: { from, to } }),
};
