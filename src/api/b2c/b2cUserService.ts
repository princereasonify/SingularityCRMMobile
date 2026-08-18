import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import { B2CUserListDto } from '../../types/b2c';

/**
 * B2C user management API — mirrors B2CUsersController.cs (base "api/b2c/users").
 * Admin-only except `team` (Agent manager + admin). Matches web b2cUserService.js.
 */
const BASE = '/b2c/users';

export interface B2CUserQuery { page?: number; pageSize?: number; role?: string; }
export interface CreateB2CUserBody {
  name: string; email: string; mobile: string; password: string; role: string;
  address?: string; bio?: string; isManager?: boolean; agentIds?: number[];
}
export interface UpdateB2CUserBody {
  name?: string; mobile?: string; address?: string; bio?: string;
  isActive?: boolean; isManager?: boolean; agentIds?: number[];
}

export const b2cUserService = {
  getUsers: (params?: B2CUserQuery) =>
    apiClient.get<PaginatedResult<B2CUserListDto>>(BASE, { params }),
  getUserById: (id: number) => apiClient.get<any>(`${BASE}/${id}`),
  createUser: (data: CreateB2CUserBody) => apiClient.post<any>(BASE, data),
  updateUser: (id: number, data: UpdateB2CUserBody) => apiClient.put<any>(`${BASE}/${id}`, data),
  toggleUser: (id: number) => apiClient.patch<any>(`${BASE}/${id}/toggle`),
  deleteUser: (id: number) => apiClient.delete(`${BASE}/${id}`),
  // Manager (Agent+IsManager) or admin: the agents reporting to this manager.
  getMyTeam: () => apiClient.get<any[]>(`${BASE}/team`),
};
