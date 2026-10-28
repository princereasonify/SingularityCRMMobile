import { Platform } from 'react-native';
import { LeadStage, ApprovalStatus, UserRole } from '../types';
import { Colors } from '../theme';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

// ─── API ──────────────────────────────────────────────────────────────────────
/**
 * Base URL from .env, with one platform correction.
 *
 * The Android emulator runs behind its own NAT: `localhost` there resolves to
 * the EMULATOR, not to the Mac running the backend. The host is reachable at the
 * special alias 10.0.2.2. iOS simulators share the host's network stack, so
 * `localhost` is already correct there.
 *
 * Rewriting here means .env carries ONE local line that works on both, instead
 * of needing a hand-edit every time you switch simulator — which is the usual
 * cause of "the backend is running but the app can't reach it" on Android.
 *
 * Only localhost/127.0.0.1 is touched. A LAN IP (physical device) or the live
 * https:// host passes through untouched.
 */
const resolveBaseUrl = (raw: string): string => {
  if (Platform.OS !== 'android') return raw;
  return raw.replace(/\/\/(localhost|127\.0\.0\.1)(:|\/)/, '//10.0.2.2$2');
};

export const API_BASE_URL = resolveBaseUrl(ENV_API_BASE_URL);

/**
 * Public privacy policy. Google Play requires a live policy linked in the store listing AND
 * inside the app. It is a static page in Sales_CRM_Web/public, served from the live portal —
 * singularitycrm.com is a parked domain and must never be linked again.
 */
export const PRIVACY_POLICY_URL = 'https://sales.singularity-learn.com/privacy-policy.html';

/** True when pointed at a local backend — handy for a debug badge or logging. */
export const IS_LOCAL_API = /\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
  API_BASE_URL,
);

/*
 * There is deliberately NO Google Maps key on the client any more.
 *
 * Every place, geocoding and directions lookup goes through our own API (`/routes/places/*`,
 * `/routes/geocode/reverse`, `/routes/directions`), which holds an IP-restricted key. These
 * are Google *web service* APIs, and the "restrict this key to my Android app" setting does
 * not cover them — only the Maps SDK — so a key inlined here could never have been secured.
 * The Maps SDK key that draws the map itself lives in AndroidManifest.xml, where an Android
 * app restriction does apply.
 */


// ─── Color aliases (theme is the single source of truth) ─────────────────────
export { Colors, getScoreColor, getProgressColor, getStatusColor, getTargetStatusColor } from '../theme';
export const ROLE_COLORS         = Colors.roles;
export const STAGE_COLORS        = Colors.stages;
export const ACTIVITY_COLORS     = Colors.activities;
export const OUTCOME_COLORS      = Colors.outcomes;
export const NOTIFICATION_COLORS = Colors.notifications;

// ─── Stage Labels ─────────────────────────────────────────────────────────────
export const STAGE_LABELS: Record<LeadStage, string> = {
  NewLead:               'New Lead',
  Contacted:             'Contacted',
  Qualified:             'Qualified',
  DemoStage:             'Demo Stage',
  DemoDone:              'Demo Done',
  ProposalSent:          'Proposal Sent',
  Negotiation:           'Negotiation',
  ContractSent:          'Contract Sent',
  Won:                   'Won',
  ImplementationStarted: 'Implementation',
  Lost:                  'Lost',
};

export const ALL_STAGES: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted', 'Lost',
];

// ─── Stage rules ──────────────────────────────────────────────────────────────
/*
 * Port of web's src/data/leadStages.js — the same rules LeadService / DealService enforce:
 *  - Won comes only from an approved deal (Create Deal), never from a drag or an edit.
 *  - Lost comes only from Mark Lost, which records a reason.
 *  - A Won lead can move on to Implementation Started (managers only); closed leads otherwise stay put.
 */
export const stageLabel = (stage?: string | null): string =>
  (stage && STAGE_LABELS[stage as LeadStage]) || stage || '';

/** Open pipeline stages, in order — the ones a lead can be moved between freely. */
export const OPEN_STAGES: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent',
];

export const CLOSED_STAGES: LeadStage[] = ['Won', 'ImplementationStarted', 'Lost'];
export const isClosedStage = (stage?: string | null) => CLOSED_STAGES.includes(stage as LeadStage);

/** Stages from which a deal can be created (DealService.DealableStages). */
export const DEALABLE_STAGES: LeadStage[] = ['DemoDone', 'ProposalSent', 'Negotiation', 'ContractSent', 'Won'];

/** Why a move is refused, or null when it's allowed. */
export function stageMoveError(from: string, to: string, role?: string): string | null {
  if (from === to) return null;
  if (to === 'Won') return 'A lead becomes Won when its deal is approved. Create the deal instead.';
  if (to === 'Lost') return 'Use Mark Lost (with a reason) to close a lead as lost.';
  if (to === 'ImplementationStarted') {
    if (from !== 'Won') return 'Only a Won lead can move to Implementation Started.';
    if (role === 'FO') return 'Your manager moves a Won lead to Implementation Started.';
    return null;
  }
  if (isClosedStage(from)) return `A ${stageLabel(from)} lead can't be moved back into the pipeline.`;
  return null;
}

/** Stages offered in the Edit Lead dropdown for a lead currently at `current`. */
export function editableStages(current: string, role?: string): LeadStage[] {
  const list: LeadStage[] = isClosedStage(current) ? [current as LeadStage] : [...OPEN_STAGES];
  if (current === 'Won' && role !== 'FO') list.push('ImplementationStarted');
  return list;
}

/** Deal approval states → label + tone (resolve the tone to a theme colour at the call site). */
export const APPROVAL_LABELS: Record<ApprovalStatus, { label: string; tone: 'neutral' | 'positive' | 'warn' | 'negative' }> = {
  Draft:        { label: 'Draft', tone: 'neutral' },
  SelfApproved: { label: 'Self-approved', tone: 'positive' },
  PendingZH:    { label: 'Awaiting Zonal Head', tone: 'warn' },
  PendingRH:    { label: 'Awaiting Regional Head', tone: 'warn' },
  PendingSH:    { label: 'Awaiting Sales Head', tone: 'warn' },
  Approved:     { label: 'Approved', tone: 'positive' },
  Rejected:     { label: 'Rejected', tone: 'negative' },
};

/** Who may act on a deal in each pending state (SCA can act on all of them). */
export const APPROVER_ROLE: Partial<Record<ApprovalStatus, UserRole>> = { PendingZH: 'ZH', PendingRH: 'RH', PendingSH: 'SH' };

/** Rupees rounded to paise — the same rounding DealService.Money uses. */
export const money = (v: unknown): number => Math.round((Number(v) || 0) * 100 + Number.EPSILON) / 100;

/**
 * The approver a deal will be routed to — DealService.RouteForApproval: by discount
 * (≤10 self, ≤20 ZH, ≤30 RH, above that SH), lifted above the creator's own level, then lifted
 * again past a level with nobody to act on it (no zone → no ZH, no region → no RH).
 * As on web, `undefined` means "assume present"; only an explicit null (the server's
 * "no zone/region assigned") escalates.
 */
export function approvalRoute(
  discount: number,
  creatorRole?: string,
  creatorZoneId: number | null | boolean = true,
  creatorRegionId: number | null | boolean = true,
): { level: string; tone: 'success' | 'warning' | 'error'; approver: string; selfApproved?: boolean } {
  let level = discount <= 10 ? 0 : discount <= 20 ? 1 : discount <= 30 ? 2 : 3;
  const creatorLevel = ({ ZH: 1, RH: 2, SH: 3, SCA: 3 } as Record<string, number>)[creatorRole || ''] || 0;
  if (level > 0 && creatorLevel >= level) level = Math.min(creatorLevel + 1, 3);
  if (level === 1 && creatorZoneId == null) level = 2;
  if (level === 2 && creatorRegionId == null) level = 3;
  return ([
    { level: 'Self-Approved', tone: 'success', approver: 'You', selfApproved: true },
    { level: 'Zonal Head Approval', tone: 'warning', approver: 'Zonal Head' },
    { level: 'Regional Head Approval', tone: 'warning', approver: 'Regional Head' },
    { level: 'Sales Head Approval', tone: 'error', approver: 'Sales Head' },
  ] as const)[level];
}

// ─── Static Dropdown Data ─────────────────────────────────────────────────────
export const BOARDS            = ['CBSE', 'ICSE', 'IB', 'State Board', 'IGCSE', 'Cambridge', 'Other'];
export const SCHOOL_TYPES      = ['Private', 'Government', 'Semi-Government', 'International', 'Franchise', 'Trust'];
export const LEAD_SOURCES      = ['Field Visit', 'Reference', 'Cold Call', 'Exhibition', 'Social Media', 'Website', 'Referral', 'Partner'];
export const PRODUCT_MODULES   = ['AI Voice', 'Curriculum', 'AI Videos', 'Lab Simulator', 'ERP', 'Homework', 'Exam'];
export const PAYMENT_TERMS     = ['100% Upfront', '50% Upfront, 50% Post Go-Live', 'Quarterly', 'Annual'];
export const CONTRACT_DURATIONS = ['1 Year', '2 Years', '3 Years', '5 Years'];
export const PAYMENT_STATUSES  = ['Pending', 'Partial', 'Paid'];
export const INTEREST_LEVELS   = ['High', 'Medium', 'Low'];
export const DEMO_MODES        = ['Online', 'Offline'];
export const ACTIVITY_TYPES    = ['Visit', 'Call', 'Demo', 'Proposal', 'FollowUp', 'Contract'];
export const ACTIVITY_OUTCOMES = ['Positive', 'Neutral', 'Negative', 'Pending'];

// ─── Kanban Columns ───────────────────────────────────────────────────────────
export const KANBAN_COLUMNS = [
  { id: 'col1', title: 'New / Contacted',        stages: ['NewLead', 'Contacted'] as LeadStage[] },
  { id: 'col2', title: 'Qualified',               stages: ['Qualified'] as LeadStage[] },
  { id: 'col3', title: 'Demo Stage',              stages: ['DemoStage', 'DemoDone'] as LeadStage[] },
  { id: 'col4', title: 'Proposal / Negotiation',  stages: ['ProposalSent', 'Negotiation', 'ContractSent'] as LeadStage[] },
  { id: 'col5', title: 'Won / Implementation',    stages: ['Won', 'ImplementationStarted'] as LeadStage[] },
];

// ─── Reports ──────────────────────────────────────────────────────────────────
export const REPORTS = [
  { id: 1, title: 'Monthly Performance',   description: 'Track monthly sales performance across all FOs', category: 'Performance', roles: ['ZH', 'RH', 'SH', 'SCA'] },
  { id: 2, title: 'Deal Aging',            description: 'Deals by age and stage with risk flags',         category: 'Pipeline',    roles: ['ZH', 'RH', 'SH', 'SCA'] },
  { id: 3, title: 'Conversion Funnel',     description: 'Stage-by-stage conversion rates',                category: 'Pipeline',    roles: ['ZH', 'RH', 'SH', 'SCA'] },
  { id: 4, title: 'Lost Deal Analysis',    description: 'Why deals are being lost and patterns',          category: 'Analysis',    roles: ['RH', 'SH', 'SCA'] },
  { id: 5, title: 'Territory Coverage',    description: 'Geographic coverage and gap analysis',           category: 'Territory',   roles: ['RH', 'SH', 'SCA'] },
  { id: 6, title: 'Team Leaderboard',      description: 'Ranked performance by team member',              category: 'Performance', roles: ['ZH', 'RH', 'SH', 'SCA'] },
  { id: 7, title: 'Revenue Forecast',      description: 'Projected revenue based on pipeline',            category: 'Finance',     roles: ['RH', 'SH', 'SCA'] },
  { id: 8, title: 'School Onboarding',     description: 'Post-sale onboarding tracking',                  category: 'Onboarding',  roles: ['ZH', 'RH', 'SH', 'SCA'] },
  { id: 9, title: 'Custom Report Builder', description: 'Build custom reports with filters',              category: 'Custom',      roles: ['RH', 'SH', 'SCA'] },
];
