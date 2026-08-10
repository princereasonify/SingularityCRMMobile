import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import {
  B2CWalletDto,
  B2CBillingTransactionDto,
  PaymentInitiatedDto,
  VerifyPaymentRequest,
  B2CBillingPlan,
  B2C_BILLING_PLANS,
} from '../../types/b2c';

/**
 * B2C billing API — routes mirror B2CBillingController.cs (base "api/b2c/billing"),
 * whole controller is B2CAdmin-only. Payment is server-authoritative: initiate takes only
 * the plan name (credits are looked up server-side) and returns a hosted payment-page URL;
 * verify re-checks the gateway status server-to-server. There is no plans endpoint — the
 * catalogue is a client constant, matching the web client.
 */

const BASE = '/b2c/billing';

export interface B2CTransactionQuery {
  page?: number;
  pageSize?: number;
}

export const b2cBillingService = {
  getWallet: () => apiClient.get<B2CWalletDto>(`${BASE}/wallet`),

  getTransactions: (params?: B2CTransactionQuery) =>
    apiClient.get<PaginatedResult<B2CBillingTransactionDto>>(`${BASE}/transactions`, { params }),

  /** Static plan catalogue (no backend route). Returns a Promise for call-site symmetry. */
  getPlans: (): Promise<B2CBillingPlan[]> => Promise.resolve(B2C_BILLING_PLANS),

  // `credits` is sent for backward-compat but IGNORED by the server (see InitiatePaymentRequest).
  initiatePayment: (planName: string, credits?: number) =>
    apiClient.post<PaymentInitiatedDto>(`${BASE}/payment/initiate`, { planName, credits: credits ?? 0 }),

  verifyPayment: (data: VerifyPaymentRequest) =>
    apiClient.post<B2CWalletDto>(`${BASE}/payment/verify`, data),
};
