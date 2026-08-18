import { apiClient } from '../client';

/** B2C expense reimbursement claims — mirrors B2CExpensesController.cs (base "api/b2c/expenses"). */
const BASE = '/b2c/expenses';

export interface SubmitExpenseBody {
  expenseDate: string;
  category: string;
  amount: number;
  description?: string;
}

export const EXPENSE_CATEGORIES = ['Travel', 'Food', 'Stay', 'Communication', 'Other'];

export const b2cExpenseService = {
  submit: (data: SubmitExpenseBody) => apiClient.post<any>(BASE, data),
  // file = RN asset { uri, name, type }
  uploadReceipt: (id: number, file: any) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<any>(`${BASE}/${id}/receipt`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getMine: (params?: any) => apiClient.get<any>(`${BASE}/mine`, { params }),
  // Admin review queue
  getAll: (params?: any) => apiClient.get<any>(BASE, { params }),
  approve: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/approve`, { note }),
  reject: (id: number, note?: string) => apiClient.patch<any>(`${BASE}/${id}/reject`, { note }),
  bulkApprove: (ids: number[]) => apiClient.post<any>(`${BASE}/bulk-approve`, { ids }),
};
