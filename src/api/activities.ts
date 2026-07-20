import { apiClient } from './client';
import { ActivityDto, PaginatedResult, CreateActivityRequest, UpdateActivityRequest } from '../types';

export const activitiesApi = {
  getActivities: (params?: { page?: number; pageSize?: number; type?: string }) =>
    apiClient.get<PaginatedResult<ActivityDto>>('/activities', { params }),

  createActivity: (data: CreateActivityRequest) =>
    apiClient.post<ActivityDto>('/activities', data),

  /**
   * Edit / delete a logged activity. Both are scoped server-side to the caller's own
   * activities (ActivityService checks `FoId == userId`), so a 404 means "not yours"
   * as well as "doesn't exist". Only the fields you send are changed.
   */
  updateActivity: (id: number, data: UpdateActivityRequest) =>
    apiClient.put<ActivityDto>(`/activities/${id}`, data),

  deleteActivity: (id: number) => apiClient.delete(`/activities/${id}`),

  getTeamActivities: (foId: number) =>
    apiClient.get<ActivityDto[]>(`/activities/team/${foId}`),

  uploadPhoto: (activityId: number, imageUri: string) => {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const type = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    formData.append('file', { uri: imageUri, name: filename, type } as any);
    formData.append('activityId', String(activityId));
    return apiClient.post<{ photoUrl: string }>('/activities/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
