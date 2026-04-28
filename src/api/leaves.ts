import { apiClient } from './client';

export interface LeaveApplication {
  leaveDate: string;
  leaveType: 'FullDay' | 'HalfDayFirstHalf' | 'HalfDaySecondHalf';
  leaveCategory: 'Casual' | 'Sick' | 'Personal' | 'Emergency';
  reason: string;
  coverArrangement?: string | null;
}

export const leavesApi = {
  applyLeave: (payload: LeaveApplication) =>
    apiClient.post<any>('/leaves', payload),

  getMyLeaves: (params?: { status?: string; category?: string }) =>
    apiClient.get<any[]>('/leaves/my', { params }),

  getTeamLeaves: (params?: { status?: string; category?: string; filterUserId?: string }) =>
    apiClient.get<any[]>('/leaves/team', { params }),

  approveLeave: (id: number) =>
    apiClient.post<any>(`/leaves/${id}/approve`),

  rejectLeave: (id: number, payload: { rejectionReason: string }) =>
    apiClient.post<any>(`/leaves/${id}/reject`, payload),

  cancelLeave: (id: number) =>
    apiClient.post<any>(`/leaves/${id}/cancel`),
};
