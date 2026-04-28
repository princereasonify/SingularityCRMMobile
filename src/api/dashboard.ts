import { apiClient } from './client';
import {
  FoDashboardDto,
  ZoneDashboardDto,
  RegionDashboardDto,
  NationalDashboardDto,
  ScaDashboardDto,
  FoPerformanceDto,
  UserPerformanceDto,
} from '../types';

export type DashboardPeriod = 'today' | 'week' | 'month';

export const dashboardApi = {
  getFODashboard: (period?: DashboardPeriod) =>
    apiClient.get<FoDashboardDto>('/dashboard/fo', { params: period ? { period } : undefined }),
  getZoneDashboard: (period?: DashboardPeriod) =>
    apiClient.get<ZoneDashboardDto>('/dashboard/zone', { params: period ? { period } : undefined }),
  getRegionDashboard: (period?: DashboardPeriod) =>
    apiClient.get<RegionDashboardDto>('/dashboard/region', { params: period ? { period } : undefined }),
  getNationalDashboard: (period?: DashboardPeriod) =>
    apiClient.get<NationalDashboardDto>('/dashboard/national', { params: period ? { period } : undefined }),
  getScaDashboard: (period?: DashboardPeriod) =>
    apiClient.get<ScaDashboardDto>('/dashboard/sca', { params: period ? { period } : undefined }),
  getTeamPerformance: () => apiClient.get<FoPerformanceDto[]>('/dashboard/team-performance'),
  getPerformanceTracking: () =>
    apiClient.get<UserPerformanceDto[]>('/dashboard/performance-tracking'),
  getReportableUsers: () => apiClient.get<any[]>('/dashboard/reportable-users'),
};
