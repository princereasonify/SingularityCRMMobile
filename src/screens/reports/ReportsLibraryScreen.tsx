import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNShare from 'react-native-share';
import { Download } from 'lucide-react-native';
import {
  reportsApi, UserPerformanceDto, SchoolVisitSummaryDto, PipelineReportDto, LostDealAnalysisDto,
} from '../../api/reports';
import { Btn, Segmented, Field, StatusBadge } from '../../components/crud';
import { Card } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { isoDate, todayStr } from '../../utils/dates';
import { stageLabel, APPROVAL_LABELS } from '../../utils/constants';
import { apiClient } from '../../api/client';

/**
 * Reports Library — the real gap: web's `sh/ReportsLibrary.jsx` gives every manager
 * role (ZH/RH/SH/SCA) five report viewers with CSV export (Team Performance, Pipeline
 * by Stage, Deal Aging, Lost Deal Analysis, School Visits); mobile had an entirely
 * typed, correctly-shaped `src/api/reports.ts` with ZERO callers anywhere in the app.
 * All five are here. Deal Aging is not a ReportsController report — like web it reads
 * GET /deals?status=pending&pageSize=500 (DealService: "pending" = waiting on any
 * approver) and computes days waiting client-side, oldest first.
 *
 * Verified against ReportsController.cs: the four /reports endpoints 403 for FO
 * (`IsManager => ZH|RH|SH|SCA`); ZH/RH additionally have their zone/region pinned
 * server-side (`ScopeFiltersAsync`) regardless of what's requested, so no client-side
 * scoping is needed or even possible to get wrong here.
 */

type Tab = 'performance' | 'pipeline' | 'aging' | 'lostDeals' | 'visits';

const TABS: { label: string; value: Tab }[] = [
  { label: 'Team', value: 'performance' },
  { label: 'Pipeline', value: 'pipeline' },
  { label: 'Aging', value: 'aging' },
  { label: 'Lost', value: 'lostDeals' },
  { label: 'Visits', value: 'visits' },
];

/** Web's `noDates` reports: the server ignores dates for them, so no date inputs and none sent. */
const NO_DATES: Tab[] = ['pipeline', 'aging'];

const DASH = '—';

/**
 * Local DealDto subset Deal Aging reads (DealDto.cs: School, FoName, ApprovalStatus,
 * TotalMoney, SubmittedAt, CreatedAt) — kept here rather than in src/types.
 */
interface PendingDealRow {
  id: number;
  school: string;
  foName?: string;
  approvalStatus: string;
  totalMoney?: number;
  submittedAt?: string | null;
  createdAt?: string;
  daysWaiting: number;
}

/** Web defaults (sh/ReportsLibrary.jsx): 1st of this month; Lost Deals looks back 90 days. */
const defaultFrom = (t: Tab) => {
  const d = new Date();
  if (t === 'lostDeals') d.setDate(d.getDate() - 90);
  else d.setDate(1);
  return isoDate(d);
};

const approvalLabel = (v: string) => (APPROVAL_LABELS as Record<string, { label: string }>)[v]?.label || v;

/**
 * Quote-escaped CSV cell with web's formula-injection guard (sh/ReportsLibrary.jsx csvCell):
 * text Excel would run as a formula (= + - @ tab CR) gets a leading apostrophe — unless it is
 * just a number like "-1200".
 */
const csvCell = (v: any) => {
  let str = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(str) && !/^[+-]?[\d\s().,-]+$/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
};
const toCsv = (head: string[], rows: any[][]) =>
  [head.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');

export const ReportsLibraryScreen = () => {
  const T = useAppTheme();
  const wide = isTabletDevice;

  const [tab, setTab] = useState<Tab>('performance');
  const [dateFrom, setDateFrom] = useState(defaultFrom('performance'));
  const [dateTo, setDateTo] = useState(todayStr());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const [performance, setPerformance] = useState<UserPerformanceDto[]>([]);
  const [pipeline, setPipeline] = useState<PipelineReportDto[]>([]);
  const [lostDeals, setLostDeals] = useState<LostDealAnalysisDto | null>(null);
  const [visits, setVisits] = useState<SchoolVisitSummaryDto[]>([]);
  const [aging, setAging] = useState<PendingDealRow[]>([]);

  // Each tab keeps web's own default range — switching resets it, like opening a new report.
  const selectTab = (t: Tab) => {
    setTab(t);
    setDateFrom(defaultFrom(t));
    setDateTo(todayStr());
  };

  // A date nudge or tab switch fires a fetch per change — only the latest may land.
  const fetchTokenRef = useRef(0);

  const fetchTab = useCallback(async (t: Tab) => {
    const token = ++fetchTokenRef.current;
    // Pipeline is a point-in-time snapshot — web sends it no dates (noDates).
    const filters = NO_DATES.includes(t) ? {} : { dateFrom, dateTo };
    try {
      if (t === 'performance') {
        const data = (await reportsApi.getUserPerformance(filters)).data ?? [];
        if (fetchTokenRef.current === token) setPerformance(data);
      } else if (t === 'pipeline') {
        const data = (await reportsApi.getPipeline(filters)).data ?? [];
        if (fetchTokenRef.current === token) setPipeline(data);
      } else if (t === 'aging') {
        // Deals awaiting any approver, oldest first (web sh/ReportsLibrary.jsx:65-81).
        const res = await apiClient.get<{ items?: any[] }>('/deals', { params: { status: 'pending', pageSize: 500 } });
        const now = Date.now();
        const rows: PendingDealRow[] = (res.data?.items ?? []).map((d: any) => ({
          ...d,
          daysWaiting: Math.floor((now - new Date(d.submittedAt || d.createdAt).getTime()) / 86_400_000),
        })).sort((a: PendingDealRow, b: PendingDealRow) => b.daysWaiting - a.daysWaiting);
        if (fetchTokenRef.current === token) setAging(rows);
      } else if (t === 'lostDeals') {
        const data = (await reportsApi.getLostDealAnalysis(filters)).data ?? null;
        if (fetchTokenRef.current === token) setLostDeals(data);
      } else {
        const data = (await reportsApi.getSchoolVisits(filters)).data ?? [];
        if (fetchTokenRef.current === token) setVisits(data);
      }
      if (fetchTokenRef.current === token) setLoadFailed(false);
    } catch {
      if (fetchTokenRef.current === token) setLoadFailed(true);
    }
    return fetchTokenRef.current === token;
  }, [dateFrom, dateTo]);

  const load = useCallback(async (t: Tab = tab) => {
    if (!(await fetchTab(t))) return;
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTab]);

  useEffect(() => { setLoading(true); load(tab); }, [tab, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load(tab); };

  const exportCsv = async () => {
    try {
      let csv = '';
      let title = '';
      if (tab === 'performance') {
        title = 'Team Performance';
        csv = toCsv(
          ['Name', 'Role', 'Visits', 'Demos', 'Deals', 'Revenue', 'Distance (km)', 'Allowance', 'Avg Visit (min)', 'Schools Visited', 'Conversion %'],
          performance.map(p => [p.name, p.role, p.totalVisits, p.totalDemos, p.totalDeals, p.totalRevenue, p.totalDistanceKm, p.totalAllowance, p.avgVisitDurationMinutes, p.schoolsVisited, p.conversionRate]),
        );
      } else if (tab === 'pipeline') {
        title = 'Pipeline by Stage';
        csv = toCsv(
          ['Stage', 'Count', 'Total Value', 'Avg Age (days)'],
          pipeline.map(p => [stageLabel(p.stage), p.count, p.totalValue, p.avgAgeDays]),
        );
      } else if (tab === 'aging') {
        title = 'Deal Aging';
        csv = toCsv(
          ['School', 'Owner', 'Waiting on', 'Value', 'Days'],
          aging.map(d => [d.school, d.foName ?? '', approvalLabel(d.approvalStatus), d.totalMoney ?? 0, d.daysWaiting]),
        );
      } else if (tab === 'lostDeals') {
        title = 'Lost Deal Analysis';
        csv = toCsv(
          ['School', 'City', 'Value', 'Loss Reason', 'FO', 'Zone', 'Close Date'],
          (lostDeals?.deals ?? []).map(d => [d.school, d.city, d.value, d.lossReason, d.foName, d.zoneName ?? '', d.closeDate ? formatDate(d.closeDate) : '']),
        );
      } else {
        title = 'School Visits';
        csv = toCsv(
          ['School', 'City', 'Visits', 'Total Time (min)', 'Avg Duration (min)', 'Unique Visitors', 'Last Visit', 'Last Outcome'],
          visits.map(v => [v.schoolName, v.city ?? '', v.totalVisits, v.totalTimeSpentMinutes, v.avgVisitDurationMinutes, v.uniqueVisitors, v.lastVisitDate ? formatDate(v.lastVisitDate) : '', v.lastOutcome ?? '']),
        );
      }
      await RNShare.open({ title: `Export ${title}`, subject: `${title} Export`, message: csv, failOnCancel: false });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Error', 'Failed to export report.');
    }
  };

  const hasRows =
    tab === 'performance' ? performance.length > 0 :
    tab === 'pipeline' ? pipeline.length > 0 :
    tab === 'aging' ? aging.length > 0 :
    tab === 'lostDeals' ? (lostDeals?.deals.length ?? 0) > 0 :
    visits.length > 0;

  const renderPerformance = () => performance.map(p => (
    <Card key={p.userId} style={s.row}>
      <View style={s.rowBetween}>
        <View style={s.flexMin}>
          <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{p.name}</Text>
          <Text style={[s.rowSub, { color: T.sub }]}>{p.role} · {p.schoolsVisited} schools · {p.conversionRate.toFixed(0)}% conversion</Text>
        </View>
        <Text style={[s.rowVal, { color: T.text }]}>{formatCurrency(p.totalRevenue)}</Text>
      </View>
      <View style={s.statsRow}>
        <Text style={[s.stat, { color: T.dim }]}>{p.totalVisits} visits</Text>
        <Text style={[s.stat, { color: T.dim }]}>{p.totalDemos} demos</Text>
        <Text style={[s.stat, { color: T.dim }]}>{p.totalDeals} deals</Text>
        <Text style={[s.stat, { color: T.dim }]}>{p.totalDistanceKm.toFixed(0)} km</Text>
      </View>
    </Card>
  ));

  const renderPipeline = () => pipeline.map((p, i) => (
    <Card key={`${p.stage}-${i}`} style={s.row}>
      <View style={s.rowBetween}>
        <Text style={[s.rowTitle, { color: T.text }]}>{stageLabel(p.stage)}</Text>
        <StatusBadge label={`${p.count} leads`} color={T.accent} />
      </View>
      <View style={s.statsRow}>
        <Text style={[s.stat, { color: T.dim }]}>{formatCurrency(p.totalValue)} total value</Text>
        <Text style={[s.stat, { color: T.dim }]}>{p.avgAgeDays.toFixed(0)}d avg age</Text>
      </View>
    </Card>
  ));

  // Web tints >14 days negative and >7 days warn.
  const renderAging = () => aging.map(d => {
    const tone = d.daysWaiting > 14 ? T.danger : d.daysWaiting > 7 ? T.warning : T.sub;
    return (
      <Card key={d.id} style={s.row}>
        <View style={s.rowBetween}>
          <View style={s.flexMin}>
            <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{d.school}</Text>
            <Text numberOfLines={1} style={[s.rowSub, { color: T.sub }]}>{d.foName || DASH} · {approvalLabel(d.approvalStatus)}</Text>
          </View>
          <Text style={[s.rowVal, { color: T.text }]}>{formatCurrency(d.totalMoney ?? 0)}</Text>
        </View>
        <Text style={[s.stat, { color: tone, fontWeight: d.daysWaiting > 7 ? '700' : '500' }]}>
          {d.daysWaiting} {d.daysWaiting === 1 ? 'day' : 'days'} waiting
        </Text>
      </Card>
    );
  });

  const renderLostDeals = () => (
    <>
      <View style={s.summaryRow}>
        <Card style={[s.summaryCard, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
          <Text style={[s.summaryVal, { color: T.danger }]}>{lostDeals?.totalLost ?? 0}</Text>
          <Text style={[s.summaryLabel, { color: T.sub }]}>Deals Lost</Text>
        </Card>
        <Card style={[s.summaryCard, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
          <Text style={[s.summaryVal, { color: T.danger }]}>{formatCurrency(lostDeals?.totalLostValue ?? 0)}</Text>
          <Text style={[s.summaryLabel, { color: T.sub }]}>Value Lost</Text>
        </Card>
      </View>
      {!!lostDeals?.byReason.length && (
        <View style={s.groupSection}>
          <Text style={[s.groupTitle, { color: T.dim }]}>BY REASON</Text>
          {lostDeals.byReason.map((r, i) => (
            <View key={i} style={s.groupRow}>
              <Text style={[s.groupName, { color: T.text }]} numberOfLines={1}>{r.reason}</Text>
              <Text style={[s.groupVal, { color: T.sub }]}>{r.count} · {formatCurrency(r.totalValue)}</Text>
            </View>
          ))}
        </View>
      )}
      {!!lostDeals?.byFo?.length && (
        <View style={s.groupSection}>
          <Text style={[s.groupTitle, { color: T.dim }]}>BY FIELD OFFICER</Text>
          {lostDeals.byFo.map(f => (
            <View key={f.foId} style={s.groupRow}>
              <Text style={[s.groupName, { color: T.text }]} numberOfLines={1}>{f.foName}</Text>
              <Text style={[s.groupVal, { color: T.sub }]}>{f.count} · <Text style={{ color: T.danger }}>{formatCurrency(f.totalValue)}</Text></Text>
            </View>
          ))}
        </View>
      )}
      {!!lostDeals?.byZone?.length && (
        <View style={s.groupSection}>
          <Text style={[s.groupTitle, { color: T.dim }]}>BY ZONE</Text>
          {lostDeals.byZone.map((z, i) => (
            <View key={i} style={s.groupRow}>
              <Text style={[s.groupName, { color: T.text }]} numberOfLines={1}>{z.zoneName}</Text>
              <Text style={[s.groupVal, { color: T.sub }]}>{z.count} · <Text style={{ color: T.danger }}>{formatCurrency(z.totalValue)}</Text></Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.groupSection}>
        <Text style={[s.groupTitle, { color: T.dim }]}>RECENT ({Math.min(25, lostDeals?.deals.length ?? 0)})</Text>
        {(lostDeals?.deals ?? []).slice(0, 25).map(d => (
          <Card key={d.leadId} style={s.row}>
            <View style={s.rowBetween}>
              <View style={s.flexMin}>
                <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{d.school}</Text>
                <Text numberOfLines={1} style={[s.rowSub, { color: T.sub }]}>{d.foName}{d.zoneName ? ` · ${d.zoneName}` : ''} · {d.city} · {d.closeDate ? formatDate(d.closeDate) : DASH}</Text>
              </View>
              <Text style={[s.rowVal, { color: T.danger }]}>{formatCurrency(d.value)}</Text>
            </View>
            <Text numberOfLines={2} style={[s.lossReason, { color: T.dim }]}>{d.lossReason || 'No reason given'}</Text>
          </Card>
        ))}
      </View>
    </>
  );

  const renderVisits = () => visits.map(v => (
    <Card key={v.schoolId} style={s.row}>
      <View style={s.rowBetween}>
        <View style={s.flexMin}>
          <Text numberOfLines={1} style={[s.rowTitle, { color: T.text }]}>{v.schoolName}</Text>
          <Text numberOfLines={1} style={[s.rowSub, { color: T.sub }]}>{v.city || DASH} · last visit {v.lastVisitDate ? formatDate(v.lastVisitDate) : DASH}</Text>
        </View>
        <StatusBadge label={`${v.totalVisits} visits`} color={T.accent} />
      </View>
      <View style={s.statsRow}>
        <Text style={[s.stat, { color: T.dim }]}>{v.avgVisitDurationMinutes.toFixed(0)}m avg</Text>
        <Text style={[s.stat, { color: T.dim }]}>{v.uniqueVisitors} visitors</Text>
        {!!v.lastOutcome && <Text style={[s.stat, { color: T.dim }]}>{v.lastOutcome}</Text>}
      </View>
    </Card>
  ));

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <LoadingSpinner fullScreen message="Loading reports…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.title, { color: T.text }]}>Reports Library</Text>
        <Text style={[s.subtitle, { color: T.sub }]}>Team performance, pipeline, deal aging, lost deals and school visits — live data, scoped to your area.</Text>

        <Segmented<Tab> value={tab} options={TABS} onChange={selectTab} />

        {!NO_DATES.includes(tab) && (
          <View style={wide ? s.dateRowWide : s.dateRow}>
            <Field label="From" style={{ flex: 1 }}>
              <DateInput value={dateFrom} onChange={setDateFrom} accentColor={T.accent} maxDate={dateTo || todayStr()} />
            </Field>
            <Field label="To" style={{ flex: 1 }}>
              <DateInput value={dateTo} onChange={setDateTo} accentColor={T.accent} minDate={dateFrom} maxDate={todayStr()} />
            </Field>
          </View>
        )}

        <Btn
          label="Export CSV"
          variant="secondary"
          small
          disabled={!hasRows}
          icon={<Download size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
          onPress={exportCsv}
          style={{ alignSelf: 'flex-start' }}
        />

        {loadFailed ? (
          <EmptyState icon="⚠️" title="Couldn't load this report" subtitle="Check your connection and pull down to retry." />
        ) : !hasRows ? (
          <EmptyState
            icon={tab === 'performance' ? '👥' : tab === 'pipeline' ? '🔀' : tab === 'aging' ? '⏳' : tab === 'lostDeals' ? '📉' : '📍'}
            title={tab === 'aging' ? 'No deals awaiting approval' : NO_DATES.includes(tab) ? 'No data yet' : 'No data for these dates'}
            subtitle={NO_DATES.includes(tab) ? 'Pull down to refresh.' : 'Try widening the date range.'}
          />
        ) : tab === 'performance' ? renderPerformance()
          : tab === 'pipeline' ? renderPipeline()
          : tab === 'aging' ? renderAging()
          : tab === 'lostDeals' ? renderLostDeals()
          : renderVisits()}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  title: { fontSize: rf(18), fontWeight: '700' },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: -6 },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateRowWide: { flexDirection: 'row', gap: 10, maxWidth: 420 },

  row: { padding: 12, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  flexMin: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: rf(13.5), fontWeight: '700' },
  rowSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
  rowVal: { fontSize: rf(14), fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { fontSize: rf(11.5), fontWeight: '500' },
  lossReason: { fontSize: rf(11.5), fontStyle: 'italic' },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, alignItems: 'center', padding: 14, gap: 3, borderRadius: 14 },
  summaryVal: { fontSize: rf(20), fontWeight: '800' },
  summaryLabel: { fontSize: rf(11), fontWeight: '600' },

  groupSection: { gap: 7 },
  groupTitle: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.4 },
  groupRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  groupName: { flex: 1, fontSize: rf(12.5), fontWeight: '600' },
  groupVal: { fontSize: rf(12), fontWeight: '500' },
});
