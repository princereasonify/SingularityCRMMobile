import { apiClient } from './client';
import { Payment, PaymentFilters, CreatePaymentRequest, PaginatedResult } from '../types';

export const paymentsApi = {
  getAll: (filters?: PaymentFilters) =>
    apiClient.get<PaginatedResult<Payment>>('/payments', { params: filters }),
  getById: (id: number) => apiClient.get<Payment>(`/payments/${id}`),
  create: (data: CreatePaymentRequest) => apiClient.post<Payment>('/payments', data),
  getByDeal: (dealId: number) => apiClient.get<Payment[]>(`/payments/deal/${dealId}`),
};
