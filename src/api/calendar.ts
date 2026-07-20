import { apiClient } from './client';
import { CalendarEvent, CreateCalendarEventRequest } from '../types';

export const calendarApi = {
  getEvents: (from: string, to: string) =>
    apiClient.get<CalendarEvent[]>('/calendar', { params: { from, to } }),
  create: (data: CreateCalendarEventRequest) =>
    apiClient.post<CalendarEvent>('/calendar', data),
  update: (id: number, data: Partial<CreateCalendarEventRequest>) =>
    apiClient.put<CalendarEvent>(`/calendar/${id}`, data),
  delete: (id: number) => apiClient.delete(`/calendar/${id}`),
  // NOTE: there is deliberately no `markComplete`. It PATCHed `/calendar/{id}/complete`,
  // which CalendarController does not declare (it has only GET, POST, PUT/{id},
  // DELETE/{id}), so every call 404'd into the caller's catch and the feature never
  // worked. Completion goes through `update(id, { isCompleted })`, which PUT binds.
};
