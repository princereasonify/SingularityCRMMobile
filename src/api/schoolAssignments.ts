import { apiClient } from './client';
import { SchoolAssignment, SchoolGeofence } from '../types';

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

  reassignSchool: (data: { schoolId: number; newUserId: number; assignmentDate: string; notes?: string }) =>
    apiClient.post('/school-assignments/reassign', data),

  /**
   * Source list for the assignment school picker — the same endpoint web uses
   * (`schoolService.getSchoolsForMap`).
   *
   *   SchoolsController.cs:109  [HttpGet("map")]
   *   SchoolsController.cs:113  return Ok(ApiResponse<List<SchoolGeofenceDto>>.Ok(schools));
   *
   * SchoolGeofenceDto is only { Id, Name, Latitude, Longitude, GeofenceRadiusMetres } —
   * there is NO `city` field. Web filters this list on `s.city`, which is always
   * undefined, so its city search silently never matches. We search on name only.
   */
  getSchoolsForMap: () => apiClient.get<SchoolGeofence[]>('/schools/map'),
};
