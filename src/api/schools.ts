import { apiClient } from './client';
import { School, SchoolFilters, CreateSchoolRequest, PaginatedResult, DuplicateMatch, SchoolWithPriority, BulkUploadResult } from '../types';

/**
 * GET /schools actually returns `{ schools, total, page, limit }` — NOT the
 * `PaginatedResult` shape (`items`/`totalCount`). Verified in
 * SalesCRM.API/Controllers/SchoolsController.cs:
 *   return Ok(ApiResponse<object>.Ok(new { schools, total, page, limit }));
 * Typing it as PaginatedResult is what made a rebuild silently return 0 rows.
 * Note the query param is `limit`, not `pageSize`.
 */
export interface SchoolsListResult {
  schools: School[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Removed: getPriority (GET /schools/priority), checkDuplicates
 * (POST /schools/check-duplicates) and getVisitHistory
 * (GET /schools/{id}/visit-history) — none of those routes exist in
 * SchoolsController, so all three were guaranteed 404s. The duplicate check and
 * visit history failed silently into empty state, and the Priority filter could
 * only ever return zero schools. Add each back with its backend action.
 */
export const schoolsApi = {
  getAll: (filters?: SchoolFilters) =>
    apiClient.get<SchoolsListResult>('/schools', { params: filters }),
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
  // Controller binds `radiusKm` (default 5). Sending `radiusMeters` never bound,
  // so every call silently swept the 5km default.
  getNearby: (lat: number, lon: number, radiusKm: number) =>
    apiClient.get<School[]>('/schools/nearby', { params: { lat, lon, radiusKm } }),

  // Duplicate detection

  // Visit priority score

  deleteSchool: (id: number) => apiClient.delete(`/schools/${id}`),

  // School assignments (FO self-assign when creating)
  bulkAssign: (data: { userId: number; schoolIds: number[]; assignmentDate: string }) =>
    apiClient.post('/school-assignments/bulk', data),

  getMyAssignments: (date: string) =>
    apiClient.get<any[]>('/school-assignments/my', { params: { date } }),
};
