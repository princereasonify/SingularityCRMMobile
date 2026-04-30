import { apiClient } from './client';

const log = (label: string, payload?: any, response?: any) => {
  if (payload !== undefined) {
    console.log(`[Tracking] ${label} payload:`, JSON.stringify(payload, null, 2));
  }
  if (response !== undefined) {
    console.log(`[Tracking] ${label} response:`, JSON.stringify(response, null, 2));
  }
};

export const trackingApi = {
  startDay: async () => {
    log('startDay');
    const res = await apiClient.post('/tracking/start-day');
    log('startDay', undefined, res.data);
    return res;
  },

  endDay: async () => {
    log('endDay');
    const res = await apiClient.post('/tracking/end-day');
    log('endDay', undefined, res.data);
    return res;
  },

  getTodaySession: async () => {
    log('getTodaySession');
    const res = await apiClient.get('/tracking/session/today');
    log('getTodaySession', undefined, res.data);
    return res;
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
    log('sendPing', pingData);
    const res = await apiClient.post('/tracking/ping', pingData);
    log('sendPing', undefined, res.data);
    return res;
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
    const payload = { pings };
    log('sendBatchPings', payload);
    const res = await apiClient.post('/tracking/ping/batch', payload);
    log('sendBatchPings', undefined, res.data);
    return res;
  },

  getLiveLocations: async (managerId?: number) => {
    const params: any = {};
    if (managerId != null) params.managerId = managerId;
    log('getLiveLocations', Object.keys(params).length ? params : undefined);
    const res = await apiClient.get('/tracking/live-locations', { params });
    log('getLiveLocations', undefined, res.data);
    return res;
  },

  getRoute: async (userId: number, date: string) => {
    const payload = { userId, date };
    log('getRoute', payload);
    const res = await apiClient.get(`/tracking/route/${userId}/${date}`);
    log('getRoute', undefined, res.data);
    return res;
  },

  getAllowances: async (from: string, to: string, userId?: string) => {
    const params: any = { from, to };
    if (userId) params.userId = userId;
    log('getAllowances', params);
    const res = await apiClient.get('/tracking/allowances', { params });
    log('getAllowances', undefined, res.data);
    return res;
  },

  approveAllowance: async (id: number, payload: { approved: boolean; remarks?: string }) => {
    log('approveAllowance', { id, ...payload });
    const res = await apiClient.patch(`/tracking/allowances/${id}`, payload);
    log('approveAllowance', undefined, res.data);
    return res;
  },

  bulkApproveAllowances: async (payload: { ids: number[]; approved: boolean }) => {
    log('bulkApproveAllowances', payload);
    const res = await apiClient.post('/tracking/allowances/bulk-approve', payload);
    log('bulkApproveAllowances', undefined, res.data);
    return res;
  },

  getFraudReports: async (from: string, to: string) => {
    const payload = { from, to };
    log('getFraudReports', payload);
    const res = await apiClient.get('/tracking/fraud-reports', { params: { from, to } });
    log('getFraudReports', undefined, res.data);
    return res;
  },
};
