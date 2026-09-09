import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users, Activity, Clock, Image as ImageIcon, Wrench, BookOpen, Download,
  ChevronDown, ChevronRight, AlertTriangle, Eye,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Segmented, Pagination, ListCard, Avatar, StatusBadge, Btn, FormModal,
} from '../../components/crud';
import { StatTile, SectionLabel } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { b2cUsageReportService } from '../../api/b2c/b2cUsageReportService';
import {
  B2CUsageReportDto, B2CUsageUserDto, B2CUsageDayDto,
  B2CUsageFeatureDto, B2CUsageDetailDto,
} from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';

/**
 * B2CUsageReportScreen — Reasonify learning-app usage for the students behind our leads.
 *
 * Mirrors the web page (Sales_CRM_Web/src/pages/b2c/B2CUsageReport.jsx), which is on the
 * sidebar for all three B2C roles and had no mobile equivalent at all. Scope is decided
 * server-side from the caller's role, so the same screen serves agent, counselor and admin
 * with no role branching here.
 *
 * The web page is a wide table with expandable rows. A table does not survive a phone, so the
 * same data is carried by a paginated list of cards that expand in place — every column the
 * table shows is present, just stacked. The drill-down that web opens as a modal is a sheet
 * here for the same reason.
 */

const ymd = (d: Date) => {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

type PresetKey = 'today' | '7days' | '30days' | 'custom';

const PRESET_RANGE: Record<Exclude<PresetKey, 'custom'>, () => { startDate: string; endDate: string }> = {
  today: () => ({ startDate: ymd(new Date()), endDate: ymd(new Date()) }),
  '7days': () => ({ startDate: ymd(daysAgo(6)), endDate: ymd(new Date()) }),
  '30days': () => ({ startDate: ymd(daysAgo(29)), endDate: ymd(new Date()) }),
};

/** Seconds → "3h 56m" / "27m 58s" / "29s". Matches how Reasonify's own report reads. */
const fmtDuration = (secs?: number | null) => {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
};

const fmtNum = (n?: number | null) => Number(n || 0).toLocaleString('en-IN');

const fmtWhen = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const initialsOf = (name?: string | null) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/**
 * Students per page.
 *
 * Deliberately small. These are tall cards — eight stat pills each, and taller again once
 * expanded — so a page of twenty was a page you scrolled for a minute to reach the pager at
 * the bottom, which defeats the point of having one. Five fits a phone screen with the pager
 * still in reach, and the cost of a smaller page is a tap, not a request: the list is already
 * in memory and sliced client-side.
 */
const PAGE_SIZE = 5;

/** Days per page inside an expanded card — the server pages this one. Same reasoning. */
const DAYS_PER_PAGE = 5;

export const B2CUsageReportScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();

  const [preset, setPreset] = useState<PresetKey>('7days');
  const [range, setRange] = useState(PRESET_RANGE['7days']());
  // Held apart from the applied range so a half-typed date never fires a request; Apply commits.
  const [draft, setDraft] = useState(PRESET_RANGE['7days']());
  const [search, setSearch] = useState('');
  const [report, setReport] = useState<B2CUsageReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<B2CUsageUserDto | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await b2cUsageReportService.getReport({ ...range, search });
      setReport(res.data ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load the usage report');
      setReport(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, search]);

  // Debounced on search only — a preset change should apply at once.
  useEffect(() => {
    const t = setTimeout(() => load(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const applyPreset = (next: PresetKey) => {
    setPreset(next);
    setExpanded(null);
    setPage(1);
    if (next !== 'custom') {
      const nextRange = PRESET_RANGE[next]();
      setRange(nextRange);
      setDraft(nextRange);
    }
  };

  // Memoised because `?? []` allocates a fresh array on every render, which would make the
  // paging memo below recompute (and re-slice) on every keystroke in the search box.
  const users = useMemo(() => report?.users ?? [], [report]);
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paged = useMemo(
    () => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [users, page],
  );

  const s = report?.summary;
  const tiles = [
    // Active vs total, because "3" alone hides that there are 26 students and 23 are silent —
    // which is the most useful number here for someone deciding who to call.
    { label: 'Students (active)', value: `${fmtNum(s?.activeUsers)} / ${fmtNum(s?.totalUsers)}`, icon: Users, tint: '#7c3aed' },
    { label: 'Total Sessions', value: fmtNum(s?.totalSessions), icon: Activity, tint: '#2563eb' },
    { label: 'Total Duration', value: fmtDuration(s?.totalDurationSecs), icon: Clock, tint: '#059669' },
    { label: 'Media', value: fmtNum(s?.totalMedia), icon: ImageIcon, tint: '#0891b2' },
    { label: 'Tools', value: fmtNum(s?.totalTools), icon: Wrench, tint: '#db2777' },
    { label: 'Homework', value: fmtNum(s?.totalHomework), icon: BookOpen, tint: '#ea580c' },
    { label: 'Study Downloads', value: fmtNum(s?.totalStudyDownloads), icon: Download, tint: '#4f46e5' },
  ];

  // Tiles per row: two on a phone, three on an iPad portrait, four in landscape. Derived from
  // live window width so a rotation re-lays them out instead of leaving a frozen grid.
  const tileCols = r.isWide ? 4 : r.isTablet ? 3 : 2;
  const tileWidth = `${100 / tileCols}%` as const;

  const st = useMemo(() => StyleSheet.create({
    safe: { flex: 1 },
    scroll: { padding: r.gutter, paddingBottom: r.rs(32), gap: r.gap },
    filters: { gap: r.rs(10) },
    customRow: { flexDirection: r.isTablet ? 'row' : 'column', gap: r.rs(10) },
    customCell: { flex: r.isTablet ? 1 : undefined },
    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -r.rs(4) },
    tileCell: { width: tileWidth, paddingHorizontal: r.rs(4), paddingBottom: r.rs(8) },
    banner: {
      flexDirection: 'row', gap: 8, alignItems: 'flex-start',
      borderRadius: 12, padding: r.rs(12), borderWidth: 1,
    },
    bannerTxt: { fontSize: r.rf(12), lineHeight: r.rf(17), flex: 1 },
    scopeTxt: { fontSize: r.rf(11.5), fontWeight: '600' },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontSize: r.rf(13.5), fontWeight: '700' },
    sub: { fontSize: r.rf(11), marginTop: 1 },
    metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: r.rs(6), marginTop: r.rs(8) },
    metaPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    metaLbl: { fontSize: r.rf(9.5), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
    metaVal: { fontSize: r.rf(12), fontWeight: '700', marginTop: 1 },
    expandBtn: {
      minHeight: MIN_TAP, minWidth: MIN_TAP, alignItems: 'center', justifyContent: 'center',
    },
    empty: { alignItems: 'center', paddingVertical: r.rs(48), gap: 6 },
    emptyTxt: { fontSize: r.rf(13) },
  }), [r, tileWidth]);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={st.empty}>
          <ActivityIndicator color={T.accent} />
          <Text style={[st.emptyTxt, { color: T.dim }]}>Loading usage…</Text>
        </View>
      );
    }
    if (users.length === 0) {
      return (
        <View style={st.empty}>
          <Text style={[st.emptyTxt, { color: T.dim }]}>
            {report?.dataAvailable === false
              ? 'No data to show.'
              : search
                ? 'No students match that search.'
                : 'No students in scope.'}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ gap: r.rs(8) }}>
        {paged.map(u => (
          <UsageCard
            key={u.studentId}
            user={u}
            open={expanded === u.studentId}
            onToggle={() => setExpanded(expanded === u.studentId ? null : u.studentId)}
            onView={() => setDetailFor(u)}
            range={range}
            st={st}
            r={r}
            T={T}
          />
        ))}
        {pageCount > 1 && (
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={p => { if (p >= 1 && p <= pageCount) { setPage(p); setExpanded(null); } }}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={st.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={T.accent}
          />
        }
      >
        {/* ── Period + search ── */}
        <View style={st.filters}>
          <Segmented
            value={preset}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7days', label: '7 Days' },
              { value: '30days', label: '30 Days' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={v => applyPreset(v as PresetKey)}
          />
          {preset === 'custom' && (
            <View style={st.customRow}>
              <View style={st.customCell}>
                <DateInput
                  label="From"
                  value={draft.startDate}
                  maxDate={draft.endDate || ymd(new Date())}
                  onChange={d => setDraft(x => ({ ...x, startDate: d }))}
                />
              </View>
              <View style={st.customCell}>
                <DateInput
                  label="To"
                  value={draft.endDate}
                  minDate={draft.startDate}
                  maxDate={ymd(new Date())}
                  onChange={d => setDraft(x => ({ ...x, endDate: d }))}
                />
              </View>
              <Btn
                label="Apply"
                variant="secondary"
                disabled={!draft.startDate || !draft.endDate}
                onPress={() => { setExpanded(null); setPage(1); setRange(draft); }}
                style={r.isTablet ? { alignSelf: 'flex-end' } : undefined}
              />
            </View>
          )}
          <SearchBar
            value={search}
            onChangeText={v => { setSearch(v); setExpanded(null); setPage(1); }}
            placeholder="Search by name or email"
          />
        </View>

        {!!report?.scopeLabel && (
          <Text style={[st.scopeTxt, { color: T.dim }]}>
            {report.scopeLabel} · {range.startDate} to {range.endDate}
          </Text>
        )}

        {!!error && (
          <View style={[st.banner, { backgroundColor: T.danger + '14', borderColor: T.danger + '55' }]}>
            <AlertTriangle size={15} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[st.bannerTxt, { color: T.danger }]}>{error}</Text>
          </View>
        )}

        {/* Reasonify answered, but with nothing to say. Distinct from an empty report, and it
            must say so — a zeroed list reads as "nobody used the product", which is worse than
            useless to someone deciding who to call. */}
        {report && !report.dataAvailable && (
          <View style={[st.banner, { backgroundColor: T.warning + '14', borderColor: T.warning + '55' }]}>
            <AlertTriangle size={15} color={T.warning} strokeWidth={ICON_STROKE} />
            <Text style={[st.bannerTxt, { color: T.text }]}>
              {report.unavailableReason || 'Reasonify’s analytics service did not respond.'} These
              figures are read live, so nothing is shown rather than stale or zeroed numbers.
            </Text>
          </View>
        )}

        {/* ── Summary ── */}
        <View style={st.tileGrid}>
          {tiles.map(t => (
            <View key={t.label} style={st.tileCell}>
              <StatTile
                label={t.label}
                value={loading ? '—' : t.value}
                tint={t.tint}
                icon={<t.icon size={13} color={t.tint} strokeWidth={ICON_STROKE} />}
              />
            </View>
          ))}
        </View>

        <SectionLabel>Students</SectionLabel>
        {renderBody()}
      </ScrollView>

      <UsageDetailSheet
        user={detailFor}
        range={range}
        onClose={() => setDetailFor(null)}
      />
    </SafeAreaView>
  );
};

/* ─── One student, expandable in place ───────────────────────────────────────
   The web table has fourteen columns. On a phone the same facts are stacked: the
   headline numbers as pills on the collapsed card, the per-day breakdown and the
   feature mix behind the chevron — so nothing the table shows is lost, and none of
   it forces a horizontal scroll. */
const UsageCard = ({
  user, open, onToggle, onView, range, st, r, T,
}: {
  user: B2CUsageUserDto;
  open: boolean;
  onToggle: () => void;
  onView: () => void;
  range: { startDate: string; endDate: string };
  st: any; r: any; T: any;
}) => {
  const [days, setDays] = useState<B2CUsageDayDto[]>([]);
  const [dayTotal, setDayTotal] = useState(0);
  const [dayPage, setDayPage] = useState(1);
  const [features, setFeatures] = useState<B2CUsageFeatureDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fetched only once the card is actually opened. Loading every student's breakdown up front
  // would be dozens of requests for panels nobody has looked at.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([
      b2cUsageReportService.getBreakdown(user.studentId, { ...range, page: dayPage, perPage: DAYS_PER_PAGE }),
      dayPage === 1
        ? b2cUsageReportService.getFeatures(user.studentId, range)
        : Promise.resolve(null),
    ])
      .then(([bd, ft]) => {
        if (cancelled) return;
        setDays(bd.data?.days ?? []);
        setDayTotal(bd.data?.total ?? 0);
        if (ft) setFeatures(ft.data ?? null);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, dayPage, user.studentId, range]);

  const dayPages = Math.max(1, Math.ceil(dayTotal / DAYS_PER_PAGE));

  const pill = (label: string, value: string) => (
    <View key={label} style={[st.metaPill, { backgroundColor: T.cardAlt }]}>
      <Text style={[st.metaLbl, { color: T.dim }]}>{label}</Text>
      <Text style={[st.metaVal, { color: T.text }]}>{value}</Text>
    </View>
  );

  return (
    <ListCard>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={st.rowTop}>
          <Avatar initials={initialsOf(user.studentName)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[st.name, { color: T.text }]} numberOfLines={1}>
              {user.studentName || 'Unknown'}
            </Text>
            <Text style={[st.sub, { color: T.dim }]} numberOfLines={1}>{user.email || '—'}</Text>
          </View>
          {/* Nothing to expand for a student who never opened the app — an arrow that
              opens an empty panel is worse than no arrow. */}
          {user.hasActivity ? (
            <TouchableOpacity onPress={onToggle} style={st.expandBtn} accessibilityRole="button"
              accessibilityLabel={open ? 'Collapse details' : 'Expand details'}>
              {open
                ? <ChevronDown size={18} color={T.accent} strokeWidth={ICON_STROKE} />
                : <ChevronRight size={18} color={T.dim} strokeWidth={ICON_STROKE} />}
            </TouchableOpacity>
          ) : (
            <StatusBadge label="No activity" color={T.dim} />
          )}
        </View>

        <View style={st.metaWrap}>
          {pill('Sessions', fmtNum(user.totalSessions))}
          {pill('Duration', fmtDuration(user.totalDurationSecs))}
          {pill('Interactions', fmtNum(user.interactionCount))}
          {pill('Topics', `${fmtNum(user.topicsCompleted)}/${fmtNum(user.topicsAttempted)}`)}
          {pill('Progress', `${user.completionPct ?? 0}%`)}
          {pill('Media', fmtNum(user.mediaCount))}
          {pill('Tools', fmtNum(user.toolCount))}
          {pill('Homework', fmtNum(user.homeworkGenerated))}
        </View>

        <Text style={[st.sub, { color: T.dim, marginTop: r.rs(6) }]} numberOfLines={1}>
          {user.assignedAgentName ? `Agent: ${user.assignedAgentName} · ` : ''}
          Last active {fmtWhen(user.lastSession)}
        </Text>

        {open && (
          <View style={{ gap: r.rs(10), marginTop: r.rs(10) }}>
            {loading ? (
              <ActivityIndicator color={T.accent} />
            ) : failed ? (
              <Text style={[st.sub, { color: T.danger }]}>Could not load this student’s breakdown.</Text>
            ) : (
              <>
                <SectionLabel>Day by day</SectionLabel>
                {days.length === 0 ? (
                  <Text style={[st.sub, { color: T.dim }]}>No activity in this period.</Text>
                ) : days.map(d => (
                  <View key={d.date} style={[st.metaPill, { backgroundColor: T.cardAlt, padding: r.rs(10) }]}>
                    <Text style={[st.metaVal, { color: T.text }]}>{d.date}</Text>
                    <Text style={[st.sub, { color: T.dim }]}>
                      {fmtNum(d.sessions)} sessions · {fmtDuration(d.durationSecs)} ·{' '}
                      {fmtNum(d.completedTopicsCount)} topics done
                    </Text>
                    <Text style={[st.sub, { color: T.dim }]}>
                      {fmtWhen(d.firstSession)} → {fmtWhen(d.lastSession)}
                    </Text>
                  </View>
                ))}
                {dayPages > 1 && (
                  <Pagination page={dayPage} pageCount={dayPages}
                    onChange={p => { if (p >= 1 && p <= dayPages) setDayPage(p); }} />
                )}

                {!!features && (
                  <>
                    <SectionLabel>How they asked</SectionLabel>
                    <View style={st.metaWrap}>
                      {features.inputSources.map(i => pill(i.label, fmtNum(i.count)))}
                    </View>
                    <SectionLabel>Features used</SectionLabel>
                    <View style={st.metaWrap}>
                      {features.features.map(f => pill(f.label, fmtNum(f.count)))}
                    </View>
                    {!!features.topModel && (
                      <Text style={[st.sub, { color: T.dim }]}>Most-used model: {features.topModel}</Text>
                    )}
                  </>
                )}

                <Btn label="View full report" variant="soft" small onPress={onView}
                  icon={<Eye size={14} color={T.accent} strokeWidth={ICON_STROKE} />} />
              </>
            )}
          </View>
        )}
      </View>
    </ListCard>
  );
};

/* ─── Topic / Session drill-down ─────────────────────────────────────────────
   The web opens this as a modal with two very wide tables. Same two reports here,
   as stacked cards behind a segmented switch. */
const UsageDetailSheet = ({
  user, range, onClose,
}: {
  user: B2CUsageUserDto | null;
  range: { startDate: string; endDate: string };
  onClose: () => void;
}) => {
  const T = useAppTheme();
  const r = useResponsive();
  const [view, setView] = useState<'topic' | 'session'>('topic');
  const [detail, setDetail] = useState<B2CUsageDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setDetail(null); setError(null); return; }
    let cancelled = false;
    setView('topic');
    setLoading(true);
    setError(null);
    b2cUsageReportService.getDetail(user.studentId, range)
      .then(res => { if (!cancelled) setDetail(res.data ?? null); })
      .catch((e: any) => {
        if (!cancelled) setError(e?.response?.data?.message || 'Could not load this student’s report');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, range]);

  const st = useMemo(() => StyleSheet.create({
    body: { gap: r.rs(10) },
    row: { borderRadius: 12, padding: r.rs(12), gap: 3 },
    title: { fontSize: r.rf(13), fontWeight: '700' },
    meta: { fontSize: r.rf(11), lineHeight: r.rf(16) },
    empty: { fontSize: r.rf(12.5), textAlign: 'center', paddingVertical: r.rs(28) },
  }), [r]);

  const dash = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const joinOr = (a?: string[]) => (a && a.length ? a.join(', ') : '—');

  return (
    <FormModal visible={!!user} title={user?.studentName || 'Usage'} onClose={onClose} wide>
      <View style={st.body}>
        <Segmented
          value={view}
          options={[{ label: 'Topics', value: 'topic' }, { label: 'Sessions', value: 'session' }]}
          onChange={v => setView(v)}
        />

        {!!detail?.inputMix?.length && (
          <Text style={[st.meta, { color: T.dim }]}>
            Input mix: {detail.inputMix.map(i => `${i.label} ${i.count}`).join(' · ')}
          </Text>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginVertical: r.rs(24) }} />
        ) : error ? (
          <Text style={[st.empty, { color: T.danger }]}>{error}</Text>
        ) : view === 'topic' ? (
          (detail?.topics?.length ?? 0) === 0 ? (
            <Text style={[st.empty, { color: T.dim }]}>No topics in this period.</Text>
          ) : detail!.topics.map((t, i) => (
            <View key={`${t.displayId ?? i}`} style={[st.row, { backgroundColor: T.cardAlt }]}>
              <Text style={[st.title, { color: T.text }]}>
                {t.seq != null ? `${t.seq}. ` : ''}{t.topicName || '—'}
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {dash(t.subject)} · {dash(t.chapterName)}
                {t.unitNumber != null ? ` · Unit ${t.unitNumber}` : ''}
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {dash(t.gradeName)} · {dash(t.boardName)} · {dash(t.mediumName)}
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {t.isCompleted ? 'Completed' : 'In progress'} · {fmtNum(t.userMessages)} msgs ·{' '}
                {fmtDuration(t.durationSecs)} · {fmtNum(t.ttsPlays)} TTS
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {dash(t.displayId)} · {fmtWhen(t.lastMessageAt)}
              </Text>
            </View>
          ))
        ) : (
          (detail?.sessions?.length ?? 0) === 0 ? (
            <Text style={[st.empty, { color: T.dim }]}>No sessions in this period.</Text>
          ) : detail!.sessions.map((x, i) => (
            <View key={`${x.displayId ?? i}`} style={[st.row, { backgroundColor: T.cardAlt }]}>
              <Text style={[st.title, { color: T.text }]}>{dash(x.displayId)}</Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {joinOr(x.subjects)} · {joinOr(x.chapterNames)} · {fmtNum(x.topicsCount)} topics
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {dash(x.gradeName)} · {dash(x.boardName)} · {dash(x.mediumName)}
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {fmtNum(x.userMessages)} msgs · {fmtNum(x.mediaCount)} media · {fmtNum(x.toolCount)} tools ·{' '}
                {fmtNum(x.homeworkGenerated)} homework
              </Text>
              <Text style={[st.meta, { color: T.dim }]}>
                {fmtDuration(x.durationSecs)} · {fmtWhen(x.lastMessageAt)}
              </Text>
            </View>
          ))
        )}
      </View>
    </FormModal>
  );
};
