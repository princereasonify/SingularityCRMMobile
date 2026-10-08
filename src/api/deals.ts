import { apiClient } from './client';
import { DealDto, PaginatedResult, CreateDealRequest } from '../types';

export const dealsApi = {
  /**
   * `status` is DealsController's [FromQuery] string? status — either an ApprovalStatus
   * member ('Rejected', 'Draft') or one of the server's groups ('pending', 'approved').
   */
  getDeals: (params?: { page?: number; pageSize?: number; status?: string }) =>
    apiClient.get<PaginatedResult<DealDto>>('/deals', { params }),

  getDeal: (id: number) => apiClient.get<DealDto>(`/deals/${id}`),

  createDeal: (data: CreateDealRequest) => apiClient.post<DealDto>('/deals', data),

  approveDeal: (id: number, approved: boolean, notes?: string | null) =>
    apiClient.put<DealDto>(`/deals/${id}/approve`, { approved, notes }),

  getPendingApprovals: () => apiClient.get<DealDto[]>('/deals/pending-approvals'),
};
