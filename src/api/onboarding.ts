import { apiClient } from './client';
import { OnboardAssignment, OnboardFilters, PaginatedResult } from '../types';

/**
 * Mirrors UpdateOnboardRequest (OnboardDtos.cs:36). Every field is optional and the
 * service applies each only when present, so partial updates are safe and will not
 * blank the fields the caller left out.
 */
export interface UpdateOnboardRequest {
  status?: string;
  completionPercentage?: number;
  notes?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}

export const onboardingApi = {
  getAll: (filters?: OnboardFilters) =>
    apiClient.get<PaginatedResult<OnboardAssignment>>('/onboarding', { params: filters }),
  getById: (id: number) => apiClient.get<OnboardAssignment>(`/onboarding/${id}`),
  /**
   * OnboardingController exposes exactly one update route — [HttpPut("{id}")] taking
   * UpdateOnboardRequest { Status?, CompletionPercentage?, Notes?, ScheduledStartDate?,
   * ScheduledEndDate? }. The two PATCH routes previously called from here
   * (`/onboarding/{id}/progress` and `/onboarding/{id}/status`) do not exist on the
   * server, so every progress and status update from mobile 404'd. Web has always
   * used this route (onboardService.js:7).
   *
   * Note the controller rejects FO callers outright (`if (UserRole == "FO") return Forbid()`).
   */
  update: (id: number, payload: UpdateOnboardRequest) =>
    apiClient.put<OnboardAssignment>(`/onboarding/${id}`, payload),

  updateProgress: (id: number, completionPercentage: number, notes?: string) =>
    apiClient.put<OnboardAssignment>(`/onboarding/${id}`, { completionPercentage, notes }),

  updateStatus: (id: number, status: string) =>
    apiClient.put<OnboardAssignment>(`/onboarding/${id}`, { status }),
};
