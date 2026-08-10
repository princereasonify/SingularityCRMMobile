import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  B2CCounselorListDto,
  B2CCounselorDetailDto,
  CreateB2CCounselorRequest,
  UpdateB2CCounselorRequest,
} from '../../types/b2c';

/**
 * B2C counselor API — routes mirror B2CCounselorsController.cs (base "api/b2c/counselors").
 * List/detail are readable by any B2C role; create/update/delete are B2CAdmin-only server-side.
 */

const BASE = '/b2c/counselors';

export interface B2CCounselorQuery {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export const b2cCounselorService = {
  getCounselors: (params?: B2CCounselorQuery) =>
    apiClient.get<PaginatedResult<B2CCounselorListDto>>(BASE, { params }),

  getCounselorById: (id: number) => apiClient.get<B2CCounselorDetailDto>(`${BASE}/${id}`),

  // GET /specializations → a flat string[] the create/edit forms multi-select from.
  getSpecializations: () => apiClient.get<string[]>(`${BASE}/specializations`),

  createCounselor: (data: CreateB2CCounselorRequest) =>
    apiClient.post<B2CCounselorDetailDto>(BASE, data),

  updateCounselor: (id: number, data: UpdateB2CCounselorRequest) =>
    apiClient.put<B2CCounselorDetailDto>(`${BASE}/${id}`, data),

  deleteCounselor: (id: number) => apiClient.delete(`${BASE}/${id}`),

  getCounselorQuality: (id: number) => apiClient.get(`${BASE}/${id}/quality`),
};
