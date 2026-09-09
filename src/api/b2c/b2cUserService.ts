import { apiClient } from '../client';
import { PaginatedResult } from '../../types';
import { B2CUserListDto, B2CReferralOptionDto, B2CPayoutDetailsDto } from '../../types/b2c';

/**
 * B2C user management API — mirrors B2CUsersController.cs (base "api/b2c/users").
 * Admin-only except `team` (Agent manager + admin). Matches web b2cUserService.js.
 */
const BASE = '/b2c/users';

export interface B2CUserQuery { page?: number; pageSize?: number; role?: string; }
export interface CreateB2CUserBody {
  name: string; email: string; mobile: string; password: string; role: string;
  address?: string; bio?: string; isManager?: boolean; agentIds?: number[];

  /**
   * Payout / KYC. All four are [Required] on the server's create DTO — a staff member who
   * cannot be paid is not a usable record, so they are collected up front rather than chased
   * later. Validated against the same rules as PayoutValidation server-side.
   */
  panNumber: string;
  aadhaarNumber: string;
  accountNumber: string;
  ifscCode: string;
}
export interface UpdateB2CUserBody {
  name?: string; mobile?: string; address?: string; bio?: string;
  isActive?: boolean; isManager?: boolean; agentIds?: number[];
  /** B2CAdmin override of the auto-generated referral code — trimmed/upper-cased server-side. */
  referralCode?: string;
  /** Login address. Editable from the counselor screen, which has no other route to it. */
  email?: string;
  /** Payout identity. Sent with the rest of the edit, exactly as the web dialog does — an
   *  omitted field is left untouched, an empty string clears it. */
  panNumber?: string;
  aadhaarNumber?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export const b2cUserService = {
  getUsers: (params?: B2CUserQuery) =>
    apiClient.get<PaginatedResult<B2CUserListDto>>(BASE, { params }),
  getUserById: (id: number) => apiClient.get<any>(`${BASE}/${id}`),
  createUser: (data: CreateB2CUserBody) => apiClient.post<any>(BASE, data),
  updateUser: (id: number, data: UpdateB2CUserBody) => apiClient.put<any>(`${BASE}/${id}`, data),
  toggleUser: (id: number) => apiClient.patch<any>(`${BASE}/${id}/toggle`),
  deleteUser: (id: number) => apiClient.delete(`${BASE}/${id}`),
  // Manager (Agent+IsManager) or admin: the agents reporting to this manager.
  getMyTeam: () => apiClient.get<any[]>(`${BASE}/team`),

  /**
   * Referral codes this caller may credit on a new lead. An admin gets every active agent and
   * counselor; an agent or counselor gets only their own, so the form can prefill it and leave
   * nothing to choose. Required on create — the server rejects a lead without one.
   */
  getReferralOptions: () =>
    apiClient.get<B2CReferralOptionDto[]>(`${BASE}/referral-codes`),

  /**
   * Admin-only: set a new password for a user who has locked themselves out.
   *
   * Present on the web User Management dialog since it was built, and missing here — so the
   * one thing an admin most often needs to do from a phone (a field agent phoning in, locked
   * out, mid-shift) was the one thing only the desktop could do.
   */
  resetPassword: (id: number, newPassword: string) =>
    apiClient.post<any>(`${BASE}/${id}/reset-password`, { newPassword }),

  /** Bank/UPI details used to pay a user's allowances and expenses. */
  getPayoutDetails: (id: number) =>
    apiClient.get<B2CPayoutDetailsDto>(`${BASE}/${id}/payout-details`),

  /** Set or clear any field. Omit one to leave it untouched; '' clears it. */
  updatePayoutDetails: (id: number, payload: Partial<B2CPayoutDetailsDto>) =>
    apiClient.put<any>(`${BASE}/${id}/payout-details`, payload),
};
