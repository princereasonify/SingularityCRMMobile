import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  useWindowDimensions, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, RotateCw, AlertCircle, Sparkles } from 'lucide-react-native';
import { Icon, IconName, ICON_STROKE } from '../../components/common/Icon';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { Segmented, StatusBadge, Btn } from '../../components/crud';
import { ProgressBar } from '../../components/common/ProgressBar';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { dashboardApi } from '../../api/dashboard';
import { aiApi } from '../../api/ai';
import { ScaDashboardDto } from '../../types';
import { formatCurrency } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * SuperSale Admin (org-wide) dashboard — the SCA counterpart of SHDashboard, on the
 * same Sunstone system so it matches FO/ZH/RH/SH exactly: grid KPI decks, equal-height
 * cards, the same panels, period bar, dark/light. ScaDashboardDto extends the national
 * DTO, so the structure is the national dashboard plus admin metrics (users) and the
 * AI report-generation actions. The drawer's AppTopbar owns the header row.
 */

const attainColor = (T: AppTheme, p: number) =>
  p >= 70 ? T.success : p >= 40 ? T.warning : T.danger;

const riskColor = (T: AppTheme, r: string) =>
  r === 'HIGH' ? T.danger : r === 'MEDIUM' ? T.warning : T.success;

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

const PanelBody = ({
  wide, contentStyle, children,
}: { wide?: boolean; contentStyle?: any; children: React.ReactNode }) =>
  wide ? (
    <ScrollView style={s.panelScroll} contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {children}
    </ScrollView>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

export const SCADashboard = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [data, setData] = useState<ScaDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [loadFailed, setLoadFailed] = useState(false);
  const [generatingAi, setGeneratingAi] = useState<'daily' | 'management' | null>(null);

  const fetch = useCallback(async (p: 'today' | 'week' | 'month' = period) => {
    try {
      const res = await dashboardApi.getScaDashboard(p);
      setData(res.data);
      setLoadFailed(false);
    } catch {
      setData(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetch(period); }, [period]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetch(period); }, [fetch, period]);
  const reload = useCallback(() => { setLoading(true); fetch(period); }, [fetch, period]);

  const handleGenerateAi = (type: 'daily' | 'management') => {
    Alert.alert(
      type === 'daily' ? 'Generate Daily Reports' : 'Generate Management Reports',
      type === 'daily'
        ? 'This will trigger AI daily report generation for all FOs. Continue?'
        : 'This will trigger management bi-weekly report generation. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setGeneratingAi(type);
            try {
              if (type === 'daily') await aiApi.generateDailyReports();
              else await aiApi.generateManagementReports();
              Alert.alert('Success', 'Report generation triggered successfully.');
            } catch {
              Alert.alert('Error', 'Failed to trigger report generation.');
            } finally {
              setGeneratingAi(null);
            }
          },
        },
      ],
    );
  };

  const periodBar = (
    <View style={[s.periodBar, { borderBottomColor: T.line }]}>
      <Text numberOfLines={1} style={[s.scopeName, { color: T.sub }]}>Organization</Text>
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
      {wide && (
        <TouchableOpacity onPress={reload} activeOpacity={0.8} style={[s.refreshBtn, { borderColor: T.lineStrong }]}>
          <RotateCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          <Text style={[s.refreshTxt, { color: T.accent }]}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading admin dashboard..." />;

  if (loadFailed || !data) {
    return (
      <View style={[s.root, { backgroundColor: T.bg }]}>
        {periodBar}
        <View style={s.errWrap}>
          <View style={[s.errCard, { backgroundColor: T.card, borderColor: T.line }]}>
            <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.errTitle, { color: T.text }]}>Couldn't load admin dashboard</Text>
            <Text style={[s.errTxt, { color: T.dim }]}>
              Check your connection and try again. No figures are shown because none could be read.
            </Text>
            <TouchableOpacity onPress={reload} activeOpacity={0.85} style={[s.retryBtn, { borderColor: T.lineStrong }]}>
              <RotateCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.retryTxt, { color: T.accent }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

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
      label: 'Pipeline Value', icon: 'Pipeline',
      value: formatCurrency(data?.pipelineValue || 0),
      sub: `${data?.activeLeads || 0} active leads`,
      tone: T.info,
    },
    {
      label: 'Schools Won', icon: 'Targets',
      value: String(data?.schoolsWon || 0),
      sub: `${data?.winRate || 0}% win rate`,
      bar: data?.winRate || 0,
      tone: T.success,
    },
    {
      label: 'Total Users', icon: 'Users',
      value: String(data?.totalUsers ?? 0),
      sub: `${data?.activeUsers ?? 0} active`,
      tone: T.info,
    },
  ];

  const activity: Kpi[] = [
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
      sub: 'Nationwide', tone: T.info,
    },
    {
      label: 'Demos This Month', icon: 'Demos',
      value: String(data?.demosThisMonth || 0),
      sub: 'Nationwide', tone: T.warning,
    },
    {
      label: 'Total FOs', icon: 'Users',
      value: String(data?.totalFOs || 0),
      sub: `${data?.totalRegions || 0} regions · ${data?.totalZones || 0} zones`,
      tone: T.success,
    },
    {
      label: 'Deals Lost', icon: 'Reports',
      value: String(data?.dealsLost || 0),
      sub: 'Stage = Lost', tone: T.danger, valueColor: T.danger,
    },
  ];

  const showActivity = data?.visitsThisMonth !== undefined || data?.demosThisMonth !== undefined;

  const regions = data?.regions || [];
  const agingDeals = data?.agingDeals || [];
  const revenueChart = data?.revenueChart || [];
  const lossReasons = data?.lossReasons || [];
  const topPerformers = data?.topPerformers || [];
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
    const oddTail = !wide && items.length % 2 === 1;
    return (
      <View key={rowKey} style={[s.grid, wide && s.kpiRowWide]}>
        {items.map((k, i) => {
          const w = wide
            ? `${100 / items.length}%`
            : oddTail && i === items.length - 1 ? '100%' : '50%';
          return (
          <View key={k.label} style={[{ width: w as any, padding: cellPad }, wide && s.kpiCell]}>
            <Card style={[s.kpi, { padding: panelPad }]}>
              <View style={[s.kpiIcon, { backgroundColor: withAlpha(k.tone || T.accent, SOFT_TINT), width: iconBox, height: iconBox }]}>
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

  // AI report actions — SCA-only admin controls, styled with the kit's Btn.
  const aiPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'AI Reports' })}
      <Text style={[s.aiHint, { color: T.dim }]}>Trigger organisation-wide report generation.</Text>
      <View style={s.aiRow}>
        <Btn
          label={generatingAi === 'daily' ? 'Generating…' : 'Daily Reports'}
          onPress={() => handleGenerateAi('daily')}
          disabled={generatingAi !== null}
          small
          icon={generatingAi === 'daily'
            ? <ActivityIndicator size="small" color={T.onAccent} />
            : <Sparkles size={14} color={T.onAccent} strokeWidth={ICON_STROKE} />}
        />
        <Btn
          label={generatingAi === 'management' ? 'Generating…' : 'Management'}
          onPress={() => handleGenerateAi('management')}
          disabled={generatingAi !== null}
          variant="secondary"
          small
          icon={generatingAi === 'management'
            ? <ActivityIndicator size="small" color={T.accent} />
            : <Sparkles size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
        />
      </View>
    </Card>
  );

  const regionPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Region Performance', count: regions.length })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {regions.length ? (
          regions.map(region => {
            const tp = attainColor(T, region.targetPct);
            return (
              <View key={region.id} style={[s.zoneRow, { padding: rowPad, borderColor: T.line }]}>
                <View style={s.flexMin}>
                  <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{region.name}</Text>
                  <View style={s.zoneStats}>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>{formatCurrency(region.revenue)}</Text>
                    <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, s.bold, { color: tp }]}>{region.targetPct}%</Text>
                    <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                    <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>{region.foCount ?? 0} FOs</Text>
                  </View>
                  <ProgressBar value={region.targetPct} height={4} color={tp} trackColor={T.cardAlt} style={{ marginTop: 5 }} />
                </View>
                <View style={s.noShrink}>
                  <StatusBadge label={region.health} color={healthColor(T, region.health)} />
                </View>
              </View>
            );
          })
        ) : empty('No region data yet')}
      </PanelBody>
    </Card>
  );

  const funnelPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Conversion Funnel (National)' })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {funnel.length ? (
          funnel.map(f => (
            <View key={f.stage} style={s.funnelRow}>
              <Text numberOfLines={2} style={[s.funnelLbl, { color: T.sub }]}>{f.stage}</Text>
              <View style={[s.funnelTrack, { backgroundColor: T.cardAlt }]}>
                <View style={{ width: `${(f.count / maxFunnel) * 100}%`, height: '100%', borderRadius: 7, overflow: 'hidden', justifyContent: 'center' }}>
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
        {agingDeals.length ? agingDeals.map((deal, idx) => {
          const c = riskColor(T, deal.risk);
          return (
            <View key={idx} style={[s.agingRow, { padding: rowPad, backgroundColor: withAlpha(c, 0.08), borderColor: withAlpha(c, 0.2) }]}>
              <View style={s.flexMin}>
                <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{deal.school}</Text>
                <Text numberOfLines={1} style={[s.cellSub, { color: T.sub }]}>{deal.stage} · {formatCurrency(deal.value)}</Text>
              </View>
              <View style={[s.noShrink, s.alignEnd]}>
                <Text numberOfLines={1} style={[s.rowVal, { color: c }]}>{deal.daysInStage}d</Text>
                <View style={[s.riskChip, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
                  <Text numberOfLines={1} style={[s.riskTxt, { color: c }]}>{deal.risk}</Text>
                </View>
              </View>
            </View>
          );
        }) : empty('No aging deals')}
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
              <Text numberOfLines={1} style={[s.barValue, { color: T.sub }]}>{formatCurrency(point.value)}</Text>
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
        {lossReasons.length ? lossReasons.map(lr => {
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
        }) : empty('No loss data yet')}
      </PanelBody>
    </Card>
  );

  const topPanel = (
    <Card style={[s.panel, { padding: panelPad }, !wide && s.panelPhone]}>
      {panelHead({ title: 'Top Performers', count: topPerformers.length })}
      <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
        {topPerformers.length ? topPerformers.slice(0, 8).map((p, idx) => {
          const tp = attainColor(T, p.targetPct);
          return (
            <View key={p.foId ?? idx} style={[s.zoneRow, { padding: rowPad, borderColor: T.line }]}>
              <View style={[s.rankChip, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
                <Text style={[s.rankTxt, { color: T.accent }]}>{idx + 1}</Text>
              </View>
              <View style={s.flexMin}>
                <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{p.name}</Text>
                <View style={s.zoneStats}>
                  <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>{formatCurrency(p.revenue)}</Text>
                  <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                  <Text numberOfLines={1} style={[s.cellSub, s.shrink, s.bold, { color: tp }]}>{p.targetPct}%</Text>
                  <Text style={[s.cellSub, { color: T.dim }]}>·</Text>
                  <Text numberOfLines={1} style={[s.cellSub, s.shrink, { color: T.sub }]}>{p.dealsWon} won</Text>
                </View>
              </View>
              <View style={s.noShrink}>
                <StatusBadge label={p.status} color={healthColor(T, p.status)} />
              </View>
            </View>
          );
        }) : empty('No performer data yet')}
      </PanelBody>
    </Card>
  );

  const rowA: { key: string; node: React.ReactNode }[] = [];
  if (regions.length > 0) rowA.push({ key: 'regions', node: regionPanel });
  rowA.push({ key: 'funnel', node: funnelPanel });
  if (agingDeals.length > 0) rowA.push({ key: 'aging', node: agingPanel });

  const rowB: { key: string; node: React.ReactNode }[] = [];
  if (revenueChart.length > 0) rowB.push({ key: 'revenue', node: revenuePanel });
  if (lossReasons.length > 0) rowB.push({ key: 'loss', node: lossPanel });
  if (topPerformers.length > 0) rowB.push({ key: 'top', node: topPanel });

  const rowC: { key: string; node: React.ReactNode }[] = [{ key: 'ai', node: aiPanel }];

  const panelRow = (cells: { key: string; node: React.ReactNode }[]) => {
    const w = wide ? `${100 / cells.length}%` : '100%';
    return (
      <View style={[s.grid, wide && s.rowWide, wide && s.rowFlex]}>
        {cells.map(c => (
          <View key={c.key} style={{ width: w as any, padding: cellPad }}>{c.node}</View>
        ))}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {periodBar}
      <Body {...bodyProps}>
        {kpiDeck(headline, 'headline')}
        {showActivity && kpiDeck(activity, 'activity')}
        {rowA.length > 0 && panelRow(rowA)}
        {rowB.length > 0 && panelRow(rowB)}
        {/* AI actions row — on phone it just stacks below like any other panel. */}
        {!wide && panelRow(rowC)}
      </Body>
    </View>
  );
};


// ─── Styles (layout only — every colour is applied inline from the theme) ──────
const s = StyleSheet.create({
  errWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errCard: { maxWidth: 380, alignItems: 'center', padding: 24, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  errTitle: { fontSize: rf(15.5), fontWeight: '700', marginTop: 4 },
  errTxt: { fontSize: rf(12.5), textAlign: 'center', lineHeight: rf(18) },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, height: 38, paddingHorizontal: 18, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  retryTxt: { fontSize: rf(13), fontWeight: '700' },
  root: { flex: 1 },
  scroll: { flex: 1 },
  bodyWide: { flex: 1, minHeight: 0, padding: 12 },

  periodBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scopeName: { fontSize: rf(12.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  segment: { alignSelf: 'flex-start', flexShrink: 0 },
  refreshBtn: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 11, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth },
  refreshTxt: { fontSize: rf(11.5), fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  kpiRowWide: { flexWrap: 'nowrap', flexShrink: 0, height: 145 },
  kpiCell: { height: '100%' },
  rowWide: { flexWrap: 'nowrap' },
  rowFlex: { flex: 1, minHeight: 0 },

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

  aiHint: { fontSize: rf(11.5), fontWeight: '400', marginBottom: 10 },
  aiRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  flexMin: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  noShrink: { flexShrink: 0 },
  alignEnd: { alignItems: 'flex-end' },
  bold: { fontWeight: '700' },
  rowTitle: { fontSize: rf(12.5), fontWeight: '600' },
  rowVal: { fontSize: rf(11.5), fontWeight: '700' },
  cellSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 1 },

  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  zoneStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },

  rankChip: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankTxt: { fontSize: rf(11), fontWeight: '800' },

  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  funnelLbl: { fontSize: rf(11), fontWeight: '500', width: 84, flexShrink: 0 },
  funnelTrack: { flex: 1, minWidth: 0, height: 22, borderRadius: 7, overflow: 'hidden' },
  funnelCount: { fontSize: rf(10), fontWeight: '700', color: '#FFF', marginLeft: 7 },

  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 132 },
  barWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  barContainer: { width: '100%', flex: 1, justifyContent: 'flex-end', marginVertical: 3 },
  bar: { width: '68%', minHeight: 4, borderRadius: 5, alignSelf: 'center', overflow: 'hidden' },
  barValue: { fontSize: rf(9), fontWeight: '600', textAlign: 'center' },
  barLabel: { fontSize: rf(10), fontWeight: '500', textAlign: 'center' },

  agingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  riskChip: { height: 16, paddingHorizontal: 6, borderRadius: 8, justifyContent: 'center', marginTop: 2 },
  riskTxt: { fontSize: rf(9), fontWeight: '700' },

  lossRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lossReason: { fontSize: rf(11.5), fontWeight: '500', width: 96, flexShrink: 0 },
  lossTrack: { flex: 1, minWidth: 0, height: 6, borderRadius: 3, overflow: 'hidden' },
  lossCount: { fontSize: rf(12), fontWeight: '700', width: 24, textAlign: 'right' },

  empty: { fontSize: rf(12.5), textAlign: 'center', paddingVertical: 28 },
});
