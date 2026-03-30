import { apiClient } from './client';

export const schoolProfilesApi = {
  getAll: () =>
    apiClient.get<any[]>('/school-profiles'),
  getById: (id: number) =>
    apiClient.get<any>(`/school-profiles/${id}`),
  create: (data: any) =>
    apiClient.post<any>('/school-profiles', data),
  update: (id: number, data: any) =>
    apiClient.put<any>(`/school-profiles/${id}`, data),
  getPrefill: (schoolId: number) =>
    apiClient.get<any>(`/school-profiles/prefill/${schoolId}`),
  getOnboardedSchools: () =>
    apiClient.get<any[]>('/school-profiles/onboarded-schools'),
};
