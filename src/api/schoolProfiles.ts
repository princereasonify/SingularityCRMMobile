import { apiClient } from './client';

/** Matches web's schoolProfileService.create/update — the controller binds
 *  `[FromQuery] string format = "csv"` on both POST and PUT, and uses it to decide
 *  whether the profile is emailed out as a CSV or an Excel attachment. Mobile used
 *  to omit it entirely, silently falling back to the "csv" default. */
export type ExportFormat = 'csv' | 'excel';

export const schoolProfilesApi = {
  getAll: () =>
    apiClient.get<any[]>('/school-profiles'),
  getById: (id: number) =>
    apiClient.get<any>(`/school-profiles/${id}`),
  create: (data: any, format: ExportFormat = 'csv') =>
    apiClient.post<any>('/school-profiles', data, { params: { format } }),
  update: (id: number, data: any, format: ExportFormat = 'csv') =>
    apiClient.put<any>(`/school-profiles/${id}`, data, { params: { format } }),
  getPrefill: (schoolId: number) =>
    apiClient.get<any>(`/school-profiles/prefill/${schoolId}`),
  getOnboardedSchools: () =>
    apiClient.get<any[]>('/school-profiles/onboarded-schools'),

  /**
   * SchoolProfileController: `[HttpPost("upload-logo")]` /
   * `public async Task<IActionResult> UploadLogo(IFormFile file, CancellationToken cancellationToken)`.
   *
   * The multipart field name MUST be `file` — that is the bound parameter name and
   * there is no [FromForm(Name=...)] override, so any other key binds nothing and the
   * controller answers "No file uploaded.". Web posts the same key
   * (schoolProfileService.js:22, `formData.append('file', file)`).
   *
   * Returns `ApiResponse<object>.Ok(new { logoUrl = result.PublicUrl }, ...)`, which the
   * client interceptor unwraps down to `{ logoUrl }`.
   */
  uploadLogo: (form: FormData) =>
    apiClient.post<{ logoUrl?: string }>('/school-profiles/upload-logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * `[HttpGet("export-csv")]` →
   * `return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "school_profiles.csv");`
   *
   * A raw file response, not an ApiResponse envelope, so `responseType: 'text'` keeps
   * axios from trying to JSON-parse it and the response interceptor leaves the string
   * alone (it only unwraps objects carrying a `success` key).
   */
  exportCsv: () =>
    apiClient.get<string>('/school-profiles/export-csv', { responseType: 'text' }),
};
