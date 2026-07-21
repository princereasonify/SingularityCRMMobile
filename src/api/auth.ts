import { apiClient } from './client';
import { LoginResponse, UserDto, Region, Zone } from '../types';
import { DeviceInfoPayload } from '../utils/deviceInfo';

/** Mirrors AuthController.UserTransferEntry { UserId, TargetId, TargetType }. */
export interface UserTransferEntry {
  userId: number;
  targetId: number;
  /** "zh" → move an FO under another ZH · "rh" → move a ZH/direct-FO under another RH. */
  targetType: 'zh' | 'rh';
}

/** Mirrors AuthController.UserDeleteRequest { Transfers }. */
export interface UserDeleteBody {
  transfers: UserTransferEntry[];
}

/**
 * Shape of the 409 payload from DeleteUser — `Data = new { type, zhSubordinates,
 * foSubordinates }`. apiClient's response interceptor only unwraps `data` on success,
 * so on an error this arrives as `err.response.data.data`.
 */
export interface DeleteBlockedInfo {
  type: 'zh' | 'rh';
  zhSubordinates: SubordinateDto[];
  foSubordinates: SubordinateDto[];
}

/** The projection the controller selects: { Id, Name, Email, Role, ZoneId, RegionId }. */
export interface SubordinateDto {
  id: number;
  name: string;
  email: string;
  role: string;
  zoneId?: number | null;
  regionId?: number | null;
}

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

  // Sends the refresh token so the server can revoke it — otherwise it stays
  // valid for its full lifetime after the user has "logged out".
  logout: (refreshToken?: string | null) =>
    apiClient.post('/auth/logout', { refreshToken: refreshToken ?? '' }),

  getPendingUsers: () => apiClient.get<UserDto[]>('/auth/pending-users'),

  approveUser: (id: number) => apiClient.post(`/auth/approve-user/${id}`),

  rejectUser: (id: number) => apiClient.post(`/auth/reject-user/${id}`),

  createUser: (data: any) => apiClient.post<UserDto>('/auth/create-user', data),

  getUsers: () => apiClient.get<UserDto[]>('/auth/users'),

  updateUser: (id: number, data: any) =>
    apiClient.put<UserDto>(`/auth/update-user/${id}`, data),

  /**
   * AuthController.DeleteUser — `[HttpDelete("delete-user/{id}")]`, bound as
   * `DeleteUser(int id, [FromBody] UserDeleteRequest? request = null)`.
   *
   * Called with no body it *probes*: if the target is a ZH with FOs in its zone, or an
   * RH with ZHs / direct FOs in its region, it answers 409 with
   * `Data = new { type, zhSubordinates, foSubordinates }` instead of deleting.
   * Called with `{ transfers: [{ userId, targetId, targetType }] }` it reassigns each
   * subordinate first, then deletes.
   *
   * `targetType` is matched literally in the controller against "zh" (line 361) and
   * "rh" (line 371). NOTE: the XML doc on UserTransferEntry.TargetType says "region",
   * but that string is never compared anywhere — sending it silently transfers nothing
   * and then deletes the parent. Use "zh" / "rh" only.
   *
   * Body goes through axios' `data` config key — DELETE bodies are not a positional arg.
   */
  deleteUser: (id: number, body?: UserDeleteBody | null) =>
    apiClient.delete(`/auth/delete-user/${id}`, body ? { data: body } : undefined),

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

  // Delete account request (unauthenticated)
  deleteAccountRequest: (email: string, password: string) =>
    apiClient.post('/auth/delete-account-request', { email, password }),

  // Home location
  getHomeLocation: () => apiClient.get('/auth/home-location'),
  // AuthController.SetHomeLocation binds SetHomeLocationRequest { Latitude,
  // Longitude, Address } and web sends all three. `address` used to be missing
  // here, so the saved home location had no address text.
  setHomeLocation: (latitude: number, longitude: number, address?: string) =>
    apiClient.post('/auth/home-location', { latitude, longitude, address }),

  /**
   * Profile picture. `User.Avatar` was always a column but nothing wrote to it, so
   * the profile screen had a picture slot with nowhere to upload to. Same multipart
   * shape as activitiesApi.uploadPhoto; server stores it and returns the public URL.
   */
  uploadAvatar: (imageUri: string) => {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    const type = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    formData.append('file', { uri: imageUri, name: filename, type } as any);
    return apiClient.post<{ avatar: string }>('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
