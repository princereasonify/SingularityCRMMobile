import { apiClient } from './client';

export const subscriptionsApi = {
  getAll: (status?: string) =>
    apiClient.get<any[]>('/subscriptions', { params: status ? { status } : {} }),
  getById: (id: number) =>
    apiClient.get<any>(`/subscriptions/${id}`),
  provisionCredentials: (id: number, payload: { schoolLoginEmail: string; schoolLoginPassword: string }) =>
    apiClient.post<any>(`/subscriptions/${id}/provision-credentials`, payload),
  revokeCredentials: (id: number) =>
    apiClient.post<any>(`/subscriptions/${id}/revoke-credentials`, {}),
  updateStatus: (id: number, status: string) =>
    apiClient.patch<any>(`/subscriptions/${id}/status`, { status }),
};
