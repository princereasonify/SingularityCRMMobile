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

/** Role → grouped nav. Other roles land here as they're migrated to the new shell. */
export const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  FO: FO_NAV,
  ZH: ZH_NAV,
};

/** The group a route belongs to — used by the topbar breadcrumb ("Role · Group"). */
export const groupForRoute = (groups: NavGroup[], route: string): string | undefined =>
  groups.find(g => g.items.some(i => i.route === route))?.label;
