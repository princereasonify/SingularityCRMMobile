/**
 * Caller Assignments (B2C Admin) — which Calling Agent owns which family. Mirrors web's
 * api/b2c/b2cCallerAssignmentService.js. Backend:
 * Controllers/B2C/B2CCallerAssignmentsController.cs, route api/b2c/caller-assignments.
 *
 * A Calling Agent sees ONLY the families assigned to them: their Call Queue, My Leads and the
 * Parent Portal call requests / feedback of those parents. Unassigned families are hidden from
 * every caller. Assigning one child assigns the whole family (every lead with the same parent).
 */
import { apiClient } from '../client';

const BASE = '/b2c/caller-assignments';

export interface CallerOverviewRow {
  id: number;
  name: string;
  isActive: boolean;
  openLeads: number;
  assignedLeads: number;
}

export interface CallerAssignmentsOverview {
  callers: CallerOverviewRow[];
  unassignedLeads: number;
  assignedLeads: number;
}

export interface AssignableLeadRow {
  leadId: number;
  studentName: string;
  parentName?: string | null;
  parentMobile?: string | null;
  mobileNumber: string;
  city?: string | null;
  grade?: string | null;
  stage: string;
  hasParentPortal: boolean;
  assignedCallerId?: number | null;
  assignedCallerName?: string | null;
  callerAssignedAt?: string | null;
  siblingCount?: number;
}

export interface AssignableLeadsResult { items: AssignableLeadRow[]; totalCount: number; }

export interface AssignResult {
  updated: number;
  siblingsIncluded?: number;
  parentRequestsMoved?: number;
  warning?: string;
}

export interface UnassignedRequestRow {
  request: {
    parentCallRequestId: number;
    parentName?: string | null;
    studentName?: string | null;
    phoneNumber: string;
    category: string;
    message?: string | null;
    source?: string | null;
    status: string;
    createdAt: string;
  };
  leadId?: number | null;
  leadStudentName?: string | null;
}

export interface UnassignedRequestsResult { items: UnassignedRequestRow[]; totalCount: number; }

export const b2cCallerAssignmentService = {
  /** Callers with workload counts, plus assigned / unassigned totals. */
  getOverview: () => apiClient.get<CallerAssignmentsOverview>(`${BASE}/overview`),

  getLeads: (params?: { view?: 'unassigned' | 'assigned' | 'all'; callerId?: string; search?: string; stage?: string; page?: number; pageSize?: number }) =>
    apiClient.get<AssignableLeadsResult>(`${BASE}/leads`, { params: { page: 1, pageSize: 25, ...params } }),

  /** Also moves the family's open Parent Portal requests to that caller. */
  assign: (leadIds: number[], callerId: number) =>
    apiClient.post<AssignResult>(`${BASE}/assign`, { leadIds, callerId }),

  /** The family disappears from its caller's screens. */
  unassign: (leadIds: number[]) => apiClient.post<AssignResult>(`${BASE}/unassign`, { leadIds }),

  /** Open Parent Portal requests no caller can see yet. */
  getUnassignedRequests: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<UnassignedRequestsResult>(`${BASE}/unassigned-requests`, { params: { page: 1, pageSize: 20, ...params } }),
};
