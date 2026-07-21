import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, RefreshControl,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Navigation, Eye, Users } from 'lucide-react-native';

import { dashboardApi } from '../../api/dashboard';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, IconBtn, StatusBadge, ListCard, Avatar, Pagination } from '../../components/crud';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { FoPerformanceDto } from '../../types';

/**
 * Team Management — the ZH/RH roster of Field Officers with their attainment.
 *
 * Data: GET /dashboard/team-performance (dashboardApi.getTeamPerformance) — unchanged.
 * Drill-downs preserved verbatim:
 *   · "Assign Schools" → SchoolsList { assignedTo: fo.foId }   (live deep link)
 *   · "View Leads"     → LeadsList   { foId: fo.foId }
 *
 * Layout follows the house split: iPad renders the CSS-grid table from the spec's
 * "List view & table row" section, phones render stacked .lcard rows.
 */

const DASH = '—';

/**
 * House page size — every list screen pages 10 at a time (SchoolsListScreen,
 * LeadsListScreen, TargetsScreen, AllowancesScreen, PaymentsScreen, DemoListScreen).
 *
 * CLIENT-side, because the endpoint has no paging to defer to. DashboardController:
 *   [HttpGet("team-performance")]
 *   public async Task<IActionResult> GetTeamPerformance()
 *   { ... return Ok(ApiResponse<List<FoPerformanceDto>>.Ok(performance)); }
 * Zero [FromQuery] parameters and a bare List<T> — no page/limit/total to send or read,
 * so the whole roster arrives in one shot and we slice it here.
 */
const PAGE_SIZE = 10;

function fmt(v: number) {
  if (!v) return '₹0';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
}

/** Web parity: On Track → success · At Risk → warning · Underperforming → danger. */
function statusColor(T: AppTheme, status?: string): string {
  if (status === 'At Risk') return T.warning;
  if (status === 'Underperforming') return T.danger;
  return T.success;
}

/** Attainment ramp — same 70/40 thresholds the legacy bar used. */
function attainColor(T: AppTheme, pct: number): string {
  if (pct >= 70) return T.success;
  if (pct >= 40) return T.warning;
  return T.danger;
}

const initialsOf = (fo: FoPerformanceDto) =>
  fo.avatar || (fo.name || '?').charAt(0).toUpperCase();

/** Weekly-visit floor below which the number reads as a warning (legacy rule). */
const VISIT_FLOOR = 15;

export const TeamManagementScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const table = isTabletDevice;

  const [foList, setFoList] = useState<FoPerformanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const totalCount = foList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  /** Clamp rather than reset: a reload that shrinks the roster must not strand us on a
   *  page that no longer exists. */
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);
  const paged = useMemo(
    () => foList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [foList, page],
  );
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    return dashboardApi.getTeamPerformance()
      .then(res => setFoList(res.data || []))
      .catch(() => Alert.alert('Error', 'Failed to load team data'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const goSchools = (fo: FoPerformanceDto) =>
    navigation?.navigate('SchoolsList', { assignedTo: fo.foId });
  const goLeads = (fo: FoPerformanceDto) =>
    navigation?.navigate('LeadsList', { foId: fo.foId });

  // ── iPad table ──────────────────────────────────────────────────────────────
  /**
   * Horizontally scrollable with a minWidth: at the raw content width the Status
   * column (flex 1.4) squeezed the "Underperforming" badge until it truncated to
   * "Underperformin" and the warning icon spilled into Actions. TABLE_MIN_W keeps
   * every column readable and scrolls instead of clipping — same pattern as the
   * Targets and Payments tables.
   */
  const renderTable = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tblScroll}>
    <View style={[s.tbl, s.tblMin, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cName]}>Field Officer</Text>
        <Text style={[s.th, { color: T.dim }, s.cRev]}>Revenue</Text>
        <Text style={[s.th, { color: T.dim }, s.cNum]}>Visits/Wk</Text>
        <Text style={[s.th, { color: T.dim }, s.cNum]}>Deals Won</Text>
        <Text style={[s.th, { color: T.dim }, s.cProg]}>Target Progress</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
      </View>

      {paged.map(fo => {
        const pct = Math.min(100, fo.targetPct || 0);
        const sc = statusColor(T, fo.status);
        const lowVisits = (fo.visitsWeek || 0) < VISIT_FLOOR;
        return (
          <View key={String(fo.foId)} style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
            <View style={[s.cName, s.nameCell]}>
              <Avatar initials={initialsOf(fo)} color={sc} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{fo.name || DASH}</Text>
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                  {fo.territory || fo.zone || 'No territory assigned'}
                </Text>
              </View>
            </View>

            <View style={s.cRev}>
              <Text style={[s.tdAmt, { color: T.text }]} numberOfLines={1}>{fmt(fo.revenue)}</Text>
              <Text style={[s.tdSub, { color: T.success }]} numberOfLines={1}>{fo.targetPct}%</Text>
            </View>

            <Text style={[s.td, { color: lowVisits ? T.warning : T.text }, s.cNum]} numberOfLines={1}>
              {fo.visitsWeek}
            </Text>
            <Text style={[s.td, { color: T.text }, s.cNum]} numberOfLines={1}>{fo.dealsWon}</Text>

            <View style={s.cProg}>
              <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>{pct}%</Text>
              <ProgressBar value={pct} height={6} color={attainColor(T, pct)} trackColor={T.cardAlt} />
            </View>

            <View style={[s.cStatus, s.statusCell]}>
              <StatusBadge label={fo.status || DASH} color={sc} />
              {fo.status === 'Underperforming' && (
                <AlertTriangle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
              )}
            </View>

            <View style={[s.cActions, s.actions]}>
              <IconBtn kind="view" label="Assign schools" onPress={() => goSchools(fo)}>
                <Navigation size={14} color={T.accent} strokeWidth={ICON_STROKE} />
              </IconBtn>
              <IconBtn kind="edit" label="View leads" onPress={() => goLeads(fo)}>
                <Eye size={14} color={T.sub} strokeWidth={ICON_STROKE} />
              </IconBtn>
            </View>
          </View>
        );
      })}
    </View>
    </ScrollView>
  );

  // ── Phone cards ─────────────────────────────────────────────────────────────
  const renderCards = () => (
    <View style={{ gap: 8 }}>
      {paged.map(fo => {
        const pct = Math.min(100, fo.targetPct || 0);
        const sc = statusColor(T, fo.status);
        const stats = [
          { label: 'Revenue', value: fmt(fo.revenue), sub: `${fo.targetPct}%`, warn: false },
          { label: 'Visits/Wk', value: String(fo.visitsWeek), sub: '', warn: (fo.visitsWeek || 0) < VISIT_FLOOR },
          { label: 'Deals Won', value: String(fo.dealsWon), sub: '', warn: false },
        ];
        return (
          <ListCard key={String(fo.foId)} style={s.rowCard}>
            <View style={s.rowTop}>
              <Avatar initials={initialsOf(fo)} color={sc} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{fo.name || DASH}</Text>
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                  {fo.territory || fo.zone || 'No territory assigned'}
                </Text>
              </View>
              <StatusBadge label={fo.status || DASH} color={sc} />
            </View>

            {/* alignItems:'stretch' + flex:1 — the three tiles are always equal height. */}
            <View style={s.statRow}>
              {stats.map(st => (
                <View key={st.label} style={[s.statCell, { backgroundColor: T.cardAlt }]}>
                  <Text
                    style={[s.statVal, { color: st.warn ? T.warning : T.text }]}
                    numberOfLines={1}
                  >
                    {st.value}
                  </Text>
                  {!!st.sub && <Text style={[s.statSub, { color: T.success }]} numberOfLines={1}>{st.sub}</Text>}
                  <Text style={[s.statLabel, { color: T.dim }]} numberOfLines={1}>{st.label}</Text>
                </View>
              ))}
            </View>

            <View style={s.progHead}>
              <Text style={[s.tdSub, { color: T.sub, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
                Target Progress
              </Text>
              <Text style={[s.progPct, { color: T.text }]}>{pct}%</Text>
            </View>
            <ProgressBar value={pct} height={6} color={attainColor(T, pct)} trackColor={T.cardAlt} />

            <View style={s.rowActions}>
              <Btn
                label="Assign Schools"
                variant="soft"
                small
                style={{ flex: 1 }}
                onPress={() => goSchools(fo)}
                icon={<Navigation size={13} color={T.accent} strokeWidth={ICON_STROKE} />}
              />
              <Btn
                label="View Leads"
                variant="secondary"
                small
                style={{ flex: 1 }}
                onPress={() => goLeads(fo)}
                icon={<Eye size={13} color={T.text} strokeWidth={ICON_STROKE} />}
              />
              {fo.status === 'Underperforming' && (
                <IconBtn kind="del" label="Underperforming" onPress={() => goLeads(fo)}>
                  <AlertTriangle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                </IconBtn>
              )}
            </View>
          </ListCard>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* No in-page title: the topbar (or the native drawer header for RH/SH/SCA)
            already names the screen. Only the count, which the header does not show,
            remains — as a light summary line, the consistent pattern across nav screens. */}
        <View style={s.header}>
          <Text style={[s.subtitle, { color: T.sub }]}>
            {foList.length} Field Officer{foList.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={s.legend}>
          <StatusBadge label="On Track" color={T.success} />
          <StatusBadge label="At Risk" color={T.warning} />
          <StatusBadge label="Underperforming" color={T.danger} />
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : foList.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Users size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No team data available</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>
              Field Officers reporting to you will appear here.
            </Text>
          </View>
        ) : (
          <>
            {table ? renderTable() : renderCards()}
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  Showing {from}{DASH}{to} of {totalCount}
                </Text>
                <Pagination page={page} pageCount={totalPages} onChange={setPage} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from the theme, inline) ─────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 32 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 2 },
  title: { fontSize: rf(22), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },

  // table
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  /** 76pt Actions + ~884pt for the flexible columns; below this Status truncated
      the "Underperforming" badge, so the table scrolls horizontally instead. */
  tblMin: { minWidth: 960 },
  tblScroll: { flexGrow: 1 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '600' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdAmt: { fontSize: rf(13.5), fontWeight: '800' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  cName: { flex: 2.2 },
  cRev: { flex: 1.1 },
  cNum: { flex: 0.9 },
  cProg: { flex: 1.5, gap: 4 },
  cStatus: { flex: 1.4 },
  cActions: { width: 76 },

  // phone card
  rowCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  statCell: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  statVal: { fontSize: rf(15), fontWeight: '800', textAlign: 'center' },
  statSub: { fontSize: rf(11), fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: rf(10), fontWeight: '600', marginTop: 2, textAlign: 'center' },
  progHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progPct: { fontSize: rf(12), fontWeight: '700' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
});
