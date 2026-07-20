import { apiClient } from './client';
import { LeadDto, LeadListDto, PaginatedResult, CreateLeadRequest, UserDto } from '../types';

export const leadsApi = {
  getLeads: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    stage?: string;
    source?: string;
    /**
     * Drill into one user's leads. The controller binds `[FromQuery] int? userId`
     * (LeadsController.GetLeads) — an unknown key like `foId` is silently dropped
     * by ASP.NET model binding and the filter would return everyone's leads.
     */
    userId?: number;
  }) => apiClient.get<PaginatedResult<LeadListDto>>('/leads', { params }),

  getLead: (id: number) => apiClient.get<LeadDto>(`/leads/${id}`),

  createLead: (data: CreateLeadRequest) => apiClient.post<LeadDto>('/leads', data),

  updateLead: (id: number, data: Partial<CreateLeadRequest>) =>
    apiClient.put<LeadDto>(`/leads/${id}`, data),

  deleteLead: (id: number) => apiClient.delete(`/leads/${id}`),

  checkDuplicate: (school: string, city: string) =>
    apiClient.get<boolean>('/leads/check-duplicate', { params: { school, city } }),

  /**
   * GET /leads/pipeline — LeadsController.GetPipeline binds
   * `[FromQuery] int? userId` and LeadService honours it, so a manager can drill
   * into one user's pipeline. The wrapper used to take no arguments at all, which
   * made that filter unreachable from mobile.
   *
   * `userId` is optional and the no-arg call sends `params: {}`, which axios
   * serialises to no query string — byte-identical to the old request. Existing
   * no-arg callers (PipelineScreen, ActivityLogScreen, CreateDealScreen) are
   * unaffected.
   */
  getPipeline: (userId?: number) =>
    apiClient.get<LeadListDto[]>('/leads/pipeline', { params: userId ? { userId } : {} }),

  // Body key is `foId` per AssignLeadRequest { int FoId } — verified, do not rename.
  assignLead: (id: number, foId: number) =>
    apiClient.put<LeadDto>(`/leads/${id}/assign`, { foId }),

  /**
   * POST /leads/{id}/mark-lost — MarkLeadLostRequest { string LossReason }.
   * Sets Stage = Lost, the reason and CloseDate. A plain updateLead({ lossReason })
   * only writes the reason and leaves the stage untouched.
   */
  markLost: (id: number, lossReason: string) =>
    apiClient.post<LeadDto>(`/leads/${id}/mark-lost`, { lossReason }),

  getAssignableFOs: () => apiClient.get<UserDto[]>('/leads/assignable-fos'),
};
