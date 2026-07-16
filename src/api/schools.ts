import { apiClient } from './client';
import { School, SchoolFilters, CreateSchoolRequest, PaginatedResult, DuplicateMatch, SchoolWithPriority, BulkUploadResult } from '../types';

export const schoolsApi = {
  getAll: (filters?: SchoolFilters) =>
    apiClient.get<PaginatedResult<School>>('/schools', { params: filters }),
  getById: (id: number) => apiClient.get<School>(`/schools/${id}`),
  create: (data: CreateSchoolRequest) => apiClient.post<School>('/schools', data),

  // Bulk step 1 — upload an Excel/CSV; backend parses + geocodes, returns a preview.
  bulkUpload: (file: { uri: string; name: string; type: string }) => {
    const fd = new FormData();
    fd.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    return apiClient.post<BulkUploadResult>('/schools/bulk-upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Bulk step 2 — create the reviewed schools.
  bulkCreate: (schools: any[]) =>
    apiClient.post<{ created: number; skipped: number; schools: School[] }>('/schools/bulk', { schools }),
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

  deleteSchool: (id: number) => apiClient.delete(`/schools/${id}`),

  // School assignments (FO self-assign when creating)
  bulkAssign: (data: { userId: number; schoolIds: number[]; assignmentDate: string }) =>
    apiClient.post('/school-assignments/bulk', data),

  getMyAssignments: (date: string) =>
    apiClient.get<any[]>('/school-assignments/my', { params: { date } }),
};
