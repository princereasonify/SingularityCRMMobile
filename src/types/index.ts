// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'FO' | 'ZH' | 'RH' | 'SH';

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
  success: boolean;
  message: string | null;
  data: {
    token: string;
    user: UserDto;
  };
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
}

export interface RoutePointDto {
  lat: number;
  lon: number;
  recordedAt: string;
  speedKmh?: number;
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
