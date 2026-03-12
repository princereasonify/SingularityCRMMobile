import { LeadStage } from '../types';
import { Colors } from '../theme';

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://singularity-learn.com/sales-crm/api';

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
export const BOARDS            = ['CBSE', 'ICSE', 'IB', 'State Board', 'IGCSE'];
export const SCHOOL_TYPES      = ['Private', 'Government', 'Franchise', 'Trust'];
export const LEAD_SOURCES      = ['Field Visit', 'Referral', 'Website', 'Cold Call', 'Partner'];
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
  { id: 1, title: 'Monthly Performance',   description: 'Track monthly sales performance across all FOs', category: 'Performance', roles: ['ZH', 'RH', 'SH'] },
  { id: 2, title: 'Deal Aging',            description: 'Deals by age and stage with risk flags',         category: 'Pipeline',    roles: ['ZH', 'RH', 'SH'] },
  { id: 3, title: 'Conversion Funnel',     description: 'Stage-by-stage conversion rates',                category: 'Pipeline',    roles: ['ZH', 'RH', 'SH'] },
  { id: 4, title: 'Lost Deal Analysis',    description: 'Why deals are being lost and patterns',          category: 'Analysis',    roles: ['RH', 'SH'] },
  { id: 5, title: 'Territory Coverage',    description: 'Geographic coverage and gap analysis',           category: 'Territory',   roles: ['RH', 'SH'] },
  { id: 6, title: 'Team Leaderboard',      description: 'Ranked performance by team member',              category: 'Performance', roles: ['ZH', 'RH', 'SH'] },
  { id: 7, title: 'Revenue Forecast',      description: 'Projected revenue based on pipeline',            category: 'Finance',     roles: ['RH', 'SH'] },
  { id: 8, title: 'School Onboarding',     description: 'Post-sale onboarding tracking',                  category: 'Onboarding',  roles: ['ZH', 'RH', 'SH'] },
  { id: 9, title: 'Custom Report Builder', description: 'Build custom reports with filters',              category: 'Custom',      roles: ['RH', 'SH'] },
];
