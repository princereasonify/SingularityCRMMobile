import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SectionLabel } from '../ui';
import { useAppTheme } from '../../theme/useAppTheme';
import { Responsive } from '../../hooks/useResponsive';

/**
 * Rows a dashboard section shows before "View all".
 *
 * A home screen is a summary. Rendering every pipeline stage, every agent, every follow-up and
 * every assigned student turned the one screen that opens on launch into a page you had to
 * scroll to read at all. Four is enough to see the shape and decide whether to drill in.
 */
export const PREVIEW_ROWS = 4;

/**
 * A section title with a "View all" that appears ONLY when rows were actually withheld —
 * a link that leads to the same four rows you can already see is just noise.
 */
export const SectionHeader = ({ title, total, onViewAll }: {
  title: string;
  /** Full row count, before slicing. */
  total: number;
  onViewAll: () => void;
}) => {
  const T = useAppTheme();
  const hidden = total - PREVIEW_ROWS;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <SectionLabel>{title}</SectionLabel>
      {hidden > 0 && (
        <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.accent }}>View all ({total})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/** A proportion bar, matching the web dashboard's pipeline and agent-load bars. */
export const Bar = ({ pct, color, track, style }: {
  pct: number; color: string; track: string; style?: any;
}) => (
  <View style={[{ height: 6, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }, style]}>
    {/* Clamped: a count above the max, or a lead cap of zero, must not paint past the track. */}
    <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} />
  </View>
);

export const initialsOf = (name?: string | null) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/**
 * Layout rule for a dashboard's section cards.
 *
 * Three things it has to get right, all of which were wrong when each dashboard rolled its own:
 *
 *  - EXACT POINTS, not percentages. In a wrapping row with a `gap`, N x (100/N)% overflows by
 *    the gaps and the last card silently drops onto a line of its own.
 *  - NO ORPHAN. A card alone on the final row is stretched across it, instead of sitting at a
 *    third of the width with two thirds of blank page beside it.
 *  - EQUAL HEIGHTS. The grid deliberately does not set `alignItems`, so the default `stretch`
 *    gives every card on a row the same height — pair it with a `flex: 1` card inside each
 *    section and two lists of different lengths still end level.
 */
export const sectionGrid = (r: Responsive) => {
  const cols = r.isWide ? 3 : r.isTablet ? 2 : 1;
  const innerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2;
  const colW = Math.floor((innerW - r.gap * (cols - 1)) / cols);

  return {
    cols,
    /** Container style for the wrapping row. */
    style: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: r.gap },
    /** Width for section `i` of `total` rendered sections. */
    widthAt: (i: number, total: number): number | '100%' => {
      if (cols === 1) return '100%';
      const aloneOnLastRow = total % cols === 1 && i === total - 1;
      return aloneOnLastRow ? innerW : colW;
    },
  };
};
