import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, RotateCw, AlertCircle } from 'lucide-react-native';
import { Icon, IconName, ICON_STROKE } from '../../components/common/Icon';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { Segmented, StatusBadge } from '../../components/crud';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { dashboardApi } from '../../api/dashboard';
import { RegionDashboardDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Regional Head dashboard — the RH counterpart of ZHDashboard/FODashboard, built
 * on the same Sunstone system (SingularityCRM-CRUD-Components.html + the app
 * theme tokens). The Region dashboard is structurally identical to the Zone
 * dashboard; only the data source (getRegionDashboard) and the labels differ.
 *
 * The screen no longer paints its own coloured header: the RH drawer already
 * renders AppTopbar (hamburger · notifications · profile · logout) above every
 * screen, so the old in-screen avatar/bell/logout strip was a second copy of
 * controls that already exist one row higher. The region name now lives in the
 * period bar, exactly as the zone name does in ZHDashboard.
 */

/** Attainment ramp — spec status tokens. */
const attainColor = (T: AppTheme, p: number) =>
  p >= 70 ? T.success : p >= 40 ? T.warning : T.danger;

const riskColor = (T: AppTheme, r: string) =>
  r === 'HIGH' ? T.danger : r === 'MEDIUM' ? T.warning : T.success;

/**
 * Zone health status ramp. `getStatusColor` returns off-spec Palette values (and
 * puts "At Risk" on the same blue as "Good"), so map the labels onto the four
 * spec status hues instead — same approach ZHDashboard takes for FO status.
 */
const healthColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'On Track':
    case 'Strong':
    case 'Healthy':
    case 'Excellent':       return T.success;
    case 'Good':            return T.info;
    case 'At Risk':
    case 'Watch':           return T.warning;
    case 'Weak':
    case 'Critical':
    case 'Underperforming': return T.danger;
    default:                return T.sub;
  }
};

/**
 * Panel body. On iPad the dashboard is a bounded, non-scrolling column, so each
 * panel scrolls INTERNALLY — that is what lets every row render without the
 * outer column overflowing. On the phone the page itself scrolls, so a nested
 * scroller would fight the parent: plain View there.
 */
const PanelBody = ({
  wide,
  contentStyle,
  children,
}: {
  wide?: boolean;
  contentStyle?: any;
  children: React.ReactNode;
}) =>
  wide ? (
    <ScrollView
      style={s.panelScroll}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

export const RHDashboard = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [data, setData] = useState<RegionDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [loadFailed, setLoadFailed] = useState(false);

  const fetch = useCallback(async (p: 'today' | 'week' | 'month' = period) => {
    try {
      const res = await dashboardApi.getRegionDashboard(p);
      setData(res.data);
      setLoadFailed(false);
    } catch {
      // The old fabricated fallback rendered invented figures identically to a
      // real region dashboard, so a RH could read made-up region revenue and act
      // on it. Mirrors ZHDashboard: record the failure and show a real error
      // state instead.
      setData(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetch(period); }, [period]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch(period);
  }, [fetch, period]);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(period);
  }, [fetch, period]);

  const regionName = data?.regionName || user?.region || 'Region';

  // ── Period filter — shared by the loading and loaded states ──
  const periodBar = (
    <View style={[s.periodBar, { borderBottomColor: T.line }]}>
      <Text numberOfLines={1} style={[s.regionName, { color: T.sub }]}>{regionName}</Text>
      <View style={s.spacer} />
      <Segmented<'today' | 'week' | 'month'>
        value={period}
        onChange={setPeriod}
        style={s.segment}
        options={[
          { label: 'Today', value: 'today' },
          { label: 'This Week', value: 'week' },
          { label: 'This Month', value: 'month' },
        ]}
      />
      {/* iPad has no page scroll, so pull-to-refresh is unreachable there. */}
      {wide && (
        <TouchableOpacity
          onPress={reload}
          activeOpacity={0.8}
          style={[s.refreshBtn, { borderColor: T.lineStrong }]}
        >
          <RotateCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          <Text style={[s.refreshTxt, { color: T.accent }]}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading region data..." />;

  // Mirrors ZHDashboard: no figures at all beats invented ones.
  if (loadFailed || !data) {
    return (
      <View style={[s.root, { backgroundColor: T.bg }]}>
        {periodBar}
        <View style={s.errWrap}>
          <View style={[s.errCard, { backgroundColor: T.card, borderColor: T.line }]}>
            <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.errTitle, { color: T.text }]}>Couldn't load region dashboard</Text>
            <Text style={[s.errTxt, { color: T.dim }]}>
              Check your connection and try again. No figures are shown because none could be read.
            </Text>
            <TouchableOpacity
              onPress={reload}
              activeOpacity={0.85}
              style={[s.retryBtn, { borderColor: T.lineStrong }]}
            >
              <RotateCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.retryTxt, { color: T.accent }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── KPI decks ────────────────────────────────────────────────────────────────
  type Kpi = {
    label: string; value: string; sub: string; icon: IconName;
    bar?: number | null; tone?: string; valueColor?: string;
  };

  const headline: Kpi[] = [
    {
      label: 'Revenue MTD', icon: 'Performance',
      value: formatCurrency(data?.revenueMTD || 0),
      sub: `${data?.targetPct || 0}% of ${formatCurrency(data?.revenueTarget || 0)}`,
      bar: data?.targetPct || 0,
    },
    {
      label: 'Active Leads', icon: 'Leads',
      value: String(data?.activeLeads || 0),
      sub: 'In pipeline',
      tone: T.info,
    },
    {
      label: 'Deals Won', icon: 'Targets',
      value: String(data?.dealsWon || 0),
      sub: `${data?.winRate || 0}% win rate`,
      bar: data?.winRate || 0,
      tone: T.success,
    },
    {
      label: 'Forecast Accuracy', icon: 'Reports',
      value: `${data?.forecastAccuracy || 0}%`,
      sub: 'Revenue forecast',
      bar: data?.forecastAccuracy || 0,
      tone: T.info,
    },
  ];

  const activity: Kpi[] = [
    {
      label: 'Pipeline Value', icon: 'Pipeline',
      value: formatCurrency(data?.pipelineValue || 0),
      sub: `${data?.totalFOs || 0} FOs · ${data?.totalZones || 0} zones`,
      tone: T.info,
    },
    {
      label: 'Pending Approvals', icon: 'Deal',
      value: String(data?.pendingApprovals || 0),
      sub: data?.pendingApprovals ? 'Action required' : 'All clear',
      tone: T.warning,
      valueColor: data?.pendingApprovals ? T.warning : T.text,
    },
    {
      label: 'Visits This Month', icon: 'Tracking',
      value: String(data?.visitsThisMonth || 0),
      sub: 'Region-wide',
      tone: T.info,
    },
    {
      label: 'Demos This Month', icon: 'Demos',
      value: String(data?.demosThisMonth || 0),
      sub: 'Region-wide',
      tone: T.warning,
    },
    {
      label: 'Deals Lost', icon: 'Reports',
      value: String(data?.dealsLost || 0),
      sub: 'Stage = Lost',
      tone: T.danger,
      valueColor: T.danger,
    },
  ];

  const showActivity = data?.pipelineValue !== undefined || data?.pendingApprovals !== undefined;

  // ── Panel data ───────────────────────────────────────────────────────────────
  const zones = data?.zones || [];
  const agingDeals = data?.agingDeals || [];
  const revenueChart = data?.revenueChart || [];
  const lossReasons = data?.lossReasons || [];
  // Length-checked, not truthiness-checked: `conversionFunnel: []` is truthy, so
  // an empty array must not win — fall through to [] so the panel shows its
  // empty state instead of rendering a blank funnel.
  const funnel: { stage: string; count: number }[] =
    data?.conversionFunnel?.length ? data.conversionFunnel : [];
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count));
  const maxRevenue = Math.max(1, ...revenueChart.map(p => p.value));
  const totalLoss = lossReasons.reduce((sum, r) => sum + r.count, 0);

  const cellPad = 5;
  const panelPad = 13;
  const listGap = 6;
  const rowPad = 9;
  const iconBox = 32;

  const Body: any = wide ? View : ScrollView;
  const bodyProps: any = wide
    ? { style: s.bodyWide }
    : {
        style: s.scroll,
        contentContainerStyle: { padding: 12, paddingBottom: insets.bottom + 16 },
        showsVerticalScrollIndicator: false,
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />
        ),
      };

  const empty = (msg: string) => <Text style={[s.empty, { color: T.dim }]}>{msg}</Text>;

  // A plain render function, not an inline component: an inline component type is
  // new on every render, which makes React unmount and remount the whole header.
  const panelHead = ({
    title, count, onAction, actionLabel,
  }: { title: string; count?: number; onAction?: () => void; actionLabel?: string }) => (
    <View style={s.panelHead}>
      <Text numberOfLines={1} style={[s.h3, { color: T.text }]}>{title}</Text>
      {count != null && count > 0 && (
        <View style={[s.countChip, { backgroundColor: T.cardAlt }]}>
          <Text style={[s.countTxt, { color: T.sub }]}>{count}</Text>
        </View>
      )}
      <View style={s.spacer} />
      {!!onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} hitSlop={8} style={s.linkBtn}>
          <Text style={[s.link, { color: T.accent }]}>{actionLabel ?? 'View all'}</Text>
          <ChevronRight size={12} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
      )}
    </View>
  );

  const kpiDeck = (items: Kpi[], rowKey: string) => {
    // Phone: two columns. An odd final card would otherwise sit alone with a 50%
    // empty gap beside it, so it spans the full row instead.
    const oddTail = !wide && items.length % 2 === 1;
    return (
      <View key={rowKey} style={[s.grid, wide && s.kpiRowWide]}>
        {items.map((k, i) => {
          const w = wide
            ? `${100 / items.length}%`
            : oddTail && i === items.length - 1 ? '100%' : '50%';
          return (
          <View
            key={k.label}
            style={[{ width: w as any, padding: cellPad }, wide && s.kpiCell]}
          >
            <Card style={[s.kpi, { padding: panelPad }]}>
              <View
                style={[
                  s.kpiIcon,
                  {
                    backgroundColor: withAlpha(k.tone || T.accent, SOFT_TINT),
                    width: iconBox, height: iconBox,
                  },
                ]}
              >
                <Icon name={k.icon} size={Math.round(iconBox * 0.53)} color={k.tone || T.accent} />
              </View>
              <Text numberOfLines={1} style={[s.kpiValue, { color: k.valueColor || T.text }]}>{k.value}</Text>
              <Text numberOfLines={2} style={[s.kpiLabel, { color: T.sub }]}>{k.label}</Text>
              <Text numberOfLines={1} style={[s.kpiSub, { color: T.dim }]}>{k.sub}</Text>
              {k.bar != null && (
                <View style={[s.track, { backgroundColor: T.cardAlt }]}>
                  <View style={{ width: `${Math.min(Math.max(k.bar, 0), 100)}%`, height: '100%', borderRadius: 3, overflow: 'hidden' }}>
                    <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                  </View>
                </View>
              )}
            </Card>
          </View>
          );
        })}
      </View>
    );
  };

  // ── Panels ───────────────────────────────────────────────────────────────────
  const zonePanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Zone Performance', count: zones.length })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {zones.length ? (
          zones.map(zone => {
            const tp = attainColor(T, zone.targetPct);
            return (
              <View key={zone.id} style={[s.zoneRow, { padding: rowPad, borderColor: T.line }]}>
                <View style={s.flexMin}>
                  <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{zone.name}</Text>
                  <View style={s.zoneStats}>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>
                      {formatCurrency(zone.revenue)}
                    </Text>
                    <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, s.bold, { color: tp }]}>
                      {zone.targetPct}%
                    </Text>
                    <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>
                      {zone.foCount ?? 0} FOs
                    </Text>
                  </View>
                  <ProgressBar
                    value={zone.targetPct}
                    height={4}
                    color={tp}
                    trackColor={T.cardAlt}
                    style={{ marginTop: 5 }}
                  />
                </View>
                <View style={s.noShrink}>
                  <StatusBadge label={zone.health} color={healthColor(T, zone.health)} />
                </View>
              </View>
            );
          })
        ) : empty('No zone data yet')}
      </PanelBody>
    </Card>
  );

  const funnelPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Conversion Funnel (All Zones)' })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {funnel.length ? (
          funnel.map(f => (
            <View key={f.stage} style={s.funnelRow}>
              <Text numberOfLines={2} style={[s.funnelLbl, { color: T.sub }]}>{f.stage}</Text>
              <View style={[s.funnelTrack, { backgroundColor: T.cardAlt }]}>
                <View
                  style={{
                    width: `${(f.count / maxFunnel) * 100}%`,
                    height: '100%', borderRadius: 7, overflow: 'hidden', justifyContent: 'center',
                  }}
                >
                  <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                  {f.count > 0 && <Text style={s.funnelCount}>{f.count}</Text>}
                </View>
              </View>
            </View>
          ))
        ) : empty('No pipeline data yet')}
      </PanelBody>
    </Card>
  );

  const agingPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Aging Deals', count: agingDeals.length })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {agingDeals.map((deal, idx) => {
          const c = riskColor(T, deal.risk);
          return (
            <View
              key={idx}
              style={[
                s.agingRow,
                { padding: rowPad, backgroundColor: withAlpha(c, 0.08), borderColor: withAlpha(c, 0.2) },
              ]}
            >
              <View style={s.flexMin}>
                <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{deal.school}</Text>
                <Text numberOfLines={1} style={[s.cellSub, { color: T.sub }]}>
                  {deal.stage} · {formatCurrency(deal.value)}
                </Text>
              </View>
              <View style={[s.noShrink, s.alignEnd]}>
                <Text numberOfLines={1} style={[s.rowVal, { color: c }]}>{deal.daysInStage}d</Text>
                <View style={[s.riskChip, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
                  <Text numberOfLines={1} style={[s.riskTxt, { color: c }]}>{deal.risk}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </PanelBody>
    </Card>
  );

  const revenuePanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Revenue Trend' })}
      <PanelBody wide={wide}>
        <View style={s.chartArea}>
          {revenueChart.map(point => (
            <View key={point.label} style={s.barWrap}>
              <Text numberOfLines={1} style={[s.barValue, { color: T.sub }]}>
                {formatCurrency(point.value)}
              </Text>
              <View style={s.barContainer}>
                <View style={[s.bar, { height: `${(point.value / maxRevenue) * 100}%` }]}>
                  <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                </View>
              </View>
              <Text numberOfLines={1} style={[s.barLabel, { color: T.dim }]}>{point.label}</Text>
            </View>
          ))}
        </View>
      </PanelBody>
    </Card>
  );

  const lossPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Loss Reasons', count: lossReasons.length })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap + 2 }}>
        {lossReasons.map(lr => {
          const p = totalLoss > 0 ? (lr.count / totalLoss) * 100 : 0;
          return (
            <View key={lr.reason} style={s.lossRow}>
              <Text numberOfLines={1} style={[s.lossReason, { color: T.sub }]}>{lr.reason}</Text>
              <View style={[s.lossTrack, { backgroundColor: T.cardAlt }]}>
                <View style={{ width: `${p}%`, height: '100%', borderRadius: 3, backgroundColor: T.danger }} />
              </View>
              <Text numberOfLines={1} style={[s.lossCount, { color: T.danger }]}>{lr.count}</Text>
            </View>
          );
        })}
      </PanelBody>
    </Card>
  );

  /**
   * Panels are conditional, so build the two rows from what is actually rendered
   * and split each row evenly — that way a row is always exactly full width and
   * never leaves a dead half-screen behind a hidden panel.
   */
  const rowA: { key: string; node: React.ReactNode }[] = [];
  if (zones.length > 0) rowA.push({ key: 'zones', node: zonePanel });
  rowA.push({ key: 'funnel', node: funnelPanel });
  if (agingDeals.length > 0) rowA.push({ key: 'aging', node: agingPanel });

  const rowB: { key: string; node: React.ReactNode }[] = [];
  if (revenueChart.length > 0) rowB.push({ key: 'revenue', node: revenuePanel });
  if (lossReasons.length > 0) rowB.push({ key: 'loss', node: lossPanel });

  const panelRow = (cells: { key: string; node: React.ReactNode }[]) => {
    const w = wide ? `${100 / cells.length}%` : '100%';
    return (
      <View style={[s.grid, wide && s.rowWide, wide && s.rowFlex]}>
        {cells.map(c => (
          <View key={c.key} style={{ width: w as any, padding: cellPad }}>
            {c.node}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {periodBar}

      <Body {...bodyProps}>
        {/* KPI decks — the row never shrinks, so a card can never be clipped. */}
        {kpiDeck(headline, 'headline')}
        {showActivity && kpiDeck(activity, 'activity')}

        {rowA.length > 0 && panelRow(rowA)}
        {rowB.length > 0 && panelRow(rowB)}
      </Body>
    </View>
  );
};


// ─── Styles (layout only — every colour is applied inline from the theme) ──────
const s = StyleSheet.create({
  // ── Error state (mirrors ZHDashboard) ──
  errWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errCard: {
    maxWidth: 380, alignItems: 'center', padding: 24, gap: 8,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  errTitle: { fontSize: rf(15.5), fontWeight: '700', marginTop: 4 },
  errTxt: { fontSize: rf(12.5), textAlign: 'center', lineHeight: rf(18) },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8,
    height: 38, paddingHorizontal: 18, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  retryTxt: { fontSize: rf(13), fontWeight: '700' },
  root: { flex: 1 },
  scroll: { flex: 1 },
  // iPad: the whole dashboard is one bounded, non-scrolling column. `minHeight: 0`
  // lets the flexing panel rows actually shrink instead of pushing past the screen.
  bodyWide: { flex: 1, minHeight: 0, padding: 12 },

  periodBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  regionName: { fontSize: rf(12.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  segment: { alignSelf: 'flex-start', flexShrink: 0 },
  refreshBtn: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 11, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth,
  },
  refreshTxt: { fontSize: rf(11.5), fontWeight: '700' },

  // alignItems:'stretch' + flex:1 on the card => every card on a line is exactly
  // as tall as the tallest one in that line.
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  /**
   * iPad: a KPI deck is exactly one line and must never be squeezed.
   *
   * The height is DEFINITE and deliberate. `grid` is `alignItems:'stretch'` and the
   * card inside each cell is `flex:1`, so with a height-less cell nothing
   * establishes an intrinsic height — the row collapses to its minimum and clips
   * the value, label and bar. Measured content at tablet rf() scale:
   * pad 13 + icon 32 + 8 + value ~25 + 3 + label ~14 (×2 lines) + 2 + sub ~13
   * + 8 + bar 5 + pad 13 ≈ 145.
   */
  kpiRowWide: { flexWrap: 'nowrap', flexShrink: 0, height: 145 },
  kpiCell: { height: '100%' },
  rowWide: { flexWrap: 'nowrap' },
  // The panel rows share whatever is left after the KPI decks.
  rowFlex: { flex: 1, minHeight: 0 },

  // KPI card — spec: radius 16 · pad 13 · icon chip 32 (soft tint) · value 21/800
  // · label 12/600 · sub 10.5 · bar 5
  kpi: { flex: 1 },
  kpiIcon: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: rf(21), fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  kpiLabel: { fontSize: rf(12), fontWeight: '600', marginTop: 3 },
  kpiSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 2, marginBottom: 8 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 'auto', marginBottom: 0 },

  panel: { flex: 1 },
  panelPhone: { minHeight: 190 },
  panelScroll: { flex: 1, minHeight: 0 },

  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  h3: { fontSize: rf(13.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  countChip: { flexShrink: 0, minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 7 },
  countTxt: { fontSize: rf(9.5), fontWeight: '700', textAlign: 'center' },
  spacer: { flex: 1, minWidth: 0 },
  linkBtn: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 1 },
  link: { fontSize: rf(10.5), fontWeight: '700' },

  // Shared row primitives. `flexShrink` is 0 by default in RN, so any Text that
  // shares a row carries flexShrink:1 + minWidth:0 or it paints over its neighbour.
  flexMin: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  noShrink: { flexShrink: 0 },
  alignEnd: { alignItems: 'flex-end' },
  bold: { fontWeight: '700' },
  rowTitle: { fontSize: rf(12.5), fontWeight: '600' },
  rowVal: { fontSize: rf(11.5), fontWeight: '700' },
  cellSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 1 },

  // zone performance
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  zoneStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },

  // funnel
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  funnelLbl: { fontSize: rf(11), fontWeight: '500', width: 84, flexShrink: 0 },
  funnelTrack: { flex: 1, minWidth: 0, height: 22, borderRadius: 7, overflow: 'hidden' },
  funnelCount: { fontSize: rf(10), fontWeight: '700', color: '#FFF', marginLeft: 7 },

  // revenue trend
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 132 },
  barWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  barContainer: { width: '100%', flex: 1, justifyContent: 'flex-end', marginVertical: 3 },
  bar: { width: '68%', minHeight: 4, borderRadius: 5, alignSelf: 'center', overflow: 'hidden' },
  barValue: { fontSize: rf(9), fontWeight: '600', textAlign: 'center' },
  barLabel: { fontSize: rf(10), fontWeight: '500', textAlign: 'center' },

  // aging deals
  agingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  riskChip: { height: 16, paddingHorizontal: 6, borderRadius: 8, justifyContent: 'center', marginTop: 2 },
  riskTxt: { fontSize: rf(9), fontWeight: '700' },

  // loss reasons
  lossRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lossReason: { fontSize: rf(11.5), fontWeight: '500', width: 96, flexShrink: 0 },
  lossTrack: { flex: 1, minWidth: 0, height: 6, borderRadius: 3, overflow: 'hidden' },
  lossCount: { fontSize: rf(12), fontWeight: '700', width: 24, textAlign: 'right' },

  empty: { fontSize: rf(12.5), textAlign: 'center', paddingVertical: 28 },
});
