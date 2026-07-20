import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Image, Linking, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronDown, ChevronUp, Users, Award, TrendingUp, Activity as ActivityIcon,
  Camera, Clock, AlertCircle, BarChart3,
} from 'lucide-react-native';

import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { apiClient } from '../../api/client';
import { dashboardApi } from '../../api/dashboard';
import { UserPerformanceDto, ActivityDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, StatTile } from '../../components/ui';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ICON_STROKE } from '../../components/common/Icon';
import { StatusBadge, ListCard, Avatar, Pagination } from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { formatCurrency } from '../../utils/formatting';
import { API_BASE_URL } from '../../utils/constants';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Performance Tracking — web parity with
 * Sales_CRM_Web/src/pages/common/PerformanceTracking.jsx.
 *
 * Verified against the controllers (literal `return Ok(...)`):
 *   DashboardController.GetPerformanceTracking  [HttpGet("performance-tracking")]
 *     → return Ok(ApiResponse<List<UserPerformanceDto>>.Ok(performance));
 *   ActivitiesController.GetTeamActivities      [HttpGet("team/{foId}")]
 *     → return Ok(ApiResponse<List<ActivityDto>>.Ok(result));
 * apiClient unwraps the {success,data,message} envelope, so `res.data` is the list
 * itself — NOT a paginated `{items,totalCount}` object. Never assume otherwise.
 *
 * `src/api/activities.ts` has no getTeamActivities helper, so the team feed calls
 * the verified route through apiClient directly (see note in the report).
 */

const PAGE_SIZE = 10;
const DASH = '—';
const GUTTER = 12;

/**
 * Table geometry — fixed point widths, NOT percentages and NOT derived from
 * useWindowDimensions(). The sidebar (240 expanded / 76 rail) + topbar mean the
 * window is not the content box, so the table sizes itself from its own content
 * and the card scrolls it horizontally when the content box is narrower.
 *
 * Each width is measured against the widest REAL content the column can hold at
 * the tablet type scale (rf() caps at ×1.2 on tablets, so th = 13px uppercase
 * with 0.4 tracking ≈ 8.4px/char, td = 15px ≈ 7.3px/char, badge = 13px ≈ 7px/char
 * plus 20px of horizontal padding):
 *   NAME     36 avatar + 10 gap + 130 for a two-word name ("Bhavya Neema" ≈ 96)
 *   ROLE     badge "SCA" ≈ 43 · header "ROLE" ≈ 34
 *   ZONE     header "ZONE / REGION" ≈ 114 on ONE line (the widest of the three
 *            variants) — values longer than that ellipsise
 *   LEADS    header "LEADS" ≈ 44
 *   WON      value "128 / 43 lost" ≈ 95
 *   WIN RATE header "WIN RATE" ≈ 70
 *   REVENUE  header "REVENUE" ≈ 62 · value "₹12.5Cr" ≈ 58 (formatCurrency compacts)
 *   TARGET % header "TARGET %" ≈ 70 · bar ≥ 60 + gap 6 + "100%" ≈ 32
 *   ACTIVITIES header "ACTIVITIES" ≈ 88 on ONE line · value "128V / 45D" ≈ 66
 *   STATUS   badge "Needs Attention" ≈ 125 (the value the backend actually emits)
 */
const COL_GAP = 10;
const COL_PAD = 16;
const COL = {
  name: 176, role: 50, zone: 132, leads: 56, won: 100,
  win: 78, rev: 80, target: 112, acts: 98, status: 132, chev: 18,
};
const COL_KEYS = Object.keys(COL) as (keyof typeof COL)[];
/** Minimum width the table needs to render every column un-truncated. */
const TABLE_W =
  COL_KEYS.reduce((a, k) => a + COL[k], 0) + COL_GAP * (COL_KEYS.length - 1) + COL_PAD * 2;

const STAGE_LABELS: Record<string, string> = {
  NewLead: 'New', Contacted: 'Contacted', Qualified: 'Qualified',
  DemoStage: 'Demo', DemoDone: 'Demo Done', ProposalSent: 'Proposal',
  Negotiation: 'Negotiation', ContractSent: 'Contract', Won: 'Won', Lost: 'Lost',
};

/**
 * DashboardService.cs:779 — `targetPct >= 70 ? "On Track" : targetPct >= 35 ?
 * "At Risk" : "Needs Attention"` — so the ladder is exactly three tiers.
 * `theme/colors.getStatusColor` has no 'Needs Attention' case (it would fall
 * through to grey), hence this local map onto spec tokens. Adjacent tiers never
 * share a hue: success → warning → danger. 'Underperforming' is a legacy alias
 * for the same bottom tier as 'Needs Attention', not a fourth tier.
 */
const statusColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'On Track': return T.success;
    case 'At Risk': return T.warning;
    case 'Underperforming':
    case 'Needs Attention': return T.danger;
    default: return T.sub;
  }
};
/** Web ramps, on spec tokens. Adjacent tiers never share a hue. */
const winRateColor = (T: AppTheme, v: number) => (v >= 50 ? T.success : v >= 25 ? T.warning : T.danger);
const targetPctColor = (T: AppTheme, v: number) => (v >= 70 ? T.success : v >= 35 ? T.warning : T.danger);
const activityTypeColor = (T: AppTheme, t?: string) =>
  t === 'Visit' ? T.info : t === 'Demo' ? T.accent : t === 'FollowUp' ? T.warning : T.sub;
const outcomeColor = (T: AppTheme, o?: string) =>
  o === 'Positive' ? T.success : o === 'Negative' ? T.danger : T.sub;
const interestColor = (T: AppTheme, i?: string) =>
  i === 'High' ? T.success : i === 'Medium' ? T.warning : T.danger;

const fmtTime = (d?: string) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : DASH;
const fmtDay = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : DASH;

/** Photos come back as server-relative paths; the API base carries a trailing /api. */
const photoSrc = (url: string) =>
  url.startsWith('http') ? url : `${String(API_BASE_URL || '').replace(/\/api\/?$/, '')}${url}`;

const initialsOf = (name?: string, avatar?: string) =>
  avatar || (name || '?').trim().charAt(0).toUpperCase() || '?';

// ─── Recent activity row (managers only — matches web) ────────────────────────
const ActivityRow = ({ act }: { act: ActivityDto }) => {
  const T = useAppTheme();
  const showPlaceholder = !act.photoUrl && (act.type === 'Visit' || act.type === 'FollowUp');
  return (
    <View style={[s.actRow, { backgroundColor: T.card, borderColor: T.line }]}>
      {!!act.photoUrl && (
        <TouchableOpacity activeOpacity={0.8} onPress={() => Linking.openURL(photoSrc(act.photoUrl!))}>
          <Image source={{ uri: photoSrc(act.photoUrl) }} style={[s.actPhoto, { borderColor: T.line }]} />
        </TouchableOpacity>
      )}
      {showPlaceholder && (
        <View style={[s.actPhoto, s.actPhotoEmpty, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
          <Camera size={16} color={T.dim} strokeWidth={ICON_STROKE} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={s.actTop}>
          <StatusBadge label={act.type} color={activityTypeColor(T, act.type)} />
          <Text style={[s.actOutcome, { color: outcomeColor(T, act.outcome) }]}>{act.outcome}</Text>
          <Text style={[s.actDate, { color: T.dim }]}>{fmtDay(act.date)}</Text>
        </View>
        <Text style={[s.actSchool, { color: T.text }]} numberOfLines={1}>{act.school || DASH}</Text>
        {!!act.personMet && (
          <Text style={[s.actMeta, { color: T.dim }]} numberOfLines={1}>
            Met: {act.personMet}{act.personDesignation ? ` (${act.personDesignation})` : ''}
          </Text>
        )}
        {!!act.notes && (
          <Text style={[s.actMeta, { color: T.dim }]} numberOfLines={1}>{act.notes}</Text>
        )}
        <View style={s.actFoot}>
          {!!act.timeIn && (
            <View style={s.actTime}>
              <Clock size={10} color={T.dim} strokeWidth={ICON_STROKE} />
              <Text style={[s.actMeta, { color: T.dim }]}>{fmtTime(act.timeIn)} – {fmtTime(act.timeOut)}</Text>
            </View>
          )}
          {!!act.interestLevel && (
            <Text style={[s.actInterest, { color: interestColor(T, act.interestLevel) }]}>
              Interest: {act.interestLevel}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export const PerformanceScreen = (_: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the table — never a card grid. Phones get list rows. */
  const table = isTabletDevice;

  const role = user?.role || 'FO';
  /**
   * FO reaches this screen via the drawer's AppTopbar (title + hamburger already
   * rendered). The manager drawer registers "Performance" WITHOUT `withHeader`, so
   * only there does this screen have to supply its own title/menu.
   */
  const ownHeader = role !== 'FO';

  const [data, setData] = useState<UserPerformanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [acts, setActs] = useState<Record<number, ActivityDto[]>>({});
  const [actsLoading, setActsLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await dashboardApi.getPerformanceTracking();
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Web lazy-loads the activity feed on first expand, and only for managers.
  const handleExpand = useCallback(async (userId: number) => {
    if (expanded === userId) { setExpanded(null); return; }
    setExpanded(userId);
    if (acts[userId] || role === 'FO') return;
    setActsLoading(userId);
    try {
      const res = await apiClient.get<ActivityDto[]>(`/activities/team/${userId}`);
      setActs(prev => ({ ...prev, [userId]: Array.isArray(res.data) ? res.data : [] }));
    } catch {
      setActs(prev => ({ ...prev, [userId]: [] }));
    } finally {
      setActsLoading(null);
    }
  }, [expanded, acts, role]);

  // Web sums every row it received — including the FO's own single row.
  const totals = useMemo(() => data.reduce((a, u) => ({
    totalLeads: a.totalLeads + (u.totalLeads || 0),
    approvedDeals: a.approvedDeals + (u.approvedDeals || 0),
    revenue: a.revenue + (u.revenue || 0),
    totalActivities: a.totalActivities + (u.totalActivities || 0),
  }), { totalLeads: 0, approvedDeals: 0, revenue: 0, totalActivities: 0 }), [data]);

  const subtitle =
    role === 'FO' ? 'Your performance overview'
    : role === 'ZH' ? `Field Officers in your zone (${data.length})`
    : role === 'RH' ? `Zonal Heads in your region (${data.length})`
    : `Regional Heads (${data.length})`;

  const sectionTitle =
    role === 'FO' ? 'Your Stats'
    : role === 'ZH' ? 'Field Officer Performance'
    : role === 'RH' ? 'Zonal Head Performance'
    : 'Regional Head Performance';

  const zoneHeader = role === 'SH' ? 'Region' : role === 'RH' ? 'Zone' : 'Zone / Region';
  const zoneCell = (u: UserPerformanceDto) => {
    const base = (u.role === 'RH' ? u.region : u.zone) || DASH;
    return u.role === 'FO' && u.region ? `${base} / ${u.region}` : base;
  };

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paged = useMemo(
    () => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data, page],
  );

  const kpiW = wide ? '25%' : '50%';
  const kpis = [
    { label: 'Total Leads', value: String(totals.totalLeads), icon: <Users size={15} color={T.info} strokeWidth={ICON_STROKE} />, tint: T.info },
    { label: 'Deals Won', value: String(totals.approvedDeals), icon: <Award size={15} color={T.success} strokeWidth={ICON_STROKE} />, tint: T.success },
    { label: 'Revenue', value: formatCurrency(totals.revenue), icon: <TrendingUp size={15} color={T.accent} strokeWidth={ICON_STROKE} />, tint: T.accent },
    { label: 'Activities', value: String(totals.totalActivities), icon: <ActivityIcon size={15} color={T.warning} strokeWidth={ICON_STROKE} />, tint: T.warning },
  ];

  // ── expanded detail (shared by table + phone rows) ──
  const renderExpanded = (u: UserPerformanceDto) => (
    <View style={[s.exp, { borderTopColor: T.line, backgroundColor: T.cardAlt }]}>
      <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
        {[
          { label: 'Active Leads', val: String(u.activeLeads), color: T.text },
          { label: 'Total Deals', val: String(u.totalDeals), color: T.text },
          { label: 'Approved Deals', val: String(u.approvedDeals), color: T.success },
          { label: 'Visits (Month)', val: String(u.visitsThisMonth), color: T.text },
          { label: 'Demos (Month)', val: String(u.demosThisMonth), color: T.text },
        ].map(x => (
          <View key={x.label} style={{ width: wide ? '20%' : '50%', padding: GUTTER / 2 }}>
            <Text style={[s.expLabel, { color: T.dim }]} numberOfLines={1}>{x.label}</Text>
            <Text style={[s.expVal, { color: x.color }]} numberOfLines={1}>{x.val}</Text>
          </View>
        ))}
      </View>

      {!!u.leadsByStage && Object.keys(u.leadsByStage).length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[s.expLabel, { color: T.dim, marginBottom: 8 }]}>Leads by Stage</Text>
          <View style={s.stageWrap}>
            {Object.entries(u.leadsByStage).map(([stage, count]) => (
              <View key={stage} style={[s.stageChip, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.stageTxt, { color: T.sub }]}>
                  {STAGE_LABELS[stage] || stage}: <Text style={{ fontWeight: '800', color: T.text }}>{count}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {role !== 'FO' && (
        <View style={[s.actsBlock, { borderTopColor: T.line }]}>
          <Text style={[s.expLabel, { color: T.dim, marginBottom: 10 }]}>Recent Activities (Last 30 Days)</Text>
          {actsLoading === u.userId ? (
            <ActivityIndicator color={T.accent} style={{ marginVertical: 16 }} />
          ) : (acts[u.userId] || []).length === 0 ? (
            <Text style={[s.actsEmpty, { color: T.dim }]}>No activities found.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {(acts[u.userId] || []).map(a => <ActivityRow key={a.id} act={a} />)}
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );

  // ── table (tablet) ──
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tblHead, { borderBottomColor: T.line }]}>
        <Text style={[s.tblHeadTxt, { color: T.text }]}>{sectionTitle}</Text>
      </View>

      {/* The table sizes to its content and scrolls INSIDE the card, so the page
          itself never scrolls sideways. contentContainer flexGrow + cName
          flexGrow let the table fill a content box wider than TABLE_W. */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        contentContainerStyle={s.tblScroll}
      >
        <View style={s.tblBody}>
          <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
            <Text style={[s.th, { color: T.dim }, s.cName]} numberOfLines={1}>Name</Text>
            <Text style={[s.th, { color: T.dim }, s.cRole]} numberOfLines={1}>Role</Text>
            <Text style={[s.th, { color: T.dim }, s.cZone]} numberOfLines={1}>{zoneHeader}</Text>
            <Text style={[s.th, { color: T.dim }, s.cLeads]} numberOfLines={1}>Leads</Text>
            <Text style={[s.th, { color: T.dim }, s.cWon]} numberOfLines={1}>Won</Text>
            <Text style={[s.th, { color: T.dim }, s.cWin]} numberOfLines={1}>Win Rate</Text>
            <Text style={[s.th, { color: T.dim }, s.cRev]} numberOfLines={1}>Revenue</Text>
            <Text style={[s.th, { color: T.dim }, s.cTarget]} numberOfLines={1}>Target %</Text>
            <Text style={[s.th, { color: T.dim }, s.cActs]} numberOfLines={1}>Activities</Text>
            <Text style={[s.th, { color: T.dim }, s.cStatus]} numberOfLines={1}>Status</Text>
            {/* spacer for the expand chevron — a View, since alignItems does nothing to Text */}
            <View style={s.cChevron} />
          </View>

          {paged.map(u => (
            <View key={u.userId}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleExpand(u.userId)}
                style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
              >
                <View style={[s.cName, s.nameCell]}>
                  {/* Avatar is a fixed 36pt View and RN's default flexShrink is 0,
                      so only the name gives ground — it can never push a neighbour. */}
                  <Avatar initials={initialsOf(u.name, u.avatar)} />
                  <Text style={[s.tdName, s.nameTxt, { color: T.text }]} numberOfLines={1}>{u.name}</Text>
                </View>
                <View style={s.cRole}>
                  <StatusBadge label={u.role} color={T.sub} />
                </View>
                <Text style={[s.td, { color: T.sub }, s.cZone]} numberOfLines={1}>{zoneCell(u)}</Text>
                <Text style={[s.tdStrong, { color: T.text }, s.cLeads]} numberOfLines={1}>{u.totalLeads}</Text>
                <Text style={[s.td, s.cWon]} numberOfLines={1}>
                  <Text style={{ color: T.success, fontWeight: '700' }}>{u.wonLeads}</Text>
                  <Text style={{ color: T.dim }}> / {u.lostLeads} lost</Text>
                </Text>
                <Text style={[s.tdStrong, { color: winRateColor(T, u.winRate) }, s.cWin]} numberOfLines={1}>{u.winRate}%</Text>
                <Text style={[s.tdStrong, { color: T.text }, s.cRev]} numberOfLines={1}>{formatCurrency(u.revenue)}</Text>
                <View style={[s.cTarget, s.targetCell]}>
                  <ProgressBar
                    value={u.targetPct}
                    height={7}
                    color={targetPctColor(T, u.targetPct)}
                    trackColor={T.line}
                    style={{ flex: 1 }}
                  />
                  <Text style={[s.tdSmall, s.targetTxt, { color: T.text }]} numberOfLines={1}>{u.targetPct}%</Text>
                </View>
                <View style={s.cActs}>
                  <Text style={[s.tdStrong, { color: T.text }]} numberOfLines={1}>{u.totalActivities}</Text>
                  <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{u.visitsThisMonth}V / {u.demosThisMonth}D</Text>
                </View>
                <View style={s.cStatus}>
                  <StatusBadge label={u.status} color={statusColor(T, u.status)} />
                </View>
                <View style={s.cChevron}>
                  {expanded === u.userId
                    ? <ChevronUp size={14} color={T.dim} strokeWidth={ICON_STROKE} />
                    : <ChevronDown size={14} color={T.dim} strokeWidth={ICON_STROKE} />}
                </View>
              </TouchableOpacity>
              {expanded === u.userId && renderExpanded(u)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {paged.map(u => (
        <View key={u.userId}>
          <ListCard onPress={() => handleExpand(u.userId)} style={expanded === u.userId ? s.rowOpen : undefined}>
            <Avatar initials={initialsOf(u.name, u.avatar)} />
            <View style={{ flex: 1 }}>
              <View style={s.rowTop}>
                <Text style={[s.tdName, s.nameTxt, { color: T.text }]} numberOfLines={1}>{u.name}</Text>
                <StatusBadge label={u.role} color={T.sub} />
              </View>
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{zoneCell(u)}</Text>
              <View style={s.rowStats}>
                <Text style={[s.tdSmall, { color: T.sub }]}>{formatCurrency(u.revenue)}</Text>
                <Text style={[s.tdSmall, { color: T.dim }]}>•</Text>
                <Text style={[s.tdSmall, { color: T.sub }]}>{u.totalLeads} leads</Text>
                <Text style={[s.tdSmall, { color: T.dim }]}>•</Text>
                <Text style={[s.tdSmall, { color: T.success }]}>{u.wonLeads} won</Text>
                <Text style={[s.tdSmall, { color: T.dim }]}>•</Text>
                <Text style={[s.tdSmall, { color: winRateColor(T, u.winRate) }]}>{u.winRate}%</Text>
              </View>
              <View style={s.rowTarget}>
                <ProgressBar
                  value={u.targetPct}
                  height={5}
                  color={targetPctColor(T, u.targetPct)}
                  trackColor={T.line}
                  style={{ flex: 1 }}
                />
                <Text style={[s.tdSmall, { color: T.text }]}>{u.targetPct}%</Text>
              </View>
            </View>
            <View style={s.rowRight}>
              <StatusBadge label={u.status} color={statusColor(T, u.status)} />
              {expanded === u.userId
                ? <ChevronUp size={16} color={T.dim} strokeWidth={ICON_STROKE} />
                : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
            </View>
          </ListCard>
          {expanded === u.userId && (
            <Card padded={false} style={s.rowExpCard}>{renderExpanded(u)}</Card>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {ownHeader ? (
          <View style={s.headerLeft}>
            <DrawerMenuButton color={T.text} />
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: T.text }]}>Performance Tracking</Text>
              <Text style={[s.subtitle, { color: T.sub }]}>{subtitle}</Text>
            </View>
          </View>
        ) : (
          <Text style={[s.subtitle, { color: T.sub }]}>{subtitle}</Text>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : (
          <>
            <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
              {kpis.map(k => (
                <View key={k.label} style={{ width: kpiW as any, padding: GUTTER / 2 }}>
                  <StatTile label={k.label} value={k.value} icon={k.icon} tint={k.tint} style={{ flex: 1 }} />
                </View>
              ))}
            </View>

            {loadFailed ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
                <Text style={[s.emptyTitle, { color: T.text }]}>Couldn't load performance</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>Check your connection and pull down to retry.</Text>
              </View>
            ) : data.length === 0 ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <BarChart3 size={34} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[s.emptyTitle, { color: T.text }]}>No data available</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>
                  Performance appears once leads and activities are recorded for this period.
                </Text>
              </View>
            ) : (
              <>
                {!table && <Text style={[s.sectionTitle, { color: T.text }]}>{sectionTitle}</Text>}
                {table ? renderTable() : renderRows()}
                {totalPages > 1 && (
                  <View style={s.pgRow}>
                    <Text style={[s.count, { color: T.dim }]}>
                      Showing {(page - 1) * PAGE_SIZE + 1}{DASH}{Math.min(page * PAGE_SIZE, data.length)} of {data.length}
                    </Text>
                    <Pagination page={page} pageCount={totalPages} onChange={setPage} />
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour is applied inline from the theme) ────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: rf(22), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },
  sectionTitle: { fontSize: rf(13.5), fontWeight: '800', letterSpacing: -0.2 },

  // percentage cells + stretch → every KPI card is exactly the same size
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },

  // table
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tblHead: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1 },
  tblHeadTxt: { fontSize: rf(13.5), fontWeight: '800', letterSpacing: -0.2 },
  tblScroll: { flexGrow: 1 },
  tblBody: { minWidth: TABLE_W, flexGrow: 1 },
  tr: {
    flexDirection: 'row', alignItems: 'center',
    gap: COL_GAP, paddingVertical: 12, paddingHorizontal: COL_PAD,
  },
  th: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(12.5), fontWeight: '500' },
  tdStrong: { fontSize: rf(12.5), fontWeight: '700' },
  tdSmall: { fontSize: rf(11.5), fontWeight: '600' },
  tdName: { fontSize: rf(13), fontWeight: '700' },
  tdSub: { fontSize: rf(10.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** The one element in the row allowed to give ground — hence it, and only it,
   *  ellipsises. RN's default flexShrink is 0, so every sibling holds its size. */
  nameTxt: { flexShrink: 1, minWidth: 0 },
  targetCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetTxt: { flexShrink: 0, textAlign: 'right' },

  /**
   * Fixed widths on BOTH the header <Text> and the body cell — identical style,
   * so header and value can never drift apart. No `alignItems` here: it does
   * nothing to <Text> content (that shipped once as the Schools ACTIONS bug);
   * numeric columns stay left-aligned like every other table in the app.
   */
  cName: { flexBasis: COL.name, flexGrow: 1, flexShrink: 0, minWidth: COL.name },
  cRole: { width: COL.role, flexShrink: 0 },
  cZone: { width: COL.zone, flexShrink: 0 },
  cLeads: { width: COL.leads, flexShrink: 0 },
  cWon: { width: COL.won, flexShrink: 0 },
  cWin: { width: COL.win, flexShrink: 0 },
  cRev: { width: COL.rev, flexShrink: 0 },
  cTarget: { width: COL.target, flexShrink: 0 },
  cActs: { width: COL.acts, flexShrink: 0 },
  cStatus: { width: COL.status, flexShrink: 0 },
  cChevron: { width: COL.chev, flexShrink: 0, alignItems: 'flex-end' },

  // phone rows
  rowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  rowTarget: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowExpCard: { borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: -1, overflow: 'hidden' },

  // expanded
  exp: { borderTopWidth: 1, padding: 14 },
  expLabel: { fontSize: rf(10), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  expVal: { fontSize: rf(16), fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  stageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stageChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  stageTxt: { fontSize: rf(11), fontWeight: '600' },

  actsBlock: { borderTopWidth: 1, paddingTop: 14, marginTop: 14 },
  actsEmpty: { fontSize: rf(12), fontWeight: '500', textAlign: 'center', paddingVertical: 16 },
  actRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 13, borderWidth: 1 },
  actPhoto: { width: 60, height: 60, borderRadius: 10, borderWidth: 1 },
  actPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  actTop: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  actOutcome: { fontSize: rf(11), fontWeight: '700' },
  actDate: { fontSize: rf(10.5), fontWeight: '500', marginLeft: 'auto' },
  actSchool: { fontSize: rf(12.5), fontWeight: '700', marginTop: 3 },
  actMeta: { fontSize: rf(10.5), fontWeight: '500', marginTop: 1 },
  actFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  actTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actInterest: { fontSize: rf(10), fontWeight: '700' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
});
