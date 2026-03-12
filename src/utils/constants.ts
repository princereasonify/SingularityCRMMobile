import { UserRole, LeadStage } from '../types';

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://singularity-learn.com/sales-crm/api';

// ─── Role Colors ──────────────────────────────────────────────────────────────
export const ROLE_COLORS: Record<UserRole, { primary: string; light: string; dark: string }> = {
  FO: { primary: '#0d9488', light: '#E0F2F1', dark: '#00695C' },
  ZH: { primary: '#7c3aed', light: '#F3E5F5', dark: '#4A148C' },
  RH: { primary: '#ea580c', light: '#FFF3E0', dark: '#E65100' },
  SH: { primary: '#2563eb', light: '#E3F2FD', dark: '#0D47A1' },
};

// ─── Stage Colors ─────────────────────────────────────────────────────────────
export const STAGE_COLORS: Record<LeadStage, string> = {
  NewLead: '#6B7280',
  Contacted: '#3B82F6',
  Qualified: '#0EA5E9',
  DemoStage: '#8B5CF6',
  DemoDone: '#6366F1',
  ProposalSent: '#F59E0B',
  Negotiation: '#F97316',
  ContractSent: '#14B8A6',
  Won: '#22C55E',
  ImplementationStarted: '#10B981',
  Lost: '#EF4444',
};

export const STAGE_LABELS: Record<LeadStage, string> = {
  NewLead: 'New Lead',
  Contacted: 'Contacted',
  Qualified: 'Qualified',
  DemoStage: 'Demo Stage',
  DemoDone: 'Demo Done',
  ProposalSent: 'Proposal Sent',
  Negotiation: 'Negotiation',
  ContractSent: 'Contract Sent',
  Won: 'Won',
  ImplementationStarted: 'Implementation',
  Lost: 'Lost',
};

export const ALL_STAGES: LeadStage[] = [
  'NewLead', 'Contacted', 'Qualified', 'DemoStage', 'DemoDone',
  'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted', 'Lost',
];

// ─── Activity Colors ──────────────────────────────────────────────────────────
export const ACTIVITY_COLORS: Record<string, string> = {
  Visit: '#0d9488',
  Call: '#3B82F6',
  Demo: '#8B5CF6',
  Proposal: '#F59E0B',
  FollowUp: '#F97316',
  Contract: '#22C55E',
};

export const OUTCOME_COLORS: Record<string, string> = {
  Positive: '#22C55E',
  Neutral: '#6B7280',
  Negative: '#EF4444',
  Pending: '#F59E0B',
};

// ─── Static Dropdown Data ──────────────────────────────────────────────────────
export const BOARDS = ['CBSE', 'ICSE', 'IB', 'State Board', 'IGCSE'];
export const SCHOOL_TYPES = ['Private', 'Government', 'Franchise', 'Trust'];
export const LEAD_SOURCES = ['Field Visit', 'Referral', 'Website', 'Cold Call', 'Partner'];
export const PRODUCT_MODULES = [
  'AI Voice', 'Curriculum', 'AI Videos', 'Lab Simulator', 'ERP', 'Homework', 'Exam',
];
export const PAYMENT_TERMS = [
  '100% Upfront',
  '50% Upfront, 50% Post Go-Live',
  'Quarterly',
  'Annual',
];
export const CONTRACT_DURATIONS = ['1 Year', '2 Years', '3 Years', '5 Years'];
export const PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid'];
export const INTEREST_LEVELS = ['High', 'Medium', 'Low'];
export const DEMO_MODES = ['Online', 'Offline'];
export const ACTIVITY_TYPES = ['Visit', 'Call', 'Demo', 'Proposal', 'FollowUp', 'Contract'];
export const ACTIVITY_OUTCOMES = ['Positive', 'Neutral', 'Negative', 'Pending'];

// ─── Score Colors ──────────────────────────────────────────────────────────────
export const getScoreColor = (score: number): string => {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'On Track': return '#22C55E';
    case 'At Risk': return '#F59E0B';
    case 'Underperforming': return '#EF4444';
    case 'Strong': return '#22C55E';
    case 'Good': return '#3B82F6';
    case 'Weak': return '#EF4444';
    default: return '#6B7280';
  }
};

export const getTargetStatusColor = (status: string): string => {
  switch (status) {
    case 'Approved': return '#22C55E';
    case 'InProgress': return '#3B82F6';
    case 'Submitted': return '#F59E0B';
    case 'Rejected': return '#EF4444';
    case 'Overdue': return '#EF4444';
    default: return '#6B7280';
  }
};

export const getProgressColor = (pct: number): string => {
  if (pct >= 70) return '#22C55E';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
};

// ─── Notification Colors ──────────────────────────────────────────────────────
export const NOTIFICATION_COLORS: Record<string, string> = {
  Urgent: '#EF4444',
  Reminder: '#F59E0B',
  Success: '#22C55E',
  Warning: '#F97316',
  Info: '#3B82F6',
};

// ─── Kanban Columns ───────────────────────────────────────────────────────────
export const KANBAN_COLUMNS = [
  { id: 'col1', title: 'New / Contacted', stages: ['NewLead', 'Contacted'] as LeadStage[] },
  { id: 'col2', title: 'Qualified', stages: ['Qualified'] as LeadStage[] },
  { id: 'col3', title: 'Demo Stage', stages: ['DemoStage', 'DemoDone'] as LeadStage[] },
  { id: 'col4', title: 'Proposal / Negotiation', stages: ['ProposalSent', 'Negotiation', 'ContractSent'] as LeadStage[] },
  { id: 'col5', title: 'Won / Implementation', stages: ['Won', 'ImplementationStarted'] as LeadStage[] },
];

// ─── Reports ──────────────────────────────────────────────────────────────────
export const REPORTS = [
  { id: 1, title: 'Monthly Performance', description: 'Track monthly sales performance across all FOs', category: 'Performance', roles: ['ZH', 'RH', 'SH'] },
  { id: 2, title: 'Deal Aging', description: 'Deals by age and stage with risk flags', category: 'Pipeline', roles: ['ZH', 'RH', 'SH'] },
  { id: 3, title: 'Conversion Funnel', description: 'Stage-by-stage conversion rates', category: 'Pipeline', roles: ['ZH', 'RH', 'SH'] },
  { id: 4, title: 'Lost Deal Analysis', description: 'Why deals are being lost and patterns', category: 'Analysis', roles: ['RH', 'SH'] },
  { id: 5, title: 'Territory Coverage', description: 'Geographic coverage and gap analysis', category: 'Territory', roles: ['RH', 'SH'] },
  { id: 6, title: 'Team Leaderboard', description: 'Ranked performance by team member', category: 'Performance', roles: ['ZH', 'RH', 'SH'] },
  { id: 7, title: 'Revenue Forecast', description: 'Projected revenue based on pipeline', category: 'Finance', roles: ['RH', 'SH'] },
  { id: 8, title: 'School Onboarding', description: 'Post-sale onboarding tracking', category: 'Onboarding', roles: ['ZH', 'RH', 'SH'] },
  { id: 9, title: 'Custom Report Builder', description: 'Build custom reports with filters', category: 'Custom', roles: ['RH', 'SH'] },
];
