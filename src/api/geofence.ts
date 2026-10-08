import { apiClient } from './client';
import { SchoolVisitLog } from '../types';

/**
 * GeofenceController is [Route("api/[controller]")] → /geofence/*. This module
 * used to call /tracking/* , which TrackingController does not serve, so every
 * call 404'd. `sendEvent` and `getTodayVisits` are gone entirely — there is no
 * POST anywhere in GeofenceController and no "visits/today" route.
 * Mirrors web's geofenceService.
 */
export const geofenceApi = {
  getVisitLogs: (userId: number, date: string) =>
    apiClient.get<SchoolVisitLog[]>('/geofence/visits', { params: { userId, date } }),
  // GET /geofence/visits/school/{schoolId} — no query params; the server scopes
  // results to visits by the caller and people they manage (B2BScope.CanManage),
  // so a ZH viewing a school sees their own zone's visits, not the whole org's.
  // This is what SchoolDetailScreen's "Visit History" tab needed and never had.
  getVisitLogsBySchool: (schoolId: number) =>
    apiClient.get<SchoolVisitLog[]>(`/geofence/visits/school/${schoolId}`),
  getVisitLogsBySession: (sessionId: number) =>
    apiClient.get<SchoolVisitLog[]>(`/geofence/visits/session/${sessionId}`),
  getGeofenceEvents: (sessionId: number) =>
    apiClient.get<any[]>(`/geofence/events/${sessionId}`),
  getTimeBreakdown: (sessionId: number) =>
    apiClient.get<any>(`/geofence/time-breakdown/${sessionId}`),
};
