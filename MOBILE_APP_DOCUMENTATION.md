# SingularityCRM Mobile App — Complete Documentation

> **Platform**: React Native (iOS + Android)
> **API Base**: `https://singularity-learn.com/sales-crm/api`
> **Auth**: Bearer token (stored in AsyncStorage, auto-attached by Axios interceptor)

---

## Table of Contents

1. [Role Hierarchy & What Each Role Can Do](#1-role-hierarchy--what-each-role-can-do)
2. [Navigation Structure per Role](#2-navigation-structure-per-role)
3. [All Screens — What They Do](#3-all-screens--what-they-do)
4. [All API Calls — Endpoint + Purpose](#4-all-api-calls--endpoint--purpose)
5. [Data Models (Types)](#5-data-models-types)
6. [Tracking & Geofencing Architecture](#6-tracking--geofencing-architecture)
7. [Code-Level Architecture](#7-code-level-architecture)
8. [Constants & Configuration](#8-constants--configuration)
9. [File Structure Reference](#9-file-structure-reference)

---

## 1. Role Hierarchy & What Each Role Can Do

```
SCA (SuperSale Admin)           ← Top of hierarchy
  └── SH (Sales Head)           ← National
        └── RH (Regional Head)  ← Region
              └── ZH (Zonal Head) ← Zone
                    └── FO (Field Officer) ← Ground level
```

### FO — Field Officer
The FO is the ground-level sales person who physically visits schools.

**Can do:**
- View their own dashboard (revenue vs target, pipeline leads, visits, demos)
- Create & manage leads (school name, contact, deal value)
- View school list and school details (visit history, contacts)
- View contacts at schools
- Log activities (Visit, Call, Demo, Proposal, FollowUp, Contract) with GPS verification
- Use the Pipeline Kanban board to track lead stages
- View and accept AI Daily Plan (AI suggests which schools to visit today)
- View AI Daily Report (summary of what was done)
- Log calendar events (meetings, follow-ups)
- Start/End their tracking day (GPS session begins)
- View their own route on the map + historical routes by date
- View their travel allowance amount
- View their targets and submit progress
- View assigned schools on a map with geofence circles + planned route
- Open the route in Google Maps for navigation
- Create a visit report after school visits
- View and manage notifications
- Customize their dashboard layout

**Cannot do:**
- See other team members' locations
- Approve deals or allowances
- Create users
- Access financial reports
- Create direct payments

---

### ZH — Zonal Head
Manages a zone with multiple FOs underneath.

**Can do:**
- Everything FO can do (they also track their own day)
- View zone dashboard (zone revenue, FO performance, pending deal approvals)
- See all FOs' live GPS locations on the map
- Click any FO to view their individual route + stats
- Approve/reject travel allowances for their FOs
- View team performance screen (FO-level KPIs)
- Manage leads, schools, contacts for the whole zone
- View pipeline Kanban for the zone
- Create and manage users (FOs in their zone)
- Approve/reject deals submitted by FOs

**Cannot do:**
- See other zones or regions
- Access region-level reports
- Create SH or RH users

---

### RH — Regional Head
Manages a region with multiple zones underneath.

**Can do:**
- Everything ZH can do (scoped to region)
- View regional dashboard (region revenue, zone breakdown, revenue charts)
- See all ZHs and FOs live on map, grouped by zone
- View zone-level performance
- View regional reports (monthly performance, conversion funnel, leaderboard, etc.)
- Export reports (PDF / CSV / Excel)
- Manage leads and schools across the region

**Cannot do:**
- See other regions
- Access national dashboards
- Create SCA / SH users

---

### SH — Sales Head
Top of the sales hierarchy, has national visibility.

**Can do:**
- Everything RH can do (scoped nationally)
- View national dashboard (all regions, total revenue vs target, win rate, forecast accuracy)
- See all users live on map grouped by region → zone
- View national-level reports
- Generate AI management reports
- Create and manage all users below SH
- Approve deals across all regions

**Cannot do:**
- Create direct payments (Bonus/Allowance/Incentive)
- Manage SCA-level payments

---

### SCA — SuperSale Admin
The highest role. Full system visibility.

**Can do:**
- Everything SH can do
- View SCA Dashboard (national KPIs + user counts, region/zone totals, direct payments summary, pending allowances)
- See ALL users (SH, RH, ZH, FO) live on map with search + role filter
- Approve/manage direct payments (Bonus, Allowance, Incentive)
- Create SH users
- View and manage the Payments screen (SCA Payments with direct payment CRUD)
- Generate both daily and management AI reports
- View Pipeline (Kanban) for the entire company

**Cannot do:**
- Nothing is restricted at this level

---

## 2. Navigation Structure per Role

### FO — Bottom Tabs
| Tab | Screen | Description |
|-----|---------|-------------|
| Dashboard | FODashboard | Revenue, targets, pipeline, hot leads, tasks |
| Leads | LeadsListScreen | All leads with filters |
| Schools | SchoolsListScreen | All schools list |
| Calendar | CalendarScreen | Week view + events |
| My Day | MyDayTrackingScreen | GPS tracking session |
| Targets | TargetsScreen | View own targets |
| Settings | SettingsScreen | Profile, preferences |

### ZH — Bottom Tabs
| Tab | Screen | Description |
|-----|---------|-------------|
| Dashboard | ZHDashboard | Zone KPIs, FO grid, pending approvals |
| Leads | LeadsListScreen | Zone leads |
| Schools | SchoolsListScreen | Zone schools |
| Pipeline | PipelineScreen | Kanban board |
| Targets | TargetsScreen | Team targets |
| Team | PerformanceScreen | FO performance |
| My Day | MyDayTrackingScreen | Own GPS session |
| Live | LiveTrackingScreen | Team live map |
| Users | UserManagementScreen | Create/manage FOs |
| Settings | SettingsScreen | Profile |

### RH — Bottom Tabs
| Tab | Screen | Description |
|-----|---------|-------------|
| Dashboard | RHDashboard | Region KPIs, zone breakdown |
| Leads | LeadsListScreen | Region leads |
| Schools | SchoolsListScreen | Region schools |
| Pipeline | PipelineScreen | Kanban |
| Reports | ReportsScreen | 9 report types |
| Targets | TargetsScreen | Region targets |
| Team | PerformanceScreen | Zone/FO performance |
| My Day | MyDayTrackingScreen | Own GPS |
| Live | LiveTrackingScreen | Team live map |
| Settings | SettingsScreen | Profile |

### SH — Bottom Tabs
| Tab | Screen | Description |
|-----|---------|-------------|
| Dashboard | SHDashboard | National KPIs |
| Leads | LeadsListScreen | All leads |
| Schools | SchoolsListScreen | All schools |
| Pipeline | PipelineScreen | National Kanban |
| Reports | ReportsScreen | National reports |
| Targets | TargetsScreen | National targets |
| Team | PerformanceScreen | Region/ZH/FO performance |
| My Day | MyDayTrackingScreen | Own GPS |
| Live | LiveTrackingScreen | All users live map |
| Settings | SettingsScreen | Profile |

### SCA — Bottom Tabs
| Tab | Screen | Description |
|-----|---------|-------------|
| Dashboard | SCADashboard | Full national + user counts + payments |
| Leads | LeadsListScreen | All leads |
| Schools | SchoolsListScreen | All schools |
| Reports | ReportsScreen | Reports |
| Pipeline | PipelineScreen | Company-wide Kanban |
| Payments | ScaPaymentsScreen | Direct payments (Bonus/Allowance/Incentive) |
| Live | LiveTrackingScreen | All users live map with search + role filter |
| Users | UserManagementScreen | Full user + region/zone management |
| Settings | SettingsScreen | Profile |

### Stack Screens (available from anywhere via `navigation.navigate()`)
```
LeadDetail       → LeadDetailScreen       (slide from right)
AddLead          → AddLeadScreen          (slide from bottom)
EditLead         → AddLeadScreen          (slide from bottom, same form)
CreateDeal       → CreateDealScreen       (slide from bottom)
SchoolDetail     → SchoolDetailScreen     (slide from right)
AddSchool        → AddSchoolScreen        (slide from bottom)
ContactDetail    → ContactDetailScreen    (slide from right)
AddContact       → AddContactScreen       (slide from bottom)
ContactsList     → ContactsListScreen     (slide from right)
DemoList         → DemoListScreen         (slide from right)
DemoDetail       → DemoDetailScreen       (slide from right)
AssignDemo       → AssignDemoScreen       (slide from bottom)
OnboardList      → OnboardListScreen      (slide from right)
OnboardDetail    → OnboardDetailScreen    (slide from right)
AssignedSchools  → AssignedSchoolsScreen  (slide from right)  ← FO map of today's schools
VisitReport      → VisitReportScreen      (slide from bottom)
AiDailyPlan      → AiDailyPlanScreen      (slide from right)
AiDailyReport    → AiDailyReportScreen    (slide from right)
AiInsights       → AiInsightsScreen       (slide from right)
Payments         → PaymentsScreen         (slide from right)
DashboardCustomize → DashboardCustomizeScreen
UserManual       → UserManualScreen
AuditHistory     → AuditHistoryScreen
Notifications    → NotificationsScreen
Activities       → ActivityLogScreen
SchoolsList      → SchoolsListScreen
```

---

## 3. All Screens — What They Do

### Dashboard Screens

#### `FODashboard.tsx`
- **API**: `GET /dashboard/fo`
- **Shows**: Revenue vs target (progress bar), pipeline leads + value, visits this week, demos this month, deals won, hot leads list (top 5 by score), today's tasks, recent activities
- **Actions**: Tap "Today's Assigned Schools" banner → `AssignedSchoolsScreen`, tap lead → `LeadDetail`, tap "See All" → `LeadsListScreen`

#### `ZHDashboard.tsx`
- **API**: `GET /dashboard/zone`
- **Shows**: Zone name, revenue MTD vs target, active pipeline, pending approvals count, win rate, at-risk FOs count, FO performance grid (each FO's stats), pending deals list
- **Actions**: Approve/reject deals inline

#### `RHDashboard.tsx`
- **API**: `GET /dashboard/region`
- **Shows**: Region name, revenue MTD vs target, active leads, deals won, win rate, forecast accuracy, zone breakdown cards with revenue/target per zone, revenue chart (bar chart by month)

#### `SHDashboard.tsx`
- **API**: `GET /dashboard/national`
- **Shows**: National revenue vs target, schools won, pipeline value, win rate, region breakdown, revenue trend chart, loss reasons breakdown

#### `SCADashboard.tsx`
- **API**: `GET /dashboard/sca`
- **Shows**: Same as SH + total users, active users, total regions/zones, direct payments total, pending allowances, AI report generation buttons, direct payments card (list + create modal with type: Bonus/Allowance/Incentive), regional scorecard

---

### Lead Screens

#### `LeadsListScreen.tsx`
- **API**: `GET /leads` with params (page, pageSize, search, stage, status)
- **Shows**: Paginated list with lead score badge (color-coded), school name, city, stage badge, deal value
- **Filters**: All / Active / Hot / Won / Unassigned
- **Actions**: Tap → `LeadDetail`, "+" button → `AddLead`
- **Layout**: 1 column on phone, 2-column grid on tablet

#### `LeadDetailScreen.tsx`
- **API**: `GET /leads/:id`, `PUT /leads/:id`, `GET /ai/lead-score/:leadId`
- **Shows**: School details, stage progression bar (visual pipeline), contact info, lead score breakdown modal (AI-powered), deal value, activity timeline, assigned FO
- **Actions**: Create Deal, Mark as Lost, Edit, Add Activity

#### `AddLeadScreen.tsx`
- **API**: `POST /leads` (create) or `PUT /leads/:id` (edit), `GET /leads/check-duplicate`, `GET /leads/assignable-fos`
- **Form sections** (collapsible):
  1. School Info (name, board, type, student count)
  2. Location (city, state)
  3. Contact (name, designation, phone, email)
  4. Deal Estimate (value, close date, lead source)
  5. Additional (notes)
- **Validation**: school, city, contactPhone required
- **Duplicate check**: Runs before submit — warns if same school+city exists

---

### School Screens

#### `SchoolsListScreen.tsx`
- **API**: `GET /schools` with filters
- **Shows**: School name, city, board, type, student count, last visit date, contact count
- **Filters**: All / Active / Inactive / Blacklisted / Priority

#### `SchoolDetailScreen.tsx`
- **API**: `GET /schools/:id`, `GET /schools/:id/visit-history`
- **Tabs**: Details | Contacts | Visit History
- **Shows**: Full address, geofence radius, principal info, contact list, visit log with duration

#### `AddSchoolScreen.tsx`
- **API**: `POST /schools`, `GET /schools/check-duplicates`
- **Form**: Name, board, type, category, city, state, pincode, full address, lat/lon, geofence radius, principal name/phone
- **Duplicate check**: By name + city + proximity

---

### Contact Screens

#### `ContactsListScreen.tsx`
- **API**: `GET /contacts`
- **Filters**: All / Decision Makers / Influencers / Champions

#### `ContactDetailScreen.tsx`
- **API**: `GET /contacts/:id`
- **Shows**: Designation, department, relationship level, decision-maker/influencer flags

#### `AddContactScreen.tsx`
- **API**: `POST /contacts`, `POST /contacts/check-duplicates`
- **Form**: Name, designation, phone, email, relationship level, decision-maker/influencer flags

---

### Deal Screens

#### `CreateDealScreen.tsx`
- **API**: `POST /deals`, `GET /leads` (to pick lead)
- **Form**: Lead selection, contract value, discount %, modules (multi-select), payment terms, contract duration, contract start/end dates
- **Logic**: Shows approval level required based on discount tier (e.g., >20% discount → needs RH approval)

---

### Demo Screens

#### `DemoListScreen.tsx`
- **API**: `GET /demos`
- **Filters**: All / Today / Upcoming / Completed / Cancelled
- **Shows**: School, scheduled date/time, mode badge (Online/Offline/Hybrid), status

#### `DemoDetailScreen.tsx`
- **API**: `GET /demos/:id`, `PATCH /demos/:id/status`
- **Shows**: Full demo details, meeting link, outcome, feedback
- **Actions**: Update status, add outcome

#### `AssignDemoScreen.tsx`
- **API**: `POST /demos`
- **Form**: Lead, school, assigned user, date, time, mode, meeting link

---

### Onboarding Screens

#### `OnboardListScreen.tsx`
- **API**: `GET /onboarding`
- **Shows**: School, assigned team member, status badge, completion progress bar, scheduled dates
- **Filters**: All / Assigned / In Progress / Completed

#### `OnboardDetailScreen.tsx`
- **API**: `GET /onboarding/:id`, `PATCH /onboarding/:id/progress`, `PATCH /onboarding/:id/status`
- **Shows**: Module list, completion %, status
- **Actions**: Update completion percentage, update status

---

### Tracking Screens

#### `MyDayTrackingScreen.tsx`
- **APIs**: `POST /tracking/start-day`, `POST /tracking/end-day`, `GET /tracking/session/today`, `POST /tracking/ping`, `GET /tracking/route/:userId/:date`, `GET /tracking/allowances`
- **Shows**: Start/End day buttons, today's session info (distance km, allowance ₹, ping count), route map for selected date (last 7 days picker), allowances tab with approval actions
- **Background tracking**: Native iOS/Android modules (`startNativeTracking`, `stopNativeTracking`), pings every 30 seconds even when app is in background
- **Offline**: Pings queued in AsyncStorage when offline, batch-uploaded when reconnected

#### `LiveTrackingScreen.tsx`
- **API**: `GET /tracking/live-locations`, `GET /tracking/route/:userId/:date`, `PATCH /tracking/allowances/:id`
- **Three tabs**:
  - **Map**: India-centered map, all team members as colored pins (FO=blue, ZH=red, RH=purple, SH=cyan), status filter (All/Active/Ended), tap pin → info sheet → "Track This Person"
  - **Team**: Hierarchical list — ZH sees flat FO list, RH sees zone groups, SH sees region → zone groups, SCA sees all with search + role filter (SH/RH/ZH/FO)
  - **Allowances**: Date range picker, allowance list, approve/reject actions
- **Auto-refresh**: Every 30 seconds
- **Individual tracking**: Tap any person → full-screen view with their live marker, route polyline, day picker (last 7 days), distance/speed/battery stats

#### `AssignedSchoolsScreen.tsx`
- **API**: `GET /school-assignments/my?date=YYYY-MM-DD`
- **Shows**:
  - Map with numbered pins per school (color-coded: green = visited, unique color per index = pending)
  - Geofence circle around each school (radius from API)
  - Planned route polyline connecting schools in `visitOrder` order
  - Live "You" GPS pin (blue pill) — updates as FO moves
  - Bottom scrollable list of schools with visited/pending badge
  - Summary bar: "X of Y visited"
- **Actions**: Tap school pin → Callout bubble (name, city, visited status, time spent); tap list row → map pans to that school; "Open Route in Google Maps" → Linking.openURL with all schools as waypoints

---

### Calendar Screen

#### `CalendarScreen.tsx`
- **API**: `GET /calendar` (date range), `POST /calendar`, `PUT /calendar/:id`, `DELETE /calendar/:id`, `PATCH /calendar/:id/complete`
- **Shows**: Week strip (day selector), events list for selected day grouped by time
- **Event types**: Visit, Meeting, Demo, Task, Call, Other — each with distinct color
- **Actions**: Create event (modal), mark complete, delete

---

### Pipeline Screen

#### `PipelineScreen.tsx`
- **API**: `GET /leads/pipeline`
- **Shows**: Kanban board with 5 columns
  - Col 1: New / Contacted
  - Col 2: Qualified
  - Col 3: Demo Stage
  - Col 4: Proposal / Negotiation
  - Col 5: Won / Implementation
- **Cards**: School name, city, deal value (₹), lead score badge
- **Interactions**: Horizontal scroll between columns, pinch-to-zoom, drag-drop cards to change stage (updates stage via `PUT /leads/:id`)

---

### Target Screens

#### `TargetsScreen.tsx`
- **APIs**: `GET /targets/my`, `GET /targets/assigned`, `GET /targets/assignable-users`, `POST /targets`, `PUT /targets/:id/progress`, `PUT /targets/:id/submit`, `PUT /targets/:id/review`
- **Two tabs**:
  - **My Targets**: Own targets with progress bars, period badges (Monthly/Quarterly/Annual), days remaining, submit button
  - **Assigned Targets**: Targets assigned to team, review (approve/reject) actions
- **Create**: Modal to create new target (title, amount, schools, period, assignee)

---

### Performance Screen

#### `PerformanceScreen.tsx`
- **API**: `GET /dashboard/team-performance`, `GET /dashboard/performance-tracking`
- **Shows**: KPI grid (leads, deals, revenue, activities), expandable team member cards with detailed stats per person
- **Role behavior**: FO sees own data, ZH/RH/SH see team

---

### Reports Screen

#### `ReportsScreen.tsx`
- **APIs**: `GET /reports/*` (9 endpoints), `GET /reports/:id/export`
- **9 Reports**:
  1. Monthly Performance
  2. Deal Aging
  3. Conversion Funnel
  4. Lost Deal Analysis
  5. Territory Coverage
  6. Team Leaderboard
  7. Revenue Forecast
  8. School Onboarding
  9. Custom Report Builder
- **Filters**: Date range, zone, region, FO, period type
- **Export**: PDF / CSV / Excel via `Linking.openURL`

---

### Activities Screen

#### `ActivityLogScreen.tsx`
- **APIs**: `GET /activities`, `POST /activities`, `POST /activities/upload-photo`
- **Filters**: Type (Visit/Call/Demo/Proposal/FollowUp/Contract), Outcome
- **Create modal fields**: Type, date, outcome, time in/out, person met, designation, phone, interest level, next action, next follow-up date, demo mode, attendees, feedback, notes, photo upload

---

### Visit Report Screen

#### `VisitReportScreen.tsx`
- **API**: `POST /visit-reports`
- **Form**: Visit purpose, person met, outcome, key discussion points, next action, remarks
- **Triggered after**: School geofence exit in MyDayTrackingScreen

---

### AI Screens

#### `AiDailyPlanScreen.tsx`
- **APIs**: `GET /ai/daily-plan`, `POST /ai/daily-plan/accept`, `POST /ai/daily-plan/regenerate`, `GET /ai/usage-quota`
- **Shows**: AI-suggested agenda for today (school, time, action, reason), optimized route, daily tips, target reminder, quota usage
- **Actions**: Accept (select items), Regenerate

#### `AiDailyReportScreen.tsx`
- **API**: `GET /ai/daily-report`
- **Shows**: Day summary, completed items, pending items, time metrics (visit/travel/idle minutes), quality score, tomorrow's suggestion

#### `AiInsightsScreen.tsx`
- **API**: `GET /ai/insights`
- **Shows**: Three sections — Team Performance insights, Pipeline Health insights, Recommended Actions — each as severity-badged cards (High/Medium/Low)

---

### User Management Screen

#### `UserManagementScreen.tsx`
- **APIs**: `GET /auth/users`, `POST /auth/create-user`, `PUT /auth/update-user/:id`, `DELETE /auth/delete-user/:id`, `GET /auth/zones`, `GET /auth/regions`, `POST /auth/regions`, `PUT /auth/regions/:id`
- **Two tabs**:
  - **Users**: List with role badge, create/edit/delete, role hierarchy filter (SCA can create SH/RH/ZH/FO, SH can create RH/ZH/FO, etc.)
  - **Regions**: Region + zone management (create, edit, delete)
- **Creatable roles per role**:
  - SCA → SH, RH, ZH, FO
  - SH → RH, ZH, FO
  - RH → ZH, FO
  - ZH → FO

---

### Payment Screens

#### `PaymentsScreen.tsx`
- **APIs**: `GET /payments`, `POST /payments`
- **Shows**: Payment list with status (Pending/Completed/Failed) and method (Cash/Cheque/Online/NEFT/UPI) badges
- **Filters**: All / Pending / Completed / Failed
- **Create modal**: Deal ID, amount, method, transaction ID, cheque details (if Cheque), notes

#### `ScaPaymentsScreen.tsx`
- **APIs**: `GET /payments/direct`, `POST /payments/direct`, `PATCH /payments/:id/verify`
- **Shows**: Direct payments (Bonus/Allowance/Incentive) list with user name, type badge, amount
- **Create modal**: User ID, type (Bonus/Allowance/Incentive), amount, description
- **SCA-only**: Regular payments can also be verified here

---

### Settings Screens

#### `SettingsScreen.tsx`
- User profile display, logout button, notification preferences, language selection, app version

#### `DashboardCustomizeScreen.tsx`
- **API**: `GET /dashboard/config`, `PUT /dashboard/config`
- Toggle which KPI cards appear on the dashboard

#### `UserManualScreen.tsx`
- In-app help/documentation viewer

---

### Other Screens

#### `NotificationsScreen.tsx`
- **APIs**: `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`
- **Type badges**: Urgent (red), Reminder (amber), Success (green), Warning (orange), Info (blue)

#### `AuditHistoryScreen.tsx`
- **API**: `GET /audit` with entity filters
- **Shows**: Timeline of actions (Created/Updated/Deleted), performer, timestamp, field-level before/after values

---

## 4. All API Calls — Endpoint + Purpose

### Authentication (`/api/auth.ts`)
```
POST   /auth/login                 → Login with email + password → returns token + user
POST   /auth/logout                → Invalidate session
POST   /auth/create-user           → Create new user (name, email, password, role, zoneId)
GET    /auth/users                 → List all users (with role filter)
PUT    /auth/update-user/:id       → Update user details
DELETE /auth/delete-user/:id       → Delete user
GET    /auth/zones                 → Get all zones list
GET    /auth/regions               → Get all regions list
POST   /auth/regions               → Create region
PUT    /auth/regions/:id           → Update region
DELETE /auth/regions/:id           → Delete region
POST   /auth/zones                 → Create zone
PUT    /auth/zones/:id             → Update zone
DELETE /auth/zones/:id             → Delete zone
```

### Leads (`/api/leads.ts`)
```
GET    /leads                      → List (page, pageSize, search, stage, status, source)
GET    /leads/:id                  → Full lead details
POST   /leads                      → Create lead
PUT    /leads/:id                  → Update lead
DELETE /leads/:id                  → Delete lead
GET    /leads/check-duplicate      → ?school=X&city=Y → boolean
GET    /leads/pipeline             → All leads for Kanban
PUT    /leads/:id/assign           → Assign to FO (foId)
GET    /leads/assignable-fos       → List FOs available for assignment
```

### Schools (`/api/schools.ts`)
```
GET    /schools                    → List (search, status, board, city, page, pageSize)
GET    /schools/:id                → School details
POST   /schools                    → Create school
PUT    /schools/:id                → Update school
GET    /schools/nearby             → ?lat=&lon=&radiusMeters= → nearby schools
GET    /schools/:id/visit-history  → All visit records for school
POST   /schools/check-duplicates   → Duplicate check (name, city, lat, lon)
GET    /schools/priority           → Priority-scored schools list
```

### Contacts (`/api/contacts.ts`)
```
GET    /contacts                   → List (search, schoolId, relationship, isDecisionMaker)
GET    /contacts/:id               → Contact details
POST   /contacts                   → Create contact
PUT    /contacts/:id               → Update contact
GET    /contacts/school/:schoolId  → All contacts for a school
POST   /contacts/check-duplicates  → Duplicate check
```

### Deals (`/api/deals.ts`)
```
GET    /deals                      → List (page, pageSize, leadId)
GET    /deals/:id                  → Deal details
POST   /deals                      → Create deal (auto-submits for approval based on discount)
PUT    /deals/:id/approve          → Approve or reject deal with note
GET    /deals/pending-approvals    → Deals awaiting approval by current user
```

### Activities (`/api/activities.ts`)
```
GET    /activities                 → List (page, pageSize, type, outcome, leadId, foId)
POST   /activities                 → Create activity
POST   /activities/upload-photo    → Upload photo (multipart/form-data) → returns photoUrl
```

### Demos (`/api/demos.ts`)
```
GET    /demos                      → List (status, assignedTo, dateFrom, dateTo)
GET    /demos/:id                  → Demo details
POST   /demos                      → Create demo assignment
PATCH  /demos/:id/status           → Update status (outcome, feedback, rescheduled date)
GET    /demos/calendar             → Demos in date range for calendar view
```

### Onboarding (`/api/onboarding.ts`)
```
GET    /onboarding                 → List (status, assignedTo, page, pageSize)
GET    /onboarding/:id             → Details
PATCH  /onboarding/:id/progress    → Update completion % + notes
PATCH  /onboarding/:id/status      → Update status
```

### Tracking (`/api/tracking.ts`)
```
POST   /tracking/start-day         → Start GPS session → returns sessionId
POST   /tracking/end-day           → End GPS session
GET    /tracking/session/today     → Today's session (status, distance, allowance)
POST   /tracking/ping              → Single GPS ping (lat, lon, accuracy, speed, altitude, battery)
POST   /tracking/ping/batch        → Array of queued pings (offline catchup)
GET    /tracking/live-locations    → All team members' live positions (for managers)
GET    /tracking/route/:userId/:date → Route points for a user on a given date
GET    /tracking/allowances        → ?dateFrom=&dateTo= → allowance list
PATCH  /tracking/allowances/:id    → Approve/reject with remarks
GET    /tracking/fraud-reports     → ?dateFrom=&dateTo= → fraud detection reports
```

### Geofence (`/api/geofence.ts`)
```
POST   /tracking/geofence-event    → Send enter/exit event (schoolId, eventType, lat, lon, distance, duration)
GET    /tracking/school-visits/:sessionId → Visit log for a session
GET    /tracking/time-breakdown/:sessionId → Visit/travel/idle time breakdown
GET    /tracking/school-visits/today → Today's school visit log
```

### School Assignments (`/api/schoolAssignments.ts`)
```
GET    /school-assignments/my      → ?date=YYYY-MM-DD → FO's assigned schools for that day
```

### Route Planning (`/api/routePlan.ts`)
```
GET    /routes/plan/today          → Today's route plan
GET    /routes/plan/:date          → Route plan for specific date
POST   /routes/plan                → Create route plan (ordered schoolIds)
PATCH  /routes/plan/:planId/visit  → Mark school as visited in plan
POST   /routes/optimize            → Optimize route for given school IDs → returns sorted list
```

### Calendar (`/api/calendar.ts`)
```
GET    /calendar                   → ?startDate=&endDate= → events list
POST   /calendar                   → Create event (title, type, startTime, endTime, notes)
PUT    /calendar/:id               → Update event
DELETE /calendar/:id               → Delete event
PATCH  /calendar/:id/complete      → Mark event complete
```

### Visit Reports (`/api/visitReport.ts`)
```
POST   /visit-reports              → Create visit report (purpose, personMet, outcome, remarks, nextAction)
GET    /visit-reports/activity/:activityId → Report for an activity
GET    /visit-reports/visit/:visitLogId    → Report for a school visit log
```

### Targets (`/api/targets.ts`)
```
POST   /targets                    → Create target (title, amount, schools, period, assignedToId)
GET    /targets/my                 → Own targets
GET    /targets/assigned           → Targets user has assigned to others
GET    /targets/:id/subtargets     → Sub-targets under parent
GET    /targets/:id/hierarchy      → Full target tree
PUT    /targets/:id/progress       → Update achieved amounts
PUT    /targets/:id/submit         → Submit for review
PUT    /targets/:id/review         → Approve or reject with note
DELETE /targets/:id                → Delete target
GET    /targets/assignable-users   → Users available for target assignment
```

### Dashboard (`/api/dashboard.ts`)
```
GET    /dashboard/fo               → FO dashboard data
GET    /dashboard/zone             → Zone Head dashboard data
GET    /dashboard/region           → Regional Head dashboard data
GET    /dashboard/national         → SH national dashboard data
GET    /dashboard/sca              → SCA dashboard (extends national with user counts + payments)
GET    /dashboard/team-performance → Team performance KPIs
GET    /dashboard/performance-tracking → Individual performance tracking
```

### Reports (`/api/reports.ts`)
```
GET    /reports/monthly-performance   → Monthly sales data
GET    /reports/deal-aging            → Deal age by stage
GET    /reports/conversion-funnel     → Stage conversion rates
GET    /reports/lost-deals            → Lost deal analysis
GET    /reports/territory-coverage    → Geographic coverage gaps
GET    /reports/leaderboard           → Team leaderboard
GET    /reports/revenue-forecast      → Projected revenue
GET    /reports/onboarding            → Post-sale onboarding tracking
GET    /reports/:reportId/export      → Export → PDF/CSV/Excel (Linking.openURL)
```

All reports accept: `?dateFrom=&dateTo=&zone=&region=&foId=&periodType=`

### Payments (`/api/payments.ts`)
```
GET    /payments                   → List (status, dealId, page, pageSize)
GET    /payments/:id               → Payment details
POST   /payments                   → Create payment (dealId, amount, method, transactionId, ...)
GET    /payments/deal/:dealId      → All payments for a deal
PATCH  /payments/:id/verify        → Verify payment (verified: boolean, notes)
GET    /payments/direct            → SCA direct payments list
POST   /payments/direct            → Create direct payment (userId, type, amount, description)
```

### AI (`/api/ai.ts`)
```
GET    /ai/daily-plan              → AI-generated visit plan for today
POST   /ai/daily-plan/accept       → Accept selected items from plan
POST   /ai/daily-plan/regenerate   → Regenerate plan
GET    /ai/daily-report            → AI report for today's activities
GET    /ai/insights                → AI insights (team, pipeline, recommendations)
GET    /ai/usage-quota             → Current quota usage
GET    /ai/lead-score/:leadId      → Lead score component breakdown
GET    /ai-reports                 → AI management reports (SH/SCA, filterable)
GET    /ai-reports/:id             → Specific AI report
POST   /ai-reports/generate-daily  → Trigger daily report generation (SH/SCA)
POST   /ai-reports/generate-management → Trigger management report generation
```

### Notifications (`/api/notifications.ts`)
```
GET    /notifications              → All notifications
PUT    /notifications/:id/read     → Mark one as read
PUT    /notifications/read-all     → Mark all as read
DELETE /notifications/:id          → Delete notification
GET    /notifications/preferences  → Get notification preferences
PUT    /notifications/preferences  → Update preferences
```

### Settings (`/api/settings.ts`)
```
GET    /settings/me                → User settings
PUT    /settings/me                → Update settings (language, theme, etc.)
GET    /dashboard/config           → Dashboard widget config
PUT    /dashboard/config           → Save widget visibility config
```

### Audit (`/api/audit.ts`)
```
GET    /audit                      → Audit logs (?entityType=&entityId=&page=&pageSize=)
```

---

## 5. Data Models (Types)

### User & Role
```typescript
type UserRole = 'FO' | 'ZH' | 'RH' | 'SH' | 'SCA'

interface UserDto {
  id: number; name: string; email: string; role: UserRole;
  avatar: string; zoneId?: number; zone?: string;
  regionId?: number; region?: string;
  zonalHead?: string; regionalHead?: string;
}
```

### Lead
```typescript
type LeadStage = 'NewLead' | 'Contacted' | 'Qualified' | 'DemoStage' | 'DemoDone'
               | 'ProposalSent' | 'Negotiation' | 'ContractSent'
               | 'Won' | 'ImplementationStarted' | 'Lost'

interface LeadListDto {
  id: number; school: string; board: string; city: string;
  type: string; stage: LeadStage; score: number; value: number;
  lastActivityDate?: string; source: string;
  foId?: number; foName?: string;
  contactName?: string;
}

interface LeadDto extends LeadListDto {
  state?: string; students?: number; closeDate?: string; notes?: string;
  lossReason?: string; contact?: Contact; activities?: ActivityDto[];
}
```

### School & Assignment
```typescript
interface School {
  id: number; name: string; board?: string; type?: string;
  category: string; city?: string; state?: string;
  latitude: number; longitude: number;
  geofenceRadiusMeters: number;
  status: 'Active' | 'Inactive' | 'Blacklisted';
  studentCount?: number; contactCount?: number;
  lastVisitDate?: string; assignedFoId?: number;
}

interface SchoolAssignment {
  id: number; schoolName: string; schoolCity: string;
  schoolAddress?: string;
  schoolLatitude: number; schoolLongitude: number;
  visitOrder: number;
  isVisited: boolean; timeSpentMinutes: number | null;
  geofenceRadiusMetres: number;
}
```

### Activity
```typescript
type ActivityType = 'Visit' | 'Call' | 'Demo' | 'Proposal' | 'FollowUp' | 'Contract'
type ActivityOutcome = 'Positive' | 'Neutral' | 'Negative' | 'Pending'

interface ActivityDto {
  id: number; type: ActivityType; date: string;
  outcome: ActivityOutcome; notes?: string;
  gpsVerified: boolean; timeIn?: string; timeOut?: string;
  personMet?: string; interestLevel?: string;
  nextAction?: string; nextFollowUpDate?: string;
  photoUrl?: string; foId: number; school?: string;
}
```

### Tracking
```typescript
interface TrackingSessionDto {
  sessionId: number;
  status: 'not_started' | 'active' | 'ended';
  startedAt?: string; endedAt?: string; sessionDate: string;
  totalDistanceKm: number; allowanceAmount: number;
  pingCount?: number; fraudScore?: number; isSuspicious?: boolean;
}

interface LiveLocationDto {
  userId: number; name: string; role: string;
  latitude: number; longitude: number;
  status: 'active' | 'ended';
  lastSeen: string; totalDistanceKm: number;
  speedKmh?: number; batteryLevel?: number;
  allowanceAmount: number; isSuspicious?: boolean;
  fraudScore?: number; zoneName?: string; regionName?: string;
}

interface AllowanceDto {
  id: number; userId: number; userName: string; role: string;
  allowanceDate: string; distanceKm: number; ratePerKm: number;
  grossAmount: number; approved: boolean;
  approvedByName?: string; approvedAt?: string;
  remarks?: string; fraudScore?: number; isSuspicious?: boolean;
}
```

### Payments
```typescript
interface Payment {
  id: number; dealId: number; school: string;
  amount: number; method: string;
  status: 'Pending' | 'Completed' | 'Failed';
  transactionId?: string; createdAt: string;
}

interface DirectPayment {
  id: number; userId: number; userName?: string;
  type: 'Bonus' | 'Allowance' | 'Incentive';
  amount: number; description?: string; createdAt: string;
}
```

---

## 6. Tracking & Geofencing Architecture

### How GPS tracking works (FO side)

```
FO opens app
  → MyDayTrackingScreen
  → Taps "Start Day"
  → POST /tracking/start-day  ← creates session on server
  → startNativeTracking()     ← native iOS/Android module starts
       ↓ every 30 seconds
  → sendLocationPing()
       → checks offline queue (AsyncStorage: 'tracking_ping_queue')
       → if online: POST /tracking/ping (lat, lon, accuracy, speed, altitude, battery)
       → if offline: queue ping, upload in batch when reconnected
  → Geolocation.watchPosition() streams location updates
  → If enters school geofence:
       → POST /tracking/geofence-event  (eventType: 'Enter', schoolId, distance)
  → If exits school geofence:
       → POST /tracking/geofence-event  (eventType: 'Exit', durationMinutes)
  → FO taps "End Day"
  → POST /tracking/end-day  ← closes session
  → stopNativeTracking()
```

### How managers see live tracking

```
LiveTrackingScreen mounts
  → GET /tracking/live-locations  ← all team members' current positions
  → renders AllUsersMarker per user (colored by role)
  → setInterval every 30 seconds → re-fetch live locations
  → tap any marker → info sheet → "Track This Person"
  → IndividualTrackingView opens:
       → GET /tracking/route/:userId/:date (route polyline)
       → GET /tracking/live-locations (find this user's latest position)
       → auto-refresh every 30s (today only)
       → day picker: last 7 days
```

### Geofence radius
Each school in the database has a `geofenceRadiusMetres` value. When the FO's GPS coordinate is within that radius of the school's lat/lon, a geofence Enter event is auto-fired. This is calculated on-device and confirmed server-side.

### Fraud detection
The backend flags suspicious tracking:
- `isSuspicious: true` on sessions/allowances
- `fraudScore` (0–100)
- `fraudFlags[]` array of specific reasons
- Shown as ⚠ warning in the UI

---

## 7. Code-Level Architecture

### HTTP Client (`/api/client.ts`)
```typescript
// Single axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,  // from @env (environment variable)
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// REQUEST interceptor — auto-attaches token
apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE interceptor — unwraps ApiResponse<T> wrapper
// Backend always returns { success, data, message }
// Interceptor strips the wrapper so callers get data directly
apiClient.interceptors.response.use(response => {
  if ('success' in response.data) response.data = response.data.data;
  return response;
});
// Also handles 401 → calls logout
```

### State Management
- No Redux. Uses React Context:
  - `AuthContext` — user object, login/logout, isLoading
  - `OfflineContext` — isOnline flag, pending action count
  - `LanguageContext` — selected language

### Responsive Design
```typescript
// rf() = responsive font size (scales with screen width)
import { rf } from '../../utils/responsive';

// isTablet = width >= 768
const tablet = width >= 768;

// Dynamic columns for FlatLists
numColumns={tablet ? 2 : 1}
key={tablet ? 'grid' : 'list'}  // key must change with numColumns or RN crashes
```

### Navigation pattern
```typescript
// Navigate to a stack screen
navigation.navigate('LeadDetail', { leadId: 123 })
navigation.navigate('AssignedSchools')

// Go back
navigation.goBack()

// Each role gets its own Tab Navigator
// Tab navigators are registered as the "Main" stack screen
getRoleNavigator(user.role)  // returns FOTabs | ZHTabs | RHTabs | SHTabs | SCATabs
```

### Map implementation
```typescript
// react-native-maps (v1.27.2)
// Default provider (Apple Maps on iOS, Google Maps on Android)
// No Google Maps API key required

<MapView
  ref={mapRef}
  style={{ flex: 1 }}  // IMPORTANT: flex:1 not absoluteFill (fixes 0-height on iPhone)
  initialRegion={INDIA_REGION}
>
  <Marker coordinate={{ latitude, longitude }}>
    <CustomMarkerView />       // custom colored pin
    <Callout>...</Callout>     // bubble on tap
  </Marker>
  <Circle center={...} radius={100} />   // geofence ring
  <Polyline coordinates={[...]} />       // route line
</MapView>

// Auto-fit camera to show all pins
mapRef.current?.fitToCoordinates(coords, {
  edgePadding: { top: 80, right: 40, bottom: 220, left: 40 },
  animated: true
});
```

### Offline queue pattern
```typescript
// Queue ping when offline
const queue = await AsyncStorage.getItem('tracking_ping_queue');
const parsed = queue ? JSON.parse(queue) : [];
parsed.push(newPing);
await AsyncStorage.setItem('tracking_ping_queue', JSON.stringify(parsed));

// Flush when reconnected
if (queue.length > 0) {
  await trackingApi.pingBatch(queue);
  await AsyncStorage.removeItem('tracking_ping_queue');
}
```

### FlatList grid pattern
```tsx
// ALWAYS add key= when numColumns can change (e.g. rotation)
// Without key, RN throws: "Changing numColumns on the fly is not supported"
<FlatList
  key={tablet ? 'grid' : 'list'}     // forces remount on column change
  numColumns={tablet ? 2 : 1}
  data={items}
  renderItem={renderItem}
/>
```

---

## 8. Constants & Configuration

### Role Colors (`ROLE_COLORS`)
| Role | Primary | Light | Dark |
|------|---------|-------|------|
| FO | `#0D9488` (Teal) | `#F0FDFA` | `#134E4A` |
| ZH | `#7C3AED` (Purple) | `#F5F3FF` | `#4C1D95` |
| RH | `#EA580C` (Orange) | `#FFF7ED` | `#7C2D12` |
| SH | `#2563EB` (Blue) | `#EFF6FF` | `#1E3A8A` |
| SCA | `#E11D48` (Rose) | `#FFF1F2` | `#9F1239` |

### Dropdown Options
```
BOARDS:       CBSE, ICSE, IB, State Board, IGCSE, Cambridge, Other
SCHOOL_TYPES: Private, Government, Semi-Government, International, Franchise, Trust
LEAD_SOURCES: Field Visit, Reference, Cold Call, Exhibition, Social Media, Website, Referral, Partner
MODULES:      AI Voice, Curriculum, AI Videos, Lab Simulator, ERP, Homework, Exam
PAYMENT_TERMS: 100% Upfront, 50/50, Quarterly, Annual
DURATIONS:    1 Year, 2 Years, 3 Years, 5 Years
DEMO_MODES:   Online, Offline, Hybrid
INTEREST:     High, Medium, Low
RELATIONSHIPS: New, Warm, Strong, Champion, Detractor
```

### Quick Login (Dev/Demo)
| Role | Email | Password |
|------|-------|----------|
| FO | arjun@educrm.in | fo123 |
| ZH | priya@educrm.in | zh123 |
| RH | rajesh@educrm.in | rh123 |
| SH | anita@educrm.in | sh123 |
| SCA | supersaleadmin@gmail.com | admin123 |

---

## 9. File Structure Reference

```
src/
├── api/
│   ├── client.ts              ← Axios instance + interceptors
│   ├── auth.ts                ← Login, user CRUD, zones, regions
│   ├── leads.ts               ← Lead CRUD, pipeline, assign
│   ├── schools.ts             ← School CRUD, nearby, priority
│   ├── contacts.ts            ← Contact CRUD
│   ├── deals.ts               ← Deal CRUD, approvals
│   ├── demos.ts               ← Demo assignment CRUD
│   ├── onboarding.ts          ← Onboarding tracking
│   ├── tracking.ts            ← GPS sessions, pings, live locations, allowances
│   ├── geofence.ts            ← Geofence events, school visits, time breakdown
│   ├── schoolAssignments.ts   ← FO daily assigned schools
│   ├── routePlan.ts           ← Route planning + optimization
│   ├── calendar.ts            ← Calendar events CRUD
│   ├── activities.ts          ← Activity log + photo upload
│   ├── visitReport.ts         ← Visit report submit
│   ├── targets.ts             ← Target CRUD + review workflow
│   ├── dashboard.ts           ← Dashboard data per role
│   ├── reports.ts             ← 9 report types + export
│   ├── payments.ts            ← Payments + SCA direct payments
│   ├── ai.ts                  ← Daily plan, report, insights, lead score
│   ├── notifications.ts       ← Notifications CRUD
│   ├── settings.ts            ← User settings + dashboard config
│   └── audit.ts               ← Audit trail
│
├── screens/
│   ├── auth/LoginScreen.tsx
│   ├── dashboard/
│   │   ├── FODashboard.tsx
│   │   ├── ZHDashboard.tsx
│   │   ├── RHDashboard.tsx
│   │   ├── SHDashboard.tsx
│   │   └── SCADashboard.tsx
│   ├── leads/
│   │   ├── LeadsListScreen.tsx
│   │   ├── LeadDetailScreen.tsx
│   │   └── AddLeadScreen.tsx
│   ├── schools/
│   │   ├── SchoolsListScreen.tsx
│   │   ├── SchoolDetailScreen.tsx
│   │   └── AddSchoolScreen.tsx
│   ├── contacts/
│   │   ├── ContactsListScreen.tsx
│   │   ├── ContactDetailScreen.tsx
│   │   └── AddContactScreen.tsx
│   ├── deals/CreateDealScreen.tsx
│   ├── demos/
│   │   ├── DemoListScreen.tsx
│   │   ├── DemoDetailScreen.tsx
│   │   └── AssignDemoScreen.tsx
│   ├── onboarding/
│   │   ├── OnboardListScreen.tsx
│   │   └── OnboardDetailScreen.tsx
│   ├── tracking/
│   │   ├── MyDayTrackingScreen.tsx   ← FO GPS session + route
│   │   ├── LiveTrackingScreen.tsx    ← Manager live map + team list
│   │   └── AssignedSchoolsScreen.tsx ← FO daily assigned schools map
│   ├── calendar/CalendarScreen.tsx
│   ├── pipeline/PipelineScreen.tsx
│   ├── targets/TargetsScreen.tsx
│   ├── performance/PerformanceScreen.tsx
│   ├── reports/ReportsScreen.tsx
│   ├── activities/ActivityLogScreen.tsx
│   ├── visitReport/VisitReportScreen.tsx
│   ├── ai/
│   │   ├── AiDailyPlanScreen.tsx
│   │   ├── AiDailyReportScreen.tsx
│   │   └── AiInsightsScreen.tsx
│   ├── users/UserManagementScreen.tsx
│   ├── payments/
│   │   ├── PaymentsScreen.tsx
│   │   └── ScaPaymentsScreen.tsx
│   ├── notifications/NotificationsScreen.tsx
│   ├── audit/AuditHistoryScreen.tsx
│   └── settings/
│       ├── SettingsScreen.tsx
│       ├── DashboardCustomizeScreen.tsx
│       └── UserManualScreen.tsx
│
├── navigation/AppNavigator.tsx    ← Role-based tabs + stack
├── context/
│   ├── AuthContext.tsx
│   ├── OfflineContext.tsx
│   └── LanguageContext.tsx
├── components/common/
│   ├── Card.tsx
│   ├── Badge.tsx / RoleBadge / StageBadge
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── SelectPicker.tsx
│   ├── KPICard.tsx
│   ├── Avatar.tsx
│   ├── ProgressBar.tsx
│   ├── ScreenHeader.tsx
│   └── LoadingSpinner / EmptyState
├── services/
│   ├── NetworkMonitor.ts          ← Connectivity polling (30s, uses origin URL)
│   ├── locationPingService.ts     ← GPS ping sender with offline queue
│   ├── nativeLocationTracking.ts  ← iOS/Android native module bridge
│   └── backgroundServiceShim.ts  ← Android headless task shim
├── types/index.ts                 ← All TypeScript interfaces
├── utils/
│   ├── constants.ts               ← Colors, labels, dropdown options
│   ├── formatting.ts              ← formatCurrency, formatDate, formatRelativeDate
│   └── responsive.ts             ← rf(), isTablet, getCardWidth, getNumColumns
└── theme/
    ├── colors.ts                  ← Color palette + role/stage/activity color maps
    └── index.ts
```

---

*Last updated: 2026-03-26*
