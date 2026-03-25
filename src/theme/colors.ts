import { UserRole, LeadStage } from '../types';

// ─── Raw Palette ──────────────────────────────────────────────────────────────
export const Palette = {
  white: '#FFFFFF',
  black: '#000000',

  gray50:  '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  teal500:   '#0d9488',
  teal700:   '#00695C',
  teal50:    '#E0F2F1',

  purple600: '#7c3aed',
  purple900: '#4A148C',
  purple50:  '#F3E5F5',

  orange600: '#ea580c',
  orange800: '#E65100',
  orange50:  '#FFF3E0',

  blue600:   '#2563eb',
  blue900:   '#0D47A1',
  blue50:    '#E3F2FD',
  blue400:   '#3B82F6',
  blue300:   '#0EA5E9',

  green500:  '#22C55E',
  green400:  '#10B981',

  yellow500: '#F59E0B',
  yellow600: '#F97316',

  red500:    '#EF4444',

  indigo500: '#6366F1',
  indigo400: '#8B5CF6',

  cyan500:   '#14B8A6',

  rose600:   '#E11D48',
  rose50:    '#FFF1F2',
  rose900:   '#9F1239',
} as const;

// ─── Semantic Colors ──────────────────────────────────────────────────────────
export const Colors = {
  // Surfaces
  background:   Palette.gray50,
  surface:      Palette.white,
  surfaceAlt:   Palette.gray100,
  border:       Palette.gray200,
  borderLight:  Palette.gray100,

  // Text
  textPrimary:   Palette.gray900,
  textSecondary: Palette.gray700,
  textTertiary:  Palette.gray500,
  textMuted:     Palette.gray400,
  textInverse:   Palette.white,

  // Status
  success: Palette.green500,
  warning: Palette.yellow500,
  danger:  Palette.red500,
  info:    Palette.blue400,

  // Input
  inputBg:          Palette.gray50,
  inputBorder:      Palette.gray200,
  inputBorderFocus: Palette.teal500,
  inputText:        Palette.gray900,
  inputLabel:       Palette.gray700,
  inputError:       Palette.red500,
  placeholder:      Palette.gray400,

  // Tab bar
  tabBarBg:      Palette.white,
  tabBarInactive: Palette.gray400,

  // ─── Role Themes ────────────────────────────────────────────────────────────
  roles: {
    FO:  { primary: Palette.teal500,   light: Palette.teal50,   dark: Palette.teal700   },
    ZH:  { primary: Palette.purple600, light: Palette.purple50, dark: Palette.purple900 },
    RH:  { primary: Palette.orange600, light: Palette.orange50, dark: Palette.orange800 },
    SH:  { primary: Palette.blue600,   light: Palette.blue50,   dark: Palette.blue900   },
    SCA: { primary: Palette.rose600,   light: Palette.rose50,   dark: Palette.rose900   },
  } as Record<UserRole, { primary: string; light: string; dark: string }>,

  // ─── Stage Colors ────────────────────────────────────────────────────────────
  stages: {
    NewLead:               Palette.gray500,
    Contacted:             Palette.blue400,
    Qualified:             Palette.blue300,
    DemoStage:             Palette.indigo400,
    DemoDone:              Palette.indigo500,
    ProposalSent:          Palette.yellow500,
    Negotiation:           Palette.yellow600,
    ContractSent:          Palette.cyan500,
    Won:                   Palette.green500,
    ImplementationStarted: Palette.green400,
    Lost:                  Palette.red500,
  } as Record<LeadStage, string>,

  // ─── Activity Colors ─────────────────────────────────────────────────────────
  activities: {
    Visit:    Palette.teal500,
    Call:     Palette.blue400,
    Demo:     Palette.indigo400,
    Proposal: Palette.yellow500,
    FollowUp: Palette.yellow600,
    Contract: Palette.green500,
  } as Record<string, string>,

  // ─── Outcome Colors ──────────────────────────────────────────────────────────
  outcomes: {
    Positive: Palette.green500,
    Neutral:  Palette.gray500,
    Negative: Palette.red500,
    Pending:  Palette.yellow500,
  } as Record<string, string>,

  // ─── Notification Colors ─────────────────────────────────────────────────────
  notifications: {
    Urgent:   Palette.red500,
    Reminder: Palette.yellow500,
    Success:  Palette.green500,
    Warning:  Palette.yellow600,
    Info:     Palette.blue400,
  } as Record<string, string>,
} as const;

// ─── Color Helper Functions ───────────────────────────────────────────────────
export const getScoreColor = (score: number): string => {
  if (score >= 70) return Palette.green500;
  if (score >= 40) return Palette.yellow500;
  return Palette.red500;
};

export const getProgressColor = (pct: number): string => {
  if (pct >= 70) return Palette.green500;
  if (pct >= 40) return Palette.yellow500;
  return Palette.red500;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'On Track':
    case 'Strong':     return Palette.green500;
    case 'At Risk':
    case 'Good':       return Palette.blue400;
    case 'Underperforming':
    case 'Weak':       return Palette.red500;
    default:           return Palette.gray500;
  }
};

export const getTargetStatusColor = (status: string): string => {
  switch (status) {
    case 'Approved':    return Palette.green500;
    case 'InProgress':  return Palette.blue400;
    case 'Submitted':   return Palette.yellow500;
    case 'Rejected':
    case 'Overdue':     return Palette.red500;
    default:            return Palette.gray500;
  }
};
