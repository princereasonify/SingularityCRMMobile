import { apiClient } from './client';
import {
  FoDashboardDto,
  ZoneDashboardDto,
  RegionDashboardDto,
  NationalDashboardDto,
  FoPerformanceDto,
  UserPerformanceDto,
} from '../types';

export const dashboardApi = {
  getFODashboard: () => apiClient.get<FoDashboardDto>('/dashboard/fo'),
  getZoneDashboard: () => apiClient.get<ZoneDashboardDto>('/dashboard/zone'),
  getRegionDashboard: () => apiClient.get<RegionDashboardDto>('/dashboard/region'),
  getNationalDashboard: () => apiClient.get<NationalDashboardDto>('/dashboard/national'),
  getTeamPerformance: () => apiClient.get<FoPerformanceDto[]>('/dashboard/team-performance'),
  getPerformanceTracking: () =>
    apiClient.get<UserPerformanceDto[]>('/dashboard/performance-tracking'),
};
