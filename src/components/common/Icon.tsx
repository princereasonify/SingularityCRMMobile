import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * The SingularityCRM line-icon set — paths copied VERBATIM from
 * SingularityCRM-Components.html ("Icon set — 1.9px stroke, rounded").
 *
 * Spec: 24×24 grid · stroke-width 1.9 · round caps/joins · rendered 17–20px
 *       (sidebar nav 19px, KPI icon 17px).
 *
 * These cover the nav/domain icons only. Utility glyphs the spec doesn't define
 * (close, chevron, search, eye, …) still come from lucide, rendered at stroke 1.9
 * so the two read as one system.
 */
export const ICON_PATHS = {
  Dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  Schools: 'M4 20V9l8-5 8 5v11M9 20v-5h6v5',
  Leads: 'M8 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 010 6M18 20c0-2.5-1-4.5-2.5-5.5',
  Pipeline: 'M5 4v16M5 8h4v6H5zM11 4h4v8h-4zM17 4h4v11h-4z',
  Estimate: 'M6 3h12v18H6zM9 7h6M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3',
  Deal: 'M4 8h16v11H4zM9 8V5h6v3',
  Activity: 'M3 12h4l2-7 4 14 2-7h6',
  Demos: 'M3 5h18v11H3zM9 20h6M12 16v4',
  Record: 'M3 7h11v10H3zM14 10l6-3v10l-6-3z',
  Onboarding: 'M9 4h6v2H9zM6 5h12v15H6zM9 13l2 2 4-4',
  Route: 'M12 2l8 18-8-4-8 4z',
  Calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  Tracking: 'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 10a2 2 0 100-4 2 2 0 000 4z',
  Home: 'M4 11l8-7 8 7M6 10v10h12V10',
  Weekly: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6',
  Payment: 'M3 6h18v12H3zM3 10h18',
  Targets: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7a5 5 0 100 10 5 5 0 000-10zM12 11a1 1 0 100 2 1 1 0 000-2z',
  Performance: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  Allowance: 'M12 3v18M8 7h6a2 2 0 010 4H9a2 2 0 000 4h7',
  Reports: 'M4 20V10M10 20V4M16 20v-8M4 20h16',
  Users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6',
  Regions: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  Bell: 'M6 8.5a4 4 0 0 1 8 0c0 3.4 1.5 4.5 1.5 4.5H4.5S6 11.9 6 8.5ZM8.4 15.5a1.8 1.8 0 0 0 3.2 0',
  Sun: 'M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3M12 8a4 4 0 100 8 4 4 0 000-8z',
  Moon: 'M19 13.5A8 8 0 0 1 10.5 5a8 8 0 1 0 8.5 8.5Z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Spec stroke width for every icon in the system. */
export const ICON_STROKE = 1.9;

interface Props {
  name: IconName;
  /** 17–20 per spec (nav 19, KPI 17). */
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon = ({ name, size = 20, color, strokeWidth = ICON_STROKE }: Props) => {
  // Resolved from the theme rather than defaulting to the light accent (#8C5A2E),
  // which would render wrong in dark mode. Every current call site passes `color`,
  // so this only guards future ones.
  const T = useAppTheme();
  const stroke = color || T.accent;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d={ICON_PATHS[name]}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
  );
};
