import { apiClient } from './client';

export interface ReportFilters {
  from?: string;
  to?: string;
  zoneId?: number;
  regionId?: number;
  foId?: number;
  period?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export const reportsApi = {
  // Fetch report data (JSON) for in-app view
  getReport: (reportId: number, filters?: ReportFilters) =>
    apiClient.get<any>(`/reports/${reportId}`, { params: filters }),

  // Returns a download URL string for the export file
  getExportUrl: (reportId: number, format: 'pdf' | 'csv' | 'excel', filters?: ReportFilters) =>
    apiClient.get<{ url: string; filename: string }>(`/reports/${reportId}/export`, {
      params: { format, ...filters },
    }),

  // Specific well-typed endpoints
  getMonthlyPerformance: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/monthly-performance', { params: filters }),

  getDealAging: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/deal-aging', { params: filters }),

  getConversionFunnel: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/conversion-funnel', { params: filters }),

  getLostDealAnalysis: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/lost-deals', { params: filters }),

  getTerritoryCoverage: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/territory-coverage', { params: filters }),

  getTeamLeaderboard: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/leaderboard', { params: filters }),

  getRevenueForecast: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/revenue-forecast', { params: filters }),

  getOnboardingReport: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/onboarding', { params: filters }),
};
