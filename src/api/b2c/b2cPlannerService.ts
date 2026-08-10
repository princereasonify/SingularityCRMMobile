import { apiClient } from '../client';

/** B2C planned visits (Route Planner / Weekly Plan / Calendar) — mirrors B2CPlannerController.cs. */
const BASE = '/b2c/planner';

export interface CreatePlannedVisitBody { leadId: number; plannedDate: string; agentId?: number; sortOrder?: number; notes?: string; }
export interface UpdatePlannedVisitBody { plannedDate?: string; status?: string; sortOrder?: number; notes?: string; }

export const b2cPlannerService = {
  // Visits between two ISO dates (own, or team/agent for admin+manager).
  get: (from: string, to: string, agentId?: number) =>
    apiClient.get<any[]>(BASE, { params: { from, to, agentId } }),
  create: (data: CreatePlannedVisitBody) => apiClient.post<any>(BASE, data),
  update: (id: number, data: UpdatePlannedVisitBody) => apiClient.put<any>(`${BASE}/${id}`, data),
  remove: (id: number) => apiClient.delete(`${BASE}/${id}`),
};
