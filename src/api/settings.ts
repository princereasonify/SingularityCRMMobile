import { apiClient } from './client';
import { UserSettings, DashboardConfig } from '../types';

export const settingsApi = {
  get: () => apiClient.get<UserSettings>('/settings/me'),

  update: (data: Partial<UserSettings>) =>
    apiClient.put<UserSettings>('/settings/me', data),

  getDashboardConfig: () =>
    apiClient.get<DashboardConfig>('/dashboard/config'),

  saveDashboardConfig: (config: DashboardConfig) =>
    apiClient.put<DashboardConfig>('/dashboard/config', config),

  getNotificationPreferences: () =>
    apiClient.get<{ whatsapp: boolean; push: boolean }>('/notifications/preferences'),

  updateNotificationPreferences: (data: { whatsapp?: boolean; push?: boolean }) =>
    apiClient.put('/notifications/preferences', data),
};
