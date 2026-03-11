import { apiClient } from './client';
import { DealDto, PaginatedResult, CreateDealRequest } from '../types';

export const dealsApi = {
  getDeals: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResult<DealDto>>('/deals', { params }),

  getDeal: (id: number) => apiClient.get<DealDto>(`/deals/${id}`),

  createDeal: (data: CreateDealRequest) => apiClient.post<DealDto>('/deals', data),

  approveDeal: (id: number, approved: boolean, notes?: string) =>
    apiClient.put<DealDto>(`/deals/${id}/approve`, { approved, notes }),

  getPendingApprovals: () => apiClient.get<DealDto[]>('/deals/pending-approvals'),
};
