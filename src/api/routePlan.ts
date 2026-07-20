import { apiClient } from './client';
import { DailyRoutePlan, CreateRoutePlanRequest, UpdateRoutePlanRequest } from '../types';

/**
 * RoutePlanController declares exactly three routes — GET /routes/plan/today,
 * POST /routes/plan, PUT /routes/plan/{id}.
 *
 * This module also exported `getByDate`, `markVisited` and `optimize`; none of
 * those routes exist in any controller, so all three were guaranteed 404s (the
 * same trap `reports.ts` had with 7 invented endpoints). Omitted rather than left
 * as bait — add one back only together with its backend action.
 *
 * NB `create` does NOT upsert: RoutePlanService.CreatePlanAsync inserts
 * unconditionally, so re-saving an existing plan via POST leaks a duplicate row.
 * Use `update` when you already hold a plan id, as web does.
 */
export const routePlanApi = {
  getToday: () => apiClient.get<DailyRoutePlan>('/routes/plan/today'),
  create: (data: CreateRoutePlanRequest) =>
    apiClient.post<DailyRoutePlan>('/routes/plan', data),
  update: (id: number, data: UpdateRoutePlanRequest) =>
    apiClient.put<DailyRoutePlan>(`/routes/plan/${id}`, data),
};
