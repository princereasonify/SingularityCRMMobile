import { apiClient } from './client';
import {
  Payment, PaymentFilters, CreatePaymentRequest, PaginatedResult,
  DirectPayment, CreateDirectPaymentRequest,
} from '../types';

export const paymentsApi = {
  getAll: (filters?: PaymentFilters) =>
    apiClient.get<PaginatedResult<Payment>>('/payments', { params: filters }),
  getById: (id: number) => apiClient.get<Payment>(`/payments/${id}`),
  create: (data: CreatePaymentRequest) => apiClient.post<Payment>('/payments', data),
  getByDeal: (dealId: number) => apiClient.get<Payment[]>(`/payments/deal/${dealId}`),
  verifyPayment: (id: number, data: { verified: boolean; notes?: string }) =>
    apiClient.patch<Payment>(`/payments/${id}/verify`, data),

  // SCA: direct payments (bonus, allowance, incentive)
  getDirectPayments: () => apiClient.get<DirectPayment[]>('/payments/direct'),
  createDirectPayment: (data: CreateDirectPaymentRequest) =>
    apiClient.post<DirectPayment>('/payments/direct', data),
};
