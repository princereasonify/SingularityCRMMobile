import { apiClient } from './client';
import { AllowanceConfig, CreateAllowanceConfigRequest } from '../types';

export const allowanceConfigApi = {
  getAll: () => apiClient.get<AllowanceConfig[]>('/admin/allowance-config'),
  create: (data: CreateAllowanceConfigRequest) =>
    apiClient.post<AllowanceConfig>('/admin/allowance-config', data),
  update: (id: number, data: Partial<CreateAllowanceConfigRequest>) =>
    apiClient.put<AllowanceConfig>(`/admin/allowance-config/${id}`, data),
  delete: (id: number) =>
    apiClient.delete(`/admin/allowance-config/${id}`),
  resolveForUser: (userId: number) =>
    apiClient.get<AllowanceConfig>(`/admin/allowance-config/resolve/${userId}`),
};
