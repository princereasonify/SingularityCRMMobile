import { apiClient } from './client';

export const expenseClaimsApi = {
  createClaim: (payload: {
    expenseDate: string;
    category: string;
    amount: number;
    description?: string;
  }) => apiClient.post<any>('/expense-claims', payload),

  getMyClaims: (params?: { status?: string; category?: string; from?: string; to?: string }) =>
    apiClient.get<any[]>('/expense-claims/my', { params }),

  getTeamClaims: (params?: { status?: string; category?: string; from?: string; to?: string }) =>
    apiClient.get<any[]>('/expense-claims/team', { params }),

  approveClaim: (id: number) =>
    apiClient.post<any>(`/expense-claims/${id}/approve`),

  rejectClaim: (id: number, payload: { rejectionReason: string }) =>
    apiClient.post<any>(`/expense-claims/${id}/reject`, payload),

  bulkApprove: (payload: { ids: number[] }) =>
    apiClient.post<any>('/expense-claims/bulk-approve', payload),
};
