import { apiClient } from './client';

const log = (label: string, payload?: any, response?: any) => {
  if (payload !== undefined) {
    console.log(`[Tracking] ${label} payload:`, JSON.stringify(payload, null, 2));
  }
  if (response !== undefined) {
    console.log(`[Tracking] ${label} response:`, JSON.stringify(response, null, 2));
  }
};

/** VehicleType enum values the backend parses (SalesCRM.Core/Enums/VehicleType.cs). */
export type VehicleType = 'TwoWheeler' | 'FourWheeler' | 'PublicTransport' | 'Other';

export const trackingApi = {
  /**
   * The FO's allowance rate is derived from the vehicle, so this MUST send one:
   * TrackingController.StartDay binds `StartDayRequest { string? VehicleType }`
   * and web posts `{ vehicleType }`. This used to post no body at all, so mobile
   * FOs started their day with no vehicle set — a real money bug.
   */
  startDay: async (vehicleType?: VehicleType) => {
    const payload = { vehicleType: vehicleType ?? null };
    log('startDay', payload);
    const res = await apiClient.post('/tracking/start-day', payload);
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

  /**
   * TrackingController.GetLiveLocations binds `[FromQuery] string? role` — a ROLE,
   * not a user id. This used to take `managerId` and send `params.managerId`, which
   * the controller never bound, so the filter silently did nothing. Web sends
   * `{ role: filterRole }`; there is no per-manager filter server-side.
   */
  getLiveLocations: async (filterRole?: string) => {
    const params: any = {};
    if (filterRole) params.role = filterRole;
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

  // Controller binds `[FromQuery] int? filterUserId` (web sends the same). This
  // used to send `userId`, which never bound — the member filter did nothing.
  getAllowances: async (from: string, to: string, filterUserId?: number | string) => {
    const params: any = { from, to };
    if (filterUserId) params.filterUserId = filterUserId;
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
