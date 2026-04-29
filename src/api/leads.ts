import { apiClient } from './client';
import { LeadDto, LeadListDto, PaginatedResult, CreateLeadRequest, UserDto } from '../types';

export const leadsApi = {
  getLeads: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    stage?: string;
    source?: string;
    foId?: number;
  }) => apiClient.get<PaginatedResult<LeadListDto>>('/leads', { params }),

  getLead: (id: number) => apiClient.get<LeadDto>(`/leads/${id}`),

  createLead: (data: CreateLeadRequest) => apiClient.post<LeadDto>('/leads', data),

  updateLead: (id: number, data: Partial<CreateLeadRequest>) =>
    apiClient.put<LeadDto>(`/leads/${id}`, data),

  deleteLead: (id: number) => apiClient.delete(`/leads/${id}`),

  checkDuplicate: (school: string, city: string) =>
    apiClient.get<boolean>('/leads/check-duplicate', { params: { school, city } }),

  getPipeline: () => apiClient.get<LeadListDto[]>('/leads/pipeline'),

  assignLead: (id: number, foId: number) =>
    apiClient.put<LeadDto>(`/leads/${id}/assign`, { foId }),

  getAssignableFOs: () => apiClient.get<UserDto[]>('/leads/assignable-fos'),
};
