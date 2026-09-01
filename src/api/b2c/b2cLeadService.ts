import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  LeadCoordinateDto,
  B2CLeadListDto,
  B2CLeadDetailDto,
  CreateB2CLeadRequest,
  UpdateB2CLeadRequest,
  ConvertLeadRequest,
  DuplicateCheckResult,
  BulkUploadResult,
  B2CBulkJobDto,
  B2CLookupOption,
  B2CLeadCredentialsDto,
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
  pincode?: string;
  grade?: string;
  board?: string;
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

  /**
   * `appointmentAt` is an ISO instant and is REQUIRED for the 'AppointmentBooked' stage —
   * an appointment with no time is not an appointment, and the server refuses it. Ignored
   * for every other stage.
   */
  updateStage: (id: number, newStage: string, notes?: string, appointmentAt?: string) =>
    apiClient.patch(`${BASE}/${id}/stage`, { newStage, notes, appointmentAt }),

  /**
   * Moves a booked visit without touching the funnel — the student changed their slot.
   * Deliberately not a stage update: that would write a meaningless
   * AppointmentBooked → AppointmentBooked step into the history on every reschedule.
   * Also moves the planned-visit row the Route Planner, Weekly Plan and Calendar read.
   */
  rescheduleAppointment: (id: number, appointmentAt: string, notes?: string) =>
    apiClient.patch<B2CLeadDetailDto>(`${BASE}/${id}/appointment`, { appointmentAt, notes }),

  /**
   * Re-attempt Reasonify account creation for a lead whose sync failed, reusing the
   * credentials captured at creation. Refused on an already-synced lead (it would duplicate
   * the student).
   */
  retryReasonifySync: (id: number) =>
    apiClient.post<B2CLeadCredentialsDto>(`${BASE}/${id}/reasonify-sync`),

  convertLead: (id: number, data: ConvertLeadRequest) =>
    apiClient.post<B2CLeadDetailDto>(`${BASE}/${id}/convert`, data),

  // POST with the values on the query string (body is null) — matches the controller signature.
  // A hard duplicate now requires BOTH the full student name and the mobile to match.
  /**
   * `excludeLeadId` is the lead being edited — without it the edit form's check finds the very
   * lead the user is editing and reports it as a duplicate of itself.
   */
  checkDuplicate: (mobile: string, studentName?: string, email?: string, excludeLeadId?: number) =>
    apiClient.post<DuplicateCheckResult>(`${BASE}/duplicate-check`, null, {
      params: { mobile, studentName, email, excludeLeadId },
    }),

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

  /**
   * Decrypted student/parent Reasonify login for this lead. B2CAdmin always; Agent/Counselor
   * only when assigned to it. This is the whole point of storing them reversibly — an agent
   * standing in the student's house needs to actually log in as them.
   */
  getCredentials: (id: number) =>
    apiClient.get<B2CLeadCredentialsDto>(`${BASE}/${id}/credentials`),

  // Reasonify's Board/Language/Grade lookups, proxied server-side. The lead form's cascading
  // dropdowns need Reasonify's real numeric ids — its registration call takes a GradeId, not
  // a label — and grades are scoped to a (board, medium) pair.
  /**
   * Coordinates for a set of leads, geocoding and PERSISTING any that lack them.
   * A B2C lead only gains coordinates from a geo-verified visit, so an unvisited one has none —
   * which is why "Optimise" used to report that no student could be placed on the route.
   */
  resolveCoordinates: (leadIds: number[]) =>
    apiClient.post<LeadCoordinateDto[]>(`${BASE}/resolve-coordinates`, { leadIds }),

  getReasonifyBoards: () => apiClient.get<B2CLookupOption[]>(`${BASE}/lookups/boards`),

  getReasonifyLanguages: () => apiClient.get<B2CLookupOption[]>(`${BASE}/lookups/languages`),

  getReasonifyGrades: (boardId: number, languageId?: number) =>
    apiClient.get<B2CLookupOption[]>(`${BASE}/lookups/grades`, { params: { boardId, languageId } }),
};
