import { apiClient } from '../client';

/** B2C start-my-day tracking — mirrors B2CTrackingController.cs (base "api/b2c/tracking"). */
const BASE = '/b2c/tracking';

export interface B2CPingBody {
  latitude: number;
  longitude: number;
  speedKmh?: number;
  accuracyMetres?: number;
  /** Client capture time (UTC ISO). Lets the server order offline/batched fixes correctly. */
  recordedAt?: string;
}

export const b2cTrackingService = {
  startDay: () => apiClient.post<any>(`${BASE}/start`),
  ping: (body: B2CPingBody) => apiClient.post<any>(`${BASE}/ping`, body),
  /** Flush offline-captured fixes together (order preserved server-side by recordedAt). */
  pingBatch: (pings: B2CPingBody[]) => apiClient.post<any>(`${BASE}/ping/batch`, { pings }),
  endDay: () => apiClient.post<any>(`${BASE}/end`),
  getMe: () => apiClient.get<any>(`${BASE}/me`),
  // Admin: everyone live now. Manager: own team live.
  getLive: () => apiClient.get<any[]>(`${BASE}/live`),
  getTeamLive: () => apiClient.get<any[]>(`${BASE}/team-live`),
  // A user's route for a date (admin/manager for team members, or self).
  getRoute: (userId: number, date: string) => apiClient.get<any>(`${BASE}/route/${userId}/${date}`),
};
