import { apiClient } from './client';
import { TargetAssignmentDto, CreateTargetRequest, UserDto } from '../types';

export const targetsApi = {
  createTarget: (data: CreateTargetRequest) =>
    apiClient.post<TargetAssignmentDto>('/targets', data),

  getMyTargets: () => apiClient.get<TargetAssignmentDto[]>('/targets/my'),

  getAssignedTargets: () => apiClient.get<TargetAssignmentDto[]>('/targets/assigned'),

  getSubTargets: (id: number) =>
    apiClient.get<TargetAssignmentDto[]>(`/targets/${id}/subtargets`),

  getHierarchy: (id: number) =>
    apiClient.get<TargetAssignmentDto[]>(`/targets/${id}/hierarchy`),

  updateProgress: (id: number, data: any) =>
    apiClient.put<TargetAssignmentDto>(`/targets/${id}/progress`, data),

  submitTarget: (id: number) =>
    apiClient.put<TargetAssignmentDto>(`/targets/${id}/submit`),

  reviewTarget: (id: number, approved: boolean, note?: string) =>
    apiClient.put<TargetAssignmentDto>(`/targets/${id}/review`, { approved, note }),

  deleteTarget: (id: number) => apiClient.delete(`/targets/${id}`),

  getAssignableUsers: () => apiClient.get<UserDto[]>('/targets/assignable-users'),
};
