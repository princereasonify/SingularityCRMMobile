import { apiClient } from './client';
import { AiDailyPlan, AiDailyReport } from '../types';

export const aiApi = {
  getDailyPlan: () => apiClient.get<AiDailyPlan>('/ai/daily-plan'),
  acceptPlan: (planId: number, acceptedItems: number[]) =>
    apiClient.post('/ai/daily-plan/accept', { planId, acceptedItems }),
  getDailyReport: () => apiClient.get<AiDailyReport>('/ai/daily-report'),
  getInsights: () => apiClient.get<any>('/ai/insights'),
  regeneratePlan: () => apiClient.post<AiDailyPlan>('/ai/daily-plan/regenerate', {}),
};
