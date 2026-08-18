import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  B2CLeadListDto,
  B2CLeadDetailDto,
  CreateB2CLeadRequest,
  UpdateB2CLeadRequest,
  ConvertLeadRequest,
  DuplicateCheckResult,
  BulkUploadResult,
  B2CBulkJobDto,
} from '../../types/b2c';

/**
 * B2C student-lead API — routes mirror SalesCRM.API/Controllers/B2C/B2CLeadsController.cs
 * (route base "api/b2c/leads"; API_BASE_URL already ends at /api). Behaviour matches the
 * working web client (b2cLeadService.js): the response interceptor unwraps ApiResponse<T>,
 * so `res.data` is the typed payload and paginated calls yield { items, totalCount, ... }.
 */

const BASE = '/b2c/leads';

export interface B2CLeadQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string;
  source?: string;
  priority?: string;
  agentId?: number;
  counselorId?: number;
  area?: string;
}

export const b2cLeadService = {
  getLeads: (params?: B2CLeadQuery) =>
    apiClient.get<PaginatedResult<B2CLeadListDto>>(BASE, { params }),

  // Manager (Agent+IsManager): leads across the manager's team agents.
  getTeamLeads: (params?: B2CLeadQuery) =>
    apiClient.get<PaginatedResult<B2CLeadListDto>>(`${BASE}/team`, { params }),

  getLead: (id: number) => apiClient.get<B2CLeadDetailDto>(`${BASE}/${id}`),

  createLead: (data: CreateB2CLeadRequest) =>
    apiClient.post<{ lead: B2CLeadDetailDto; duplicateInfo: DuplicateCheckResult }>(BASE, data),

  updateLead: (id: number, data: UpdateB2CLeadRequest) =>
    apiClient.put<B2CLeadDetailDto>(`${BASE}/${id}`, data),

  deleteLead: (id: number) => apiClient.delete(`${BASE}/${id}`),

  // B2CAdmin only — first assignment of an unassigned lead to an agent.
  assignLead: (id: number, agentId: number) =>
    apiClient.post(`${BASE}/${id}/assign`, { agentId }),

  // B2CAdmin only — move an already-assigned lead to a different agent (reason required).
  reassignLead: (id: number, agentId: number, reason: string) =>
    apiClient.post(`${BASE}/${id}/reassign`, { agentId, reason }),

  // B2CAdmin only — attach a counselor to the lead.
  assignCounselor: (id: number, counselorId: number) =>
    apiClient.post(`${BASE}/${id}/assign-counselor`, { counselorId }),

  updateStage: (id: number, newStage: string, notes?: string) =>
    apiClient.patch(`${BASE}/${id}/stage`, { newStage, notes }),

  convertLead: (id: number, data: ConvertLeadRequest) =>
    apiClient.post<B2CLeadDetailDto>(`${BASE}/${id}/convert`, data),

  // POST with the values on the query string (body is null) — matches the controller signature.
  // A hard duplicate now requires BOTH the full student name and the mobile to match.
  checkDuplicate: (mobile: string, studentName?: string, email?: string) =>
    apiClient.post<DuplicateCheckResult>(`${BASE}/duplicate-check`, null, { params: { mobile, studentName, email } }),

  // B2CAdmin only. `file` is a RN document/asset { uri, name, type } appended to FormData.
  bulkUpload: (file: any, defaultAgentId?: number) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<BulkUploadResult>(`${BASE}/bulk-upload`, form, {
      params: defaultAgentId ? { defaultAgentId } : {},
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getBulkJob: (jobId: number) => apiClient.get<B2CBulkJobDto>(`${BASE}/bulk-jobs/${jobId}`),
};
