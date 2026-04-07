import { apiClient } from './client';
import { SchoolAssignment } from '../types';

export interface BulkAssignRequest {
  userId: number;
  assignmentDate: string;
  schoolIds: number[];
  notes?: string;
}

export interface AssignmentResult {
  id: number;
  schoolId: number;
  schoolName: string;
  userId: number;
  userName: string;
  assignmentDate: string;
  visitOrder: number;
  isVisited: boolean;
  assignedById: number;
  assignedByName: string;
}

export const schoolAssignmentsApi = {
  getMyAssignments: (date: string) =>
    apiClient.get<SchoolAssignment[]>('/school-assignments/my', { params: { date } }),

  getUserAssignments: (userId: number, date: string) =>
    apiClient.get<SchoolAssignment[]>(`/school-assignments/user/${userId}`, { params: { date } }),

  getTeamAssignments: (date: string) =>
    apiClient.get<SchoolAssignment[]>('/school-assignments/team', { params: { date } }),

  bulkAssign: (data: BulkAssignRequest) =>
    apiClient.post<{ success: boolean; assignments: AssignmentResult[] }>('/school-assignments/bulk', data),

  deleteAssignment: (id: number) =>
    apiClient.delete(`/school-assignments/${id}`),
};
