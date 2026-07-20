import { apiClient } from './client';
import { UserSettings, DashboardConfig } from '../types';

/**
 * ⚠️ NONE of these endpoints exist on the backend today.
 *
 *   GET/PUT /settings/me              → there is no SettingsController
 *   GET/PUT /dashboard/config         → DashboardController has no `config` route
 *   GET/PUT /notifications/preferences → NotificationsController has no `preferences` route
 *
 * They 404 into the callers' catch blocks, which is why the old Settings toggles
 * appeared to work but never persisted. The WhatsApp/Push toggles no longer use
 * this module (push is enforced device-side via the FCM token); the only remaining
 * consumer is DashboardCustomizeScreen, whose entry point has been removed from
 * Settings until a real endpoint exists.
 *
 * Kept — rather than deleted — so the intended contract is documented in one place
 * for whoever writes the backend. Do NOT wire anything new to it.
 */
export const settingsApi = {
  get: () => apiClient.get<UserSettings>('/settings/me'),

  update: (data: Partial<UserSettings>) =>
    apiClient.put<UserSettings>('/settings/me', data),

  getDashboardConfig: () =>
    apiClient.get<DashboardConfig>('/dashboard/config'),

  saveDashboardConfig: (config: DashboardConfig) =>
    apiClient.put<DashboardConfig>('/dashboard/config', config),
};
