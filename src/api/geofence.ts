import { apiClient } from './client';
import { GeofenceEventRequest, SchoolVisitLog, TimeBreakdown } from '../types';

export const geofenceApi = {
  sendEvent: (data: GeofenceEventRequest) =>
    apiClient.post('/tracking/geofence-event', data),
  getSchoolVisits: (sessionId: number) =>
    apiClient.get<SchoolVisitLog[]>(`/tracking/school-visits/${sessionId}`),
  getTimeBreakdown: (sessionId: number) =>
    apiClient.get<TimeBreakdown>(`/tracking/time-breakdown/${sessionId}`),
  getTodayVisits: () =>
    apiClient.get<SchoolVisitLog[]>('/tracking/school-visits/today'),
};
