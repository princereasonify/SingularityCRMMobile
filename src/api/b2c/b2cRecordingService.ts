import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  StartRecordingRequest,
  StartRecordingResult,
  RecordingStatusDto,
  B2CCounselingFeedbackDto,
  CounselorQualityOverviewItem,
} from '../../types/b2c';

/**
 * B2C AI-coach recording API — routes mirror B2CAiCoachController.cs (base
 * "api/b2c/aicoach"; API_BASE_URL already ends at /api). The response interceptor
 * unwraps ApiResponse<T>, so `res.data` is the typed payload. Every recording
 * endpoint below is Counselor-only server-side.
 *
 * Backs the phase-2 native counselor flow (B2CCounselorRecordingScreen): start a
 * session → record locally → upload the audio → poll status → render AI feedback.
 * `uploadAudio` already returns the feedback synchronously; the status poll +
 * getFeedback exist for resilience and for reopening a finished session.
 */

const BASE = '/b2c/aicoach';

export const b2cRecordingService = {
  // POST /recordings/start → returns the recording (incl. recordingId).
  startRecording: (data: StartRecordingRequest) =>
    apiClient.post<StartRecordingResult>(`${BASE}/recordings/start`, data),

  // GET /recordings/{id}/status → { recordingId, status, hasFeedback }.
  getStatus: (recordingId: number) =>
    apiClient.get<RecordingStatusDto>(`${BASE}/recordings/${recordingId}/status`),

  // POST /recordings/{id}/upload (multipart, field "audio"). `audio` is a RN asset.
  // Returns the analysed feedback once processing completes.
  uploadAudio: (
    recordingId: number,
    audio: { uri: string; name: string; type: string },
    onProgress?: (pct: number) => void,
  ) => {
    const form = new FormData();
    form.append('audio', { uri: audio.uri, name: audio.name, type: audio.type } as any);
    return apiClient.post<B2CCounselingFeedbackDto>(`${BASE}/recordings/${recordingId}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // large audio uploads must not hit the default request timeout
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.min(100, Math.round((e.loaded * 100) / e.total)));
      },
    });
  },

  // GET /recordings/{id}/feedback → full AI-coach feedback.
  getFeedback: (recordingId: number) =>
    apiClient.get<B2CCounselingFeedbackDto>(`${BASE}/recordings/${recordingId}/feedback`),

  // GET /my-sessions?pageSize=... → a plain LIST (not PaginatedResult).
  getMySessions: (pageSize = 10) =>
    apiClient.get<B2CCounselingFeedbackDto[]>(`${BASE}/my-sessions`, { params: { pageSize } }),

  // GET /quality-overview → admin counselor-quality leaderboard (PaginatedResult).
  // Mirrors web b2cAiCoachService.getQualityOverview(params). B2CAdmin-only server-side.
  getQualityOverview: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<PaginatedResult<CounselorQualityOverviewItem>>(`${BASE}/quality-overview`, { params }),
};
