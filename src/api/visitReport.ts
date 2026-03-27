import { apiClient } from './client';
import { CreateVisitReportRequest, VisitField, CreateVisitFieldRequest } from '../types';

export const visitReportApi = {
  create: (data: CreateVisitReportRequest) =>
    apiClient.post('/visit-reports', data),
  getByActivity: (activityId: number) =>
    apiClient.get(`/visit-reports/activity/${activityId}`),
  getBySchoolVisit: (visitLogId: number) =>
    apiClient.get(`/visit-reports/visit/${visitLogId}`),

  // Visit field configuration (SH admin)
  getFields: () => apiClient.get<VisitField[]>('/visit-reports/fields'),
  createField: (data: CreateVisitFieldRequest) =>
    apiClient.post<VisitField>('/visit-reports/fields', data),
  updateField: (id: number, data: Partial<CreateVisitFieldRequest>) =>
    apiClient.put<VisitField>(`/visit-reports/fields/${id}`, data),
  deleteField: (id: number) =>
    apiClient.delete(`/visit-reports/fields/${id}`),
};
