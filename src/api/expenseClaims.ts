import { apiClient } from './client';

export const expenseClaimsApi = {
  /**
   * ExpenseClaimsController.CreateClaim binds `[FromForm] CreateExpenseClaimRequest`
   * plus an optional `IFormFile? bill`, so the request MUST be multipart. The old
   * `createClaim` posted JSON, which cannot bind to [FromForm] — submitting a claim
   * without a receipt failed every time. Web always builds FormData; so do we now,
   * simply omitting the `bill` part when there is no file.
   */
  createClaimWithBill: (formData: FormData) =>
    apiClient.post<any>('/expense-claims', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

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
