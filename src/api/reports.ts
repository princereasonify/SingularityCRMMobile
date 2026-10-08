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

// Field names/casing verified against ReportDtos.cs (C# PascalCase → camelCase JSON,
// same convention every other typed DTO in this app already follows).
export interface UserPerformanceDto {
  userId: number;
  name: string;
  role: string;
  totalVisits: number;
  totalDemos: number;
  totalDeals: number;
  totalRevenue: number;
  totalDistanceKm: number;
  totalAllowance: number;
  avgVisitDurationMinutes: number;
  schoolsVisited: number;
  conversionRate: number;
}

export interface SchoolVisitSummaryDto {
  schoolId: number;
  schoolName: string;
  city?: string;
  totalVisits: number;
  totalTimeSpentMinutes: number;
  avgVisitDurationMinutes: number;
  uniqueVisitors: number;
  lastVisitDate?: string;
  lastOutcome?: string;
}

export interface PipelineReportDto {
  stage: string;
  count: number;
  totalValue: number;
  avgAgeDays: number;
}

export interface LostDealItemDto {
  leadId: number;
  school: string;
  city: string;
  value: number;
  lossReason: string;
  foId: number;
  foName: string;
  zoneId?: number;
  zoneName?: string;
  closeDate?: string;
}

export interface LostDealReasonGroupDto { reason: string; count: number; totalValue: number; }
export interface LostDealFoGroupDto { foId: number; foName: string; count: number; totalValue: number; }
export interface LostDealZoneGroupDto { zoneId?: number; zoneName: string; count: number; totalValue: number; }

export interface LostDealAnalysisDto {
  totalLost: number;
  totalLostValue: number;
  byReason: LostDealReasonGroupDto[];
  byFo: LostDealFoGroupDto[];
  byZone: LostDealZoneGroupDto[];
  deals: LostDealItemDto[];
}

/**
 * The four reports ReportsController actually serves. The previous version of
 * this file also exposed getReport/getExportUrl/monthly-performance/deal-aging/
 * conversion-funnel/territory-coverage/leaderboard/revenue-forecast/onboarding —
 * none of those routes exist in any controller, so every one was a guaranteed
 * 404. They are omitted rather than left as traps; add them back only alongside
 * the matching backend action.
 *
 * All four 403 for FO (ReportsController.IsManager) — reachable by ZH/RH/SH/SCA
 * only. ZH/RH additionally get their filters pinned server-side to their own
 * zone/region (ScopeFiltersAsync) regardless of what's requested.
 *
 * Consumed by ReportsLibraryScreen (src/screens/reports/ReportsLibraryScreen.tsx).
 */
export const reportsApi = {
  getUserPerformance: (filters?: ReportFilters) =>
    apiClient.get<UserPerformanceDto[]>('/reports/user-performance', { params: filters }),
  getSchoolVisits: (filters?: ReportFilters) =>
    apiClient.get<SchoolVisitSummaryDto[]>('/reports/school-visits', { params: filters }),
  getPipeline: (filters?: ReportFilters) =>
    apiClient.get<PipelineReportDto[]>('/reports/pipeline', { params: filters }),
  getLostDealAnalysis: (filters?: ReportFilters) =>
    apiClient.get<LostDealAnalysisDto>('/reports/lost-deals', { params: filters }),
};
