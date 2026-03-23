import { apiClient } from './client';
import { OnboardAssignment, OnboardFilters, PaginatedResult } from '../types';

export const onboardingApi = {
  getAll: (filters?: OnboardFilters) =>
    apiClient.get<PaginatedResult<OnboardAssignment>>('/onboarding', { params: filters }),
  getById: (id: number) => apiClient.get<OnboardAssignment>(`/onboarding/${id}`),
  updateProgress: (id: number, completionPercentage: number, notes?: string) =>
    apiClient.patch<OnboardAssignment>(`/onboarding/${id}/progress`, { completionPercentage, notes }),
  updateStatus: (id: number, status: string) =>
    apiClient.patch<OnboardAssignment>(`/onboarding/${id}/status`, { status }),
};
