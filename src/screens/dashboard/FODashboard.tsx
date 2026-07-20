import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Clock, AlertCircle, CalendarCheck, ChevronRight, RotateCw } from 'lucide-react-native';
import { Icon, IconName, ICON_STROKE } from '../../components/common/Icon';
import { GradientBackground } from '../../components/common/GradientBackground';
import { Card } from '../../components/ui';
import { dashboardApi } from '../../api/dashboard';
import { weeklyPlanApi } from '../../api/weeklyPlan';
import { FoDashboardDto, DayPlan, LeadListDto } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatCurrency, formatRelativeDate } from '../../utils/formatting';
import { STAGE_LABELS, STAGE_COLORS } from '../../utils/constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

const pct = (actual: number, target: number) =>
  target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;

/** Bar colour by attainment — spec status palette (web uses green/amber/red). */
const attainColor = (p: number, T: AppTheme) =>
  p >= 80 ? T.success : p >= 50 ? T.warning : T.danger;

const hhmm = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const DASH = '—';
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Local calendar date. Web uses `toISOString().split('T')[0]`, which is UTC and
 * therefore names the wrong day for anyone east/west of GMT after the cutover —
 * the plan lookup must use the device's own day, so build the key by hand.
 */
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const mondayOf = (d: Date) => {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
};

/** Backend stores planData/managerEdits as a JSON string — tolerate both string and array. */
const parsePlan = (raw: any): DayPlan[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Always render a full Mon→Sun skeleton so the 7 day pills stay uniform. */
const buildWeek = (monday: Date, raw: any): DayPlan[] => {
  const parsed = parsePlan(raw);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = addDays(monday, i);
    const ymd = toYMD(dt);
    const match = parsed.find((x: any) => x?.date === ymd);
    return {
      date: ymd,
      dayOfWeek: DAY_ABBR[dt.getDay()],
      activities: Array.isArray(match?.activities) ? match!.activities : [],
    };
  });
};

/**
 * Panel body. On iPad the dashboard is a bounded, non-scrolling column, so each
 * panel scrolls INTERNALLY — that is what lets every row render (no `slice(0, 4)`)
 * without the outer column overflowing. On the phone the page itself scrolls, so
 * a nested scroller would fight the parent: plain View there.
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
      style={styles.panelScroll}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  ) : (
    <View style={contentStyle}>{children}</View>
  );

export const FODashboard = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  // Window size may ONLY decide orientation/device class. The permanent sidebar
  // (240 / 76) + topbar mean the window is NOT the content box, so it must never
  // be used to size anything — that mistake clipped this screen twice.
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [data, setData] = useState<FoDashboardDto | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [weekDays, setWeekDays] = useState<DayPlan[]>([]);

  const fetch = useCallback(async (p: 'today' | 'week' | 'month') => {
    try {
      const res = await dashboardApi.getFODashboard(p);
      setData(res.data);
      setLoadFailed(false);
    } catch {
      // A zeroed dashboard is indistinguishable from "you did nothing today",
      // so record the failure and render a real error state instead.
      setData(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /** Current week's approved plan — nullable payload, so guard before reading. */
  const fetchPlan = useCallback(async () => {
    try {
      const res = await weeklyPlanApi.getMy(toYMD(mondayOf(new Date())));
      const plan: any = res?.data;
      if (!plan || (plan.status !== 'Approved' && plan.status !== 'EditedByManager')) {
        setWeekDays([]);
        return;
      }
      setWeekDays(buildWeek(mondayOf(new Date()), plan.managerEdits || plan.planData));
    } catch {
      setWeekDays([]);
    }
  }, []);

  useEffect(() => { fetch(period); }, [period, fetch]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const reload = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch(period);
    fetchPlan();
  }, [fetch, fetchPlan, period]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch(period);
    fetchPlan();
  }, [fetch, fetchPlan, period]);

  // ── Period filter — shared by the loaded, loading and failed states ──
  const periodBar = (
    <View style={[styles.periodBar, { borderBottomColor: T.line }]}>
      <View style={[styles.segment, { backgroundColor: T.cardAlt }]}>
        {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as const).map(([p, label]) => {
          const on = period === p;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
              style={styles.segBtn}
            >
              {on && <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />}
              <Text style={[styles.segTxt, { color: on ? '#FFF' : T.sub }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* iPad has no page scroll, so pull-to-refresh is unreachable there. */}
      {wide && (
        <TouchableOpacity
          onPress={reload}
          activeOpacity={0.8}
          style={[styles.refreshBtn, { borderColor: T.lineStrong }]}
        >
          <RotateCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          <Text style={[styles.refreshTxt, { color: T.accent }]}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading dashboard..." />;

  // ── FIX: a failed load used to render a fully-zeroed dashboard ──
  if (loadFailed || !data) {
    return (
      <View style={[styles.root, { backgroundColor: T.bg }]}>
        {periodBar}
        <View style={styles.errWrap}>
          <View style={[styles.errCard, { backgroundColor: T.card, borderColor: T.line }]}>
            <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[styles.errTitle, { color: T.text }]}>Couldn't load dashboard</Text>
            <Text style={[styles.errTxt, { color: T.dim }]}>
              Check your connection and try again. No figures are shown because none could be read.
            </Text>
            <TouchableOpacity
              onPress={reload}
              activeOpacity={0.85}
              style={[styles.retryBtn, { borderColor: T.lineStrong }]}
            >
              <RotateCw size={15} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[styles.retryTxt, { color: T.accent }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const d = data;
  const revenuePct = pct(Number(d?.revenue ?? 0), Number(d?.revenueTarget ?? 0));
  const hours = Number(d?.hoursWorked ?? 0);
  const km = Number(d?.totalDistanceKm ?? 0);
  const rate = Number(d?.allowanceRatePerKm ?? 0);

  // ── KPI row — same six as the web, in the same order ──
  const kpis: { label: string; value: string; sub: string; icon: IconName; bar: number | null }[] = [
    {
      label: 'Month Revenue', icon: 'Performance',
      value: formatCurrency(Number(d?.revenue ?? 0)),
      sub: `${revenuePct}% of ${formatCurrency(Number(d?.revenueTarget ?? 0))}`,
      bar: revenuePct,
    },
    {
      label: 'Pipeline Leads', icon: 'Leads',
      value: String(d?.pipelineLeads ?? 0),
      sub: `Value: ${formatCurrency(Number(d?.pipelineValue ?? 0))}`,
      bar: null,
    },
    {
      label: 'Hours Today', icon: 'Tracking',
      value: `${hours}h`,
      sub: `${km} km traveled`,
      bar: pct(hours, 9),
    },
    {
      label: 'Allowance', icon: 'Allowance',
      value: `₹${d?.allowanceAmount ?? 0}`,
      sub: `${km} km × ₹${rate.toFixed(2)}`,
      bar: null,
    },
    {
      label: 'Visits This Week', icon: 'Calendar',
      value: String(d?.visitsThisWeek ?? 0),
      sub: `Target: ${d?.visitsTargetWeekly ?? 15}/week`,
      bar: pct(d?.visitsThisWeek ?? 0, d?.visitsTargetWeekly ?? 15),
    },
    {
      label: 'Demos This Month', icon: 'Demos',
      value: String(d?.demosThisMonth ?? 0),
      sub: `Target: ${d?.demosTargetMonthly ?? 8}/month`,
      bar: pct(d?.demosThisMonth ?? 0, d?.demosTargetMonthly ?? 8),
    },
  ];

  // ── Time breakdown (today) ──
  const inSchool = Number(d?.inSchoolMinutes ?? 0);
  const travelling = Number(d?.travellingMinutes ?? 0);
  const idle = Number(d?.idleMinutes ?? 0);
  const totalMins = inSchool + travelling + idle;
  const timeRows = [
    { label: 'In School', value: inSchool, color: T.success },
    { label: 'Travelling', value: travelling, color: T.info },
    { label: 'Idle', value: idle, color: T.warning },
  ];

  // ── Activity vs target (this month) ──
  const activityRows = [
    { label: 'Visits', actual: d?.visitsThisMonth ?? 0, target: d?.visitsTargetMonthly ?? 80 },
    { label: 'Demos', actual: d?.demosThisMonth ?? 0, target: d?.demosTargetMonthly ?? 28 },
    { label: 'Follow-ups', actual: d?.followUpsThisMonth ?? 0, target: d?.followUpsTargetMonthly ?? 40 },
    { label: 'Deals Won', actual: d?.dealsWon ?? 0, target: d?.dealsTargetMonthly ?? 5 },
  ];

  const funnel = d?.conversionFunnel ?? [];
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count));
  const aging = d?.agingDeals ?? [];
  const tasks = d?.todaysTasks ?? [];
  const hotLeads: LeadListDto[] = d?.hotLeads ?? [];

  const riskColor = (r: string) =>
    r === 'HIGH' ? T.danger : r === 'MEDIUM' ? T.warning : T.success;

  const empty = (msg: string) => <Text style={[styles.empty, { color: T.dim }]}>{msg}</Text>;

  const openLead = (id: number) => navigation.navigate('LeadDetail', { leadId: id });

  // ── Weekly plan strip data ──
  const todayYMD = toYMD(new Date());
  const tomorrowYMD = toYMD(addDays(new Date(), 1));
  const countFor = (ymd: string) =>
    weekDays.find(x => x.date === ymd)?.activities?.length ?? 0;
  const todayActs = countFor(todayYMD);
  const tomorrowActs = countFor(tomorrowYMD);

  // iPad: 6 KPIs across, then two bounded panel rows. The phone stacks and scrolls.
  const kpiW = wide ? `${100 / 6}%` : '50%';
  const quarter = wide ? '25%' : '100%';
  const half = wide ? '50%' : '100%';

  const cellPad = 5;
  const panelPad = 13;
  const listGap = 6;
  const rowPad = 9;
  const iconBox = 32;

  // iPad: a plain bounded View, so the column can never grow past the screen.
  // Phone portrait: a normal page ScrollView with pull-to-refresh.
  const Body: any = wide ? View : ScrollView;
  const bodyProps: any = wide
    ? { style: styles.bodyWide }
    : {
        style: styles.scroll,
        contentContainerStyle: { padding: 12, paddingBottom: insets.bottom + 16 },
        showsVerticalScrollIndicator: false,
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />
        ),
      };

  const panelRow: any = [styles.grid, wide && styles.rowWide, wide && styles.rowFlex];

  // A plain render function, not an inline component: an inline component type is
  // new on every render, which makes React unmount and remount the whole header.
  const panelHead = ({
    title,
    count,
    onAction,
    actionLabel,
  }: { title: string; count?: number; onAction?: () => void; actionLabel?: string }) => (
    <View style={styles.panelHead}>
      <Text numberOfLines={1} style={[styles.h3, { color: T.text }]}>{title}</Text>
      {count != null && count > 0 && (
        <View style={[styles.countChip, { backgroundColor: T.cardAlt }]}>
          <Text style={[styles.countTxt, { color: T.sub }]}>{count}</Text>
        </View>
      )}
      <View style={styles.spacer} />
      {!!onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} style={styles.linkBtn}>
          <Text style={[styles.link, { color: T.accent }]}>{actionLabel ?? 'View all'}</Text>
          <ChevronRight size={12} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
      )}
    </View>
  );

  const hotLeadRow = (l: LeadListDto) => {
    const sc = STAGE_COLORS[l.stage] ?? T.accent;
    const stageLabel = STAGE_LABELS[l.stage] ?? l.stage;
    const last = l.lastActivityDate ? formatRelativeDate(l.lastActivityDate) : DASH;

    if (wide) {
      return (
        <TouchableOpacity
          key={l.id}
          onPress={() => openLead(l.id)}
          activeOpacity={0.8}
          style={[styles.hlRow, { borderTopColor: T.line }]}
        >
          <View style={styles.colSchool}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: T.text }]}>{l.school}</Text>
            <Text numberOfLines={1} style={[styles.cellSub, { color: T.dim }]}>
              {l.city} · {l.board}
            </Text>
          </View>
          <View style={styles.colStage}>
            <View style={[styles.stageChip, { backgroundColor: withAlpha(sc, SOFT_TINT) }]}>
              <Text numberOfLines={1} style={[styles.stageTxt, { color: sc }]}>{stageLabel}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={[styles.cellVal, styles.colValue, { color: T.text }]}>
            {formatCurrency(Number(l.value))}
          </Text>
          <Text numberOfLines={1} style={[styles.cellSub, styles.colLast, { color: T.sub }]}>{last}</Text>
          <View style={styles.colAct}>
            <View style={[styles.actBtn, { backgroundColor: T.accentSoft }]}>
              <Text numberOfLines={1} style={[styles.actTxt, { color: T.accent }]}>Act</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Phone: same five fields, stacked instead of columned — nothing is dropped.
    return (
      <TouchableOpacity
        key={l.id}
        onPress={() => openLead(l.id)}
        activeOpacity={0.8}
        style={[styles.hlRowPhone, { padding: rowPad, borderColor: T.line }]}
      >
        <View style={styles.flexMin}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: T.text }]}>{l.school}</Text>
          <Text numberOfLines={1} style={[styles.cellSub, { color: T.dim }]}>
            {l.city} · {l.board} · {last}
          </Text>
          <View style={styles.hlMeta}>
            <View style={[styles.stageChip, { backgroundColor: withAlpha(sc, SOFT_TINT) }]}>
              <Text numberOfLines={1} style={[styles.stageTxt, { color: sc }]}>{stageLabel}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.cellVal, { color: T.text }]}>
              {formatCurrency(Number(l.value))}
            </Text>
          </View>
        </View>
        <View style={[styles.actBtn, { backgroundColor: T.accentSoft }]}>
          <Text numberOfLines={1} style={[styles.actTxt, { color: T.accent }]}>Act</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {periodBar}

      <Body {...bodyProps}>
        {/* ── KPI row — never shrinks, so a KPI card can never be clipped ── */}
        <View style={[styles.grid, wide && styles.kpiRowWide]}>
          {kpis.map(k => (
            <View key={k.label} style={[{ width: kpiW as any, padding: cellPad }, wide && styles.kpiCell]}>
              <Card style={[styles.kpi, { padding: panelPad }]}>
                <View style={[styles.kpiIcon, { backgroundColor: T.accentSoft, width: iconBox, height: iconBox }]}>
                  <Icon name={k.icon} size={Math.round(iconBox * 0.53)} color={T.accent} />
                </View>
                <Text numberOfLines={1} style={[styles.kpiValue, { color: T.text }]}>{k.value}</Text>
                <Text numberOfLines={2} style={[styles.kpiLabel, { color: T.sub }]}>{k.label}</Text>
                <Text numberOfLines={1} style={[styles.kpiSub, { color: T.dim }]}>{k.sub}</Text>
                {k.bar != null && (
                  <View style={[styles.track, { backgroundColor: T.cardAlt }]}>
                    <View style={{ width: `${k.bar}%`, height: '100%', borderRadius: 3, overflow: 'hidden' }}>
                      <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                    </View>
                  </View>
                )}
              </Card>
            </View>
          ))}
        </View>

        {/* ── Weekly plan strip — compact mirror of web; taps through to the full screen ── */}
        {weekDays.length > 0 && (
          <View style={[styles.stripCell, { padding: cellPad }]}>
            <Card style={styles.strip} onPress={() => navigation.navigate('WeeklyPlanScreen')}>
              <View style={styles.stripHead}>
                <CalendarCheck size={14} color={T.accent} strokeWidth={ICON_STROKE} />
                <Text numberOfLines={1} style={[styles.stripTitle, { color: T.text }]}>Weekly Plan</Text>
                <View style={[styles.planChip, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
                  <Text numberOfLines={1} style={[styles.planChipTxt, { color: T.accent }]}>
                    Today {todayActs}
                  </Text>
                </View>
                <View style={[styles.planChip, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
                  <Text numberOfLines={1} style={[styles.planChipTxt, { color: T.info }]}>
                    Tomorrow {tomorrowActs}
                  </Text>
                </View>
                <View style={styles.spacer} />
                <Text numberOfLines={1} style={[styles.link, { color: T.accent }]}>View Full Plan</Text>
                <ChevronRight size={12} color={T.accent} strokeWidth={ICON_STROKE} />
              </View>
              <View style={styles.stripDays}>
                {weekDays.map(day => {
                  const dt = new Date(`${day.date}T00:00:00`);
                  const isToday = day.date === todayYMD;
                  const isTomorrow = day.date === tomorrowYMD;
                  const n = day.activities?.length ?? 0;
                  return (
                    <View
                      key={day.date}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isToday ? withAlpha(T.accent, 0.18) : T.cardAlt,
                          borderColor: isToday ? T.accent : isTomorrow ? withAlpha(T.info, 0.5) : 'transparent',
                        },
                        day.date < todayYMD && styles.dayPast,
                      ]}
                    >
                      <Text numberOfLines={1} style={[styles.dayName, { color: isToday ? T.accent : T.dim }]}>
                        {DAY_ABBR[dt.getDay()]}
                      </Text>
                      <Text numberOfLines={1} style={[styles.dayNum, { color: isToday ? T.accent : T.text }]}>
                        {dt.getDate()}
                      </Text>
                      <View style={styles.dots}>
                        {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: isToday ? T.accent : T.info }]} />
                        ))}
                        {n > 3 && (
                          <Text numberOfLines={1} style={[styles.dotMore, { color: T.dim }]}>+{n - 3}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ── Row 1: Time Breakdown · Activity vs Target · Conversion Funnel · Pipeline Summary ── */}
        <View style={panelRow}>
          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {panelHead({ title: 'Time Breakdown (Today)' })}
              <PanelBody wide={wide}>
                {totalMins > 0 ? (
                  <View style={styles.timeRow}>
                    <View style={{ flex: 1, gap: listGap + 4 }}>
                      {timeRows.map(r => (
                        <View key={r.label}>
                          <View style={styles.between}>
                            <Text numberOfLines={1} style={[styles.rowLbl, styles.flexMin, { color: T.sub }]}>{r.label}</Text>
                            <Text numberOfLines={1} style={[styles.rowVal, styles.noShrink, { color: r.color }]}>{Math.round(r.value)} min</Text>
                          </View>
                          <View style={[styles.track3, { backgroundColor: T.cardAlt }]}>
                            <View style={{ width: `${(r.value / totalMins) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: r.color }} />
                          </View>
                        </View>
                      ))}
                    </View>
                    <View style={styles.noShrink}>
                      <Text numberOfLines={1} style={[styles.big, { color: T.text }]}>{hours}h</Text>
                      <Text numberOfLines={1} style={[styles.cellSub, styles.centerTxt, { color: T.dim }]}>Total</Text>
                    </View>
                  </View>
                ) : empty('No tracking session today')}
              </PanelBody>
            </Card>
          </View>

          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {panelHead({ title: 'Activity vs Target (This Month)' })}
              <PanelBody wide={wide} contentStyle={{ gap: listGap + 4 }}>
                {activityRows.map(a => {
                  const p = pct(a.actual, a.target);
                  return (
                    <View key={a.label}>
                      <View style={styles.between}>
                        <Text numberOfLines={1} style={[styles.rowLbl, styles.flexMin, { color: T.sub }]}>{a.label}</Text>
                        <Text numberOfLines={1} style={[styles.rowVal, styles.noShrink, { color: T.text }]}>
                          {a.actual} <Text style={{ color: T.dim }}>/ {a.target}</Text>
                        </Text>
                      </View>
                      <View style={[styles.track3, { backgroundColor: T.cardAlt }]}>
                        <View style={{ width: `${p}%`, height: '100%', borderRadius: 3, backgroundColor: attainColor(p, T) }} />
                      </View>
                    </View>
                  );
                })}
              </PanelBody>
            </Card>
          </View>

          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {panelHead({ title: 'Conversion Funnel' })}
              <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
                {funnel.length ? (
                  funnel.map(f => (
                    <View key={f.stage} style={styles.funnelRow}>
                      <Text numberOfLines={2} style={[styles.funnelLbl, { color: T.sub }]}>{f.stage}</Text>
                      <View style={[styles.funnelTrack, { backgroundColor: T.cardAlt }]}>
                        <View style={{ width: `${(f.count / maxFunnel) * 100}%`, height: '100%', borderRadius: 7, overflow: 'hidden', justifyContent: 'center' }}>
                          <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
                          {f.count > 0 && <Text style={styles.funnelCount}>{f.count}</Text>}
                        </View>
                      </View>
                    </View>
                  ))
                ) : empty('No leads yet')}
              </PanelBody>
            </Card>
          </View>

          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {panelHead({ title: 'Pipeline Summary' })}
              <PanelBody wide={wide}>
                {[
                  { k: 'Total Pipeline Leads', v: String(d?.pipelineLeads ?? 0), c: T.text },
                  { k: 'Pipeline Value', v: formatCurrency(Number(d?.pipelineValue ?? 0)), c: T.accent },
                  { k: 'Deals Won', v: String(d?.dealsWon ?? 0), c: T.success },
                  { k: 'Deals Lost', v: String(d?.dealsLost ?? 0), c: T.danger },
                ].map((r, i, arr) => (
                  <View
                    key={r.k}
                    style={[
                      styles.sumRow,
                      i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line },
                    ]}
                  >
                    <Text numberOfLines={1} style={[styles.rowLbl, styles.flexMin, { color: T.sub }]}>{r.k}</Text>
                    <Text numberOfLines={1} style={[styles.sumVal, styles.noShrink, { color: r.c }]}>{r.v}</Text>
                  </View>
                ))}
              </PanelBody>
            </Card>
          </View>
        </View>

        {/* ── Row 2: Deal Aging · Today's Tasks · Hot Leads ── */}
        <View style={panelRow}>
          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {/* Every deal renders — the panel scrolls rather than truncating to 4. */}
              {panelHead({ title: 'Deal Aging', count: aging.length })}
              <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
                {aging.length ? (
                  aging.map((a, i) => {
                    const c = riskColor(a.risk);
                    return (
                      <View
                        key={i}
                        style={[
                          styles.agingRow,
                          { padding: rowPad, backgroundColor: withAlpha(c, 0.08), borderColor: withAlpha(c, 0.2) },
                        ]}
                      >
                        <View style={styles.flexMin}>
                          <Text numberOfLines={1} style={[styles.rowTitle, { color: T.text }]}>{a.school}</Text>
                          <Text numberOfLines={1} style={[styles.cellSub, { color: T.sub }]}>
                            {a.stage} · {formatCurrency(Number(a.value))}
                          </Text>
                        </View>
                        <View style={[styles.noShrink, { alignItems: 'flex-end' }]}>
                          <Text numberOfLines={1} style={[styles.rowVal, { color: c }]}>{a.daysInStage}d</Text>
                          <View style={[styles.riskChip, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
                            <Text numberOfLines={1} style={[styles.riskTxt, { color: c }]}>{a.risk}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : empty('No pending deals')}
              </PanelBody>
            </Card>
          </View>

          <View style={{ width: quarter as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {/* Every task renders — the panel scrolls rather than truncating to 4. */}
              {panelHead({ title: "Today's Tasks", count: tasks.length })}
              <PanelBody wide={wide} contentStyle={{ gap: listGap }}>
                {tasks.length ? (
                  tasks.map(t => (
                    <View key={t.id} style={[styles.taskRow, { padding: rowPad, borderColor: T.line }]}>
                      {t.isDone
                        ? <CheckCircle size={17} color={T.success} strokeWidth={1.9} />
                        : <Clock size={17} color={T.warning} strokeWidth={1.9} />}
                      <View style={styles.flexMin}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowTitle,
                            { color: t.isDone ? T.dim : T.text },
                            t.isDone && { textDecorationLine: 'line-through' },
                          ]}
                        >
                          {t.school}
                        </Text>
                        <Text numberOfLines={1} style={[styles.cellSub, { color: T.dim }]}>
                          {hhmm(t.scheduledTime)} · {t.type}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : empty('No tasks scheduled for today.')}
              </PanelBody>
            </Card>
          </View>

          <View style={{ width: half as any, padding: cellPad }}>
            <Card style={[styles.panel, { padding: panelPad }, !wide && styles.panelPhone]}>
              {panelHead({
                title: 'Hot Leads — Immediate Action',
                count: hotLeads.length,
                onAction: () => navigation.navigate('LeadsList'),
                actionLabel: 'View all',
              })}
              {wide && hotLeads.length > 0 && (
                <View style={styles.hlHead}>
                  <Text numberOfLines={1} style={[styles.th, styles.colSchool, { color: T.dim }]}>School</Text>
                  <Text numberOfLines={1} style={[styles.th, styles.colStage, { color: T.dim }]}>Stage</Text>
                  <Text numberOfLines={1} style={[styles.th, styles.colValue, { color: T.dim }]}>Value</Text>
                  <Text numberOfLines={1} style={[styles.th, styles.colLast, { color: T.dim }]}>Activity</Text>
                  <View style={styles.colAct} />
                </View>
              )}
              <PanelBody wide={wide} contentStyle={wide ? undefined : { gap: listGap }}>
                {hotLeads.length ? hotLeads.map(hotLeadRow) : empty('No hot leads right now')}
              </PanelBody>
            </Card>
          </View>
        </View>
      </Body>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  // iPad: the whole dashboard is one bounded, non-scrolling column. `minHeight: 0`
  // lets the flexing panel rows actually shrink instead of pushing past the screen.
  bodyWide: { flex: 1, minHeight: 0, padding: 12 },

  periodBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, alignSelf: 'flex-start' },
  segBtn: { height: 30, borderRadius: 9, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  segTxt: { fontSize: 12, fontWeight: '700' },
  refreshBtn: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 11, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth,
  },
  refreshTxt: { fontSize: rf(11.5), fontWeight: '700' },

  // ── Error state ──
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

  // alignItems:stretch + flex:1 on the card => every card in a line is the
  // same height as the tallest one (funnel/time-breakdown differ in content).
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  /**
   * iPad: the six KPIs are exactly one line and must never be squeezed.
   *
   * The height is DEFINITE and deliberate. `grid` is `alignItems:'stretch'` and the
   * card inside each cell is `flex:1`, so with a height-less cell nothing
   * establishes an intrinsic height — the row collapsed to its minimum and clipped
   * the value, label and bar. Measured content at tablet rf() scale:
   * pad 13 + icon 32 + 8 + value ~25 + 3 + label ~14 (×2 lines) + 2 + sub ~13
   * + 8 + bar 5 + pad 13 ≈ 150.
   */
  kpiRowWide: { flexWrap: 'nowrap', flexShrink: 0, height: 150 },
  rowWide: { flexWrap: 'nowrap' },
  // The two panel rows share whatever is left after the KPI row and the strip.
  rowFlex: { flex: 1, minHeight: 0 },

  // KPI card — spec: radius 16 · pad 13–14 · icon chip 32 (soft tint) · value 21/800 · label 12/600 · sub 10.5 · bar 5
  kpi: { flex: 1 },
  kpiCell: { height: '100%' },
  kpiIcon: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: rf(21), fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  kpiLabel: { fontSize: rf(12), fontWeight: '600', marginTop: 3 },
  kpiSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 2, marginBottom: 8 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 'auto', marginBottom: 0 },
  track3: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },

  // ── Weekly plan strip ──
  stripCell: { flexShrink: 0, width: '100%' },
  strip: { padding: 9 },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripTitle: { fontSize: rf(12.5), fontWeight: '700', flexShrink: 1, minWidth: 0 },
  planChip: { flexShrink: 0, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  planChipTxt: { fontSize: rf(9.5), fontWeight: '700' },
  stripDays: { flexDirection: 'row', gap: 6, marginTop: 7 },
  dayPill: {
    flex: 1, minWidth: 0, borderRadius: 10, paddingVertical: 4,
    alignItems: 'center', borderWidth: 1,
  },
  dayPast: { opacity: 0.55 },
  dayName: { fontSize: rf(8.5), fontWeight: '700', textAlign: 'center' },
  dayNum: { fontSize: rf(13), fontWeight: '800', textAlign: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 7, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotMore: { fontSize: rf(7.5), fontWeight: '700' },

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

  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  flexMin: { flex: 1, minWidth: 0 },
  noShrink: { flexShrink: 0 },
  centerTxt: { textAlign: 'center' },
  rowLbl: { fontSize: rf(11.5), fontWeight: '600' },
  rowVal: { fontSize: rf(11.5), fontWeight: '700' },
  rowTitle: { fontSize: rf(12.5), fontWeight: '600' },
  cellSub: { fontSize: rf(10.5), fontWeight: '400', marginTop: 1 },
  cellVal: { fontSize: rf(11.5), fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  big: { fontSize: rf(26), fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' },

  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  funnelLbl: { fontSize: rf(11), fontWeight: '500', width: 80, flexShrink: 0 },
  funnelTrack: { flex: 1, minWidth: 0, height: 22, borderRadius: 7, overflow: 'hidden' },
  funnelCount: { fontSize: rf(10), fontWeight: '700', color: '#FFF', marginLeft: 7 },

  agingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  riskChip: { height: 16, paddingHorizontal: 6, borderRadius: 8, justifyContent: 'center', marginTop: 2 },
  riskTxt: { fontSize: rf(9), fontWeight: '700' },

  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },

  // ── Hot leads table. Header and body cells share these exact widths, and
  // every fixed cell is flexShrink: 0 so nothing paints over its neighbour.
  hlHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 5 },
  th: { fontSize: rf(9.5), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  hlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth,
  },
  hlRowPhone: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  hlMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  colSchool: { flex: 1, minWidth: 0 },
  colStage: { width: 78, flexShrink: 0 },
  colValue: { width: 70, flexShrink: 0 },
  colLast: { width: 56, flexShrink: 0 },
  colAct: { width: 48, flexShrink: 0 },
  stageChip: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  stageTxt: { fontSize: rf(9), fontWeight: '700' },
  actBtn: { flexShrink: 0, height: 24, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actTxt: { fontSize: rf(10.5), fontWeight: '700' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingVertical: 11 },
  sumVal: { fontSize: rf(15), fontWeight: '800', letterSpacing: -0.3 },

  empty: { fontSize: rf(12.5), textAlign: 'center', paddingVertical: 28 },
});
