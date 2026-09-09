import { apiClient } from '../client';
import {
  B2CUsageReportDto,
  B2CUsageBreakdownDto,
  B2CUsageDetailDto,
  B2CUsageFeatureDto,
} from '../../types/b2c';

/**
 * Reasonify usage for the B2C students behind our leads.
 *
 * Every endpoint is scoped server-side to the caller's role — an agent's own students, a
 * manager's team's, everything for a counselor or admin. There is deliberately no "whose
 * data" parameter to pass: the server decides, and a 404 from the drill-downs means
 * "not yours or not there", which the UI must not try to distinguish.
 *
 * Dates are plain YYYY-MM-DD; Reasonify reads them as whole local days with an INCLUSIVE
 * end day. Omit both and the server defaults to the last 7 days.
 *
 * Mirrors Sales_CRM_Web/src/api/b2c/b2cUsageReportService.js so both clients ask for the
 * same things in the same shape.
 */

const BASE = '/b2c/usage-report';

export interface B2CUsageRange {
  startDate?: string;
  endDate?: string;
}

export const b2cUsageReportService = {
  getReport: (params: B2CUsageRange & { search?: string } = {}) =>
    apiClient.get<B2CUsageReportDto>(BASE, {
      params: { ...params, search: params.search || undefined },
    }),

  /** Day-by-day activity for one student — the expanded card's table. */
  getBreakdown: (
    studentId: string,
    params: B2CUsageRange & { page?: number; perPage?: number } = {},
  ) =>
    apiClient.get<B2CUsageBreakdownDto>(
      `${BASE}/users/${encodeURIComponent(studentId)}/breakdown`,
      { params: { page: 1, perPage: 10, ...params } },
    ),

  /** Topic + Session reports for one student — the View button's sheet. */
  getDetail: (studentId: string, params: B2CUsageRange = {}) =>
    apiClient.get<B2CUsageDetailDto>(
      `${BASE}/users/${encodeURIComponent(studentId)}/detail`,
      { params },
    ),

  /** Input sources + feature usage for one student — the expanded card's second half. */
  getFeatures: (studentId: string, params: B2CUsageRange = {}) =>
    apiClient.get<B2CUsageFeatureDto>(
      `${BASE}/users/${encodeURIComponent(studentId)}/features`,
      { params },
    ),
};
