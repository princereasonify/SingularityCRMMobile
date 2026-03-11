import { apiClient } from './client';
import { NotificationDto } from '../types';

export const notificationsApi = {
  getNotifications: () => apiClient.get<NotificationDto[]>('/notifications'),
  markRead: (id: number) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
  deleteNotification: (id: number) => apiClient.delete(`/notifications/${id}`),
};
