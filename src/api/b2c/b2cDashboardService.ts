import { apiClient } from '../client';
import {
  B2CAdminDashboardDto,
  B2CAgentDashboardDto,
  B2CCounselorDashboardDto,
} from '../../types/b2c';

/**
 * B2C dashboard API — routes mirror B2CDashboardController.cs (base "api/b2c/dashboard").
 * Each endpoint is role-gated server-side: admin → B2CAdmin, agent → Agent, counselor → Counselor.
 */

const BASE = '/b2c/dashboard';

export const b2cDashboardService = {
  getAdminDashboard: () => apiClient.get<B2CAdminDashboardDto>(`${BASE}/admin`),
  getAgentDashboard: () => apiClient.get<B2CAgentDashboardDto>(`${BASE}/agent`),
  getCounselorDashboard: () => apiClient.get<B2CCounselorDashboardDto>(`${BASE}/counselor`),
};
