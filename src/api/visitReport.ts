import { apiClient } from './client';
import { CreateVisitReportRequest, VisitField, CreateVisitFieldRequest } from '../types';

/**
 * `getByActivity` / `getBySchoolVisit` removed — VisitReportsController exposes
 * only `[HttpGet] GetVisitReports([FromQuery] int? userId, [FromQuery] string? date)`;
 * neither `visit-reports/activity/{id}` nor `visit-reports/visit/{id}` exists.
 */
export const visitReportApi = {
  getAll: (params?: { userId?: number; date?: string }) =>
    apiClient.get<any[]>('/visit-reports', { params }),
  create: (data: CreateVisitReportRequest) =>
    apiClient.post('/visit-reports', data),

  /**
   * POST /visit-reports/upload-media (multipart) — VisitReportsController.cs:65
   *   public async Task<IActionResult> UploadMedia(IFormFile file, [FromForm] string mediaType, ...)
   * The file part MUST be named `file`; `mediaType` is a separate form field and
   * must be exactly "photo" | "video" | "audio" (the switch lowercases it, anything
   * else returns 400 "Invalid media type").
   * Responds `Ok(ApiResponse<object>.Ok(new { url = result.PublicUrl, mediaType, contentType }))`
   * — the URL field is literally `url`.
   */
  uploadMedia: (
    file: { uri: string; name: string; type: string },
    mediaType: 'photo' | 'video' | 'audio',
    onProgress?: (pct: number) => void,
  ) => {
    const fd = new FormData();
    fd.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    fd.append('mediaType', mediaType);
    return apiClient.post<{ url: string; mediaType: string; contentType: string }>(
      '/visit-reports/upload-media',
      fd,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0, // 50MB video uploads must not hit the default request timeout
        onUploadProgress: (e: any) => {
          if (!onProgress || !e.total) return;
          onProgress(Math.min(100, Math.round((e.loaded * 100) / e.total)));
        },
      },
    );
  },

  // Visit field configuration (SH admin)
  getFields: () => apiClient.get<VisitField[]>('/visit-reports/fields'),
  createField: (data: CreateVisitFieldRequest) =>
    apiClient.post<VisitField>('/visit-reports/fields', data),
  updateField: (id: number, data: Partial<CreateVisitFieldRequest>) =>
    apiClient.put<VisitField>(`/visit-reports/fields/${id}`, data),
  deleteField: (id: number) =>
    apiClient.delete(`/visit-reports/fields/${id}`),
};
