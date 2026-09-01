import { useMemo } from 'react';
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
  const { width, height } = useWindowDimensions();

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
