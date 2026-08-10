import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  B2CActivityListDto,
  CreateB2CActivityRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  OtpResult,
} from '../../types/b2c';

/**
 * B2C activity API — routes mirror B2CActivitiesController.cs (base "api/b2c/activities";
 * API_BASE_URL already ends at /api). The response interceptor unwraps ApiResponse<T>, so
 * `res.data` is the typed payload.
 *
 * getActivities / createActivity back the lead-detail activity list; sendOtp / verifyOtp /
 * uploadSelfie back the phase-2 native Agent geo-visit flow (B2CAgentVisitScreen). The OTP
 * and selfie endpoints are Agent-only server-side.
 */

const BASE = '/b2c/activities';

export interface B2CActivityQuery {
  page?: number;
  pageSize?: number;
}

export const b2cActivityService = {
  getActivities: (leadId: number, params?: B2CActivityQuery) =>
    apiClient.get<PaginatedResult<B2CActivityListDto>>(`${BASE}/lead/${leadId}`, { params }),

  // The caller's own activity feed across all their leads (Agent/Counselor). Supports
  // from/to for the calendar's "what was done" overlay. Server route: GET /mine.
  getMyActivities: (params?: { page?: number; pageSize?: number; type?: string; from?: string; to?: string }) =>
    apiClient.get<PaginatedResult<any>>(`${BASE}/mine`, { params }),

  // POST /  → returns the created activity (incl. id) used to attach the selfie.
  createActivity: (data: CreateB2CActivityRequest) =>
    apiClient.post<B2CActivityListDto>(BASE, data),

  /** @deprecated use createActivity — kept as an alias for older callers. */
  logActivity: (data: CreateB2CActivityRequest) =>
    apiClient.post<B2CActivityListDto>(BASE, data),

  // B2CAdmin only — approve/reject a pending visit selfie. POST /{id}/selfie/approve
  // with body { approved, note }; returns the updated activity. Mirrors web approveSelfie.
  approveSelfie: (activityId: number, approved: boolean, note?: string) =>
    apiClient.post<B2CActivityListDto>(`${BASE}/${activityId}/selfie/approve`, { approved, note }),

  // ── Native Agent visit flow (Agent-only server-side) ──
  sendOtp: (data: SendOtpRequest) =>
    apiClient.post<OtpResult>(`${BASE}/otp/send`, data),

  verifyOtp: (data: VerifyOtpRequest) =>
    apiClient.post<OtpResult>(`${BASE}/otp/verify`, data),

  // `photo` is a RN asset { uri, name, type }; multipart field name is "photo" per the controller.
  uploadSelfie: (activityId: number, photo: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('photo', { uri: photo.uri, name: photo.name, type: photo.type } as any);
    return apiClient.post<{ url: string }>(`${BASE}/${activityId}/selfie`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // selfie upload must not hit the default request timeout
    });
  },

  // Student ID-card image attached to a visit. Same multipart contract as the selfie.
  uploadStudentId: (activityId: number, photo: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('photo', { uri: photo.uri, name: photo.name, type: photo.type } as any);
    return apiClient.post<{ url: string }>(`${BASE}/${activityId}/student-id`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    });
  },
};
