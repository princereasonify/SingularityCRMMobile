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

export const dashboardApi = {
  getFODashboard: () => apiClient.get<FoDashboardDto>('/dashboard/fo'),
  getZoneDashboard: () => apiClient.get<ZoneDashboardDto>('/dashboard/zone'),
  getRegionDashboard: () => apiClient.get<RegionDashboardDto>('/dashboard/region'),
  getNationalDashboard: () => apiClient.get<NationalDashboardDto>('/dashboard/national'),
  getScaDashboard: () => apiClient.get<ScaDashboardDto>('/dashboard/sca'),
  getTeamPerformance: () => apiClient.get<FoPerformanceDto[]>('/dashboard/team-performance'),
  getPerformanceTracking: () =>
    apiClient.get<UserPerformanceDto[]>('/dashboard/performance-tracking'),
};
