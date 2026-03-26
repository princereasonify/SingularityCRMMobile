import { apiClient } from './client';
import { SchoolAssignment } from '../types';

export const schoolAssignmentsApi = {
  getMyAssignments: (date: string) =>
    apiClient.get<SchoolAssignment[]>('/school-assignments/my', { params: { date } }),
};
