import { apiClient } from './client';
import { AllowanceConfig, CreateAllowanceConfigRequest } from '../types';

export const allowanceConfigApi = {
  getAll: () => apiClient.get<AllowanceConfig[]>('/admin/allowance-config'),
  create: (data: CreateAllowanceConfigRequest) =>
    apiClient.post<AllowanceConfig>('/admin/allowance-config', data),
  resolveForUser: (userId: number) =>
    apiClient.get<AllowanceConfig>(`/admin/allowance-config/resolve/${userId}`),
};
