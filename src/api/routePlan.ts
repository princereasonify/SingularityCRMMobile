import { apiClient } from './client';
import { DailyRoutePlan, CreateRoutePlanRequest } from '../types';

export const routePlanApi = {
  getToday: () => apiClient.get<DailyRoutePlan>('/routes/plan/today'),
  getByDate: (date: string) => apiClient.get<DailyRoutePlan>(`/routes/plan/${date}`),
  create: (data: CreateRoutePlanRequest) => apiClient.post<DailyRoutePlan>('/routes/plan', data),
  markVisited: (planId: number, schoolId: number) =>
    apiClient.patch(`/routes/plan/${planId}/visit`, { schoolId }),
  optimize: (schoolIds: number[]) =>
    apiClient.post<{ orderedStops: any[] }>('/routes/optimize', { schoolIds }),
};
