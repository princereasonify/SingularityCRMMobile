/**
 * Calling Agent — the call-centre desk role. Mirrors web's api/b2c/b2cCallingService.js and
 * backend's B2CCallingController (base "api/b2c/calling").
 */
import { apiClient } from '../client';

const BASE = '/b2c/calling';

/**
 * Call outcomes, mirroring B2CCallOutcome on the server. The `value` must match the C# enum
 * name exactly — JSON carries enums as names, so a typo here is a silently rejected request.
 *
 * `connected` marks the outcomes where a person actually answered; the Log Call form uses it to
 * decide whether the discussion note is required, the same rule the server enforces in
 * LogCallAsync. `terminal` outcomes clear the callback date server-side, so the form stops
 * asking for one.
 */
export interface CallOutcomeMeta { value: string; label: string; connected: boolean; terminal: boolean; }
export const CALL_OUTCOMES: CallOutcomeMeta[] = [
  { value: 'Connected', label: 'Connected', connected: true, terminal: false },
  { value: 'CallBackLater', label: 'Call back later', connected: true, terminal: false },
  { value: 'NotInterested', label: 'Not interested', connected: true, terminal: true },
  { value: 'NotReachable', label: 'Not reachable', connected: false, terminal: false },
  { value: 'Busy', label: 'Busy', connected: false, terminal: false },
  { value: 'SwitchedOff', label: 'Switched off', connected: false, terminal: false },
  { value: 'WrongNumber', label: 'Wrong number', connected: false, terminal: true },
];
export const outcomeMeta = (value?: string | null): CallOutcomeMeta | null =>
  CALL_OUTCOMES.find((o) => o.value === value) || null;

/** Objection types, mirroring B2CObjectionType — why the family is being handed to a counselor. */
export const HANDOFF_REASONS = [
  { value: 'CourseContent', label: 'Not following the material' },
  { value: 'Price', label: 'Price concern' },
  { value: 'Timing', label: 'Timing does not suit' },
  { value: 'TrustConcern', label: 'Not convinced / trust' },
  { value: 'ParentDecision', label: 'Parent wants to decide' },
  { value: 'Competitor', label: 'Considering a competitor' },
  { value: 'Distance', label: 'Distance' },
  { value: 'Other', label: 'Something else' },
];

export interface CallQueueRow {
  id: number;
  studentName: string;
  parentName?: string | null;
  parentMobile?: string | null;
  mobileNumber: string;
  city?: string | null;
  area?: string | null;
  grade?: string | null;
  stage: string;
  coinBalance?: number | null;
  reasonifySyncStatus?: string | null;
  bucket: 'Overdue' | 'DueToday' | 'NeverCalled' | 'Later';
  lastCalledAt?: string | null;
  lastCallNote?: string | null;
  callAttempts: number;
  nextCallAt?: string | null;
  appointmentAt?: string | null;
  assignedAgentName?: string | null;
  assignedCounselorName?: string | null;
  callLockedByName?: string | null;
  lockedByMe?: boolean;
}

export interface CallQueueSummary {
  overdue: number;
  dueToday: number;
  neverCalled: number;
  total: number;
}

export interface CallQueueResult {
  items: CallQueueRow[];
  totalCount: number;
  summary: CallQueueSummary;
}

export interface StaffAvailabilityRow {
  userId: number;
  name: string;
  isManager?: boolean;
  teamSize?: number;
  plannedVisits: number;
  activeLeads?: number | null;
  leadCap?: number | null;
  available: boolean;
  unavailableReason?: string | null;
  bookedSlots?: string[];
  /** Counselor availability only — B2CCounselors.Id, a different id space from userId. */
  counselorId?: number;
}

export interface CallDashboard {
  callsToday: number;
  connectedToday: number;
  overdue: number;
  dueToday: number;
  handoffsToday: number;
  upNext: CallQueueRow[];
  recentCalls: MyCallRow[];
}

export interface MyCallRow {
  id: number;
  leadId: number;
  studentName: string;
  parentName?: string | null;
  city?: string | null;
  outcome?: string | null;
  discussion?: string | null;
  notes?: string | null;
  calledAt: string;
  nextCallAt?: string | null;
  leadStage: string;
}

export interface MyCallsResult { items: MyCallRow[]; totalCount: number; connectedCount: number; }

export interface CallCenterCaller {
  userId: number;
  name: string;
  isActive: boolean;
  calls: number;
  connected: number;
  connectRate: number;
  callbacksBooked: number;
  handoffs: number;
  lastCallAt?: string | null;
}

export interface CallCenterSummary {
  startDate: string;
  endDate: string;
  totalCalls: number;
  connected: number;
  connectRate: number;
  callbacksBooked: number;
  handoffs: number;
  overdue: number;
  leadsNeverCalled: number;
  callers: CallCenterCaller[];
}

export interface CallLogRow extends MyCallRow { callerName: string; }
export interface CallLogResult { items: CallLogRow[]; totalCount: number; }

export const b2cCallingService = {
  getQueue: (params?: {
    page?: number; pageSize?: number; date?: string; search?: string;
    stage?: string; source?: string; priority?: string; neverCalled?: boolean;
  }) => apiClient.get<CallQueueResult>(`${BASE}/queue`, { params }),

  logCall: (payload: { leadId: number; outcome: string; discussion?: string; notes?: string; nextCallAt?: string }) =>
    apiClient.post<{ stageAdvanced?: boolean }>(`${BASE}/calls`, payload),

  /** Advisory only — resolves with `{ acquired, heldByName }`; a refusal is not an error. */
  acquireLock: (leadId: number) => apiClient.post<{ acquired: boolean; heldByName?: string }>(`${BASE}/leads/${leadId}/lock`),
  releaseLock: (leadId: number) => apiClient.delete(`${BASE}/leads/${leadId}/lock`),

  /** Who can take a visit on `date`. `kind` is 'Agent' or 'Counselor'; omit for both. Each row
   *  carries BOTH ids because the two assignment endpoints want different ones. */
  getAvailability: (params?: { kind?: 'Agent' | 'Counselor'; date?: string }) =>
    apiClient.get<{ staff: StaffAvailabilityRow[] }>(`${BASE}/availability`, { params }),

  /** The caller's own home screen — their day, plus what the queue is holding. */
  getDashboard: () => apiClient.get<CallDashboard>(`${BASE}/dashboard`),

  /** The caller's own calls. `from`/`to` are yyyy-mm-dd; `to` is inclusive of that whole day. */
  getMyCalls: (params?: { page?: number; pageSize?: number; from?: string; to?: string; outcome?: string }) =>
    apiClient.get<MyCallsResult>(`${BASE}/my-calls`, { params }),

  // ── Admin only ──────────────────────────────────────────────────────────────
  /** Call-centre performance + per-caller breakdown. Defaults to the last 7 days. */
  getCallCenterSummary: (params?: { from?: string; to?: string }) =>
    apiClient.get<CallCenterSummary>(`${BASE}/call-center/summary`, { params }),
  /** Every call by every caller. */
  getCallLog: (params?: { page?: number; pageSize?: number; from?: string; to?: string; callerId?: string; outcome?: string; search?: string }) =>
    apiClient.get<CallLogResult>(`${BASE}/call-center/calls`, { params }),
};
