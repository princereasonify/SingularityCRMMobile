import { apiClient } from './client';

export type AiReportType = 'FoDaily' | 'FoWeekly' | 'FoMonthly' | 'ZhWeekly' | 'RhWeekly' | 'ShWeekly' | 'ScaWeekly';

export interface GenerateReportParams {
  type: AiReportType;
  foId?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const aiReportsApi = {
  getReports: (filters?: { dateFrom?: string; dateTo?: string; reportType?: string }) =>
    apiClient.get<any[]>('/ai-reports', { params: filters }),
  getReport: (id: number) =>
    apiClient.get<any>(`/ai-reports/${id}`),
  // Unified generate endpoint
  generate: (params: GenerateReportParams) =>
    apiClient.post<any>('/ai-reports/generate', undefined, { params }),
  // Legacy endpoints kept for backward compatibility
  generateMyDaily: (date?: string) =>
    apiClient.post<any>('/ai-reports/generate-my-daily', { date }),
  generateManagement: (dateFrom?: string, dateTo?: string) =>
    apiClient.post<any>('/ai-reports/generate-management', { dateFrom, dateTo }),
};
