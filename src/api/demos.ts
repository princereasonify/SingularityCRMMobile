import { apiClient } from './client';
import {
  DemoAssignment,
  DemoFilters,
  CreateDemoRequest,
  DemoRecordingDto,
  RecordingFilters,
} from '../types';

/** Backend cap — SalesCRM.API DemosController.MaxRecordingBytes (300 MB). */
export const MAX_RECORDING_BYTES = 314_572_800;

/**
 * GET /demos returns `{ demos, total, page, limit }` — NOT `PaginatedResult`
 * (`items`/`totalCount`). Verified in DemosController.GetDemos:
 *   return Ok(ApiResponse<object>.Ok(new { demos, total, page, limit }));
 * Typing it as PaginatedResult is the same lie that made SchoolsListScreen
 * silently render 0 rows, and it really did break the Record Demo attach picker:
 * `res.data.items` is undefined, so the fallback handed `.map()` the envelope.
 */
export interface DemosListResult {
  demos: DemoAssignment[];
  total: number;
  page: number;
  limit: number;
}

/**
 * `role` filters by the *assignee's* role and is honoured only for SH/SCA, who are
 * the only callers whose GET /demos scope spans every tier. It is bound explicitly
 * server-side — ASP.NET silently drops query keys with no matching parameter, so an
 * unbound filter would appear to work while quietly returning unfiltered data:
 *   [HttpGet]
 *   public async Task<IActionResult> GetDemos([FromQuery] string? status, [FromQuery] int? assignedToId,
 *       [FromQuery] string? from, [FromQuery] string? to, [FromQuery] int page = 1, [FromQuery] int limit = 20,
 *       [FromQuery] string? role = null)
 */
export type DemoListFilters = DemoFilters & { role?: string };

export const demosApi = {
  getAll: (filters?: DemoListFilters) =>
    apiClient.get<DemosListResult>('/demos', { params: filters }),
  getById: (id: number) => apiClient.get<DemoAssignment>(`/demos/${id}`),
  create: (data: CreateDemoRequest) => apiClient.post<DemoAssignment>('/demos', data),
  update: (id: number, data: Partial<DemoAssignment> & { status?: string }) =>
    apiClient.put<DemoAssignment>(`/demos/${id}`, data),
  getCalendar: (from: string, to: string) =>
    apiClient.get<DemoAssignment[]>('/demos/calendar', { params: { from, to } }),

  // ─── Recordings (mirrors the web RecordingStudio) ──────────────────────────
  // Visibility is hierarchy-aware server-side: FO sees own, ZH zone, RH region,
  // SH/SCA all. SCA is read-only — upload/rename/delete/attach return 403.

  /** GET /demos/recordings — filters: mediaType, from, to, userId, search. */
  getRecordings: (filters?: RecordingFilters) =>
    apiClient.get<DemoRecordingDto[]>('/demos/recordings', { params: filters }),

  /**
   * POST /demos/recordings (multipart). `uri` is a local file path from the camera
   * or the audio recorder. onProgress reports 0–100 so the UI can show a bar.
   */
  uploadRecording: (
    file: { uri: string; name: string; type: string },
    mediaType: 'video' | 'audio' | 'screen',
    title?: string,
    durationSec?: number,
    onProgress?: (pct: number) => void,
  ) => {
    const fd = new FormData();
    fd.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    fd.append('mediaType', mediaType);
    if (title) fd.append('title', title);
    if (durationSec != null) fd.append('durationSec', String(Math.round(durationSec)));
    return apiClient.post<DemoRecordingDto>('/demos/recordings', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // large uploads must not hit the default request timeout
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return;
        onProgress(Math.min(100, Math.round((e.loaded * 100) / e.total)));
      },
    });
  },

  /** PATCH /demos/recordings/{id} — rename. */
  renameRecording: (id: number, title: string) =>
    apiClient.patch<DemoRecordingDto>(`/demos/recordings/${id}`, { title }),

  /** DELETE /demos/recordings/{id}. */
  deleteRecording: (id: number) => apiClient.delete(`/demos/recordings/${id}`),

  /** POST /demos/{demoId}/attach-recording. */
  attachRecording: (demoId: number, recordingId: number) =>
    apiClient.post<DemoAssignment>(`/demos/${demoId}/attach-recording`, { recordingId }),
};
