import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions, PixelRatio } from 'react-native';

/**
 * Live, rotation-aware layout metrics.
 *
 * The problem this exists to solve: `utils/responsive.ts` reads `Dimensions.get('window')`,
 * and every screen bakes its `rf()` / `rs()` results into a module-level `StyleSheet.create`,
 * which React Native evaluates ONCE at import. `isTablet()` is worse — it closes over a width
 * captured at module load. So on an iPad, rotating landscape↔portrait leaves every font size,
 * padding and breakpoint frozen at whatever the launch orientation was, which is what makes
 * layouts clip and overlap after a rotation.
 *
 * `useWindowDimensions()` re-renders on every size change, so anything derived here is always
 * current. Use it INSIDE the component and build styles in a `useMemo` keyed on the values you
 * use — never in a module-level StyleSheet.
 *
 *   const r = useResponsive();
 *   const s = useMemo(() => StyleSheet.create({ ... }), [r.width]);
 */

/**
 * How much horizontal space a PERMANENT drawer is occupying, published by the navigator.
 *
 * This exists because `useWindowDimensions()` reports the whole window, and on a tablet the
 * drawer is permanent — it sits inside that window and is never available to a screen. Every
 * screen sizing a grid from the window width therefore over-measured by the sidebar, asked for
 * more columns than could fit, and the last card wrapped: the "dead space on the right" that
 * showed up on every list page at once. The width is published rather than assumed because it
 * changes when the user collapses the sidebar to a rail.
 *
 * 0 on a phone, where the drawer overlays the content instead of displacing it.
 */
const SidebarWidthContext = createContext(0);

export const SidebarWidthProvider = ({ width, children }: {
  width: number; children: React.ReactNode;
}) => (
  <SidebarWidthContext.Provider value={width}>{children}</SidebarWidthContext.Provider>
);

const BASE_WIDTH = 393;          // iPhone 14 Pro portrait — the design baseline
export const TABLET_MIN = 768;   // iPad portrait and up
export const WIDE_MIN = 1024;    // iPad landscape — two-pane territory

/** Apple's HIG minimum, and the floor for anything the user has to hit with a thumb. */
export const MIN_TAP = 44;

export interface Responsive {
  width: number;
  height: number;
  /** Shortest side — the stable measure of how big the DEVICE is, whatever way it is held. */
  shortest: number;
  isTablet: boolean;
  isWide: boolean;
  isLandscape: boolean;
  /** Columns for a card grid: 1 on a phone, 2 on a tablet, 3 when there is room. */
  columns: number;
  /** Font scale. Capped so a large screen reads as roomier, not merely zoomed. */
  rf: (size: number) => number;
  /** Spacing scale. Slightly more generous than `rf` — space is what makes a tablet breathe. */
  rs: (size: number) => number;
  /** Page gutter: the horizontal padding a screen's content sits inside. */
  gutter: number;
  /** Gap between cards in a grid or stack. */
  gap: number;
  /** Caps body text so a full-width line on an iPad stays readable. */
  maxContentWidth: number;
}

export function useResponsive(): Responsive {
  const { width: windowWidth, height } = useWindowDimensions();
  const sidebarWidth = useContext(SidebarWidthContext);

  // What a screen can actually paint into. Everything below is derived from this, not from
  // the window, so column counts and card widths describe the space that really exists.
  const width = Math.max(320, windowWidth - sidebarWidth);

  return useMemo(() => {
    const shortest = Math.min(width, height);
    // Classified on the SHORTEST side, so an iPad is a tablet in both orientations and a
    // phone in landscape is never mistaken for one.
    const isTablet = shortest >= TABLET_MIN;
    const isWide = width >= WIDE_MIN;
    const isLandscape = width > height;

    const scale = width / BASE_WIDTH;
    const fontCap = isTablet ? 1.25 : 1.1;
    const spaceCap = isTablet ? 1.5 : 1.05;

    const rf = (size: number) =>
      Math.round(PixelRatio.roundToNearestPixel(size * Math.min(scale, fontCap)));
    const rs = (size: number) => Math.round(size * Math.min(scale, spaceCap));

    return {
      width,
      height,
      shortest,
      isTablet,
      isWide,
      isLandscape,
      columns: isWide ? 3 : isTablet ? 2 : 1,
      rf,
      rs,
      gutter: isTablet ? 24 : 16,
      gap: isTablet ? 16 : 12,
      // 720pt is about 90 characters at body size — past that the eye loses the line.
      maxContentWidth: isWide ? 1100 : width,
    };
  }, [width, height]);
}

/**
 * Card width for a wrapping list grid.
 *
 * Two rules, both learned the hard way:
 *
 *  - EXACT POINTS, never percentages. In a wrapping row with a `gap`, N x (100/N)% overflows
 *    by the gaps and the last card silently drops onto a line of its own — which reads as a
 *    broken grid with a column of dead space beside it.
 *  - COLUMNS NEVER EXCEED ITEMS. A single counselor in a three-column grid sat at a third of
 *    the width with two thirds of blank page next to it; the grid was sized for a list that
 *    wasn't there. Capping at the item count makes one card fill the row and two split it.
 *
 * @param itemCount how many cards will actually render
 */
export const gridCardWidth = (r: Responsive, itemCount: number): number | '100%' => {
  const cols = Math.max(1, Math.min(r.columns, itemCount || 1));
  if (cols === 1) return '100%';
  const innerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2;
  return Math.floor((innerW - r.gap * (cols - 1)) / cols);
};
