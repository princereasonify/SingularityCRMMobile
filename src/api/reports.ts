import { apiClient } from './client';

/**
 * Mirrors SalesCRM.Core/DTOs/Reports/ReportDtos.cs `ReportFilters`, which every
 * ReportsController action binds as `[FromQuery] ReportFilters filters`.
 *
 * It previously declared `foId` and `period`: the C# type has neither (the user
 * key is `UserId`), so both were silently dropped — ASP.NET ignores unknown query
 * keys rather than erroring. Keep this in step with the C# class.
 *
 * NB `aiReportsApi` is a DIFFERENT surface: AIReportsController really does bind
 * `[FromQuery] int? foId`, so `foId` is correct there and wrong here.
 */
export interface ReportFilters {
  userId?: number;
  role?: string;
  zoneId?: number;
  regionId?: number;
  dateFrom?: string;
  dateTo?: string;
  leadStage?: string;
  activityType?: string;
}

/**
 * The four reports ReportsController actually serves. The previous version of
 * this file also exposed getReport/getExportUrl/monthly-performance/deal-aging/
 * conversion-funnel/territory-coverage/leaderboard/revenue-forecast/onboarding —
 * none of those routes exist in any controller, so every one was a guaranteed
 * 404. They are omitted rather than left as traps; add them back only alongside
 * the matching backend action.
 *
 * Nothing consumes this module today — ReportsScreen uses `aiReportsApi`.
 */
export const reportsApi = {
  getUserPerformance: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/user-performance', { params: filters }),
  getSchoolVisits: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/school-visits', { params: filters }),
  getPipeline: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/pipeline', { params: filters }),
  getLostDealAnalysis: (filters?: ReportFilters) =>
    apiClient.get<any>('/reports/lost-deals', { params: filters }),
};
