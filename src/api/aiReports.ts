import { apiClient } from './client';

export const aiReportsApi = {
  getReports: (filters?: { dateFrom?: string; dateTo?: string; reportType?: string }) =>
    apiClient.get<any[]>('/ai-reports', { params: filters }),
  getReport: (id: number) =>
    apiClient.get<any>(`/ai-reports/${id}`),
};
