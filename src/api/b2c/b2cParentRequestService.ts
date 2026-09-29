/**
 * Parent "please call me" requests, from the Parent Portal (app.singularity-learn.com). Mirrors
 * web's api/b2c/b2cParentRequestService.js.
 *
 * Every method calls SalesCRM's own backend (Controllers/B2C/B2CParentRequestsController.cs,
 * route api/b2c/parent-requests), which relays server-to-server to EducationAPI using a shared
 * service key. As of when this was ported, EducationAPI's own side (its call-request endpoints
 * accepting SalesCRM's key, and its own database tables) may still be pending — if so, every
 * call here fails with a clear "not configured yet" message, not a crash and not fake data. The
 * same generic error-toast path every other screen uses will surface that message unchanged.
 */
import { apiClient } from '../client';

const BASE = '/b2c/parent-requests';

/** Verbatim from ParentCallCategories.Allowed on EducationAPI. */
export const PARENT_CATEGORIES = ['Coins & Payments', 'Study Plan', 'AI Assistant', 'Fees', 'Attendance', 'Other'];

export interface ParentCallOutcomeMeta { value: string; label: string; connected: boolean; }
/** Verbatim from ParentCallOutcomes.Allowed — no "NotInterested"; this is a support call. */
export const CALL_OUTCOMES: ParentCallOutcomeMeta[] = [
  { value: 'Connected', label: 'Connected', connected: true },
  { value: 'CallBackLater', label: 'Call back later', connected: true },
  { value: 'NotReachable', label: 'Not reachable', connected: false },
  { value: 'Busy', label: 'Busy', connected: false },
  { value: 'SwitchedOff', label: 'Switched off', connected: false },
  { value: 'WrongNumber', label: 'Wrong number', connected: false },
];

export interface CallRequestStatusMeta { value: string; label: string; tone: string; open: boolean; }
/** Waiting -> Assigned -> Confirmed -> Completed, with Attempted / Rescheduled / Cancelled as
 *  side branches. `open` mirrors EducationAPI's own ActiveStatuses default. */
export const CALL_REQUEST_STATUSES: CallRequestStatusMeta[] = [
  { value: 'Waiting', label: 'Waiting', tone: 'accent', open: true },
  { value: 'Assigned', label: 'Assigned', tone: 'violet', open: true },
  { value: 'Confirmed', label: 'Confirmed', tone: 'warn', open: true },
  { value: 'Attempted', label: 'Attempted', tone: 'negative', open: true },
  { value: 'Rescheduled', label: 'Rescheduled', tone: 'warn', open: true },
  { value: 'Completed', label: 'Completed', tone: 'positive', open: false },
  { value: 'Cancelled', label: 'Cancelled', tone: 'neutral', open: false },
];

export const outcomeMeta = (v?: string | null): ParentCallOutcomeMeta | null => CALL_OUTCOMES.find((o) => o.value === v) || null;
export const statusMeta = (v?: string | null): CallRequestStatusMeta | null => CALL_REQUEST_STATUSES.find((s) => s.value === v) || null;

export interface ParentCallRequestRow {
  parentCallRequestId: number;
  parentName?: string | null;
  studentName?: string | null;
  phoneNumber: string;
  category: string;
  message?: string | null;
  /** 'feedback' when this call request arrived merged with a feedback ticket. */
  source?: string | null;
  status: string;
  preferredSlotStart?: string | null;
  preferredSlotEnd?: string | null;
  confirmedSlotStart?: string | null;
  confirmedSlotEnd?: string | null;
  assignedAgentName?: string | null;
  createdAt: string;
}

export const b2cParentRequestService = {
  /** status omitted = EducationAPI's own ActiveStatuses default. */
  getQueue: (params?: { status?: string; mine?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<{ callRequests: ParentCallRequestRow[] }>(`${BASE}/queue`, { params: { page: 1, pageSize: 20, ...params } }),

  /** Race-safe on EducationAPI's own side; a losing click surfaces its message unchanged. */
  take: (id: number) => apiClient.post(`${BASE}/${id}/take`),

  /** confirmedSlotStart/End optional, defaults to the parent's preferred window when omitted. */
  confirm: (id: number, body?: { confirmedSlotStart?: string; confirmedSlotEnd?: string }) =>
    apiClient.post(`${BASE}/${id}/confirm`, body || {}),

  /** EducationAPI maps the outcome to the next status itself. */
  logCall: (id: number, body: { outcome: string; notes?: string; callbackAt?: string }) =>
    apiClient.post(`${BASE}/${id}/log`, body),
};
