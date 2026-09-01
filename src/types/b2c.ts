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
  /** The family agreed a specific slot — carries B2CLead.appointmentAt. */
  | 'AppointmentBooked'
  | 'DocumentPending'
  | 'CounselingBooked'
  | 'CounselingDone'
  /** The counselor demoed the product. Sits alongside CounselingDone, not instead of it. */
  | 'DemoDone'
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
  'New', 'Contacted', 'Interested', 'AppointmentBooked', 'DocumentPending', 'CounselingBooked',
  'CounselingDone', 'DemoDone', 'ApplicationSent', 'FollowUp', 'Converted', 'NotInterested', 'Lost',
];

/** Stages that mean nobody is visiting this student again. */
export const B2C_TERMINAL_STAGES: B2CLeadStage[] = ['Converted', 'NotInterested', 'Lost'];

/**
 * The stage whose whole content is a date and time. It cannot be saved from a note alone, and
 * the route planner builds the day around it — see `appointmentAt` on the lead DTOs.
 */
export const B2C_APPOINTMENT_STAGE: B2CLeadStage = 'AppointmentBooked';

/**
 * Activity types a user may LOG. 'Note' is deliberately absent: every type already carries a
 * required Notes field, so it only duplicated the box beneath it. Existing Note activities
 * still render — this list is what can be created (web parity, B2CLeadDetail.jsx).
 */
export const B2C_ACTIVITY_TYPES = ['Call', 'Visit', 'WhatsApp', 'Email', 'Session'] as const;

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
  // Address parts the API now returns on the list row too, so a card can show one compact
  // line and the full address without fetching the detail.
  area?: string | null;
  pincode?: string | null;
  fullAddress?: string | null;
  grade?: string | null;
  board?: string | null;
  nationality?: string | null;
  reasonifySyncStatus?: string | null;
  reasonifyStudentId?: number | null;
  stage: string;
  priority: string;
  leadScore: number;
  source: string;
  assignedAgentName?: string | null;
  assignedAgentId?: number | null;
  assignedCounselorName?: string | null;
  assignedCounselorId?: number | null;
  siblingFlag: boolean;

  /** When the family is expecting the agent (UTC instant). Null unless a visit is booked. */
  appointmentAt?: string | null;
  /** What was agreed for that visit — on the list row so a card can reschedule without a fetch. */
  appointmentNotes?: string | null;

  /**
   * The note written when this lead was moved INTO the stage it currently sits in — i.e. why
   * it is where it is. Every screen showing a stage is a screen where the reader is asking
   * that question, so it rides on the list row rather than living inside a dialog.
   */
  currentStageNote?: string | null;
  currentStageNoteBy?: string | null;
  currentStageNoteAt?: string | null;

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
  /** Credited at creation; shown read-only because no edit can move coins already granted. */
  referralCode?: string | null;
  /** What was agreed for the booked visit. */
  appointmentNotes?: string | null;
  /** Why the last Reasonify push did not land — an edit can save locally and fail remotely. */
  reasonifySyncError?: string | null;
  /** The student joined a parent account a sibling already had; it keeps its own password. */
  reasonifyParentLinked?: boolean;
  alternateMobile?: string | null;
  email?: string | null;
  parentName?: string | null;
  parentMobile?: string | null;
  parentEmail?: string | null;
  schoolName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  reasonifyBoardId?: number | null;
  reasonifyLanguageId?: number | null;
  reasonifyGradeId?: number | null;
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

/** Reasonify Board / Language / Grade lookup option (GET /b2c/leads/lookups/*). */
export interface B2CLookupOption {
  id: number;
  name: string;
}

/** Decrypted student + parent Reasonify login for a lead (GET /b2c/leads/{id}/credentials). */
export interface B2CLeadCredentialsDto {
  leadId?: number;
  /** Blank for a phone-only student — they sign in to Reasonify with studentMobile. */
  studentEmail?: string | null;
  /** The student's Reasonify login when they have no email of their own. */
  studentMobile?: string | null;
  studentPassword?: string | null;
  parentEmail?: string | null;
  parentPassword?: string | null;
  /**
   * The student joined a parent account that ALREADY existed (a sibling is enrolled there).
   * That account kept its own password, so the one captured on this lead is not a working
   * login and must not be offered as one.
   */
  parentAccountLinked?: boolean;
  reasonifySyncStatus?: string | null;
  reasonifySyncError?: string | null;
  reasonifyStudentId?: number | null;
  reasonifyParentId?: number | null;
}

/**
 * A lead scheduled for a visit on a given day — what the Route Planner, Weekly Plan and
 * Calendar all read. `appointmentAt` is the lead's booked slot when it has one; the planner
 * needs the TIME, not just the day, to order a route around fixed commitments.
 */
export interface B2CPlannedVisitDto {
  id: number;
  agentId: number;
  agentName: string;
  leadId: number;
  studentName: string;
  mobileNumber?: string | null;
  city?: string | null;
  area?: string | null;
  stage?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  appointmentAt?: string | null;
  plannedDate: string;
  sortOrder: number;
  notes?: string | null;
  assignedByAdmin: boolean;
  status: string;
  createdAt: string;
}

export type B2CNationality = 'Indian' | 'NRI';
export const B2C_NATIONALITIES: B2CNationality[] = ['Indian', 'NRI'];

/**
 * Mirrors SalesCRM.Core/DTOs/B2C/B2CLeadDtos.cs `CreateB2CLeadRequest`. Everything marked
 * required below is [Required] server-side: the same request provisions the student AND
 * parent Reasonify accounts, so the parent's details and both passwords are as mandatory as
 * the student's, and the Reasonify board/medium/grade ids are what the registration call
 * actually needs (it takes a numeric GradeId, not a label).
 */
export interface CreateB2CLeadRequest {
  studentName: string;
  parentName: string;
  mobileNumber: string;
  parentMobile: string;
  alternateMobile?: string | null;
  email: string;
  parentEmail: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName: string;
  nationality: B2CNationality;
  reasonifyBoardId: number;
  reasonifyLanguageId: number;
  reasonifyGradeId: number;
  studentPassword: string;
  parentPassword: string;

  /**
   * The Agent/Counselor code credited for this student. REQUIRED by the server
   * (CreateB2CLeadRequest.ReferralCode is [Required]) — it is what earns the student their
   * 500-coin Reasonify signup bonus. An agent or counselor may only credit themselves; a
   * B2CAdmin picks from the active roster. See b2cUserService.getReferralOptions().
   */
  referralCode: string;
  area?: string | null;
  city: string;
  state: string;
  pincode: string;
  fullAddress?: string | null;
  enrollmentTimeline: B2CEnrollmentTimeline;
  source: B2CLeadSource;
  sourceReference?: string | null;
  notes?: string | null;
  assignToAgentId?: number | null;
  overrideDuplicate?: boolean;
}

/**
 * Partial update — every field is optional and only what is sent gets written
 * (UpdateLeadAsync applies each property only when it is non-null). Passwords are absent by
 * design: they are captured once at creation and read back through the credentials endpoint.
 */
export interface UpdateB2CLeadRequest {
  studentName?: string;
  parentName?: string | null;
  mobileNumber?: string;
  parentMobile?: string | null;
  priority?: B2CLeadPriority;
  alternateMobile?: string | null;
  email?: string | null;
  parentEmail?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName?: string | null;
  nationality?: B2CNationality | null;
  reasonifyBoardId?: number | null;
  reasonifyLanguageId?: number | null;
  reasonifyGradeId?: number | null;
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
  /** Assigned once at creation and never regenerated (e.g. "VIR@123"). B2CAdmin can edit it. */
  referralCode?: string | null;

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

  /**
   * Payout / KYC. All four are [Required] on the server's create DTO — a staff member who
   * cannot be paid is not a usable record, so they are collected up front rather than chased
   * later. Validated against the same rules as PayoutValidation server-side.
   */
  panNumber: string;
  aadhaarNumber: string;
  accountNumber: string;
  ifscCode: string;
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

/**
 * One selectable referral code (GET /b2c/users/referral-codes). An agent or counselor gets a
 * single-entry list — their own — which the create form prefills and locks.
 */
export interface B2CReferralOptionDto {
  userId: number;
  name: string;
  role: string;
  referralCode: string;
  isManager?: boolean;
}

/** One lead's resolved position. `source`: stored | geocoded | unresolved. */
export interface LeadCoordinateDto {
  leadId: number;
  latitude?: number | null;
  longitude?: number | null;
  source: string;
}

/**
 * [origin][destination] driving cost grids in the order the points were sent.
 * Durations SECONDS, distances METRES; -1 means no drivable route (never treat it as zero).
 */
export interface RouteMatrixDto {
  durations: number[][];
  distances: number[][];
}

/** One stop of a saved day, carrying whatever the GPS trail has since confirmed. */
export interface RouteStopDto {
  id: number;
  leadId: number;
  studentName: string;
  stopOrderIndex: number;
  isFixedAppointment: boolean;
  scheduledArrivalTime: string;
  estimatedDepartureTime: string;
  latitude: number;
  longitude: number;
  visited: boolean;
  actualArrivedAt: string | null;
  actualDepartedAt: string | null;
  /** Minutes late against the promise; negative is early, null until confirmed. */
  arrivalVarianceMinutes: number | null;
}

export interface RoutePlanDto {
  id: number;
  agentId: number;
  planDate: string;
  totalEstimatedDistanceKm: number;
  totalEstimatedDurationMinutes: number;
  totalActualDistanceKm: number | null;
  optimizationMethod: string;
  status: 'Planned' | 'Active' | 'Completed' | 'PartiallyCompleted';
  completedAt: string | null;
  stops: RouteStopDto[];
  unvisitedCount: number;
}

export interface SaveRoutePlanRequest {
  planDate: string;
  agentId?: number | null;
  totalEstimatedDistanceKm: number;
  totalEstimatedDurationMinutes: number;
  optimizationMethod: string;
  stops: {
    leadId: number;
    stopOrderIndex: number;
    isFixedAppointment: boolean;
    scheduledArrivalTime: string;
    estimatedDepartureTime: string;
    latitude: number;
    longitude: number;
  }[];
}
