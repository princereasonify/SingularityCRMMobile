import { apiClient } from './client';
import { AllowanceConfig } from '../types';

/**
 * Request bodies matching the backend DTOs (AllowanceConfigService). The shared
 * `CreateAllowanceConfigRequest` type names the min-distance field `minDistanceKm`, which
 * the server never binds — it is `MinDistanceForAllowance` — so the value was silently
 * dropped. These local types carry the real names; `null` clears nothing on its own, the
 * `clear*` flags on update are what remove a value.
 */
export interface AllowanceConfigCreateBody {
  scope: 'Global' | 'Region' | 'Zone' | 'User' | 'Role';
  scopeId?: number | null;
  targetRole?: string | null;
  vehicleType?: string | null;
  ratePerKm: number;
  maxDailyAllowance?: number | null;
  minDistanceForAllowance?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface AllowanceConfigUpdateBody {
  ratePerKm?: number;
  maxDailyAllowance?: number | null;
  minDistanceForAllowance?: number | null;
  vehicleType?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  clearMaxDailyAllowance?: boolean;
  clearMinDistanceForAllowance?: boolean;
  clearEffectiveTo?: boolean;
  clearVehicleType?: boolean;
}

export const allowanceConfigApi = {
  getAll: () => apiClient.get<AllowanceConfig[]>('/admin/allowance-config'),
  create: (data: AllowanceConfigCreateBody) =>
    apiClient.post<AllowanceConfig>('/admin/allowance-config', data),
  update: (id: number, data: AllowanceConfigUpdateBody) =>
    apiClient.put<AllowanceConfig>(`/admin/allowance-config/${id}`, data),
  delete: (id: number) =>
    apiClient.delete(`/admin/allowance-config/${id}`),
  resolveForUser: (userId: number) =>
    apiClient.get<AllowanceConfig>(`/admin/allowance-config/resolve/${userId}`),
};
