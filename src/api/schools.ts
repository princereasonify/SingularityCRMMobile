import { apiClient } from './client';
import { School, SchoolFilters, CreateSchoolRequest, PaginatedResult, DuplicateMatch, SchoolWithPriority } from '../types';

export const schoolsApi = {
  getAll: (filters?: SchoolFilters) =>
    apiClient.get<PaginatedResult<School>>('/schools', { params: filters }),
  getById: (id: number) => apiClient.get<School>(`/schools/${id}`),
  create: (data: CreateSchoolRequest) => apiClient.post<School>('/schools', data),
  update: (id: number, data: Partial<CreateSchoolRequest>) =>
    apiClient.put<School>(`/schools/${id}`, data),
  getNearby: (lat: number, lon: number, radiusMeters: number) =>
    apiClient.get<School[]>('/schools/nearby', { params: { lat, lon, radiusMeters } }),
  getVisitHistory: (id: number) =>
    apiClient.get<any[]>(`/schools/${id}/visit-history`),

  // Duplicate detection
  checkDuplicates: (name: string, city?: string, lat?: number, lon?: number) =>
    apiClient.post<DuplicateMatch[]>('/schools/check-duplicates', { name, city, lat, lon }),

  // Visit priority score
  getPriority: (filters?: SchoolFilters) =>
    apiClient.get<PaginatedResult<SchoolWithPriority>>('/schools/priority', { params: filters }),

  // School assignments (FO self-assign when creating)
  bulkAssign: (data: { userId: number; schoolIds: number[]; assignmentDate: string }) =>
    apiClient.post('/school-assignments/bulk', data),

  getMyAssignments: (date: string) =>
    apiClient.get<any[]>('/school-assignments/my', { params: { date } }),
};
