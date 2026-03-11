import { apiClient } from './client';
import { ActivityDto, PaginatedResult, CreateActivityRequest } from '../types';

export const activitiesApi = {
  getActivities: (params?: { page?: number; pageSize?: number; type?: string }) =>
    apiClient.get<PaginatedResult<ActivityDto>>('/activities', { params }),

  createActivity: (data: CreateActivityRequest) =>
    apiClient.post<ActivityDto>('/activities', data),

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
