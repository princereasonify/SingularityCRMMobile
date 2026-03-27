import { apiClient } from './client';

export const weeklyPlanApi = {
  getMy: (weekStart: string) =>
    apiClient.get<any>('/weekly-plans/my', { params: { weekStart } }),
  getTeam: (weekStart: string) =>
    apiClient.get<any[]>('/weekly-plans/team', { params: { weekStart } }),
  create: (data: { weekStartDate: string; weekEndDate: string; planData: any[] }) =>
    apiClient.post<any>('/weekly-plans', data),
  update: (id: number, planData: any[]) =>
    apiClient.put<any>(`/weekly-plans/${id}`, { planData }),
  submit: (id: number) => apiClient.post<any>(`/weekly-plans/${id}/submit`, {}),
  approve: (id: number) => apiClient.post<any>(`/weekly-plans/${id}/approve`, {}),
  managerEdit: (id: number, planData: any[]) =>
    apiClient.post<any>(`/weekly-plans/${id}/edit`, { planData }),
  reject: (id: number, notes: string) =>
    apiClient.post<any>(`/weekly-plans/${id}/reject`, { notes }),
};
