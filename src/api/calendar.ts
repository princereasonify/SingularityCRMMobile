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
  markComplete: (id: number) =>
    apiClient.patch<CalendarEvent>(`/calendar/${id}/complete`),
};
