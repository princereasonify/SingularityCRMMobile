import { apiClient } from './client';
import { School, SchoolFilters, CreateSchoolRequest, PaginatedResult } from '../types';

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
};
