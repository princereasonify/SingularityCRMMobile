import { apiClient } from '../client';

/** B2C travel/visit allowance claims — mirrors B2CAllowancesController.cs (base "api/b2c/allowances"). */
const BASE = '/b2c/allowances';

export interface SubmitAllowanceClaimBody {
  claimDate: string;
  visitCount: number;
  distanceKm: number;
  notes?: string;
}

// Verified field-for-field against B2CAllowanceDtos.cs.
export interface B2CAllowanceClaim {
  id: number;
  b2CUserId: number;
  userName: string;
  userRole: string;
  claimDate: string;
  visitCount: number;
  distanceKm: number;
  amount: number;
  notes?: string;
  status: string;
  reviewedById?: number;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: string;
}

export interface B2CAllowanceSummary {
  totalClaims: number;
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface B2CAllowanceClaimList {
  items: B2CAllowanceClaim[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: B2CAllowanceSummary;
}

export interface GetClaimsParams {
  page?: number;
  pageSize?: number;
  userId?: number;
  status?: string;
  from?: string;
  to?: string;
}

export const b2cAllowanceService = {
  getConfig: () => apiClient.get<any>(`${BASE}/config`),

  /** B2CAdmin only. Rates the daily allowance is computed from (per visit, per km, fixed). */
  updateConfig: (data: {
    ratePerVisit?: number;
    ratePerKm?: number;
    fixedDailyAmount?: number;
  }) => apiClient.put<any>(`${BASE}/config`, data),
  submitClaim: (data: SubmitAllowanceClaimBody) => apiClient.post<any>(BASE, data),
  getMyClaims: (params?: any) => apiClient.get<any>(`${BASE}/mine`, { params }),
  /**
   * Admin review queue (B2CAdmin only). Was fully wired here already — getClaims/approve/
   * reject/bulkApprove all exist and match the backend exactly — but no screen anywhere in
   * the app ever called them, so a B2CAdmin had no way to approve/reject allowance claims on
   * mobile at all. See B2CAllowanceApprovalsScreen.tsx.
   */
  getClaims: (params?: GetClaimsParams) => apiClient.get<B2CAllowanceClaimList>(BASE, { params }),
  approve: (id: number, note?: string) => apiClient.patch<B2CAllowanceClaim>(`${BASE}/${id}/approve`, { note }),
  reject: (id: number, note?: string) => apiClient.patch<B2CAllowanceClaim>(`${BASE}/${id}/reject`, { note }),
  bulkApprove: (ids: number[]) => apiClient.post<{ approved: number }>(`${BASE}/bulk-approve`, { ids }),
};
