import { apiClient } from './client';

export const aiReportsApi = {
  getReports: (filters?: { dateFrom?: string; dateTo?: string; reportType?: string }) =>
    apiClient.get<any[]>('/ai-reports', { params: filters }),
  getReport: (id: number) =>
    apiClient.get<any>(`/ai-reports/${id}`),
  generateMyDaily: (date?: string) =>
    apiClient.post<any>('/ai-reports/generate-my-daily', { date }),
  generateManagement: (dateFrom?: string, dateTo?: string) =>
    apiClient.post<any>('/ai-reports/generate-management', { dateFrom, dateTo }),
};
