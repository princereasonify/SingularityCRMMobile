import { apiClient } from '../client';

/** B2C objections / re-engagement + counseling — mirrors B2CObjectionsController.cs. */
const BASE = '/b2c/objections';

export const b2cObjectionService = {
  escalate: (leadId: number, payload: any) => apiClient.post<any>(`${BASE}/escalate/${leadId}`, payload),
  create: (payload: any) => apiClient.post<any>(BASE, payload),
  getForLead: (leadId: number) => apiClient.get<any[]>(`${BASE}/lead/${leadId}`),
  // Counselor queue (own) / admin oversight (all, filter by counselorId/agentId/status).
  getQueue: (params?: any) => apiClient.get<any>(`${BASE}/queue`, { params }),
  update: (id: number, payload: any) => apiClient.patch<any>(`${BASE}/${id}`, payload),
  generateBrief: (id: number) => apiClient.post<any>(`${BASE}/${id}/brief`),
  generatePostSession: (id: number) => apiClient.post<any>(`${BASE}/${id}/post-session`),
};

// Typed feedback the agent captures on a Call/Visit (mirrors web).
export const FEEDBACK_TYPES = [
  { value: 'Interested', label: 'Interested', tone: 'positive' },
  { value: 'ReadyToBuy', label: 'Ready to buy', tone: 'positive' },
  { value: 'WantsDemo', label: 'Wants a demo', tone: 'positive' },
  { value: 'NeedsParentApproval', label: 'Needs parent approval', tone: 'warn' },
  { value: 'WantsScholarship', label: 'Wants scholarship/discount', tone: 'warn' },
  { value: 'ThinkingItOver', label: 'Thinking it over', tone: 'warn' },
  { value: 'CallbackLater', label: 'Call back later', tone: 'warn' },
  { value: 'PriceConcern', label: 'Price concern', tone: 'negative' },
  { value: 'Competitor', label: 'Chose competitor', tone: 'negative' },
  { value: 'TimingNotRight', label: 'Timing not right', tone: 'negative' },
  { value: 'TooFar', label: 'Too far', tone: 'negative' },
  { value: 'TrustConcern', label: 'Trust concern', tone: 'negative' },
  { value: 'NotInterested', label: 'Not interested', tone: 'negative' },
];

export const OBJECTION_TYPES = [
  { value: 'Price', label: 'Price / affordability' },
  { value: 'CourseContent', label: 'Course content' },
  { value: 'Timing', label: 'Timing / schedule' },
  { value: 'Competitor', label: 'Chose a competitor' },
  { value: 'TrustConcern', label: 'Trust concern' },
  { value: 'Distance', label: 'Distance / location' },
  { value: 'ParentDecision', label: 'Parent decision' },
  { value: 'Other', label: 'Other' },
];

export const OBJECTION_STATUSES = ['Open', 'InProgress', 'Resolved', 'LostCause'];
