import { apiClient } from './client';

/**
 * GeofenceController is [Route("api/[controller]")] → /geofence/*. This module
 * used to call /tracking/* , which TrackingController does not serve, so every
 * call 404'd. `sendEvent` and `getTodayVisits` are gone entirely — there is no
 * POST anywhere in GeofenceController and no "visits/today" route.
 * Mirrors web's geofenceService.
 */
export const geofenceApi = {
  getVisitLogs: (userId: number, date: string) =>
    apiClient.get<any[]>('/geofence/visits', { params: { userId, date } }),
  getVisitLogsBySession: (sessionId: number) =>
    apiClient.get<any[]>(`/geofence/visits/session/${sessionId}`),
  getGeofenceEvents: (sessionId: number) =>
    apiClient.get<any[]>(`/geofence/events/${sessionId}`),
  getTimeBreakdown: (sessionId: number) =>
    apiClient.get<any>(`/geofence/time-breakdown/${sessionId}`),
};
