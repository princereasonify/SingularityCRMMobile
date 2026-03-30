# SingularityCRM — Screen-wise Test Cases

> **Project:** SingularityCRM (React Native 0.84.1)
> **Roles:** FO (Field Officer) · ZH (Zonal Head) · RH (Regional Head) · SH (State Head) · SCA (Senior Central Admin)
> **Legend:** TC = Test Case · P = Precondition · S = Steps · E = Expected Result

---

## Table of Contents

1. [Login Screen](#1-login-screen)
2. [FO Dashboard](#2-fo-dashboard)
3. [ZH Dashboard](#3-zh-dashboard)
4. [RH Dashboard](#4-rh-dashboard)
5. [SH Dashboard](#5-sh-dashboard)
6. [SCA Dashboard](#6-sca-dashboard)
7. [Leads List Screen](#7-leads-list-screen)
8. [Lead Detail Screen](#8-lead-detail-screen)
9. [Add/Edit Lead Screen](#9-addedit-lead-screen)
10. [Contacts List Screen](#10-contacts-list-screen)
11. [Contact Detail Screen](#11-contact-detail-screen)
12. [Add Contact Screen](#12-add-contact-screen)
13. [Schools List Screen](#13-schools-list-screen)
14. [School Detail Screen](#14-school-detail-screen)
15. [Add School Screen](#15-add-school-screen)
16. [Demo List Screen](#16-demo-list-screen)
17. [Demo Detail Screen](#17-demo-detail-screen)
18. [Assign Demo Screen](#18-assign-demo-screen)
19. [Onboard List Screen](#19-onboard-list-screen)
20. [Onboard Detail Screen](#20-onboard-detail-screen)
21. [Activity Log Screen](#21-activity-log-screen)
22. [My Day Tracking Screen](#22-my-day-tracking-screen)
23. [Live Tracking Screen](#23-live-tracking-screen)
24. [Assigned Schools Screen](#24-assigned-schools-screen)
25. [Route Planner Screen](#25-route-planner-screen)
26. [AI Daily Plan Screen](#26-ai-daily-plan-screen)
27. [AI Daily Report Screen](#27-ai-daily-report-screen)
28. [AI Insights Screen](#28-ai-insights-screen)
29. [Targets Screen](#29-targets-screen)
30. [Calendar Screen](#30-calendar-screen)
31. [Pipeline Screen](#31-pipeline-screen)
32. [Performance Screen](#32-performance-screen)
33. [Reports Screen](#33-reports-screen)
34. [Payments Screen](#34-payments-screen)
35. [SCA Payments Screen](#35-sca-payments-screen)
36. [Notifications Screen](#36-notifications-screen)
37. [Create Deal Screen](#37-create-deal-screen)
38. [Visit Report Screen](#38-visit-report-screen)
39. [Audit History Screen](#39-audit-history-screen)
40. [Weekly Plan Screen](#40-weekly-plan-screen)
41. [User Management Screen](#41-user-management-screen)
42. [Settings Screens](#42-settings-screens)

---

## 1. Login Screen

**Path:** `src/screens/auth/LoginScreen.tsx`
**Accessible by:** All roles (unauthenticated)

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-LGN-01 | Valid FO login | App installed, server reachable | Enter valid FO email & password → tap Login | Navigate to FO tab navigator; teal (#0d9488) theme applied |
| TC-LGN-02 | Valid ZH login | — | Enter valid ZH credentials → tap Login | Navigate to ZH tab navigator; purple (#7c3aed) theme |
| TC-LGN-03 | Valid RH login | — | Enter valid RH credentials → tap Login | Navigate to RH tab navigator; orange (#ea580c) theme |
| TC-LGN-04 | Valid SH login | — | Enter valid SH credentials → tap Login | Navigate to SH tab navigator; blue (#2563eb) theme |
| TC-LGN-05 | Valid SCA login | — | Enter valid SCA credentials → tap Login | Navigate to SCA tab navigator |
| TC-LGN-06 | Wrong password | — | Enter valid email + wrong password → tap Login | Error message displayed: "Invalid credentials" or server message; no navigation |
| TC-LGN-07 | Empty email | — | Leave email blank → tap Login | Validation error on email field; login not triggered |
| TC-LGN-08 | Empty password | — | Fill email, leave password blank → tap Login | Validation error on password field |
| TC-LGN-09 | Invalid email format | — | Enter "notanemail" → tap Login | Validation error: "Enter valid email" |
| TC-LGN-10 | Loading state | — | Tap Login → observe UI during API call | Login button shows spinner/loading indicator; button disabled during request |
| TC-LGN-11 | Network offline | Device offline | Enter valid credentials → tap Login | Error shown: "No internet connection" or similar; no crash |
| TC-LGN-12 | Show/hide password | — | Tap eye icon on password field | Password toggles between hidden (••••) and visible text |
| TC-LGN-13 | Device info sent | — | Login successfully | Backend records deviceUniqueId, deviceBrand, deviceModel, deviceOs, appVersion, simCarrier, isEmulator |
| TC-LGN-14 | Session restore | Previously logged in | Close & reopen app | Auto-navigates to correct role dashboard without re-login |
| TC-LGN-15 | 401 session expiry | Token expired (7 days) | Open app with expired token | Redirected to Login screen; no crash |

---

## 2. FO Dashboard

**Path:** `src/screens/dashboard/FODashboard.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-FOD-01 | KPI cards load | Logged in as FO | Open Dashboard tab | Shows Revenue, Revenue Target, Visits This Week, Demos This Month, Deals Won, Pipeline Leads, Pipeline Value |
| TC-FOD-02 | Revenue progress bar | — | View Revenue KPI card | Progress bar shows `(revenue / revenueTarget) * 100`%; correct color (green >80%, amber 50–80%, red <50%) |
| TC-FOD-03 | Hot leads list | — | Scroll to Hot Leads section | Displays up to 5 hot leads with school name, stage badge, score |
| TC-FOD-04 | Today's tasks | — | View Today's Tasks section | Shows task list with time, type, school name; completed tasks shown differently |
| TC-FOD-05 | Recent activities | — | View Recent Activities | Shows activity type, school, date, outcome badge |
| TC-FOD-06 | Pull to refresh | — | Pull down on dashboard | Spinner shows; data re-fetches; new data displayed |
| TC-FOD-07 | Loading skeleton | Slow network | Open dashboard | Skeleton loaders shown while data fetches |
| TC-FOD-08 | Empty hot leads | No leads assigned | Open dashboard | "No hot leads" empty state shown instead of list |
| TC-FOD-09 | Navigate to lead | — | Tap a hot lead row | Navigates to Lead Detail Screen for that lead |
| TC-FOD-10 | Offline fallback | Device offline | Open dashboard | Cached data shown with "Offline" banner at top |
| TC-FOD-11 | Tablet layout | On iPad/tablet | Open dashboard | 2-column KPI grid instead of single column |

---

## 3. ZH Dashboard

**Path:** `src/screens/dashboard/ZHDashboard.tsx`
**Accessible by:** ZH

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-ZHD-01 | Zone metrics load | Logged in as ZH | Open Dashboard | Shows Zone Name, Revenue MTD, Revenue Target, Target%, Active Pipeline, Pending Approvals, Win Rate, At-Risk FOs |
| TC-ZHD-02 | FO performance table | — | Scroll to FO Performance | Table shows each FO's name, revenue, target%, visits, demos, deals |
| TC-ZHD-03 | At-risk FO highlight | FO has poor performance | View FO list | At-risk FOs shown with red/warning indicator |
| TC-ZHD-04 | Pending approvals badge | Deals pending approval | View dashboard | Pending Approvals count visible; tapping navigates to deals list |
| TC-ZHD-05 | Navigate to FO performance | — | Tap FO row | Navigates to Performance detail for that FO |
| TC-ZHD-06 | Pull to refresh | — | Pull down | Data refreshes; updated metrics shown |
| TC-ZHD-07 | Pending deals list | — | Scroll to Pending Deals | Shows deal school, value, status badge |

---

## 4. RH Dashboard

**Path:** `src/screens/dashboard/RHDashboard.tsx`
**Accessible by:** RH

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-RHD-01 | Region metrics load | Logged in as RH | Open Dashboard | Shows Region Name, Revenue MTD, Target%, Active Leads, Deals Won, Win Rate, Forecast Accuracy |
| TC-RHD-02 | Zone breakdown table | — | View Zones section | Each zone shows revenue, target%, win rate, health status |
| TC-RHD-03 | Revenue chart | — | View revenue chart | Bar/line chart renders with correct monthly labels and values |
| TC-RHD-04 | Zone health colors | — | View zone rows | Green = Healthy, Amber = At Risk, Red = Critical |
| TC-RHD-05 | Navigate to zone | — | Tap zone row | Navigates to zone detail / ZH performance view |

---

## 5. SH Dashboard

**Path:** `src/screens/dashboard/SHDashboard.tsx`
**Accessible by:** SH

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SHD-01 | National metrics load | Logged in as SH | Open Dashboard | Shows Revenue MTD, Target%, Schools Won, Pipeline Value, Win Rate |
| TC-SHD-02 | Region breakdown | — | View Regions section | Each region shows revenue, target%, schools, win rate, forecast |
| TC-SHD-03 | Revenue chart | — | View chart | Renders correctly with region labels |
| TC-SHD-04 | Loss reasons chart | — | Scroll down | Loss reasons displayed (e.g. pie/bar) with reason labels and counts |

---

## 6. SCA Dashboard

**Path:** `src/screens/dashboard/SCADashboard.tsx`
**Accessible by:** SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SCAD-01 | All metrics load | Logged in as SCA | Open Dashboard | Shows all national + SCA-specific KPIs: Total Users, Active Users, Total Regions/Zones, Direct Payments, Pending Allowances |
| TC-SCAD-02 | User stats | — | View user stats section | totalUsers, activeUsers displayed correctly |
| TC-SCAD-03 | Direct payments total | — | View direct payments | Monetary total shown correctly formatted (₹X.XL / ₹X.XCr) |

---

## 7. Leads List Screen

**Path:** `src/screens/leads/LeadsListScreen.tsx`
**Accessible by:** FO, ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-LL-01 | Leads list loads | Logged in | Open Leads tab | List of leads shows school name, stage badge, score, city, value |
| TC-LL-02 | Search by school name | Leads exist | Type "Delhi" in search bar | List filters to only schools matching "Delhi" |
| TC-LL-03 | Filter by stage | — | Tap filter → select "Won" stage | Only Won leads shown |
| TC-LL-04 | Sort by value | — | Tap sort → sort by value descending | Leads re-ordered by highest value first |
| TC-LL-05 | Navigate to detail | — | Tap a lead row | Navigates to Lead Detail Screen |
| TC-LL-06 | Add new lead (FO only) | Logged in as FO | Tap + button | Navigates to Add Lead Screen |
| TC-LL-07 | Pagination / infinite scroll | More than 20 leads | Scroll to bottom | Next page of leads loads automatically |
| TC-LL-08 | Empty state | No leads | Open leads (no data) | "No leads found" message shown |
| TC-LL-09 | Pull to refresh | — | Pull down | List refreshes with latest data |
| TC-LL-10 | Stage badge color | — | View lead with stage "Won" | Green badge shown for Won; red for Lost; stage-appropriate colors |
| TC-LL-11 | FO name shown | Logged in as ZH/RH/SH | View lead list | FO name displayed under each lead |
| TC-LL-12 | Overdue indicator | Lead last activity >5 days | View lead row | Overdue indicator (red dot or text) shown |

---

## 8. Lead Detail Screen

**Path:** `src/screens/leads/LeadDetailScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-LD-01 | Lead info loads | Lead exists | Open a lead | School, board, city, state, stage, score, value, contact details shown |
| TC-LD-02 | Activity timeline | Activities exist | Scroll to activities | Each activity shows type icon, date, outcome, person met |
| TC-LD-03 | Add activity | Logged in as FO | Tap "Add Activity" | Navigates to activity creation form |
| TC-LD-04 | Edit lead | Logged in as FO | Tap edit icon | Navigates to Edit Lead Screen pre-filled |
| TC-LD-05 | Stage badge | — | View lead header | Correct stage badge with appropriate color |
| TC-LD-06 | Lead score | — | View score | Score 0–100 shown; color reflects score level |
| TC-LD-07 | Create deal button | Lead in Negotiation+ stage | View lead | "Create Deal" button visible |
| TC-LD-08 | Contact info section | Contact data exists | View contact card | Contact name, designation, phone, email shown |
| TC-LD-09 | Call contact | Phone number exists | Tap phone number | Opens phone dialer with number |
| TC-LD-10 | Lead score breakdown | — | Tap score indicator | Breakdown modal shows engagement, visitQuality, contactQuality, demoProgress, dealSignals |
| TC-LD-11 | Delete lead (manager only) | Logged in as ZH/RH/SH/SCA | Long-press or tap delete | Confirmation modal shown; on confirm lead deleted; navigate back |
| TC-LD-12 | GPS verified badge | Activity with gpsVerified=true | View activity in list | GPS verified checkmark shown on activity |

---

## 9. Add/Edit Lead Screen

**Path:** `src/screens/leads/AddLeadScreen.tsx`
**Accessible by:** FO, ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AL-01 | Form renders | — | Open Add Lead | All fields shown: School Name, Board, City, State, Type, Source, Value, Close Date, Contact Name, Phone |
| TC-AL-02 | Required field validation | — | Submit with empty school name | Error "School name is required" shown |
| TC-AL-03 | Required contact phone | — | Submit without phone | Error on contact phone field |
| TC-AL-04 | Valid submission | All fields filled | Tap Save | API called; navigates back to leads list; success toast/alert |
| TC-AL-05 | Duplicate detection | Duplicate school exists | Enter existing school name | Warning shown: "Possible duplicate: [School Name]" |
| TC-AL-06 | Board picker | — | Tap board field | Picker shows: CBSE, ICSE, IB, State Board, IGCSE, Cambridge, Other |
| TC-AL-07 | Source picker | — | Tap source field | Picker shows: Field Visit, Reference, Cold Call, Exhibition, Social Media, Website, Referral, Partner |
| TC-AL-08 | Pre-populated on edit | Lead exists | Open Edit Lead | All fields pre-filled with existing lead data |
| TC-AL-09 | FO assignment (manager) | Logged in as ZH/RH | Open add lead | FO assignment picker visible |
| TC-AL-10 | Location capture | FO adds Visit activity | Tap GPS icon | Current coordinates captured and shown on form |
| TC-AL-11 | Network offline submission | Device offline | Fill form → Submit | Action queued offline; "Saved offline" message shown |

---

## 10. Contacts List Screen

**Path:** `src/screens/contacts/ContactsListScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-CL-01 | Contacts list loads | Contacts exist | Open Contacts | List shows name, designation, school, phone, relationship badge |
| TC-CL-02 | Search contact | — | Type "Sharma" in search | Filters contacts matching name |
| TC-CL-03 | Filter by relationship | — | Filter by "Champion" | Only Champion relationship contacts shown |
| TC-CL-04 | Navigate to detail | — | Tap contact row | Opens Contact Detail Screen |
| TC-CL-05 | Add contact button | — | Tap + | Navigates to Add Contact Screen |
| TC-CL-06 | Relationship badge colors | — | View contacts | New=gray, Warm=yellow, Strong=blue, Champion=green, Detractor=red |
| TC-CL-07 | Decision maker tag | — | View contact with isDecisionMaker=true | "Decision Maker" tag shown |
| TC-CL-08 | Empty state | No contacts | Open contacts | "No contacts found" empty state |

---

## 11. Contact Detail Screen

**Path:** `src/screens/contacts/ContactDetailScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-CD-01 | Contact info loads | Contact exists | Open contact | Name, designation, department, phone, email, school, relationship shown |
| TC-CD-02 | Call contact | Phone exists | Tap phone | Opens dialer |
| TC-CD-03 | Email contact | Email exists | Tap email | Opens email client |
| TC-CD-04 | Edit contact | — | Tap edit | Navigates to edit form pre-filled |
| TC-CD-05 | School link | School attached | Tap school name | Navigates to School Detail |
| TC-CD-06 | Personality notes | Notes exist | View notes section | Notes text displayed |
| TC-CD-07 | Last contacted date | — | View contact | "Last contacted: X days ago" shown using relative date |

---

## 12. Add Contact Screen

**Path:** `src/screens/contacts/AddContactScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AC-01 | Form renders | — | Open Add Contact | Name, designation, phone, email, school, relationship fields shown |
| TC-AC-02 | Required name validation | — | Submit without name | Error: "Name is required" |
| TC-AC-03 | Relationship picker | — | Tap relationship field | Options: New, Warm, Strong, Champion, Detractor |
| TC-AC-04 | School search | Schools exist | Type in school field | Autocomplete shows matching schools |
| TC-AC-05 | Decision maker toggle | — | Toggle "Is Decision Maker" | Toggle state saved on submit |
| TC-AC-06 | Duplicate check | Duplicate contact exists | Enter existing phone | Warning about possible duplicate |
| TC-AC-07 | Successful save | All required fields | Tap Save | Contact created; navigate back; success message |

---

## 13. Schools List Screen

**Path:** `src/screens/schools/SchoolsListScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SL-01 | Schools list loads | Schools exist | Open Schools tab | List shows name, city, board, status badge, student count |
| TC-SL-02 | Search by name | — | Type school name in search | Filtered results appear |
| TC-SL-03 | Filter by status | — | Filter by "Active" | Only Active schools shown |
| TC-SL-04 | Filter by board | — | Filter by "CBSE" | Only CBSE schools shown |
| TC-SL-05 | Navigate to detail | — | Tap school row | Opens School Detail Screen |
| TC-SL-06 | Add school button | Logged in as ZH/RH/SH/SCA | Tap + | Navigates to Add School Screen |
| TC-SL-07 | Status badge colors | — | View list | Active=green, Inactive=gray, Blacklisted=red |
| TC-SL-08 | Priority score | — | View list item | Visit priority score shown if available |
| TC-SL-09 | Assigned FO name | — | View school row | Assigned FO name shown |
| TC-SL-10 | Empty state | No schools | Open screen | "No schools found" empty state |

---

## 14. School Detail Screen

**Path:** `src/screens/schools/SchoolDetailScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SD-01 | School info loads | School exists | Open school | Name, board, type, city, state, pincode, address, students, principal shown |
| TC-SD-02 | Map view | Lat/lng exists | View map section | Map shows school pin at correct coordinates |
| TC-SD-03 | Geofence circle | geofenceRadiusMeters set | View map | Geofence circle drawn around school pin |
| TC-SD-04 | Contact list | Contacts linked | Scroll to contacts | School contacts shown |
| TC-SD-05 | Lead history | Leads linked | Scroll to leads | Associated leads shown with stage |
| TC-SD-06 | Last visit date | Visit history exists | View info | Last visit date displayed |
| TC-SD-07 | Get directions | Lat/lng exists | Tap directions button | Opens Google Maps to school location |
| TC-SD-08 | Edit school | Logged in as ZH+ | Tap edit | Navigates to edit form |
| TC-SD-09 | Partner office badge | isPartnerOffice=true | View school | "Partner Office" badge shown |
| TC-SD-10 | Status badge | — | View school header | Status badge: Active/Inactive/Blacklisted |

---

## 15. Add School Screen

**Path:** `src/screens/schools/AddSchoolScreen.tsx`
**Accessible by:** ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AS-01 | Form renders | — | Open Add School | All fields visible: Name, Board, Type, Category, City, State, Pincode, Address, Lat, Lng, Students, Principal |
| TC-AS-02 | Required name validation | — | Submit without name | Error shown |
| TC-AS-03 | Required lat/lng | — | Submit without coordinates | Error: coordinates required |
| TC-AS-04 | Category picker | — | Tap category | Options shown: Primary, Secondary, Higher Secondary, etc. |
| TC-AS-05 | Duplicate detection | Duplicate school exists | Enter existing name+city | Warning: "Possible duplicate: [School Name]" |
| TC-AS-06 | Map pin selection | — | Tap "Pick on Map" | Map opens; user taps location; lat/lng auto-filled |
| TC-AS-07 | Geofence radius | — | Enter radius value | Saved as geofenceRadiusMeters |
| TC-AS-08 | Successful save | All required fields | Tap Save | School created; navigate back; success shown |

---

## 16. Demo List Screen

**Path:** `src/screens/demos/DemoListScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-DL-01 | Demo list loads | Demos exist | Open Demos tab | List shows school, date, mode, status, assigned-to |
| TC-DL-02 | Filter by status | — | Filter "Scheduled" | Only Scheduled demos shown |
| TC-DL-03 | Filter by mode | — | Filter "Online" | Only Online demos |
| TC-DL-04 | Date range filter | — | Select from/to dates | Only demos within range shown |
| TC-DL-05 | Navigate to detail | — | Tap demo row | Opens Demo Detail Screen |
| TC-DL-06 | Assign demo button | Logged in as ZH/RH | Tap + | Opens Assign Demo Screen |
| TC-DL-07 | Status badge colors | — | View list | Scheduled=blue, Completed=green, Cancelled=red |
| TC-DL-08 | Empty state | No demos | Open screen | "No demos found" message |

---

## 17. Demo Detail Screen

**Path:** `src/screens/demos/DemoDetailScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-DD-01 | Demo info loads | Demo exists | Open demo | School, date, time, mode, status, assignee, meeting link shown |
| TC-DD-02 | Join meeting link | Online demo with link | Tap meeting link | Opens URL in browser/app |
| TC-DD-03 | Update status | Logged in as assigned user | Tap "Mark Complete" | Status updates; success message |
| TC-DD-04 | Outcome picker | Demo completed | Tap update | Outcome options: Successful, Partial, Unsuccessful, Rescheduled |
| TC-DD-05 | Recording available | hasRecording=true | View demo | Recording section shown |

---

## 18. Assign Demo Screen

**Path:** `src/screens/demos/AssignDemoScreen.tsx`
**Accessible by:** ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AD-01 | Form renders | — | Open Assign Demo | Lead, school, assignee, date, time, mode fields |
| TC-AD-02 | Lead selector | Leads exist | Tap lead field | Searchable picker with leads list |
| TC-AD-03 | Assignee picker | Users exist | Tap assigned-to | Shows eligible users |
| TC-AD-04 | Date/time picker | — | Tap date | Native date picker opens |
| TC-AD-05 | Mode selection | — | Tap mode | Online / Offline / Hybrid options |
| TC-AD-06 | Meeting link required for Online | Mode=Online | Submit without link | Warning or auto-validation shown |
| TC-AD-07 | Successful assignment | All fields filled | Tap Assign | Demo created; navigate back; success |

---

## 19. Onboard List Screen

**Path:** `src/screens/onboarding/OnboardListScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-OL-01 | Onboard list loads | Onboarding records exist | Open Onboarding | List shows school, status, completion%, assignee |
| TC-OL-02 | Filter by status | — | Filter "InProgress" | Only InProgress records shown |
| TC-OL-03 | Completion percentage bar | — | View list item | Progress bar reflects completionPercentage |
| TC-OL-04 | Navigate to detail | — | Tap row | Opens Onboard Detail Screen |
| TC-OL-05 | Empty state | No records | Open screen | "No onboarding records" message |

---

## 20. Onboard Detail Screen

**Path:** `src/screens/onboarding/OnboardDetailScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-OD-01 | Onboard info loads | Record exists | Open record | School, assignee, status, completion%, modules, dates shown |
| TC-OD-02 | Update progress | Logged in as assignee | Tap update progress | Completion percentage updates |
| TC-OD-03 | Status update | — | Change status | New status saved; badge updates |
| TC-OD-04 | Module checklist | Modules assigned | View modules | Each module shows checked/unchecked state |

---

## 21. Activity Log Screen

**Path:** `src/screens/activities/ActivityLogScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-ACT-01 | Activity list loads | Activities exist | Open Activity Log | List shows type icon, date, school, outcome, person met |
| TC-ACT-02 | Filter by type | — | Filter "Visit" | Only Visit activities shown |
| TC-ACT-03 | Filter by outcome | — | Filter "Positive" | Only Positive outcome activities |
| TC-ACT-04 | Date range filter | — | Select date range | Activities within range shown |
| TC-ACT-05 | GPS verified badge | gpsVerified=true | View activity | GPS checkmark badge displayed |
| TC-ACT-06 | Photo attachment | photoUrl exists | View activity | Photo thumbnail shown; tap to enlarge |
| TC-ACT-07 | Add activity | Logged in as FO | Tap + | Activity creation form opens (from Lead Detail or directly) |
| TC-ACT-08 | Empty state | No activities | Open screen | "No activities found" message |
| TC-ACT-09 | Outcome color coding | — | View list | Positive=green, Neutral=gray, Negative=red, Pending=amber |

---

## 22. My Day Tracking Screen

**Path:** `src/screens/tracking/MyDayTrackingScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-MT-01 | Session status loads | — | Open My Day | Shows today's session status (not_started / active / ended) |
| TC-MT-02 | Start Day button | Session not started | Tap "Start Day" | Tracking session created; GPS pinging begins; button changes to "End Day" |
| TC-MT-03 | End Day button | Session active | Tap "End Day" | Session ends; tracking stops; distance and allowance shown |
| TC-MT-04 | Distance display | Session active/ended | View screen | Total distance in km shown; updates in real-time when active |
| TC-MT-05 | Allowance amount | Session ended | View summary | Travel allowance calculated (distance × rate) shown in ₹ |
| TC-MT-06 | Already started today | Session active | Open My Day | "End Day" button shown; current session stats visible |
| TC-MT-07 | Day already ended | Session ended | Open My Day | Summary shown; no start/end buttons; read-only state |
| TC-MT-08 | Location permission denied | — | Tap Start Day without location permission | Alert: "Location permission required" |
| TC-MT-09 | Fraud flag indicator | Session has fraudFlags | View ended session | Warning shown if isSuspicious=true |
| TC-MT-10 | School visit log | Geofence entries today | View screen | Schools visited today with time-in, time-out, duration |
| TC-MT-11 | Offline start | Device offline | Tap Start Day | Error or queue; "Cannot start day offline" message |

---

## 23. Live Tracking Screen

**Path:** `src/screens/tracking/LiveTrackingScreen.tsx`
**Accessible by:** ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-LT-01 | Live map loads | FOs have active sessions | Open Live Tracking | Map renders with FO location pins |
| TC-LT-02 | FO pin details | — | Tap FO pin on map | Callout shows FO name, distance, speed, last seen time |
| TC-LT-03 | Suspicious FO indicator | FO has isSuspicious=true | View map | FO pin marked with warning/red indicator |
| TC-LT-04 | FO list below map | — | Scroll down | List of FOs with name, status, distance, allowance |
| TC-LT-05 | Auto-refresh | — | Wait 30 seconds | FO locations update automatically |
| TC-LT-06 | Filter by zone | Logged in as RH/SH | Select zone filter | Only FOs from selected zone shown |
| TC-LT-07 | No active FOs | No FOs have sessions | Open screen | "No active field officers" message |
| TC-LT-08 | Speed indicator | FO moving fast | View FO card | Speed shown in km/h |
| TC-LT-09 | Fraud score | fraudScore > threshold | View FO | Fraud score percentage shown with warning color |

---

## 24. Assigned Schools Screen

**Path:** `src/screens/tracking/AssignedSchoolsScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-ASS-01 | Schools map loads | Assignments exist for today | Open screen | Map shows numbered pins for each assigned school |
| TC-ASS-02 | Geofence circles | — | View map | Semi-transparent circles drawn around each school |
| TC-ASS-03 | Route polyline | Multiple schools | View map | Dashed line connects schools in visit order |
| TC-ASS-04 | Visited status | School marked visited | View map | Pin shows green checkmark; list row shows "Visited" badge |
| TC-ASS-05 | Time spent | Visit time exists | View list row | "Visited (X min)" shown under visited school |
| TC-ASS-06 | Google Maps button | — | Tap "Open Route in Google Maps" | Opens Google Maps with all schools as waypoints |
| TC-ASS-07 | Select school row | — | Tap school in list | Map pans to that school pin |
| TC-ASS-08 | Your location pin | GPS active | View map | Blue "You" pill shown at current GPS position |
| TC-ASS-09 | No assignments | No schools assigned today | Open screen | "No Schools Assigned" overlay shown |
| TC-ASS-10 | Geofence activation | Screen loads | Load assignments | Background geofences registered for iOS (updateGeofences called) |
| TC-ASS-11 | School arrival notification | Enter school geofence | Walk into school zone | iOS notification: "Arrived at [School Name]" |
| TC-ASS-12 | School exit notification | Exit school geofence | Leave school zone | iOS notification: "Visit logged — X min at [School Name]" |
| TC-ASS-13 | Visit order display | Multiple schools | View list | Schools numbered 1, 2, 3... in planned visit order |

---

## 25. Route Planner Screen

**Path:** `src/screens/tracking/RoutePlannerScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-RP-01 | Today's plan loads | Plan exists | Open Route Planner | Existing route plan shows stops in order |
| TC-RP-02 | Create plan | No plan for today | Tap "Create Plan" | School picker opens to select stops |
| TC-RP-03 | Add school stop | — | Select school | Stop added to plan with order number |
| TC-RP-04 | Reorder stops | Multiple stops | Drag handles | Stop order changes; order numbers update |
| TC-RP-05 | Remove stop | Stop exists | Tap remove on stop | Stop removed from plan |
| TC-RP-06 | Optimize route | Multiple stops | Tap "Optimize" | API called; stops reordered by optimal route |
| TC-RP-07 | Mark visited | Tracking session active | Tap "Mark Visited" on stop | Stop marked visited; green checkmark shown |
| TC-RP-08 | Estimated distance | Plan created | View plan | Total estimated distance shown |
| TC-RP-09 | Estimated duration | — | View plan | Total estimated duration shown |
| TC-RP-10 | Empty state | No plan yet | Open screen | "No route plan for today" with create button |

---

## 26. AI Daily Plan Screen

**Path:** `src/screens/ai/AiDailyPlanScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AIP-01 | Plan loads | Plan generated | Open AI Daily Plan | Agenda items shown with time, action, school, reason |
| TC-AIP-02 | Generate plan | No plan yet | Tap "Generate Plan" | API called; loading spinner; plan appears |
| TC-AIP-03 | Accept plan | Plan exists | Tap "Accept Plan" | Plan accepted; confirmed badge; route plan created |
| TC-AIP-04 | Regenerate plan | Plan exists | Tap "Regenerate" | New plan generated replacing old |
| TC-AIP-05 | Daily tips | Plan has tips | View screen | Tips section shown below agenda |
| TC-AIP-06 | Target reminder | Target near deadline | View screen | Target reminder card shown |
| TC-AIP-07 | Usage quota | — | View screen | Remaining AI uses shown (quota indicator) |
| TC-AIP-08 | Quota exhausted | Used all daily quota | Tap Generate | "Daily limit reached" message; generate button disabled |
| TC-AIP-09 | Optimized route note | Plan has route | View plan | Route optimization note shown |
| TC-AIP-10 | Empty state | First use | Open screen | "Generate your AI plan for today" prompt shown |

---

## 27. AI Daily Report Screen

**Path:** `src/screens/ai/AiDailyReportScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AIR-01 | Report loads | Report generated | Open AI Daily Report | Summary, completed items, pending items, metrics shown |
| TC-AIR-02 | Generate report | End of day, sessions done | Tap "Generate Report" | API called; report appears |
| TC-AIR-03 | Metrics display | — | View metrics section | Visit time, travel time, idle time, quality score shown |
| TC-AIR-04 | Tomorrow suggestion | — | View report | "Tomorrow's suggestion" section shown |
| TC-AIR-05 | Completed vs pending | — | View lists | Completed items in green; pending in amber |
| TC-AIR-06 | Quality score color | Score < 50 | View score | Red color for low quality |

---

## 28. AI Insights Screen

**Path:** `src/screens/ai/AiInsightsScreen.tsx`
**Accessible by:** FO, ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AII-01 | Insights load | Insights available | Open AI Insights | Insights list/cards shown |
| TC-AII-02 | Lead score breakdown | Lead selected | Tap lead | Score breakdown: engagement, visitQuality, contactQuality, demoProgress, dealSignals |
| TC-AII-03 | AI reports list | — | View reports section | AI-generated report titles shown |
| TC-AII-04 | Generate management report | Logged in as ZH+ | Tap generate management report | Report generated for the role level |
| TC-AII-05 | Quota display | — | View screen | Daily AI usage quota shown |

---

## 29. Targets Screen

**Path:** `src/screens/targets/TargetsScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-TG-01 | My targets load | Targets assigned | Open Targets | List shows title, period, targetAmount, achievedAmount, status, progress bar |
| TC-TG-02 | Progress bar accuracy | — | View target | Progress bar = (achievedAmount / targetAmount) × 100 |
| TC-TG-03 | Target status badge | — | View targets | Pending=gray, InProgress=blue, Submitted=amber, Approved=green, Rejected=red, Overdue=red |
| TC-TG-04 | Assign sub-target | Logged in as ZH/RH/SH | Tap "Assign Target" | Create target form opens with parent target linked |
| TC-TG-05 | Submit target | Target InProgress | Tap "Submit" | Target status changes to Submitted; confirmation shown |
| TC-TG-06 | Review target | Logged in as approver | Tap pending target | Approve/Reject options shown |
| TC-TG-07 | Schools & revenue metrics | — | View target | numberOfSchools/achievedSchools and revenue progress shown |
| TC-TG-08 | Overdue target | Past end date | View expired target | Red "Overdue" badge shown; days overdue count |
| TC-TG-09 | Hierarchy view | — | Tap "View Hierarchy" | Parent/sub-target tree shown |
| TC-TG-10 | Delete target | Logged in as creator | Long-press target | Delete confirmation; on confirm target removed |

---

## 30. Calendar Screen

**Path:** `src/screens/calendar/CalendarScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-CAL-01 | Calendar loads | Events exist | Open Calendar | Month view shown with event dots on dates |
| TC-CAL-02 | Navigate months | — | Swipe left/right | Previous/next month shown |
| TC-CAL-03 | Select date | — | Tap a date | Events for that date shown below calendar |
| TC-CAL-04 | Event types | Multiple event types | View events | Different colors for Visit, Demo, Call, etc. |
| TC-CAL-05 | Add event | — | Tap + | Event creation form opens |
| TC-CAL-06 | Event form fields | — | Open create event | Title, description, event type, start time, end time, school fields |
| TC-CAL-07 | Mark event complete | Event exists | Tap "Mark Complete" | isCompleted=true; event shown with strikethrough/done state |
| TC-CAL-08 | Edit event | Event exists | Tap edit on event | Form pre-filled with event data |
| TC-CAL-09 | Delete event | Event exists | Tap delete | Confirmation; event removed from calendar |
| TC-CAL-10 | Today indicator | — | View calendar | Today's date highlighted |

---

## 31. Pipeline Screen

**Path:** `src/screens/pipeline/PipelineScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-PP-01 | Kanban board loads | Leads in various stages | Open Pipeline | Columns: New/Contacted, Qualified, Demo Stage, Proposal/Negotiation, Won/Implementation |
| TC-PP-02 | Lead cards in columns | — | View board | Each card shows school, score, value, FO name |
| TC-PP-03 | Column totals | — | View column header | Count and total pipeline value per column shown |
| TC-PP-04 | Navigate to lead | — | Tap lead card | Opens Lead Detail Screen |
| TC-PP-05 | Horizontal scroll | Multiple columns | Swipe horizontally | Board scrolls to reveal all columns |
| TC-PP-06 | Filter by FO | Logged in as ZH+ | Select FO filter | Board shows only selected FO's leads |
| TC-PP-07 | Empty column | No leads in stage | View column | "No leads" placeholder shown in that column |

---

## 32. Performance Screen

**Path:** `src/screens/performance/PerformanceScreen.tsx`
**Accessible by:** ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-PF-01 | Team performance loads | Team members exist | Open Performance | Table/list shows each user's revenue, target%, visits, demos, deals, win rate |
| TC-PF-02 | Sort by revenue | — | Tap "Revenue" column header | List sorted by revenue descending |
| TC-PF-03 | FO status indicator | — | View FO row | "On Track" / "At Risk" / "Behind" status shown |
| TC-PF-04 | Progress bars | — | View target% | Progress bar per row |
| TC-PF-05 | Navigate to FO detail | — | Tap FO row | Opens detailed FO performance view |
| TC-PF-06 | Filter by zone/region | Logged in as RH/SH | Apply filter | Only users from selected zone/region shown |

---

## 33. Reports Screen

**Path:** `src/screens/reports/ReportsScreen.tsx`
**Accessible by:** ZH, RH, SH, SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-RP-01 | Report list loads | — | Open Reports | Cards shown: Monthly Performance, Deal Aging, Conversion Funnel, Lost Deal Analysis, Territory Coverage, Team Leaderboard |
| TC-RP-02 | Role-filtered reports | Logged in as ZH | View list | Only reports tagged for ZH role shown |
| TC-RP-03 | Export PDF | — | Tap export PDF on report | PDF generated; share sheet opens |
| TC-RP-04 | Export CSV | — | Tap export CSV | CSV file downloaded/shared |
| TC-RP-05 | Export Excel | — | Tap export Excel | Excel file downloaded/shared |
| TC-RP-06 | Report loading state | — | Tap a report | Loading indicator while data fetches |
| TC-RP-07 | Leaderboard ranking | — | View Team Leaderboard | FOs ranked by revenue; rank numbers shown |

---

## 34. Payments Screen

**Path:** `src/screens/payments/PaymentsScreen.tsx`
**Accessible by:** FO, ZH, RH, SH

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-PAY-01 | Payments list loads | Payments exist | Open Payments | List shows school, amount, method, status, date |
| TC-PAY-02 | Add payment | Deal exists | Tap + | Payment creation form opens |
| TC-PAY-03 | Payment method picker | — | Tap method field | Options: Cash, Cheque, Bank Transfer, UPI, etc. |
| TC-PAY-04 | Cheque fields | Method=Cheque | Select Cheque | Extra fields: cheque number, cheque date, bank name, cheque image |
| TC-PAY-05 | Status badge | — | View list | Pending=amber, Partial=blue, Paid=green |
| TC-PAY-06 | Filter by status | — | Filter "Pending" | Only pending payments shown |
| TC-PAY-07 | Verify payment | Logged in as ZH+ | Tap "Verify" | Payment marked verified; status updates |
| TC-PAY-08 | Amount validation | — | Enter 0 amount | Validation error: "Amount must be greater than 0" |

---

## 35. SCA Payments Screen

**Path:** `src/screens/payments/ScaPaymentsScreen.tsx`
**Accessible by:** SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SCAP-01 | All payments load | — | Open screen | All system payments listed |
| TC-SCAP-02 | Direct payments tab | — | Switch to Direct Payments | Bonuses, allowances, incentives for users listed |
| TC-SCAP-03 | Add direct payment | — | Tap + in direct payments | Form: user, type (Bonus/Allowance/Incentive), amount, description |
| TC-SCAP-04 | Allowance approvals | — | View allowances tab | Allowance records with approve button |
| TC-SCAP-05 | Approve allowance | Allowance pending | Tap "Approve" | allowance.approved=true; record updates |
| TC-SCAP-06 | Fraud score on allowance | Suspicious session | View allowance | fraudScore shown; isSuspicious flag marked |

---

## 36. Notifications Screen

**Path:** `src/screens/notifications/NotificationsScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-NOT-01 | Notifications load | Notifications exist | Open Notifications | List shows title, body, type, time |
| TC-NOT-02 | Unread indicator | Unread notifications exist | View list | Unread items shown with bold or highlight |
| TC-NOT-03 | Mark single read | Unread notification | Tap notification | isRead=true; highlight removed |
| TC-NOT-04 | Mark all read | Unread notifications exist | Tap "Mark All Read" | All notifications marked read |
| TC-NOT-05 | Delete notification | — | Swipe left or tap delete | Notification removed from list |
| TC-NOT-06 | Notification type icon | — | View various types | Urgent=red, Reminder=blue, Success=green, Warning=amber, Info=gray |
| TC-NOT-07 | Relative timestamp | — | View time | "2 min ago", "Yesterday", "3d ago" format used |
| TC-NOT-08 | Empty state | No notifications | Open screen | "No notifications" message shown |

---

## 37. Create Deal Screen

**Path:** `src/screens/deals/CreateDealScreen.tsx`
**Accessible by:** FO (create), ZH/RH/SH/SCA (approve)

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-CD2-01 | Form renders with lead data | Lead at Negotiation+ stage | Open Create Deal | School name pre-filled from lead; editable fields shown |
| TC-CD2-02 | Contract value required | — | Submit without value | Validation error |
| TC-CD2-03 | Discount < 100% | — | Enter 110 as discount | Validation error: discount must be 0–100 |
| TC-CD2-04 | Final value calculation | Enter value and discount | Change discount | Final value = contractValue - (contractValue × discount / 100) auto-calculated |
| TC-CD2-05 | Module multi-select | — | Tap modules field | Checklist: AI Voice, Curriculum, AI Videos, Lab Simulator, ERP, Homework, Exam |
| TC-CD2-06 | Payment terms picker | — | Tap payment terms | Options: 100% Upfront, 50/50, Quarterly, Annual |
| TC-CD2-07 | Duration picker | — | Tap duration | Options: 1, 2, 3, 5 Years |
| TC-CD2-08 | Submit for approval | — | Tap "Submit for Approval" | Deal created with status PendingZH; success message |
| TC-CD2-09 | Save as draft | — | Tap "Save Draft" | Deal created with status Draft; no approval triggered |
| TC-CD2-10 | Approval flow | Deal PendingZH | ZH opens deal | Approve / Reject buttons shown |

---

## 38. Visit Report Screen

**Path:** `src/screens/visitReport/VisitReportScreen.tsx`
**Accessible by:** FO

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-VR-01 | Form renders | Geofence exit occurred | Open Visit Report | Purpose, person met, outcome, remarks, next action fields |
| TC-VR-02 | Purpose required | — | Submit without purpose | Validation error |
| TC-VR-03 | Next action required | — | Submit without next action | Validation error |
| TC-VR-04 | Person met picker | Contacts exist | Tap person met | Shows school contacts as options |
| TC-VR-05 | Custom visit fields | visitFields configured | View form | Extra fields defined by admin appear in form |
| TC-VR-06 | Next action date | — | Set next action date | Date picker opens; date saved |
| TC-VR-07 | Successful submit | All required fields | Tap Submit | Visit report saved; navigate back; success toast |
| TC-VR-08 | Activity linked | Activity ID passed | View form | Activity association shown in report |

---

## 39. Audit History Screen

**Path:** `src/screens/audit/AuditHistoryScreen.tsx`
**Accessible by:** SCA, SH

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AUD-01 | Audit log loads | Audit records exist | Open Audit History | Log shows entityType, action, performedBy, timestamp |
| TC-AUD-02 | Filter by entity type | — | Filter "Lead" | Only Lead audit records shown |
| TC-AUD-03 | Filter by user | — | Filter by user name | Only that user's actions shown |
| TC-AUD-04 | Filter by date range | — | Select from/to dates | Only logs in range shown |
| TC-AUD-05 | Changed fields detail | Record has changedFields | Tap log entry | Expand shows field-by-field old→new values |
| TC-AUD-06 | Action badges | — | View list | Created=green, Updated=blue, Deleted=red |
| TC-AUD-07 | IP address shown | IP recorded | View log entry | IP address shown |

---

## 40. Weekly Plan Screen

**Path:** `src/screens/weeklyPlan/WeeklyPlanScreen.tsx`
**Accessible by:** FO (submit), ZH/RH (approve/reject)

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-WP-01 | My plan loads | Plan exists | Open Weekly Plan | 7-day grid with activities per day |
| TC-WP-02 | Create plan | No plan this week | Tap "Create Plan" | Day-by-day form opens |
| TC-WP-03 | Add activity to day | — | Tap a day → Add activity | Activity type, school, time fields shown |
| TC-WP-04 | Submit plan | Plan in Draft | Tap "Submit for Approval" | Status=Submitted; ZH/RH notified |
| TC-WP-05 | Approve plan | Logged in as ZH, plan submitted | Tap "Approve" | Plan status=Approved; FO notified |
| TC-WP-06 | Reject plan | Logged in as ZH | Tap "Reject" with reason | Plan rejected; FO sees rejection with reason |
| TC-WP-07 | Manager edit | Logged in as ZH | Tap "Edit" on plan | Manager can modify submitted plan |
| TC-WP-08 | Team plans view | Logged in as ZH | View team tab | All FOs' plans for the week listed |
| TC-WP-09 | Status badge | — | View plan card | Draft=gray, Submitted=amber, Approved=green, Rejected=red |

---

## 41. User Management Screen

**Path:** `src/screens/users/UserManagementScreen.tsx`
**Accessible by:** SCA, SH, RH (for own hierarchy)

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-UM-01 | User list loads | Users exist | Open User Management | List shows name, email, role badge, zone, region |
| TC-UM-02 | Add new user | — | Tap + | User creation form: name, email, role, zone/region |
| TC-UM-03 | Role assignment | — | Tap role field | Options: FO, ZH, RH, SH (SCA only visible to SCA) |
| TC-UM-04 | Zone assignment | Role=FO or ZH | Select zone | Zone picker shows available zones |
| TC-UM-05 | Edit user | User exists | Tap edit on user | Edit form pre-filled |
| TC-UM-06 | Delete user | — | Tap delete | Confirmation modal; on confirm user deactivated |
| TC-UM-07 | Search user | — | Type name in search | Filtered list shown |
| TC-UM-08 | Role badge colors | — | View list | FO=teal, ZH=purple, RH=orange, SH=blue, SCA=gray |
| TC-UM-09 | Create zone | — | Tap "Add Zone" | Zone creation form; name + region required |
| TC-UM-10 | Create region | — | Tap "Add Region" | Region creation form; name required |

---

## 42. Settings Screens

### 42a. Settings Screen
**Path:** `src/screens/settings/SettingsScreen.tsx`
**Accessible by:** All roles

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-SET-01 | Settings page loads | — | Open Settings | Language, push notifications, logout options shown |
| TC-SET-02 | Language toggle English | — | Select English | App language switches to English throughout |
| TC-SET-03 | Language toggle Hindi | — | Select Hindi | App language switches to Hindi throughout |
| TC-SET-04 | Push notifications toggle | — | Toggle off | Preference saved; push notifications disabled |
| TC-SET-05 | Logout | — | Tap Logout | Confirmation dialog; on confirm token cleared; navigate to Login |
| TC-SET-06 | App version shown | — | View settings | App version string displayed at bottom |

### 42b. Dashboard Customize Screen
**Path:** `src/screens/settings/DashboardCustomizeScreen.tsx`

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-DC-01 | Widget list loads | — | Open customize | All available widgets listed with toggle switches |
| TC-DC-02 | Toggle widget off | Widget visible | Toggle off | Widget hidden from dashboard |
| TC-DC-03 | Reorder widgets | — | Drag widget row | Widget order changes; updated on dashboard |
| TC-DC-04 | Save configuration | Changes made | Tap Save | saveDashboardConfig API called; success shown |
| TC-DC-05 | Reset to default | — | Tap "Reset" | Default widget configuration restored |

### 42c. Allowance Config Screen
**Path:** `src/screens/settings/AllowanceConfigScreen.tsx`
**Accessible by:** SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-AC2-01 | Config list loads | — | Open screen | List of allowance rate configs (per role) |
| TC-AC2-02 | Add new config | — | Tap + | Form: role, rate per km, effective date |
| TC-AC2-03 | Rate per km validation | — | Enter negative value | Validation error |
| TC-AC2-04 | Resolve for user | User exists | Tap "Resolve" | Shows which config applies to a specific user |

### 42d. Visit Field Config Screen
**Path:** `src/screens/settings/VisitFieldConfigScreen.tsx`
**Accessible by:** SCA

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-VFC-01 | Field list loads | — | Open screen | Custom visit report fields listed |
| TC-VFC-02 | Add field | — | Tap + | Form: field name, type (text/picker/checkbox), required toggle |
| TC-VFC-03 | Edit field | Field exists | Tap edit | Edit form pre-filled |
| TC-VFC-04 | Delete field | — | Tap delete | Confirmation; field removed; no longer appears in visit report |
| TC-VFC-05 | Required field toggle | — | Toggle required on | Field marked as required in visit report form |

### 42e. User Manual Screen
**Path:** `src/screens/settings/UserManualScreen.tsx`

| TC | Test Case | Precondition | Steps | Expected Result |
|----|-----------|-------------|-------|----------------|
| TC-UM2-01 | Manual renders | — | Open User Manual | HTML-based manual content renders in WebView/scroll view |
| TC-UM2-02 | Share/Export PDF | — | Tap share/export button | PDF generated from HTML; share sheet opens |
| TC-UM2-03 | Role-specific content | — | View as FO vs ZH | Content relevant to logged-in role shown |

---

## Cross-Cutting Test Cases

### Offline Behaviour

| TC | Test Case | Steps | Expected Result |
|----|-----------|-------|----------------|
| TC-OFF-01 | Offline banner | Turn off WiFi/data → open app | Red "Offline" banner appears at top of all screens |
| TC-OFF-02 | Offline banner disappears | Reconnect network | Banner disappears automatically |
| TC-OFF-03 | Queue offline action | Offline → create lead | Action queued; "Saved offline" toast |
| TC-OFF-04 | Sync on reconnect | Actions in queue → reconnect | SyncManager flushes queue; actions sent to server |
| TC-OFF-05 | Cache schools | Online → open schools → go offline → reopen | Cached school data shown |

### Security / Auth

| TC | Test Case | Steps | Expected Result |
|----|-----------|-------|----------------|
| TC-SEC-01 | Role access control | Login as FO → attempt to navigate to Live Tracking (ZH only) | Access denied; FO tab doesn't include that screen |
| TC-SEC-02 | Token expiry redirect | Token expires mid-session | 401 interceptor fires; auto-logout; Login screen shown |
| TC-SEC-03 | Device fingerprint on login | Login from new device | Backend receives deviceInfo payload; NewDevice alert generated |
| TC-SEC-04 | Emulator detection | Login from Android emulator | isEmulator=true sent to backend |

### Performance

| TC | Test Case | Steps | Expected Result |
|----|-----------|-------|----------------|
| TC-PERF-01 | Dashboard load time | Open any dashboard on 4G | KPI cards visible within 3 seconds |
| TC-PERF-02 | Map render | Open Assigned Schools or Live Tracking | Map renders within 2 seconds |
| TC-PERF-03 | Large list scroll | Leads list with 100+ items | Smooth 60fps scroll; no jank |

### Tablet / Responsive Layout

| TC | Test Case | Steps | Expected Result |
|----|-----------|-------|----------------|
| TC-TAB-01 | iPad dashboard layout | Open dashboard on iPad | 2-column KPI grid; wider cards |
| TC-TAB-02 | iPad form layout | Open add lead on iPad | Form takes partial width; not edge-to-edge |
| TC-TAB-03 | Landscape orientation | Rotate iPad to landscape | Layout adjusts; no overflow or cut-off elements |

---

*Total Test Cases: 350+*
*Last Updated: 2026-03-29*
