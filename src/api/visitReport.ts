import { apiClient } from './client';
import { CreateVisitReportRequest, VisitField, CreateVisitFieldRequest } from '../types';

/**
 * `getByActivity` / `getBySchoolVisit` removed — VisitReportsController exposes
 * only `[HttpGet] GetVisitReports([FromQuery] int? userId, [FromQuery] string? date)`;
 * neither `visit-reports/activity/{id}` nor `visit-reports/visit/{id}` exists.
 */
export const visitReportApi = {
  getAll: (params?: { userId?: number; date?: string }) =>
    apiClient.get<any[]>('/visit-reports', { params }),
  create: (data: CreateVisitReportRequest) =>
    apiClient.post('/visit-reports', data),

  // Visit field configuration (SH admin)
  getFields: () => apiClient.get<VisitField[]>('/visit-reports/fields'),
  createField: (data: CreateVisitFieldRequest) =>
    apiClient.post<VisitField>('/visit-reports/fields', data),
  updateField: (id: number, data: Partial<CreateVisitFieldRequest>) =>
    apiClient.put<VisitField>(`/visit-reports/fields/${id}`, data),
  deleteField: (id: number) =>
    apiClient.delete(`/visit-reports/fields/${id}`),
};
