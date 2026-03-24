# SingularityCRM — User Manual

> **EduCRM Sales Portal · Mobile Application**
> Version 1.0.0 · React Native · iOS & Android

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [User Roles](#3-user-roles)
4. [Navigation](#4-navigation)
5. [Dashboard](#5-dashboard)
6. [Leads Management](#6-leads-management)
7. [Pipeline (Kanban Board)](#7-pipeline-kanban-board)
8. [Schools](#8-schools)
9. [Contacts](#9-contacts)
10. [Activities](#10-activities)
11. [Demos](#11-demos)
12. [Deals](#12-deals)
13. [Calendar](#13-calendar)
14. [Visit Reports](#14-visit-reports)
15. [Onboarding](#15-onboarding)
16. [Payments](#16-payments)
17. [Targets](#17-targets)
18. [Performance & Reports](#18-performance--reports)
19. [Location Tracking](#19-location-tracking)
20. [AI Features](#20-ai-features)
21. [Notifications](#21-notifications)
22. [Settings](#22-settings)
23. [Offline Mode](#23-offline-mode)
24. [Audit History](#24-audit-history)
25. [Troubleshooting](#25-troubleshooting)

---

## 1. Overview

SingularityCRM is a mobile CRM application built for EdTech sales teams. It enables Field Officers (FOs) and their managers to manage school leads, track visits, monitor pipeline, run demos, close deals, and leverage AI-powered daily planning — all from a smartphone.

**Key capabilities:**
- Role-based dashboards with real-time KPIs
- Full lead lifecycle management (New → Won/Lost)
- Pinch-to-zoom Kanban pipeline with drag-and-drop card movement
- GPS-based location tracking and geofencing
- AI-generated daily plans and reports
- Duplicate detection for schools and contacts
- Offline mode with automatic sync on reconnect
- Multi-language support (English / Hindi)
- Audit trail for all entity changes

---

## 2. Getting Started

### Login

```
┌─────────────────────────────────┐
│          9:41 AM        ▓▓▓▓▓  │
├─────────────────────────────────┤
│                                 │
│         ◉ SingularityCRM        │
│       EduCRM Sales Portal       │
│                                 │
│  ┌─────────────────────────┐    │
│  │  📧  email@educrm.in    │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🔒  ••••••••           │    │
│  └─────────────────────────┘    │
│                                 │
│  ╔═════════════════════════╗    │
│  ║        L O G I N        ║    │
│  ╚═════════════════════════╝    │
│                                 │
│     Forgot password?            │
│                                 │
│  Version 1.0.0                  │
└─────────────────────────────────┘
```

1. Open the app — you will see the **Login** screen.
2. Enter your registered **email address** and **password**.
3. Tap **Login**.
4. Your dashboard loads automatically based on your assigned role.

> Your session stays active for **7 days**. You will only be asked to log in again after this period or if you manually log out.

### Logout

Go to **Settings → Account → Logout**.

---

## 3. User Roles

The app has four roles, each with a different color theme and set of tabs:

| Role | Full Name | Color | Access Level |
|------|-----------|-------|--------------|
| **FO** | Field Officer | Teal `#0d9488` | Own leads, schools, calendar, tracking, targets |
| **ZH** | Zone Head | Purple `#7c3aed` | Zone leads, pipeline, team performance, live tracking, user management |
| **RH** | Regional Head | Orange `#ea580c` | Regional leads, pipeline, reports, team tracking |
| **SH** | Sales Head | Blue `#2563eb` | All regions, full reports, pipeline, performance |

Each role sees only the data and tabs relevant to their level.

---

## 4. Navigation

### Bottom Tab Bar

```
┌─────────────────────────────────────────┐
│                  Screen                 │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  🏠    📋    🏫    📅    📍    🎯    ⚙️  │
│ Dash  Leads School  Cal  MyDay Target Set│
└─────────────────────────────────────────┘
        FO Tab Bar (7 tabs)

┌──────────────────────────────────────────────────┐
│  🏠   📋   🌿   🎯   📈   🧭   📍   👥   ⚙️    │
│ Dash Lead Pipe Tgt Team MyDay Live Users Set     │
└──────────────────────────────────────────────────┘
        ZH / RH / SH Tab Bar (9 tabs)
```

### Offline Banner

```
┌─────────────────────────────────┐
│ ████ No internet — 3 actions queued ████ │  ← Red banner
├─────────────────────────────────┤
│           Screen content        │
```

A **red banner** appears at the top of the screen when the device has no internet connection, showing how many actions are queued for sync.

---

## 5. Dashboard

### FO Dashboard

```
┌─────────────────────────────────┐
│  ████████████████████████████  │
│  ◀  Good Morning, Ravi! 🌤     │
│     Monday, 24 March 2026       │
│  ████████████████████████████  │
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │ Visits   │  │  Calls   │    │
│  │   3/5    │  │   7/10   │    │
│  │  Today   │  │  Today   │    │
│  └──────────┘  └──────────┘    │
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │ Active   │  │  Score   │    │
│  │  Leads   │  │   78%    │    │
│  │   24     │  │ ▓▓▓▓▓▓▓░ │    │
│  └──────────┘  └──────────┘    │
│                                 │
│  ── Today's Plan ──────────     │
│  🏫 Delhi Public School  9:00  │
│  📞 Modern Academy      11:00  │
│  🏫 Sunrise School      14:00  │
│                                 │
│  ── Recent Activity ───────     │
│  ✅ Visit · DPS · 2h ago        │
│  📞 Call · Sunrise · 4h ago     │
│                                 │
│  [+ Add Lead]  [+ Log Activity] │
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

### ZH / RH / SH Dashboard

```
┌─────────────────────────────────┐
│  ████ Zone Dashboard ██████████ │
│     March 2026  •  West Zone    │
│  ████████████████████████████  │
│                                 │
│  ┌────────┐ ┌────────┐ ┌─────┐  │
│  │ Leads  │ │ Demos  │ │Deals│  │
│  │   47   │ │   12   │ │  5  │  │
│  │ +3 today│ │ this wk│ │ mtd │  │
│  └────────┘ └────────┘ └─────┘  │
│                                 │
│  Revenue Pipeline               │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  62%   │
│  ₹18.4L of ₹30L target          │
│                                 │
│  ── Team Leaderboard ──         │
│  🥇 Ravi Kumar      94pts       │
│  🥈 Priya Singh     87pts       │
│  🥉 Amit Sharma     81pts       │
│                                 │
│  ── Live FOs ──────────         │
│  🟢 Ravi  •  DPS, Dwarka        │
│  🟢 Priya •  Ryan Int'l         │
│  ⚫ Amit  •  Last seen 2h ago   │
│                                 │
├─────────────────────────────────┤
│  🏠  📋  🌿  🎯  📈  🧭  📍  ⚙️ │
└─────────────────────────────────┘
```

### Customize Dashboard

```
┌─────────────────────────────────┐
│  ██ Customize Dashboard ███████ │
│     5 of 7 widgets visible      │
│  ████████████████████████████  │
│                                 │
│  ℹ Toggle widgets on/off and    │
│    use arrows to reorder them.  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ▲  1  📊 KPI Summary      │🔵│
│  │ ▼     KPI · large         │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ▲  2  📈 Pipeline Chart   │🔵│
│  │ ▼     CHART · large       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ▲  3  📋 Recent Leads     │🔵│
│  │ ▼     LIST · medium       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ▲  4  🗺️ Team Map         │⚪│
│  │ ▼     MAP · large    OFF  │  │
│  └───────────────────────────┘  │
│                                 │
│  [Reset to Default] [Save Layout]│
├─────────────────────────────────┤
│  🏠  📋  🌿  🎯  📈  🧭  📍  ⚙️ │
└─────────────────────────────────┘
```

---

## 6. Leads Management

### Leads List

```
┌─────────────────────────────────┐
│  ████████ Leads (47) ██████████ │
│  ████████████████████████████  │
│                                 │
│  🔍 Search school or city...    │
│                                 │
│  [All] [New] [Qualified] [Demo] │
│  [Proposal] [Won] [Lost]        │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔥 Delhi Public School    │  │
│  │    Dwarka • CBSE          │  │
│  │    ₹2,40,000   Score: 82  │  │
│  │    📅 Visited 2 days ago  │  │
│  │    Stage: Demo Done       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │ ← Red left border = overdue
│  ▌ Modern Academy             │  │
│  ▌    Rohini • ICSE           │  │
│  ▌    ₹1,80,000   Score: 54   │  │
│  ▌    ⚠️ No activity 6d ago   │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Sunrise International     │  │
│  │    Gurgaon • IB           │  │
│  │    ₹4,50,000   Score: 67  │  │
│  │    📅 Called yesterday    │  │
│  └───────────────────────────┘  │
│                          [  +  ]│
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

### Add Lead Screen

```
┌─────────────────────────────────┐
│  ◀  Add Lead                    │
│  ████████████████████████████  │
│                                 │
│  ⚠️ 1 possible duplicate found  │  ← Yellow warning
│                                 │
│  ▌ SCHOOL INFORMATION           │
│  ┌─────────────────────────┐    │
│  │ School Name *           │    │
│  │ Delhi Public School     │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ City                    │    │
│  │ Dwarka, New Delhi       │    │
│  └─────────────────────────┘    │
│  Board: [CBSE] [ICSE] [IB] ...  │
│                                 │
│  ▌ DEAL INFORMATION             │
│  ┌─────────────────────────┐    │
│  │ Estimated Value (₹)     │    │
│  │ 240000                  │    │
│  └─────────────────────────┘    │
│  Source: [Field Visit] [Referral]│
│                                 │
│  ╔═════════════════════════╗    │
│  ║       Add Lead          ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

### Lead Detail Screen

```
┌─────────────────────────────────┐
│  ◀  Delhi Public School    🕐 ✎ │
│  ████████████████████████████  │
│                                 │
│  Stage: [Demo Done ▾]           │
│  ₹2,40,000  •  CBSE  •  Dwarka  │
│                                 │
│  ┌─── Score ──────────────┐     │
│  │                        │     │
│  │       ╭─────╮          │     │
│  │       │  82 │  ← tap   │     │
│  │       ╰─────╯          │     │
│  │    🔥 Hot Lead          │     │
│  └────────────────────────┘     │
│                                 │
│  ── Activities ─────────────    │
│  ✅ Visit  •  Positive  •  2d   │
│     "Principal very interested" │
│  📞 Call   •  Neutral   •  5d   │
│     "Follow-up next week"       │
│                                 │
│  ── Contacts ───────────────    │
│  👤 Dr. R. Sharma (Principal)   │
│  👤 Ms. P. Gupta  (Coordinator) │
│                                 │
│  [Log Activity]  [Schedule Demo]│
│  [Create Deal]                  │
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

### Lead Score Breakdown (Modal)

```
┌─────────────────────────────────┐
│                                 │
│  ╔═══════════════════════════╗  │
│  ║    Lead Score Breakdown   ║  │
│  ╠═══════════════════════════╣  │
│  ║                           ║  │
│  ║    Total Score:  82 / 100 ║  │
│  ║    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  ║  │
│  ║                           ║  │
│  ║  Engagement        18/25  ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  ║  │
│  ║                           ║  │
│  ║  Visit Quality     20/25  ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  ║  │
│  ║                           ║  │
│  ║  Contact Quality   15/20  ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░  ║  │
│  ║                           ║  │
│  ║  Demo Progress     17/20  ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  ║  │
│  ║                           ║  │
│  ║  Deal Signals      12/10  ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ║  │
│  ║                           ║  │
│  ║        [ Close ]          ║  │
│  ╚═══════════════════════════╝  │
└─────────────────────────────────┘
```

---

## 7. Pipeline (Kanban Board)

### Normal View

```
┌──────────────────────────────────────────────────────────┐
│  ██████████████ Pipeline ████████████████████████████   │
│  47 leads  •  ₹1,24,50,000       [−] [+] [⊡]          │
│  ████████████████████████████████████████████████████   │
│  🤏 Pinch to zoom  •  ✌ Two-finger drag  •  👆 Long press│
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │New/Contact│ │Qualified │ │Demo Stage│ │Proposal/ │   │
│  │    [12]  │ │   [8]    │ │   [11]   │ │Negotiation│  │
│  │ ₹18.2L   │ │  ₹9.6L   │ │  ₹24.1L  │   [9]    │   │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤   │
│  │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│   │
│  ││🔥DPS   ││ ││Modern  ││ ││Sunrise ││ ││Ryan Int││   │
│  ││Dwarka  ││ ││Rohini  ││ ││Gurgaon ││ ││Noida   ││   │
│  ││₹2.4L 82││ ││₹1.8L 54││ ││₹4.5L 71││ ││₹3.2L 66││   │
│  │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│   │
│  │┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│   │
│  ││Bloom   ││ ││GD Goen ││ ││Oxford  ││ ││Indus   ││   │
│  ││Saket   ││ ││Vasant K││ ││Faridab ││ ││Pune    ││   │
│  ││₹1.6L 45││ ││₹2.1L 61││ ││₹2.8L 58││ ││₹5.0L 79││   │
│  │└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Drag-and-Drop in Action

```
┌──────────────────────────────────────────────────────────┐
│  ██████████████ Pipeline ████████████████████████████   │
│  ████████████████████████████████████████████████████   │
│  📦 Drag over a column to move this lead                 │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │New/Contact│ │Qualified │ │Demo Stage│ │Proposal/ │   │
│  │    [12]  │ │   [8]    │ │   [11]   │ │Negotiation│  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤   │
│  │┌────────┐│ │          │ │┌────────┐│ ║══════════║   │
│  ││🔥DPS   ││ │ ↓ Drop   │ ││Sunrise ││ ║ ↓ Drop   ║   │
│  ││(ghost) ││ │  here    │ ││Gurgaon ││ ║  here    ║ ← highlighted
│  │└ ░░░░░░┘│ │          │ │└────────┘│ ║══════════║   │
│  │         │ │┌────────┐│ │┌────────┐│ │┌────────┐│   │
│  │         │ ││GD Goen ││ ││Oxford  ││ ││Indus   ││   │
│  │         │ │└────────┘│ │└────────┘│ │└────────┘│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│               ╔════════════╗                             │
│               ║ 🔥 DPS     ║  ← Ghost card follows finger│
│               ║ Dwarka     ║                             │
│               ║ ₹2,40,000  ║                             │
│               ╚════════════╝                             │
└──────────────────────────────────────────────────────────┘
```

### Zoom Controls

| Control | Action |
|---------|--------|
| **Pinch in / out** | Zoom the board out / in |
| **Two-finger drag** | Pan the board left / right / up / down |
| **− button** | Zoom out by 20% |
| **+ button** | Zoom in by 20% |
| **⊡ button** | Reset zoom and position to default |

---

## 8. Schools

### Schools List

```
┌─────────────────────────────────┐
│  ████████ Schools (63) █████████│
│  ████████████████████████████  │
│                                 │
│  🔍 Search schools...           │
│                                 │
│  [All] [Active] [Inactive]      │
│  [Blacklisted] [Priority 🔥]    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔥 94  Delhi Public School│  │← Priority score
│  │    Dwarka • CBSE • Private│  │
│  │    HIGH PRIORITY          │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🔥 72  Sunrise Int'l      │  │
│  │    Gurgaon • IB • Private │  │
│  │    MEDIUM PRIORITY        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Ryan International        │  │
│  │    Noida • CBSE • Private │  │
│  │    Active                 │  │
│  └───────────────────────────┘  │
│                          [  +  ]│
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

### Add School — Duplicate Detection Modal

```
┌─────────────────────────────────┐
│                                 │
│  ╔═══════════════════════════╗  │
│  ║  ⚠️  Possible Duplicate   ║  │
│  ║       Found               ║  │
│  ╠═══════════════════════════╣  │
│  ║                           ║  │
│  ║ ▌ Delhi Public School     ║  │
│  ║   Dwarka, Delhi           ║  │
│  ║   ● Definite Match        ║  │
│  ║   Same name & city        ║  │
│  ║   [↗ View Existing]       ║  │
│  ║                           ║  │
│  ║ ▌ DPS Rohini              ║  │
│  ║   Rohini, Delhi           ║  │
│  ║   ◐ Probable Match        ║  │
│  ║   Similar name            ║  │
│  ║   [↗ View Existing]       ║  │
│  ║                           ║  │
│  ║  [Create Anyway] [Cancel] ║  │
│  ╚═══════════════════════════╝  │
└─────────────────────────────────┘
```

---

## 9. Contacts

### Add Contact Screen

```
┌─────────────────────────────────┐
│  ◀  Add Contact                 │
│  ████████████████████████████  │
│                                 │
│  🏫 Delhi Public School         │← School banner
│                                 │
│  ⚠️ 1 possible duplicate found  │← Warning banner
│                                 │
│  ▌ BASIC INFORMATION            │
│  ┌─────────────────────────┐    │
│  │ Full Name *             │    │
│  │ Dr. Ramesh Sharma       │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ Designation             │    │
│  │ Principal               │    │
│  └─────────────────────────┘    │
│                                 │
│  ▌ RELATIONSHIP                 │
│  [New] [Warm] [Strong]          │
│  [Champion] [Detractor]         │
│                                 │
│  Decision Maker        [  🔵  ] │
│  Influencer            [  ⚪  ] │
│                                 │
│  ╔═════════════════════════╗    │
│  ║      Add Contact        ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

### Contact Detail Screen

```
┌─────────────────────────────────┐
│  ◀  Dr. Ramesh Sharma           │
│  ████████████████████████████  │
│                                 │
│        ╭───╮                    │
│        │ R │  Dr. Ramesh Sharma │
│        ╰───╯  Principal         │
│               🏫 DPS Dwarka     │
│                                 │
│  📞 +91 98765 43210             │
│  📧 r.sharma@dps.edu            │
│                                 │
│  Relationship:  ● Strong        │
│  ✅ Decision Maker              │
│  ✅ Influencer                  │
│                                 │
│  Personality Notes:             │
│  "Prefers data-driven demos.    │
│   Very focused on ROI."         │
│                                 │
│  ┌──────────────────────────┐   │
│  │ 📞 Call  💬 WhatsApp     │   │
│  │ 📧 Email  ✏️ Edit        │   │
│  └──────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 10. Activities

### Log Activity Screen

```
┌─────────────────────────────────┐
│  ◀  Log Activity                │
│  ████████████████████████████  │
│  Delhi Public School            │
│                                 │
│  Activity Type                  │
│  [Visit] [Call] [Demo]          │
│  [Proposal] [FollowUp]          │
│  [Contract]                     │
│                                 │
│  Outcome                        │
│  [Positive] [Neutral]           │
│  [Negative] [Pending]           │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Notes                   │    │
│  │ Principal agreed to a   │    │
│  │ product demo next week. │    │
│  │ Very interested in AI   │    │
│  │ Voice module.           │    │
│  └─────────────────────────┘    │
│                                 │
│  Next Follow-up Date            │
│  ┌─────────────────────────┐    │
│  │ 📅  30 March 2026       │    │
│  └─────────────────────────┘    │
│                                 │
│  ╔═════════════════════════╗    │
│  ║      Save Activity      ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

### Activity Log Timeline

```
┌─────────────────────────────────┐
│  ◀  Activities                  │
│  ████████████████████████████  │
│                                 │
│  Today                          │
│  │                              │
│  ├─ ✅ Visit · Positive         │
│  │    Delhi Public School       │
│  │    "Principal confirmed demo"│
│  │    9:30 AM                   │
│  │                              │
│  ├─ 📞 Call · Neutral           │
│  │    Modern Academy            │
│  │    "Will call back Friday"   │
│  │    11:15 AM                  │
│  │                              │
│  Yesterday                      │
│  │                              │
│  ├─ 🎯 Demo · Positive          │
│  │    Sunrise International     │
│  │    "Team loved AI Videos"    │
│  │    2:00 PM                   │
│  │                              │
│  ├─ 📄 Proposal · Pending       │
│  │    Ryan International        │
│  │    "Sent proposal via email" │
│  │    4:45 PM                   │
│                                 │
└─────────────────────────────────┘
```

---

## 11. Demos

### Demo List

```
┌─────────────────────────────────┐
│  ████████ Demos (8) ████████████│
│  ████████████████████████████  │
│                                 │
│  [Upcoming] [Completed] [All]   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📅 28 Mar  •  Online      │  │
│  │ Delhi Public School       │  │
│  │ Ravi Kumar (FO)           │  │
│  │ ⏰ 10:00 AM – 11:30 AM   │  │
│  │ Status: Scheduled    [▶] │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📅 30 Mar  •  Offline     │  │
│  │ Sunrise International     │  │
│  │ Priya Singh (FO)          │  │
│  │ ⏰ 02:00 PM – 03:30 PM   │  │
│  │ Status: Scheduled    [▶] │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ✅ 22 Mar  •  Online      │  │
│  │ Ryan International        │  │
│  │ Score: ⭐⭐⭐⭐⭐           │  │
│  │ Status: Completed         │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## 12. Deals

### Create Deal Screen

```
┌─────────────────────────────────┐
│  ◀  Create Deal                 │
│  ████████████████████████████  │
│  Delhi Public School            │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Contract Value (₹) *    │    │
│  │ 2,40,000                │    │
│  └─────────────────────────┘    │
│                                 │
│  Payment Terms                  │
│  [100% Upfront]                 │
│  [50% Upfront, 50% Post]        │
│  [Quarterly] [Annual]           │
│                                 │
│  Contract Duration              │
│  [1 Year] [2 Years] [3 Years]   │
│                                 │
│  Product Modules                │
│  [✅ AI Voice] [✅ AI Videos]   │
│  [☐ Curriculum] [☐ ERP]        │
│                                 │
│  Expected Close Date            │
│  ┌─────────────────────────┐    │
│  │ 📅  31 March 2026       │    │
│  └─────────────────────────┘    │
│                                 │
│  ╔═════════════════════════╗    │
│  ║       Create Deal       ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

---

## 13. Calendar

```
┌─────────────────────────────────┐
│  ████████ Calendar ████████████ │
│  ████████████████████████████  │
│                                 │
│  ◀  March 2026  ▶               │
│                                 │
│  Mo  Tu  We  Th  Fr  Sa  Su     │
│   2   3   4   5   6   7   8     │
│   9  10  11  12  13  14  15     │
│  16  17  18  19  20  21  22     │
│  23 [24] 25  26  27  28  29    │← Today highlighted
│  30  31                         │
│                                 │
│  ── Monday, 24 March ─────────  │
│                                 │
│  🏫 9:00 AM  Visit              │
│     Delhi Public School         │
│                                 │
│  📞 11:00 AM  Call              │
│     Modern Academy              │
│                                 │
│  🎯 2:00 PM   Demo              │
│     Sunrise International       │
│                                 │
│  📄 4:30 PM   Follow-up Due     │
│     Ryan International          │
│                                 │
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

---

## 14. Visit Reports

```
┌─────────────────────────────────┐
│  ◀  Visit Report                │
│  ████████████████████████████  │
│  Delhi Public School            │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Contacts Met            │    │
│  │ Dr. R. Sharma (Principal│    │
│  │ Ms. P. Gupta (Coord.)   │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Discussion Summary      │    │
│  │ Discussed AI Voice and  │    │
│  │ AI Videos modules.      │    │
│  │ Principal keen on demo. │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Next Steps              │    │
│  │ Schedule product demo   │    │
│  │ for 28 March 2026.      │    │
│  └─────────────────────────┘    │
│                                 │
│  📍 GPS: 28.5921° N, 77.0461° E │
│     Auto-captured ✓             │
│                                 │
│  ╔═════════════════════════╗    │
│  ║      Submit Report      ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

---

## 15. Onboarding

```
┌─────────────────────────────────┐
│  ████████ Onboarding ███████████│
│  ████████████████████████████  │
│                                 │
│  [In Progress] [Completed]      │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Delhi Public School       │  │
│  │ Won: 15 Mar 2026          │  │
│  │                           │  │
│  │ Progress ▓▓▓▓▓▓░░░░  60%  │  │
│  │                           │  │
│  │ ✅ Contract Signed        │  │
│  │ ✅ Onboarding Call Done   │  │
│  │ ✅ Data Migration         │  │
│  │ ⏳ Staff Training         │  │
│  │ ☐  Go Live                │  │
│  │                           │  │
│  │ Go Live: 10 Apr 2026      │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

---

## 16. Payments

```
┌─────────────────────────────────┐
│  ◀  Payments                    │
│  ████████████████████████████  │
│  Delhi Public School            │
│                                 │
│  Contract Value: ₹2,40,000      │
│  Status: ◐ Partial              │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Invoice #1001             │  │
│  │ ₹1,20,000  •  Due: 1 Mar  │  │
│  │ ✅ Paid on 28 Feb 2026    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Invoice #1002             │  │
│  │ ₹1,20,000  •  Due: 1 Apr  │  │
│  │ ⏳ Pending                │  │
│  └───────────────────────────┘  │
│                                 │
│  ── Payment Timeline ─────────  │
│  │                              │
│  ├─ ✅ ₹1,20,000  28 Feb 2026  │
│  ├─ ⏳ ₹1,20,000  1 Apr 2026   │
│                                 │
└─────────────────────────────────┘
```

---

## 17. Targets

```
┌─────────────────────────────────┐
│  ████████ My Targets ███████████│
│  March 2026                     │
│  ████████████████████████████  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Leads Added               │  │
│  │ 18 / 25                   │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  72% │  │
│  │ On Track 🟢               │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Demos Done                │  │
│  │ 7 / 12                    │  │
│  │ ▓▓▓▓▓▓▓▓▓░░░░░░░░░  58%  │  │
│  │ At Risk 🟡                │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Deals Closed              │  │
│  │ 2 / 5                     │  │
│  │ ▓▓▓▓▓▓░░░░░░░░░░░░  40%  │  │
│  │ Behind 🔴                 │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Revenue (₹)               │  │
│  │ ₹4.8L / ₹12L             │  │
│  │ ▓▓▓▓▓▓▓░░░░░░░░░░░  40%  │  │
│  │ Behind 🔴                 │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

---

## 18. Performance & Reports

### Team Performance Screen

```
┌─────────────────────────────────┐
│  ████████ Team Performance ████ │
│  West Zone  •  March 2026       │
│  ████████████████████████████  │
│                                 │
│  ── Leaderboard ───────────     │
│  ┌───────────────────────────┐  │
│  │ 🥇  Ravi Kumar            │  │
│  │     Leads: 18  Deals: 3   │  │
│  │     Revenue: ₹7.2L        │  │
│  │     Score: 94 ▓▓▓▓▓▓▓▓▓▓ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🥈  Priya Singh           │  │
│  │     Leads: 15  Deals: 2   │  │
│  │     Revenue: ₹4.8L        │  │
│  │     Score: 87 ▓▓▓▓▓▓▓▓▓░ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🥉  Amit Sharma           │  │
│  │     Leads: 14  Deals: 2   │  │
│  │     Revenue: ₹4.2L        │  │
│  │     Score: 81 ▓▓▓▓▓▓▓▓░░ │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  🏠  📋  🌿  🎯  📈  🧭  📍  ⚙️ │
└─────────────────────────────────┘
```

### Reports Screen

```
┌─────────────────────────────────┐
│  ████████ Reports ██████████████│
│  ████████████████████████████  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 📊 Monthly Performance    │  │
│  │    Track monthly sales    │  │
│  │    across all FOs       ▶ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ⏳ Deal Aging             │  │
│  │    Deals by age with      │  │
│  │    risk flags           ▶ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🔻 Conversion Funnel      │  │
│  │    Stage-by-stage         │  │
│  │    conversion rates     ▶ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📉 Lost Deal Analysis     │  │
│  │    Why deals are lost   ▶ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🛠️ Custom Report Builder  │  │
│  │    Build with filters   ▶ │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  🏠  📋  🌿  📊  🎯  📈  🧭  ⚙️ │
└─────────────────────────────────┘
```

---

## 19. Location Tracking

### My Day Tracking Screen

```
┌─────────────────────────────────┐
│  ████████ My Day ███████████████│
│  Monday, 24 March 2026          │
│  ████████████████████████████  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🟢 Day Active              │  │
│  │    Started: 9:02 AM        │  │
│  │    Duration: 3h 42m        │  │
│  │    GPS: Tracking ●         │  │
│  └───────────────────────────┘  │
│                                 │
│  ── Today's Visits ──────────   │
│  ┌───────────────────────────┐  │
│  │ ✅ Delhi Public School    │  │
│  │    In: 9:15 AM            │  │
│  │    Out: 10:30 AM  (1h15m) │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ✅ Modern Academy         │  │
│  │    In: 11:10 AM           │  │
│  │    Out: 12:05 PM  (55m)   │  │
│  └───────────────────────────┘  │
│                                 │
│  ╔═════════════╗ ╔═══════════╗  │
│  ║ Start Visit ║ ║ End My Day║  │
│  ╚═════════════╝ ╚═══════════╝  │
├─────────────────────────────────┤
│  🏠    📋    🏫    📅    📍     │
└─────────────────────────────────┘
```

### Live Tracking Screen (ZH/RH/SH)

```
┌─────────────────────────────────┐
│  ████████ Live Tracking █████████│
│  West Zone  •  4 FOs Online     │
│  ████████████████████████████  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  [Map View]               │  │
│  │                           │  │
│  │   🟢 Ravi                 │  │
│  │          🟢 Priya         │  │
│  │                   🟢 Amit │  │
│  │      🟢 Deepak            │  │
│  │                           │  │
│  │   ⚫ Sunita (inactive)    │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  ── FO Status ───────────────   │
│  🟢 Ravi Kumar    DPS Dwarka    │
│     Last ping: 2 min ago        │
│  🟢 Priya Singh   Ryan Int'l    │
│     Last ping: 1 min ago        │
│  🟢 Amit Sharma   In Transit    │
│     Last ping: 4 min ago        │
│  ⚫ Sunita Rao    Day not started│
├─────────────────────────────────┤
│  🏠  📋  🌿  🎯  📈  🧭  📍  ⚙️ │
└─────────────────────────────────┘
```

---

## 20. AI Features

### AI Daily Plan Screen

```
┌─────────────────────────────────┐
│  ◀  AI Daily Plan          ↺    │
│  Monday, 24 March 2026          │
│  ████████████████████████████  │
│                                 │
│  ⚡ 2 of 3 regenerations left   │← Quota banner
│                                 │
│  💡 Focus on Demo Stage leads   │
│     today — 3 are overdue for   │
│     follow-up.                  │
│                                 │
│  🎯 Target: ₹12L by month end.  │
│     You're at 40%. Push hard    │
│     this week.                  │
│                                 │
│  Suggested Agenda (4 items)     │
│                                 │
│  ┌─── Selected ──────────────┐  │
│  │ 9:00  Visit DPS Dwarka  ✅│  │
│  │ 💬 Overdue follow-up      │  │
│  └───────────────────────────┘  │
│  ┌─── Selected ──────────────┐  │
│  │ 11:00 Call Modern Acad  ✅│  │
│  │ 💬 Proposal pending       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 14:00 Visit Sunrise    ☐  │  │← Unselected
│  │ 💬 Demo feedback pending  │  │
│  └───────────────────────────┘  │
│                                 │
│  ╔═════════════════════════╗    │
│  ║  Accept Plan (2 items)  ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

### AI Insights Screen

```
┌─────────────────────────────────┐
│  ◀  AI Insights            ↺    │
│  ████████████████████████████  │
│                                 │
│  ⚡ 4 of 5 refreshes left today │
│                                 │
│  🔥 High Probability Closes     │
│  ┌───────────────────────────┐  │
│  │ Delhi Public School  82%  │  │
│  │ "Demo done, decision maker│  │
│  │  engaged. Follow up now." │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Ryan International   74%  │  │
│  │ "Proposal sent, no reply  │  │
│  │  in 5 days. Call today."  │  │
│  └───────────────────────────┘  │
│                                 │
│  ⚠️ Risk Alerts                 │
│  ┌───────────────────────────┐  │
│  │ Bloom School     COLD     │  │
│  │ "No activity in 12 days.  │  │
│  │  Re-engage or mark lost." │  │
│  └───────────────────────────┘  │
│                                 │
│  ╔═════════════════════════╗    │
│  ║    Refresh Insights     ║    │
│  ╚═════════════════════════╝    │
└─────────────────────────────────┘
```

---

## 21. Notifications

```
┌─────────────────────────────────┐
│  ◀  Notifications               │
│  ████████████████████████████  │
│                                 │
│  Today                          │
│  ┌───────────────────────────┐  │
│  │ 🔵 New Lead Assigned      │  │
│  │    DPS Vasant Kunj has    │  │
│  │    been assigned to you   │  │
│  │    10 minutes ago         │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🟡 Follow-up Due Today    │  │
│  │    Ryan International     │  │
│  │    Proposal follow-up due │  │
│  │    1 hour ago             │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 🟢 Demo Scheduled         │  │
│  │    Sunrise Int'l  28 Mar  │  │
│  │    Confirmed by Priya     │  │
│  │    3 hours ago            │  │
│  └───────────────────────────┘  │
│                                 │
│  Yesterday                      │
│  ┌───────────────────────────┐  │
│  │ 🔴 Deal Alert             │  │
│  │    Modern Academy has not │  │
│  │    responded in 7 days    │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

---

## 22. Settings

```
┌─────────────────────────────────┐
│  ◀  Settings                    │
│  ████████████████████████████  │
│                                 │
│  Language                       │
│  ┌───────────────────────────┐  │
│  │ [English ●] [हिंदी ○]    │  │
│  └───────────────────────────┘  │
│                                 │
│  🔔 Notifications               │
│  ┌───────────────────────────┐  │
│  │ 💬 WhatsApp Notifications │⚪│
│  │ 🔔 Push Notifications     │🔵│
│  └───────────────────────────┘  │
│                                 │
│  📶 Offline Mode                │
│  ┌───────────────────────────┐  │
│  │ 🟢 Online                 │  │
│  │ [↺ Sync Now] [🗑 Clear]  │  │
│  └───────────────────────────┘  │
│                                 │
│  🔄 AI Usage Today              │
│  ┌───────────────────────────┐  │
│  │ Daily Plan    ▓░░  1/3   │  │
│  │ Daily Report  ░░░  0/2   │  │
│  │ AI Insights   ▓░░  1/5   │  │
│  └───────────────────────────┘  │
│                                 │
│  📱 Dashboard                   │
│  ┌───────────────────────────┐  │
│  │ Customize Dashboard     ▶ │  │
│  └───────────────────────────┘  │
│                                 │
│  Account                        │
│  ┌───────────────────────────┐  │
│  │ ╭─╮ Rajesh Kumar          │  │
│  │ │R│ rajesh@educrm.in      │  │
│  │ ╰─╯ RH                   │  │
│  └───────────────────────────┘  │
│  [→ Logout]                     │
│                                 │
│  Version 1.0.0                  │
├─────────────────────────────────┤
│  🏠  📋  🌿  📊  🎯  📈  🧭  ⚙️ │
└─────────────────────────────────┘
```

---

## 23. Offline Mode

```
┌─────────────────────────────────┐
│ ████ No internet — 3 actions queued ████ │  ← Red banner
├─────────────────────────────────┤
│  ◀  Settings                    │
│  ████████████████████████████  │
│                                 │
│  📶 Offline Mode                │
│  ┌───────────────────────────┐  │
│  │ 🔴 Offline                │  │
│  │ 3 actions queued          │  │
│  │                           │  │
│  │ [↺ Sync Now] [🗑 Clear]  │  │
│  └───────────────────────────┘  │
│                                 │
│  Queued Actions:                │
│  ┌───────────────────────────┐  │
│  │ 📍 GPS Ping · 2 min ago   │  │
│  │ ✅ Activity Log · 5m ago  │  │
│  │ 🏫 Visit Start · 8m ago   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### What works offline

| Feature | Offline | Online only |
|---------|:-------:|:-----------:|
| View cached leads & schools | ✅ | |
| View calendar | ✅ | |
| Log activities (queued) | ✅ | |
| GPS pings (queued) | ✅ | |
| Load fresh data | | ✅ |
| Create new leads | | ✅ |
| AI features | | ✅ |
| Reports | | ✅ |

---

## 24. Audit History

```
┌─────────────────────────────────┐
│  ◀  Audit History               │
│  Delhi Public School            │
│  ████████████████████████████  │
│                                 │
│  │                              │
│  ├─ ╭───╮                       │
│  │  │ ✎ │  Updated  •  Blue     │
│  │  ╰───╯  Ravi Kumar           │
│  │         24 Mar 2026, 9:30 AM │
│  │  ┌──────────┬──────┬──────┐  │
│  │  │ Field    │Before│After │  │
│  │  ├──────────┼──────┼──────┤  │
│  │  │ Stage    │Demo  │Demo  │  │
│  │  │          │Stage │Done  │  │
│  │  │ Score    │ 71   │ 82   │  │
│  │  └──────────┴──────┴──────┘  │
│  │                              │
│  ├─ ╭───╮                       │
│  │  │ + │  Created  •  Green    │
│  │  ╰───╯  Ravi Kumar           │
│  │         18 Mar 2026, 10:00AM │
│  │  "Lead created from          │
│  │   field visit"               │
│  │                              │
│  ├─ ╭───╮                       │
│  │  │🗑│  Deleted  •  Red       │
│  │  ╰───╯  System               │
│  │         15 Mar 2026, 3:00 PM │
│  │  "Duplicate contact removed" │
│                                 │
└─────────────────────────────────┘
```

---

## 25. Troubleshooting

### "The action NAVIGATE was not handled by any navigator"
This means a screen link is broken. Update the app to the latest version.

### App shows a red offline banner but I have internet
The app checks connectivity by pinging the server every 15 seconds. Wait a moment or go to **Settings → Sync Now** to force a check.

### Ghost card appears but lead doesn't move on pipeline
Ensure you hold the card for at least **0.4 seconds** before dragging. Release your finger directly over the target column (the column header area must be visible in the drop zone).

### AI plan not loading
Check your internet connection. If online, the daily quota may be exhausted — the banner will show "Limit reached — resets tomorrow."

### Duplicate warning shows on lead I know is unique
The duplicate check uses name + city similarity scoring. Tap **Create Anyway** to save if you are confident the lead is new.

### Login fails with correct credentials
- Check that you are connected to the internet
- Contact your administrator to confirm your account is active

### Location tracking stops in background (Android)
Ensure **Battery Optimization** is disabled for this app:
*Settings → Apps → SingularityCRM → Battery → Unrestricted*

### Location tracking stops in background (iOS)
Ensure **Location** permission is set to **Always** (not "While Using"):
*Settings → Privacy → Location Services → SingularityCRM → Always*

---

## Appendix A — Lead Stage Reference

| Stage | Meaning |
|-------|---------|
| New Lead | Lead created, not yet contacted |
| Contacted | Initial contact made |
| Qualified | Budget and decision-maker confirmed |
| Demo Stage | Demo scheduled |
| Demo Done | Demo completed, awaiting feedback |
| Proposal Sent | Formal proposal submitted |
| Negotiation | Commercial terms being discussed |
| Contract Sent | Contract shared for signing |
| Won | Deal signed |
| Implementation Started | Onboarding in progress |
| Lost | Deal lost — reason logged |

## Appendix B — Score Color Guide

| Score Range | Color | Interpretation |
|-------------|-------|---------------|
| 70 – 100 | 🟢 Green | Hot lead — high conversion probability |
| 40 – 69 | 🟡 Amber | Warm — needs nurturing |
| 0 – 39 | 🔴 Red | Cold — at risk of being lost |

## Appendix C — Activity Type Reference

| Type | When to use |
|------|-------------|
| Visit | In-person school visit |
| Call | Phone/video call with contact |
| Demo | Product demonstration session |
| Proposal | Proposal presented or sent |
| FollowUp | Follow-up after any interaction |
| Contract | Contract discussion or signing |

## Appendix D — AI Quota Limits

| AI Feature | Daily Limit |
|------------|------------|
| Daily Plan regenerations | 3 per day |
| Daily Report generations | 2 per day |
| AI Insights refreshes | 5 per day |

Quotas reset at midnight every day.

---

*SingularityCRM · Built for EdTech Sales Excellence*
*For support, contact your system administrator.*
