import { apiClient } from './client';
import { DemoAssignment, DemoFilters, CreateDemoRequest, PaginatedResult } from '../types';

export const demosApi = {
  getAll: (filters?: DemoFilters) =>
    apiClient.get<PaginatedResult<DemoAssignment>>('/demos', { params: filters }),
  getById: (id: number) => apiClient.get<DemoAssignment>(`/demos/${id}`),
  create: (data: CreateDemoRequest) => apiClient.post<DemoAssignment>('/demos', data),
  updateStatus: (id: number, status: string, outcome?: string, feedback?: string) =>
    apiClient.patch<DemoAssignment>(`/demos/${id}/status`, { status, outcome, feedback }),
  getCalendar: (from: string, to: string) =>
    apiClient.get<DemoAssignment[]>('/demos/calendar', { params: { from, to } }),
};
