import { apiClient } from '../client';

/** B2C travel/visit allowance claims — mirrors B2CAllowancesController.cs (base "api/b2c/allowances"). */
const BASE = '/b2c/allowances';

export interface SubmitAllowanceClaimBody {
  claimDate: string;
  visitCount: number;
  distanceKm: number;
  notes?: string;
}

export const b2cAllowanceService = {
  getConfig: () => apiClient.get<any>(`${BASE}/config`),
  submitClaim: (data: SubmitAllowanceClaimBody) => apiClient.post<any>(BASE, data),
  getMyClaims: (params?: any) => apiClient.get<any>(`${BASE}/mine`, { params }),
  // Admin review queue
  getClaims: (params?: any) => apiClient.get<any>(BASE, { params }),
  approve: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/approve`, { note }),
  reject: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/reject`, { note }),
  bulkApprove: (ids: number[]) => apiClient.post<any>(`${BASE}/bulk-approve`, { ids }),
};
