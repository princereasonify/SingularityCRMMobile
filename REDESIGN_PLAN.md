# SingularityCRM Mobile — Visual Redesign Plan

**Goal:** Apply the design from `SingularityCRM-FO.html` to the React Native app.
**Scope:** Visual design only. **No functionality changes** — API calls, navigation,
auth/token-refresh, and background tracking are all left exactly as they are.

## Confirmed decisions
- **All 5 roles use the same design** (FO terracotta). No per-role accent — FO, ZH, RH,
  SH, and SCA all render identically. Role is not conveyed by colour.
- **Bundle the Space Grotesk font** to match the mockup's typography.

---

## Design tokens (from the mockup)

| Token | Value | Notes |
|---|---|---|
| Font | **Space Grotesk** | bundled; applied to all text styles |
| Background | `#FAF9F5` | warm off-white (was cool `#F9FAFB`) |
| Surface / card | `#FFFFFF` | |
| Border | `#F2EFEA` | warm hairline |
| **Accent (all roles)** | `#C2542B` | terracotta — primary |
| Accent light | `#F5EFE8` | tint for chips/badges |
| Accent dark | `#B3491F` | pressed / emphasis |
| Success | `#4C8C5C` | green |
| Warning / target | `#E9A13B` | amber/gold |
| Text ink | `#221C14` | near-black warm |
| Corner radius | 16–22px | large, soft cards (current `lg:16`, `xl:20` already close) |

---

## Why this is low-risk

The app already has a **central theme** (`src/theme/`) that every screen imports
(`Colors / Typography / Spacing / Radius / Shadows / CS`). Role colours already exist as
`Colors.roles.{FO,ZH,RH,SH,SCA}`, and shared components (`Button`, `Avatar`,
`ScreenHeader`, `Badge`, `LoadingSpinner`) default to `Colors.roles.FO.primary`.

Because of that, most of the new look is achieved by editing a few **token files**, not by
rewriting screens. Setting all 5 role entries to the terracotta set re-skins every
role-coloured element across the whole app in one change.

---

## Phase 0 — Design tokens (foundation)

Files: `theme/colors.ts`, `theme/typography.ts`, `theme/spacing.ts`, `theme/shadows.ts`,
plus font wiring.

1. **`theme/colors.ts`**
   - Add terracotta palette entries; set **all 5** `Colors.roles.*` to
     `{ primary: #C2542B, light: #F5EFE8, dark: #B3491F }`.
   - `background → #FAF9F5`, `surface #FFFFFF`, `border → #F2EFEA`.
   - `success → #4C8C5C`, `warning → #E9A13B`, `textPrimary → #221C14`.
   - Keep stage/activity/status helper colours (functional meaning), only warm them if needed.
2. **Space Grotesk font**
   - Add font files under `src/assets/fonts/` (Regular/Medium/SemiBold/Bold).
   - Register via `react-native.config.js`, run `npx react-native-asset` (links iOS + Android).
   - Add a `Fonts` token and reference it from every `typography.ts` style.
   - Requires a native rebuild after linking.
3. **`theme/typography.ts`** — point all styles at Space Grotesk; tune weights/sizes to the
   mockup (bold oversized stat numbers, lighter captions).
4. **`theme/spacing.ts`** — add `Radius.xl2 = 22` for large cards; scale unchanged otherwise.
5. **`theme/shadows.ts`** — softer, warmer low-elevation shadows for the card look.

**CHECKPOINT:** after Phase 0 the whole app already shifts to the terracotta/warm look with
no screen edits. Review here before continuing.

---

## Phase 1 — Shared components (`src/components/common/`)

Re-skin the primitives so screens inherit the look automatically:
`Button`, `Card`/surface, `ScreenHeader`, `Avatar`, `Badge`, `StatTile`/KPI row,
**bottom dock nav**, list rows, search bar, filter chips, empty states.

---

## Phase 2 — Screens (design pass, in mockup order)

1. **Auth** — login + Face ID styling
2. **Dashboards** — all 5 role dashboards (`FODashboard` … `SCADashboard`) to the mockup's
   greeting / revenue-vs-target / stat-tiles / today's-route layout. Identical design, only
   the data differs per role.
3. **Leads / Schools / Pipeline** — search, filter chips, score cards
4. **My Day / Tracking / Allowances** — live map, day-in-progress, start/end day, stat strip
5. **Targets · Payments · Calendar · Notifications · AI Plan**
6. **Remaining** — activities, deals, demos, reports, team, contacts, leaves, weekly plan,
   visit report, onboarding, settings, users, audit, performance, regions/zones

---

## Explicitly NOT touched

API calls · navigation graph · auth / refresh-token flow · background location tracking ·
data shapes · business logic. This is a styling/markup pass only.

---

## Suggested order & checkpoints

1. Phase 0 tokens → **review**
2. Font bundling + rebuild → **review type**
3. Phase 1 shared components → **review**
4. Phase 2 screens, group by group → **review each group**

Screen inventory (all under `src/screens/`): activities, ai, allowances, audit, auth,
calendar, contacts, dashboard, deals, demos, leads, leaves, notifications, onboarding,
payments, performance, pipeline, regionsZones, reports, schools, settings, targets, team,
tracking, users, visitReport, weeklyPlan.
