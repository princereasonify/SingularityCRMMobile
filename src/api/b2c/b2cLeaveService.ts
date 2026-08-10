import { apiClient } from '../client';

/** B2C leave requests — mirrors B2CLeavesController.cs (base "api/b2c/leaves"). */
const BASE = '/b2c/leaves';

export interface SubmitLeaveBody { leaveType: string; fromDate: string; toDate: string; reason?: string; }

export const b2cLeaveService = {
  submit: (data: SubmitLeaveBody) => apiClient.post<any>(BASE, data),
  getMine: (params?: any) => apiClient.get<any>(`${BASE}/mine`, { params }),
  // Admin review queue
  getAll: (params?: any) => apiClient.get<any>(BASE, { params }),
  approve: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/approve`, { note }),
  reject: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/reject`, { note }),
  bulkApprove: (ids: number[]) => apiClient.post<any>(`${BASE}/bulk-approve`, { ids }),
  // Manager team queue
  getTeam: (params?: any) => apiClient.get<any>(`${BASE}/team`, { params }),
  teamApprove: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/team-approve`, { note }),
  teamReject: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/team-reject`, { note }),
};
