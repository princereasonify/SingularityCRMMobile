import { apiClient } from '../client';

/** B2C convert-to-enrollment (payment) — mirrors B2CEnrollmentController.cs (base "api/b2c/enrollment"). */
const BASE = '/b2c/enrollment';

export const b2cEnrollmentService = {
  saveDraft: (payload: any) => apiClient.post<any>(BASE, payload),
  getByLead: (leadId: number) => apiClient.get<any>(`${BASE}/by-lead/${leadId}`),
  // file = RN asset { uri, name, type }
  uploadDocument: (id: number, docType: string, file: any) => {
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);
    return apiClient.post<any>(`${BASE}/${id}/document`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadProfilePic: (id: number, file: any) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<any>(`${BASE}/${id}/profile-pic`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  initiatePayment: (payload: any) => apiClient.post<any>(`${BASE}/payment/initiate`, payload),
  verifyPayment: (orderId: string) => apiClient.post<any>(`${BASE}/payment/verify`, { orderId }),
};

export const PLAN_MODES = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'HalfYearly', label: 'Half-yearly' },
  { value: 'Annually', label: 'Annually' },
  { value: 'OneTime', label: 'One-time' },
];
export const DOC_TYPES = ['Aadhaar', 'Marksheet', 'StudentPhoto', 'ParentId', 'Other'];
