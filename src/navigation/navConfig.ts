import { IconName } from '../components/common/Icon';

/**
 * Grouped sidebar navigation — the single source of truth shared by the sidebar and
 * the topbar breadcrumb. Items and their order mirror the web app's Sidebar.jsx so the
 * two platforms stay in lockstep.
 *
 * Group order per the sidebar spec:
 *   Overview · Sales · Demos · Field · Finance · Insights · Admin
 * (a group renders only if the role actually has items in it)
 */
export interface NavItem {
  /** Must match the Drawer.Screen `name` it navigates to. */
  route: string;
  label: string;
  /** From the spec icon set; `lucide` names fall back in the sidebar. */
  icon: IconName | 'Leaves';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const FO_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ route: 'Dashboard', label: 'Dashboard', icon: 'Dashboard' }],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Schools', label: 'Schools', icon: 'Schools' },
      { route: 'Leads', label: 'Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Deal Estimate', label: 'Deal Estimate', icon: 'Estimate' },
      { route: 'Create Deal', label: 'Create Deal', icon: 'Deal' },
      { route: 'Activity Log', label: 'Activity Log', icon: 'Activity' },
    ],
  },
  {
    label: 'Demos',
    items: [
      { route: 'Demos', label: 'Demos', icon: 'Demos' },
      { route: 'Record Demo', label: 'Record Demo', icon: 'Record' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Route Planner', label: 'Route Planner', icon: 'Route' },
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'My Tracking', label: 'My Tracking', icon: 'Tracking' },
      { route: 'Home Location', label: 'Home Location', icon: 'Home' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Payment Integration', label: 'Payment Integration', icon: 'Payment' },
      { route: 'My Targets', label: 'My Targets', icon: 'Targets' },
      { route: 'My Performance', label: 'My Performance', icon: 'Performance' },
      { route: 'Allowances', label: 'Allowances', icon: 'Allowance' },
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
];

/**
 * ZH — mirrors web's `Sidebar.jsx` ZH array exactly, all 20 items in web's order,
 * regrouped into the same Overview/Sales/Demos/Field/Finance/Insights/Admin bands
 * FO uses. Two of these had no mobile drawer entry before (Record Demo, Payment
 * Integration) even though both screens already existed.
 *
 * Differences from FO, all matching web:
 *   · "Zone Dashboard" not "Dashboard"; adds Team, Onboarding, Manage Users
 *   · "Live Tracking" (the manager view) instead of FO's own "My Tracking"
 *   · "Targets" not "My Targets"; no Activity Log, no Route Planner, no My Performance
 */
export const ZH_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { route: 'Dashboard', label: 'Zone Dashboard', icon: 'Dashboard' },
      { route: 'Team', label: 'Team', icon: 'Users' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Schools', label: 'Schools', icon: 'Schools' },
      { route: 'All Leads', label: 'All Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Deal Estimate', label: 'Deal Estimate', icon: 'Estimate' },
      { route: 'Create Deal', label: 'Create Deal', icon: 'Deal' },
    ],
  },
  {
    label: 'Demos',
    items: [
      { route: 'Demo Management', label: 'Demo Management', icon: 'Demos' },
      { route: 'Record Demo', label: 'Record Demo', icon: 'Record' },
      { route: 'Onboarding', label: 'Onboarding', icon: 'Onboarding' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Live Tracking', label: 'Live Tracking', icon: 'Tracking' },
      { route: 'Home Location', label: 'Home Location', icon: 'Home' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Payment Integration', label: 'Payment Integration', icon: 'Payment' },
      { route: 'Targets', label: 'Targets', icon: 'Targets' },
      { route: 'Allowances', label: 'Allowances', icon: 'Allowance' },
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
  {
    label: 'Admin',
    items: [{ route: 'Manage Users', label: 'Manage Users', icon: 'Users' }],
  },
];

/**
 * RH — mirrors web's `Sidebar.jsx` RH array (20 items) PLUS Team, which mobile
 * already had and which the backend genuinely supports for RH
 * (DashboardService.GetTeamPerformanceAsync scopes FOs to `caller.RegionId`), so
 * it's added to web's RH sidebar too rather than dropped. 21 items total.
 *
 * Same grouping as ZH. Differences from ZH, all matching web:
 *   · "Region Dashboard" not "Zone Dashboard"
 *   · adds "Regions & Zones" (the RH hierarchy admin screen) in Admin
 *   · scoping is region-wide (the RH's ZHs + their FOs), enforced server-side
 */
export const RH_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { route: 'Dashboard', label: 'Region Dashboard', icon: 'Dashboard' },
      { route: 'Team', label: 'Team', icon: 'Users' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Schools', label: 'Schools', icon: 'Schools' },
      { route: 'Leads', label: 'Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Deal Estimate', label: 'Deal Estimate', icon: 'Estimate' },
      { route: 'Create Deal', label: 'Create Deal', icon: 'Deal' },
    ],
  },
  {
    label: 'Demos',
    items: [
      { route: 'Demo Management', label: 'Demo Management', icon: 'Demos' },
      { route: 'Record Demo', label: 'Record Demo', icon: 'Record' },
      { route: 'Onboarding', label: 'Onboarding', icon: 'Onboarding' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Live Tracking', label: 'Live Tracking', icon: 'Tracking' },
      { route: 'Home Location', label: 'Home Location', icon: 'Home' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Payment Integration', label: 'Payment Integration', icon: 'Payment' },
      { route: 'Targets', label: 'Targets', icon: 'Targets' },
      { route: 'Allowances', label: 'Allowances', icon: 'Allowance' },
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
  {
    label: 'Admin',
    items: [
      { route: 'Regions & Zones', label: 'Regions & Zones', icon: 'Regions' },
      { route: 'Manage Users', label: 'Manage Users', icon: 'Users' },
    ],
  },
];

/**
 * SH — mirrors web's `Sidebar.jsx` SH array (22 items) regrouped into the shared bands,
 * plus Team (which mobile already had and the backend supports for SH via
 * DashboardService.GetTeamPerformanceAsync). SH-specific admin screens: Allowance Config
 * and Visit Fields (visit-report field configuration — SH only, web parity).
 *
 * Differences from RH, all matching web:
 *   · "National Dashboard"; adds Visit Fields + Allowance Config in Admin
 *   · no per-FO tracking; national scope (org-wide, enforced server-side)
 */
export const SH_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { route: 'Dashboard', label: 'National Dashboard', icon: 'Dashboard' },
      { route: 'Team', label: 'Team', icon: 'Users' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Schools', label: 'Schools', icon: 'Schools' },
      { route: 'All Leads', label: 'All Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Deal Estimate', label: 'Deal Estimate', icon: 'Estimate' },
      { route: 'Create Deal', label: 'Create Deal', icon: 'Deal' },
    ],
  },
  {
    label: 'Demos',
    items: [
      { route: 'Demo Management', label: 'Demo Management', icon: 'Demos' },
      { route: 'Record Demo', label: 'Record Demo', icon: 'Record' },
      { route: 'Onboarding', label: 'Onboarding', icon: 'Onboarding' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Live Tracking', label: 'Live Tracking', icon: 'Tracking' },
      { route: 'Home Location', label: 'Home Location', icon: 'Home' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Payment Integration', label: 'Payment Integration', icon: 'Payment' },
      { route: 'Targets', label: 'Targets', icon: 'Targets' },
      { route: 'Allowances', label: 'Allowances', icon: 'Allowance' },
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
  {
    label: 'Admin',
    items: [
      { route: 'Allowance Config', label: 'Allowance Config', icon: 'Allowance' },
      { route: 'Visit Fields', label: 'Visit Fields', icon: 'Onboarding' },
      { route: 'Regions & Zones', label: 'Regions & Zones', icon: 'Regions' },
      { route: 'Manage Users', label: 'Manage Users', icon: 'Users' },
    ],
  },
];

/**
 * SCA — mirrors web's `Sidebar.jsx` SCA array (22 items) regrouped into the shared bands.
 * Differences from SH, all matching web:
 *   · "Admin Dashboard"; adds Performance; no Team, no Visit Fields
 *   · Payments is the real gateway "Payment Integration" (the old "Deal Payments"
 *     direct-payment screen hit endpoints the backend never served)
 *   · full org-wide scope (SCA sees everything)
 */
export const SCA_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ route: 'Dashboard', label: 'Admin Dashboard', icon: 'Dashboard' }],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Schools', label: 'Schools', icon: 'Schools' },
      { route: 'All Leads', label: 'All Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Deal Estimate', label: 'Deal Estimate', icon: 'Estimate' },
      { route: 'Create Deal', label: 'Create Deal', icon: 'Deal' },
    ],
  },
  {
    label: 'Demos',
    items: [
      { route: 'Demo Management', label: 'Demo Management', icon: 'Demos' },
      { route: 'Record Demo', label: 'View Recordings', icon: 'Record' },
      { route: 'Onboarding', label: 'Onboarding', icon: 'Onboarding' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Live Tracking', label: 'Live Tracking', icon: 'Tracking' },
      { route: 'Home Location', label: 'Home Location', icon: 'Home' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Payment Integration', label: 'Payment Integration', icon: 'Payment' },
      { route: 'Targets', label: 'Targets', icon: 'Targets' },
      { route: 'Performance', label: 'Performance', icon: 'Performance' },
      { route: 'Allowances', label: 'Allowances', icon: 'Allowance' },
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
  {
    label: 'Admin',
    items: [
      { route: 'Allowance Config', label: 'Allowance Config', icon: 'Allowance' },
      { route: 'Regions & Zones', label: 'Regions & Zones', icon: 'Regions' },
      { route: 'Manage Users', label: 'Manage Users', icon: 'Users' },
    ],
  },
];

/**
 * ── B2C nav (separate product) ──────────────────────────────────────────────
 * Item membership and per-role order mirror the web app's Sidebar.jsx `navsByRole`
 * exactly, regrouped into the shared bands the B2B drawers use so the two platforms
 * stay in lockstep. The web sidebar is a flat list; the band sequence here is chosen
 * so the flattened order is identical to web's. Icons reuse the SingularityCRM icon
 * set (Icon.tsx) — the nearest set glyph to each web lucide icon.
 *
 * The Agent "Visit" and Counselor "Recording"/"AI Coach" entries are the native
 * mobile flows (geo-verified visit capture, session recording + AI coaching); they
 * have no web equivalent and are appended after the web-mirrored items.
 */
export const B2CAdmin_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ route: 'Dashboard', label: 'Dashboard', icon: 'Dashboard' }],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Student Leads', label: 'Student Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
      { route: 'Counselors', label: 'Counselors', icon: 'Users' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { route: 'User Management', label: 'User Management', icon: 'Users' },
      // Web reaches these two only through the "Add" button on the list page. On mobile the
      // drawer IS the navigation, so they get their own entries as well — the list screens
      // still push the same routes.
      { route: 'Add User', label: 'Add User', icon: 'Users' },
      { route: 'Add Counselor', label: 'Add Counselor', icon: 'Users' },
      { route: 'Approval Center', label: 'Approval Center', icon: 'Onboarding' },
      { route: 'Allowance Config', label: 'Allowance Config', icon: 'Allowance' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'Live Tracking', label: 'Live Tracking', icon: 'Tracking' },
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Geo Compliance', label: 'Geo Compliance', icon: 'Route' },
    ],
  },
  {
    label: 'Insights',
    items: [{ route: 'Reports', label: 'Reports', icon: 'Reports' }],
  },
  {
    label: 'Support',
    items: [{ route: 'Counseling', label: 'Counseling', icon: 'Users' }],
  },
  // Billing is hidden from the B2C admin on both platforms (web's Sidebar.jsx dropped it too).
  // The screen and its route stay registered, so restoring it is a one-line change.
];

export const Agent_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ route: 'Dashboard', label: 'Dashboard', icon: 'Dashboard' }],
  },
  {
    label: 'Sales',
    items: [
      { route: 'My Leads', label: 'My Leads', icon: 'Leads' },
      { route: 'Pipeline', label: 'Pipeline', icon: 'Pipeline' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'My Day', label: 'My Day', icon: 'Sun' },
      { route: 'Route Planner', label: 'Route Planner', icon: 'Route' },
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Weekly Plan', label: 'Weekly Plan', icon: 'Weekly' },
      { route: 'Activity Log', label: 'Activity Log', icon: 'Activity' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
      { route: 'My Allowances', label: 'My Allowances', icon: 'Allowance' },
      { route: 'My Expenses', label: 'My Expenses', icon: 'Payment' },
      { route: 'My Performance', label: 'My Performance', icon: 'Performance' },
    ],
  },
  {
    // Mobile-only native geo-verified visit capture (no web equivalent).
    label: 'Visit',
    items: [{ route: 'Visit', label: 'Visit', icon: 'Activity' }],
  },
];

export const Counselor_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ route: 'Dashboard', label: 'Dashboard', icon: 'Dashboard' }],
  },
  {
    label: 'Sales',
    items: [
      { route: 'Re-engagement Queue', label: 'Re-engagement Queue', icon: 'Targets' },
      // Label tracks the web Counselor sidebar ("Assigned Students") while the
      // route stays "My Leads" (the shared B2C leads list).
      { route: 'My Leads', label: 'Assigned Students', icon: 'Leads' },
    ],
  },
  {
    label: 'Field',
    items: [
      { route: 'My Day', label: 'My Day', icon: 'Sun' },
      { route: 'Route Planner', label: 'Route Planner', icon: 'Route' },
      { route: 'Calendar', label: 'Calendar', icon: 'Calendar' },
      { route: 'Activity Log', label: 'Activity Log', icon: 'Activity' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { route: 'Leaves', label: 'Leaves', icon: 'Leaves' },
      { route: 'My Allowances', label: 'My Allowances', icon: 'Allowance' },
      { route: 'My Expenses', label: 'My Expenses', icon: 'Payment' },
      { route: 'My Performance', label: 'My Performance', icon: 'Performance' },
    ],
  },
  {
    // "AI Coach" keeps the native `Recording` route (the counselor's
    // record→analyse flow); no web equivalent.
    label: 'AI Coach',
    items: [{ route: 'Recording', label: 'AI Coach', icon: 'Record' }],
  },
];

/**
 * MANAGER_NAV — extra Team section an Agent who is also a Manager gets
 * (mirrors web's `MANAGER_NAV`, appended when `role === 'Agent' && isManager`).
 */
export const MANAGER_NAV: NavGroup[] = [
  {
    label: 'Team',
    items: [
      { route: 'My Team', label: 'My Team', icon: 'Users' },
      { route: 'Team Leads', label: 'Team Leads', icon: 'Leads' },
      { route: 'Team Tracking', label: 'Team Tracking', icon: 'Tracking' },
      { route: 'Team Approvals', label: 'Team Approvals', icon: 'Onboarding' },
    ],
  },
];

/** Role → grouped nav. Other roles land here as they're migrated to the new shell. */
export const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  FO: FO_NAV,
  ZH: ZH_NAV,
  RH: RH_NAV,
  SH: SH_NAV,
  SCA: SCA_NAV,
  B2CAdmin: B2CAdmin_NAV,
  Agent: Agent_NAV,
  Counselor: Counselor_NAV,
};

/** The group a route belongs to — used by the topbar breadcrumb ("Role · Group"). */
export const groupForRoute = (groups: NavGroup[], route: string): string | undefined =>
  groups.find(g => g.items.some(i => i.route === route))?.label;
