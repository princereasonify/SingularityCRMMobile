import { apiClient } from '../client';

/** B2C geo-compliance — mirrors B2CGeoController.cs (base "api/b2c/geo"). Admin-only. */
const BASE = '/b2c/geo';

export const b2cGeoService = {
  getViolations: (params?: any) => apiClient.get<any>(`${BASE}/violations`, { params }),
  review: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/violations/${id}/review`, { note }),
  getPendingSelfies: () => apiClient.get<any[]>(`${BASE}/pending-selfies`),
};
