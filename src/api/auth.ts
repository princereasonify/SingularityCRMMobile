import { apiClient } from './client';
import { LoginResponse, UserDto, Region, Zone } from '../types';
import { DeviceInfoPayload } from '../utils/deviceInfo';

export const authApi = {
  login: (email: string, password: string, deviceInfo?: DeviceInfoPayload) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password, deviceInfo }),

  signup: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    role: string;
  }) => apiClient.post('/auth/signup', data),

  logout: () => apiClient.post('/auth/logout'),

  getPendingUsers: () => apiClient.get<UserDto[]>('/auth/pending-users'),

  approveUser: (id: number) => apiClient.post(`/auth/approve-user/${id}`),

  rejectUser: (id: number) => apiClient.post(`/auth/reject-user/${id}`),

  createUser: (data: any) => apiClient.post<UserDto>('/auth/create-user', data),

  getUsers: () => apiClient.get<UserDto[]>('/auth/users'),

  updateUser: (id: number, data: any) =>
    apiClient.put<UserDto>(`/auth/update-user/${id}`, data),

  deleteUser: (id: number) => apiClient.delete(`/auth/delete-user/${id}`),

  getZones: () => apiClient.get<Zone[]>('/auth/zones'),

  getRegions: () => apiClient.get<Region[]>('/auth/regions'),

  createRegion: (name: string) => apiClient.post<Region>('/auth/regions', { name }),

  updateRegion: (id: number, name: string) =>
    apiClient.put<Region>(`/auth/regions/${id}`, { name }),

  deleteRegion: (id: number) => apiClient.delete(`/auth/regions/${id}`),

  createZone: (name: string, regionId: number) =>
    apiClient.post<Zone>('/auth/zones', { name, regionId }),

  updateZone: (id: number, name: string, regionId: number) =>
    apiClient.put<Zone>(`/auth/zones/${id}`, { name, regionId }),

  deleteZone: (id: number) => apiClient.delete(`/auth/zones/${id}`),
};
