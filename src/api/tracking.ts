import { apiClient } from './client';

export const trackingApi = {
  startDay: () => apiClient.post('/tracking/start-day'),
  endDay: () => apiClient.post('/tracking/end-day'),
  getTodaySession: () => apiClient.get('/tracking/session/today'),
  sendPing: (data: { latitude: number; longitude: number; accuracy_metres?: number; speed_kmh?: number; altitude_metres?: number; recorded_at?: string }) =>
    apiClient.post('/tracking/ping', data),
  getLiveLocations: () => apiClient.get('/tracking/live-locations'),
  getRoute: (userId: number, date: string) => apiClient.get(`/tracking/route/${userId}/${date}`),
  getAllowances: (from: string, to: string) => apiClient.get('/tracking/allowances', { params: { from, to } }),
  approveAllowance: (id: number, data: { approved: boolean; remarks?: string }) => apiClient.patch(`/tracking/allowances/${id}`, data),
};
