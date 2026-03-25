// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'FO' | 'ZH' | 'RH' | 'SH' | 'SCA';

export type LeadStage =
  | 'NewLead'
  | 'Contacted'
  | 'Qualified'
  | 'DemoStage'
  | 'DemoDone'
  | 'ProposalSent'
  | 'Negotiation'
  | 'ContractSent'
  | 'Won'
  | 'ImplementationStarted'
  | 'Lost';

export type ActivityType = 'Visit' | 'Call' | 'Demo' | 'Proposal' | 'FollowUp' | 'Contract';

export type ActivityOutcome = 'Positive' | 'Neutral' | 'Negative' | 'Pending';

export type ApprovalStatus =
  | 'Draft'
  | 'SelfApproved'
  | 'PendingZH'
  | 'PendingRH'
  | 'Approved'
  | 'Rejected';

export type NotificationType = 'Urgent' | 'Reminder' | 'Success' | 'Warning' | 'Info';

export type TargetStatus =
  | 'Pending'
  | 'InProgress'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'Overdue';

export type PeriodType = 'Monthly' | 'Quarterly' | 'Annually';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface UserDto {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  zoneId?: number;
  zone?: string;
  regionId?: number;
  region?: string;
  zonalHead?: string;
  regionalHead?: string;
}

export interface Region {
  id: number;
  name: string;
  zoneCount?: number;
}

export interface Zone {
  id: number;
  name: string;
  regionId: number;
  region?: string;
}

export interface LeadListDto {
  id: number;
  school: string;
  board: string;
  city: string;
  type: string;
  stage: LeadStage;
  score: number;
  value: number;
  lastActivityDate?: string;
  source: string;
  foId?: number;
  foName?: string;
  assignedById?: number;
  assignedByName?: string;
  contactName?: string;
}

export interface LeadDto extends LeadListDto {
  state?: string;
  students?: number;
  closeDate?: string;
  notes?: string;
  lossReason?: string;
  contact?: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };
  activities?: ActivityDto[];
}

export interface ActivityDto {
  id: number;
  type: ActivityType;
  date: string;
  outcome: ActivityOutcome;
  notes?: string;
  gpsVerified: boolean;
  timeIn?: string;
  timeOut?: string;
  personMet?: string;
  personDesignation?: string;
  personPhone?: string;
  interestLevel?: string;
  nextAction?: string;
  nextFollowUpDate?: string;
  photoUrl?: string;
  demoMode?: string;
  conductedBy?: string;
  attendees?: number;
  feedback?: string;
  foId: number;
  foName?: string;
  leadId: number;
  school?: string;
}

export interface DealDto {
  id: number;
  leadId: number;
  school: string;
  foId: number;
  foName?: string;
  contractValue: number;
  discount: number;
  finalValue: number;
  paymentTerms: string;
  duration: string;
  modules: string[];
  notes?: string;
  approvalStatus: ApprovalStatus;
  submittedAt?: string;
  approverName?: string;
  approvalNotes?: string;
  students?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  numberOfLicenses?: number;
  paymentStatus?: string;
  contractPdfUrl?: string;
}

export interface TargetAssignmentDto {
  id: number;
  title: string;
  description?: string;
  targetAmount: number;
  achievedAmount: number;
  numberOfSchools: number;
  achievedSchools: number;
  numberOfLogins?: number;
  achievedLogins?: number;
  numberOfStudents?: number;
  achievedStudents?: number;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  status: TargetStatus;
  assignedToId: number;
  assignedToName?: string;
  assignedToRole?: string;
  assignedToZone?: string;
  assignedToRegion?: string;
  assignedById: number;
  assignedByName?: string;
  assignedByRole?: string;
  parentTargetId?: number;
  subTargetTotal?: number;
  subTargetSchoolsTotal?: number;
  subTargetCount?: number;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt?: string;
}

export interface NotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface TaskItemDto {
  id: number;
  scheduledTime: string;
  type: ActivityType;
  school: string;
  isDone: boolean;
  userId: number;
  leadId?: number;
}

// ─── Dashboard DTOs ───────────────────────────────────────────────────────────

export interface FoDashboardDto {
  revenue: number;
  revenueTarget: number;
  visitsThisWeek: number;
  demosThisMonth: number;
  dealsWon: number;
  pipelineLeads: number;
  pipelineValue: number;
  hotLeads: LeadListDto[];
  todaysTasks: TaskItemDto[];
  recentActivities: ActivityDto[];
}

export interface FoPerformanceDto {
  foId: number;
  name: string;
  avatar: string;
  territory: string;
  revenue: number;
  target: number;
  targetPct: number;
  visitsWeek: number;
  demosMonth: number;
  dealsWon: number;
  pipelineLeads: number;
  status: string;
}

export interface ZoneDashboardDto {
  zoneName: string;
  revenueMTD: number;
  revenueTarget: number;
  targetPct: number;
  activePipeline: number;
  pendingApprovals: number;
  winRate: number;
  atRiskFOs: number;
  foPerformance: FoPerformanceDto[];
  pendingDeals: DealDto[];
}

export interface ZoneSummaryDto {
  id: number;
  name: string;
  revenue: number;
  target: number;
  targetPct: number;
  winRate: number;
  pipeline: number;
  health: string;
}

export interface RegionDashboardDto {
  regionName: string;
  revenueMTD: number;
  revenueTarget: number;
  targetPct: number;
  activeLeads: number;
  dealsWon: number;
  winRate: number;
  forecastAccuracy: number;
  zones: ZoneSummaryDto[];
  revenueChart: { label: string; value: number }[];
}

export interface RegionSummaryDto {
  id: number;
  name: string;
  revenue: number;
  target: number;
  targetPct: number;
  schools: number;
  winRate: number;
  forecast: number;
  health: string;
}

export interface NationalDashboardDto {
  revenueMTD: number;
  revenueTarget: number;
  targetPct: number;
  schoolsWon: number;
  pipelineValue: number;
  winRate: number;
  regions: RegionSummaryDto[];
  revenueChart: { label: string; value: number }[];
  lossReasons: { reason: string; count: number }[];
}

export interface ScaDashboardDto extends NationalDashboardDto {
  totalUsers?: number;
  activeUsers?: number;
  totalRegions?: number;
  totalZones?: number;
  directPaymentsTotal?: number;
  pendingAllowances?: number;
}

export interface UserPerformanceDto {
  userId: number;
  name: string;
  role: UserRole;
  avatar: string;
  zone?: string;
  region?: string;
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalDeals: number;
  approvedDeals: number;
  revenue: number;
  target: number;
  targetPct: number;
  winRate: number;
  totalActivities: number;
  visitsThisMonth: number;
  demosThisMonth: number;
  status: string;
  leadsByStage?: Record<string, number>;
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: UserDto;
}

// ─── API Requests ──────────────────────────────────────────────────────────────

export interface CreateLeadRequest {
  school: string;
  board: string;
  city: string;
  state?: string;
  students?: number;
  type: string;
  source: string;
  value?: number;
  closeDate?: string;
  notes?: string;
  contactName: string;
  contactDesignation?: string;
  contactPhone: string;
  contactEmail?: string;
  foId?: number;
}

export interface CreateActivityRequest {
  type: ActivityType;
  date: string;
  outcome: ActivityOutcome;
  notes?: string;
  gpsVerified?: boolean;
  latitude?: number;
  longitude?: number;
  leadId: number;
  timeIn?: string;
  timeOut?: string;
  personMet?: string;
  personDesignation?: string;
  personPhone?: string;
  interestLevel?: string;
  nextAction?: string;
  nextFollowUpDate?: string;
  demoMode?: string;
  conductedBy?: string;
  attendees?: number;
  feedback?: string;
}

export interface CreateDealRequest {
  leadId: number;
  contractValue: number;
  discount: number;
  paymentTerms: string;
  duration: string;
  modules: string[];
  notes?: string;
  submitForApproval: boolean;
  contractStartDate?: string;
  contractEndDate?: string;
  numberOfLicenses?: number;
  paymentStatus?: string;
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export type TrackingSessionStatus = 'not_started' | 'active' | 'ended';

export interface TrackingSessionDto {
  sessionId: number;
  status: TrackingSessionStatus;
  startedAt?: string;
  endedAt?: string;
  sessionDate: string;
  totalDistanceKm: number;
  allowanceAmount: number;
  pingCount?: number;
  rawDistanceKm?: number;
  filteredDistanceKm?: number;
  reconstructedDistanceKm?: number;
  fraudScore?: number;
  isSuspicious?: boolean;
  fraudFlags?: string[];
}

export interface ButtonStateDto {
  startDayEnabled: boolean;
  endDayEnabled: boolean;
}

export interface SessionResponseDto {
  success: boolean;
  session: TrackingSessionDto;
  buttonState: ButtonStateDto;
}

export interface LiveLocationDto {
  userId: number;
  name: string;
  role: string;
  zoneId?: number;
  zoneName?: string;
  regionId?: number;
  regionName?: string;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  lastSeen: string;
  totalDistanceKm: number;
  allowanceAmount: number;
  status: string;
  fraudScore?: number;
  isSuspicious?: boolean;
  batteryLevel?: number;
}

export interface RoutePointDto {
  lat: number;
  lon: number;
  recordedAt: string;
  speedKmh?: number;
  isFiltered?: boolean;
  clusterGroup?: number;
}

export interface AllowanceDto {
  id: number;
  userId: number;
  userName: string;
  role: string;
  allowanceDate: string;
  distanceKm: number;
  ratePerKm: number;
  grossAmount: number;
  approved: boolean;
  approvedByName?: string;
  approvedAt?: string;
  remarks?: string;
  rawDistanceKm?: number;
  filteredDistanceKm?: number;
  fraudScore?: number;
  isSuspicious?: boolean;
}

export interface FraudReportDto {
  sessionId: number;
  userId: number;
  userName: string;
  sessionDate: string;
  fraudScore: number;
  isSuspicious: boolean;
  fraudFlags: string[];
  rawDistanceKm: number;
  filteredDistanceKm: number;
  reconstructedDistanceKm: number;
  totalPings: number;
  invalidPings: number;
  filteredPings: number;
  mockedPings: number;
}

export interface CreateTargetRequest {
  title: string;
  description?: string;
  targetAmount: number;
  numberOfSchools: number;
  numberOfLogins?: number;
  numberOfStudents?: number;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  assignedToId: number;
  parentTargetId?: number;
}

// ─── School ───────────────────────────────────────────────────────────────────

export interface SchoolFilters {
  search?: string;
  status?: string;
  board?: string;
  city?: string;
  page?: number;
  pageSize?: number;
}

export interface School {
  id: number;
  name: string;
  board?: string;
  type?: string;
  category: string;
  city?: string;
  state?: string;
  pincode?: string;
  fullAddress?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  studentCount?: number;
  principalName?: string;
  principalPhone?: string;
  isPartnerOffice: boolean;
  status: 'Active' | 'Inactive' | 'Blacklisted';
  contactCount?: number;
  leadCount?: number;
  lastVisitDate?: string;
  assignedFoId?: number;
  assignedFoName?: string;
}

export interface CreateSchoolRequest {
  name: string;
  board?: string;
  type?: string;
  category: string;
  city?: string;
  state?: string;
  pincode?: string;
  fullAddress?: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters?: number;
  studentCount?: number;
  principalName?: string;
  principalPhone?: string;
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export interface ContactFilters {
  search?: string;
  schoolId?: number;
  relationship?: string;
  page?: number;
  pageSize?: number;
}

export interface Contact {
  id: number;
  name: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  schoolId?: number;
  schoolName?: string;
  profession?: string;
  personalityNotes?: string;
  isDecisionMaker: boolean;
  isInfluencer: boolean;
  relationship: 'New' | 'Warm' | 'Strong' | 'Champion' | 'Detractor';
  lastContactedAt?: string;
}

export interface CreateContactRequest {
  name: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  schoolId?: number;
  profession?: string;
  personalityNotes?: string;
  isDecisionMaker?: boolean;
  isInfluencer?: boolean;
  relationship?: string;
}

// ─── Geofence ─────────────────────────────────────────────────────────────────

export interface GeofenceEventRequest {
  schoolId: number;
  eventType: 'Enter' | 'Exit';
  timestamp: string;
  latitude: number;
  longitude: number;
  distanceFromCenterMeters: number;
  durationMinutes?: number;
}

export interface SchoolVisitLog {
  id: number;
  schoolId: number;
  schoolName: string;
  enteredAt: string;
  exitedAt?: string;
  durationMinutes?: number;
  isVerified: boolean;
  hasVisitReport: boolean;
}

export interface TimeBreakdown {
  totalVisitMinutes: number;
  totalTravelMinutes: number;
  totalIdleMinutes: number;
  schoolsVisited: number;
  visits: SchoolVisitLog[];
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

export interface DemoFilters {
  search?: string;
  status?: string;
  mode?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DemoAssignment {
  id: number;
  leadId: number;
  schoolId: number;
  schoolName: string;
  requestedByName: string;
  assignedToName: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  demoMode: 'Online' | 'Offline' | 'Hybrid';
  status: 'Requested' | 'Approved' | 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled' | 'Rescheduled';
  outcome?: 'Successful' | 'Partial' | 'Unsuccessful' | 'Rescheduled';
  meetingLink?: string;
  notes?: string;
  feedback?: string;
  hasRecording: boolean;
}

export interface CreateDemoRequest {
  leadId: number;
  schoolId: number;
  assignedToId: number;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  demoMode: string;
  meetingLink?: string;
  notes?: string;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface OnboardAssignment {
  id: number;
  leadId: number;
  dealId?: number;
  schoolId: number;
  schoolName: string;
  assignedToName: string;
  status: 'Assigned' | 'InProgress' | 'Completed' | 'OnHold' | 'Cancelled';
  completionPercentage: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  modules?: string[];
}

// ─── Route Plan ───────────────────────────────────────────────────────────────

export interface RouteStop {
  order: number;
  schoolId: number;
  schoolName: string;
  latitude: number;
  longitude: number;
  estimatedArrival?: string;
  actualArrival?: string;
  visited: boolean;
}

export interface DailyRoutePlan {
  id: number;
  planDate: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Abandoned';
  stops: RouteStop[];
  totalEstimatedDistanceKm?: number;
  totalEstimatedDurationMinutes?: number;
}

export interface CreateRoutePlanRequest {
  planDate: string;
  stops: { schoolId: number; order: number }[];
}

// ─── Visit Report ─────────────────────────────────────────────────────────────

export interface CreateVisitReportRequest {
  schoolVisitLogId: number;
  activityId?: number;
  purpose: string;
  personMetId?: number;
  outcome: string;
  remarks?: string;
  nextAction: string;
  nextActionDate?: string;
  nextActionNotes?: string;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface AiAgendaItem {
  time: string;
  action: string;
  school: string;
  schoolId: number;
  reason: string;
}

export interface AiDailyPlan {
  id: number;
  planDate: string;
  suggestedAgenda: AiAgendaItem[];
  optimizedRoute?: string;
  dailyTips?: string;
  targetReminder?: string;
}

export interface AiDailyReport {
  summary: string;
  completed: string[];
  pending: string[];
  metrics: {
    visitTime: string;
    travelTime: string;
    idleTime: string;
    qualityScore: number;
  };
  tomorrowSuggestion?: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: number;
  eventType: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  schoolName?: string;
  isCompleted: boolean;
}

export interface CreateCalendarEventRequest {
  eventType: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  schoolId?: number;
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export interface PaymentFilters {
  search?: string;
  status?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DirectPayment {
  id: number;
  userId: number;
  userName?: string;
  type: 'Bonus' | 'Allowance' | 'Incentive';
  amount: number;
  description?: string;
  createdAt: string;
}

export interface CreateDirectPaymentRequest {
  userId: number;
  type: 'Bonus' | 'Allowance' | 'Incentive';
  amount: number;
  description?: string;
}

export interface Payment {
  id: number;
  dealId: number;
  schoolName?: string;
  amount: number;
  method: string;
  status: string;
  transactionId?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  chequeImageUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatePaymentRequest {
  dealId: number;
  amount: number;
  method: string;
  transactionId?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: 'Created' | 'Updated' | 'Deleted';
  changedFields?: Record<string, { old: any; new: any }>;
  performedByName: string;
  performedAt: string;
  ipAddress?: string;
}

export interface AuditFilters {
  entityType?: string;
  entityId?: number;
  userId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ─── Duplicate Detection ──────────────────────────────────────────────────────

export interface DuplicateMatch {
  matchedEntityId: number;
  matchedEntityName: string;
  matchType: 'Definite' | 'Probable' | 'Possible';
  matchReason: string;
  similarity: number;
}

// ─── Visit Priority Score ─────────────────────────────────────────────────────

export interface SchoolWithPriority extends School {
  visitPriorityScore: number;
  priorityLevel: 'High' | 'Medium' | 'Low';
  daysSinceLastVisit?: number;
}

// ─── Lead Score Breakdown ─────────────────────────────────────────────────────

export interface LeadScoreBreakdown {
  total: number;
  engagement: number;
  visitQuality: number;
  contactQuality: number;
  demoProgress: number;
  dealSignals: number;
}

// ─── AI Usage Quota ───────────────────────────────────────────────────────────

export interface AiUsageQuota {
  endpoint: string;
  used: number;
  limit: number;
  resetsAt: string;
}

// ─── Dashboard Widget ─────────────────────────────────────────────────────────

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'list' | 'map' | 'calendar' | 'leaderboard' | 'ai';
  title: string;
  position: number;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  updatedAt?: string;
}

// ─── User Settings ────────────────────────────────────────────────────────────

export interface UserSettings {
  language: 'en' | 'hi';
  whatsappNotifications: boolean;
  pushNotifications: boolean;
  dashboardWidgets?: DashboardWidget[];
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

export type OfflineActionType =
  | 'gps_ping'
  | 'geofence_event'
  | 'visit_report'
  | 'activity'
  | 'visit_start'
  | 'visit_end';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  data: any;
  timestamp: string;
  retryCount: number;
}
