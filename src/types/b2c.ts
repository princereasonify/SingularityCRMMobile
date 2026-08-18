/**
 * B2C (student-enrollment) domain types — mirror the backend DTOs/enums under
 * SalesCRM.Core/DTOs/B2C and SalesCRM.Core/Enums (B2C*.cs). Enum values are the
 * C# enum NAMES: the API is configured with a JsonStringEnumConverter, so both
 * request bodies and response DTOs carry enum names as strings (verified against
 * the working web client under Sales_CRM_Web/src/pages/b2c).
 *
 * Phase 1 = foundation + CRUD. The visit/recording native flows are phase 2; a
 * few activity signatures are stubbed here so callers can be wired ahead of time.
 */

// ─── Enums (string-name unions, matching backend exactly) ──────────────────────

export type B2CLeadStage =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'DocumentPending'
  | 'CounselingBooked'
  | 'CounselingDone'
  | 'ApplicationSent'
  | 'FollowUp'
  | 'Converted'
  | 'NotInterested'
  | 'Lost';

export type B2CLeadSource =
  | 'Website'
  | 'Facebook'
  | 'Instagram'
  | 'GoogleAds'
  | 'WhatsApp'
  | 'WalkIn'
  | 'Event'
  | 'Other';

export type B2CLeadPriority = 'Hot' | 'Warm' | 'Cold';

export type B2CEnrollmentTimeline =
  | 'Immediate'
  | 'OneToThreeMonths'
  | 'ThreeToSixMonths'
  | 'SixPlusMonths';

export type B2CPaymentMode =
  | 'Monthly'
  | 'Quarterly'
  | 'HalfYearly'
  | 'Annually'
  | 'OneTime';

export type B2CActivityTypeName =
  | 'Call'
  | 'Visit'
  | 'WhatsApp'
  | 'Email'
  | 'Session'
  | 'Note'
  | 'VisitClose'
  | 'DocumentUpload';

export type B2CAuthMethod = 'None' | 'OTP' | 'Selfie';

// ─── Option lists (value = enum name, label = display) ─────────────────────────

export const B2C_LEAD_STAGES: B2CLeadStage[] = [
  'New', 'Contacted', 'Interested', 'DocumentPending', 'CounselingBooked',
  'CounselingDone', 'ApplicationSent', 'FollowUp', 'Converted', 'NotInterested', 'Lost',
];

export const B2C_LEAD_SOURCES: B2CLeadSource[] = [
  'Website', 'Facebook', 'Instagram', 'GoogleAds', 'WhatsApp', 'WalkIn', 'Event', 'Other',
];

export const B2C_LEAD_PRIORITIES: B2CLeadPriority[] = ['Hot', 'Warm', 'Cold'];

export const B2C_ENROLLMENT_TIMELINES: { value: B2CEnrollmentTimeline; label: string }[] = [
  { value: 'Immediate', label: 'Immediate' },
  { value: 'OneToThreeMonths', label: '1–3 Months' },
  { value: 'ThreeToSixMonths', label: '3–6 Months' },
  { value: 'SixPlusMonths', label: '6+ Months' },
];

export const B2C_PAYMENT_MODES: B2CPaymentMode[] = [
  'Monthly', 'Quarterly', 'HalfYearly', 'Annually', 'OneTime',
];

// ─── Lead DTOs ─────────────────────────────────────────────────────────────────

export interface B2CLeadListDto {
  id: number;
  studentName: string;
  mobileNumber: string;
  city: string;
  state: string;
  grade?: string | null;
  board?: string | null;
  stage: string;
  priority: string;
  leadScore: number;
  source: string;
  assignedAgentName?: string | null;
  assignedAgentId?: number | null;
  assignedCounselorName?: string | null;
  assignedCounselorId?: number | null;
  siblingFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface B2CLeadStageHistoryDto {
  id: number;
  fromStage?: string | null;
  toStage: string;
  changedByName: string;
  notes?: string | null;
  changedAt: string;
}

export interface B2CLeadAssignmentHistoryDto {
  id: number;
  assignedToName: string;
  assignedByName: string;
  reassignReason?: string | null;
  assignedAt: string;
  relievedAt?: string | null;
}

export interface B2CSiblingLeadDto {
  id: number;
  studentName: string;
  stage: string;
  agentName?: string | null;
}

export interface B2CActivityListDto {
  id: number;
  type: string;
  outcome?: string | null;
  notes?: string | null;
  performedByName: string;
  authMethod: string;
  authVerified: boolean;
  geoStatus?: string | null;
  photoUrl?: string | null;
  selfieUrl?: string | null;
  studentIdCardUrl?: string | null;
  studentIdSchoolName?: string | null;
  studentIdBoard?: string | null;
  studentIdStandard?: string | null;
  nextFollowUpDate?: string | null;
  createdAt: string;
}

export interface B2CLeadDetailDto extends B2CLeadListDto {
  alternateMobile?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  pincode?: string | null;
  fullAddress?: string | null;
  enrollmentTimeline: string;
  sourceReference?: string | null;
  notes?: string | null;
  paymentMode?: string | null;
  confirmedAmount?: number | null;
  firstPaymentDate?: string | null;
  stageHistory: B2CLeadStageHistoryDto[];
  assignmentHistory: B2CLeadAssignmentHistoryDto[];
  recentActivities: B2CActivityListDto[];
  siblingLeads: B2CSiblingLeadDto[];
}

export interface CreateB2CLeadRequest {
  studentName: string;
  parentName?: string | null;
  mobileNumber: string;
  alternateMobile?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName?: string | null;
  area?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  fullAddress?: string | null;
  enrollmentTimeline: B2CEnrollmentTimeline;
  source: B2CLeadSource;
  sourceReference?: string | null;
  notes?: string | null;
  assignToAgentId?: number | null;
  overrideDuplicate?: boolean;
}

export interface UpdateB2CLeadRequest {
  studentName?: string;
  parentName?: string | null;
  mobileNumber?: string;
  priority?: B2CLeadPriority;
  alternateMobile?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName?: string | null;
  area?: string | null;
  city?: string;
  state?: string;
  pincode?: string | null;
  fullAddress?: string | null;
  enrollmentTimeline?: B2CEnrollmentTimeline;
  source?: B2CLeadSource;
  sourceReference?: string | null;
  notes?: string | null;
}

export interface ConvertLeadRequest {
  paymentMode: B2CPaymentMode;
  confirmedAmount: number;
  firstPaymentDate: string;
  activityId?: number | null;
}

export interface DuplicateCheckResult {
  isHardDuplicate: boolean;
  isSoftDuplicate: boolean;
  isClean: boolean;
  existingLeadId?: number | null;
  existingStudentName?: string | null;
  existingAgentName?: string | null;
  existingStage?: string | null;
  message?: string | null;
}

export interface BulkRowError {
  rowNumber: number;
  reason: string;
  studentName?: string | null;
  mobile?: string | null;
}

export interface BulkUploadResult {
  jobId: number;
  totalRows: number;
  successCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
  capBlockedCount: number;
  errors: BulkRowError[];
}

export interface B2CBulkJobDto {
  id: number;
  fileName?: string | null;
  status: string;
  totalRows: number;
  successCount: number;
  hardDuplicateCount: number;
  softDuplicateCount: number;
  errorCount: number;
  capBlockedCount: number;
  createdAt: string;
  completedAt?: string | null;
}

// ─── User DTOs (B2CUserDtos.cs) — agents, managers ──────────────────────────────

export interface B2CUserListDto {
  id: number;
  name: string;
  email: string;
  mobile?: string | null;
  role: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;

  // Manager info
  isManager: boolean;
  managerId?: number | null;
  managerName?: string | null;
  teamSize: number;
  teamAgentIds: number[];

  /** The city this person actually works, derived from their assigned leads' cities
   *  (most frequent wins). Null when they have no leads yet. Drives the
   *  "Name · City · N students" admin "view as" filter label. */
  primaryCity?: string | null;

  // Counselor-only extras (null for agents)
  counselorId?: number | null;
  bio?: string | null;
  /** Open (non-converted, non-deleted) student leads currently assigned to them. */
  activeLeadsCount?: number | null;
  avgAiScore?: number | null;
}

// ─── Counselor DTOs ────────────────────────────────────────────────────────────

export interface B2CCounselorListDto {
  id: number;
  userId: number;
  name: string;
  email: string;
  specializations: string[];
  isActive: boolean;
  /** Open (non-converted, non-deleted) student leads currently assigned to them. */
  activeLeadsCount: number;
  /** The city this counselor actually works, derived from their assigned leads'
   *  cities (most frequent wins). Null when they have no leads yet. */
  primaryCity?: string | null;
  avgAiScore?: number | null;
  createdAt: string;
}

export interface B2CCounselorDetailDto extends B2CCounselorListDto {
  mobile?: string | null;
  bio?: string | null;
  totalSessionsRecorded: number;
  conversionRate?: number | null;
}

/** Admin AI-coach quality leaderboard row (B2CAiCoachDtos.cs CounselorQualityOverviewItem). */
export interface CounselorQualityOverviewItem {
  counselorId: number;
  counselorName: string;
  totalSessions: number;
  avgScore: number;
  trend: string; // Improving / Declining / Stable
}

export interface CreateB2CCounselorRequest {
  name: string;
  email: string;
  mobile: string;
  password: string;
  specializations: string[];
  bio?: string | null;
}

export interface UpdateB2CCounselorRequest {
  name?: string;
  mobile?: string;
  specializations?: string[];
  bio?: string | null;
  isActive?: boolean;
}

// ─── Dashboard DTOs ────────────────────────────────────────────────────────────

export interface StageFunnelItem {
  stage: string;
  count: number;
}

export interface AgentPerformanceItem {
  agentId: number;
  agentName: string;
  activeLeads: number;
  leadCap: number;
  conversions: number;
  conversionPercent: number;
}

export interface GeoComplianceSummary {
  violationsThisMonth: number;
  unverifiedVisits: number;
  pendingSelfies: number;
  passRatePercent: number;
}

export interface SourceBreakdownItem {
  source: string;
  count: number;
}

export interface CounselorQualitySummary {
  avgScore: number;
  lowestScoringCounselor?: string | null;
  sessionsThisMonth: number;
}

export interface B2CAdminDashboardDto {
  totalLeadsThisMonth: number;
  leadsConvertedThisMonth: number;
  conversionRatePercent: number;
  activeAgents: number;
  activeCounselors: number;
  revenueThisMonth: number;
  pipeline: StageFunnelItem[];
  agentPerformance: AgentPerformanceItem[];
  geoCompliance: GeoComplianceSummary;
  sourceBreakdown: SourceBreakdownItem[];
  counselorQuality: CounselorQualitySummary;
}

export interface B2CAgentDashboardDto {
  activeLeads: number;
  leadCap: number;
  contactedToday: number;
  followUpsDueToday: number;
  conversionsThisMonth: number;
  leadsCreatedThisMonth: number;
  myPipeline: StageFunnelItem[];
  todayTasks: B2CActivityListDto[];
}

export interface CoachingScoreTrend {
  date: string;
  score: number;
}

export interface B2CCounselorDashboardDto {
  totalActiveAssignments: number;
  sessionsThisWeek: number;
  sessionsToday: number;
  avgAiScore: number;
  assignedLeads: B2CLeadListDto[];
  scoreTrend: CoachingScoreTrend[];
}

// ─── Activity DTOs ─────────────────────────────────────────────────────────────

export interface CreateB2CActivityRequest {
  leadId: number;
  type: B2CActivityTypeName;
  outcome?: string | null;
  notes?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  authMethod?: B2CAuthMethod;
  nextFollowUpDate?: string | null;
  // Student ID manual entry (used when there's no ID card to photograph).
  studentIdSchoolName?: string | null;
  studentIdBoard?: string | null;
  studentIdStandard?: string | null;
}

export interface OtpResult {
  success: boolean;
  message: string;
  attemptsRemaining: number;
}

// SendOtpRequest / VerifyOtpRequest / ApproveSelfieRequest — B2CActivityDtos.cs.
export interface SendOtpRequest {
  leadId: number;
}

export interface VerifyOtpRequest {
  leadId: number;
  otp: string; // exactly 6 chars server-side
}

export interface ApproveSelfieRequest {
  approved: boolean;
  note?: string | null;
}

// ─── AI Coach / recording DTOs (B2CAiCoachDtos.cs) ──────────────────────────────

export interface StartRecordingRequest {
  leadId: number;
  consentGiven: boolean;
}

export interface StartRecordingResult {
  recordingId: number;
  consentAt: string;
  status: string;
}

export interface DimensionScore {
  score: number;
  comment: string;
}

export interface RecordingStatusDto {
  recordingId: number;
  status: string;
  hasFeedback: boolean;
}

export interface B2CCounselingFeedbackDto {
  recordingId: number;
  leadStudentName: string;
  sessionDate: string;
  durationSeconds: number;
  status: string;
  overallScore: number;
  rapport: DimensionScore;
  needsDiscovery: DimensionScore;
  productKnowledge: DimensionScore;
  objectionHandling: DimensionScore;
  closing: DimensionScore;
  clarity: DimensionScore;
  empathy: DimensionScore;
  followUp: DimensionScore;
  strengths: string[];
  improvementAreas: string[];
  suggestedPhrases: string[];
  generatedAt?: string | null;
}

// ─── Billing DTOs ──────────────────────────────────────────────────────────────

export interface B2CWalletDto {
  id: number;
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  lastRechargeAt?: string | null;
  planExpiresAt?: string | null;
}

export interface B2CBillingTransactionDto {
  id: number;
  type: string;
  description: string;
  credits: number;
  balanceAfter: number;
  referenceId?: string | null;
  invoiceUrl?: string | null;
  createdAt: string;
}

export interface PaymentInitiatedDto {
  orderId: string;
  amount: number;
  currency: string;
  paymentUrl: string;
}

export interface VerifyPaymentRequest {
  orderId: string;
}

/** Client-side plan catalogue — the backend has no plans endpoint; it derives
 *  credits + price server-side from the plan name (verified: web B2CBilling.jsx
 *  keeps the same static list). */
export interface B2CBillingPlan {
  name: string;
  credits: number;
  price: number;
}

export const B2C_BILLING_PLANS: B2CBillingPlan[] = [
  { name: 'Starter', credits: 50, price: 50 },
  { name: 'Growth', credits: 200, price: 180 },
  { name: 'Pro', credits: 500, price: 400 },
];
