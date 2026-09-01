import { Platform } from 'react-native';
import { LeadStage } from '../types';
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
