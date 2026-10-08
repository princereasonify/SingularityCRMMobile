import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Clock, CalendarClock, Phone, ExternalLink, Filter, Users } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, SearchBar, Trigger, Dropdown, FilterChip, Pagination, ListCard, Avatar, StatusBadge,
} from '../../components/crud';
import { StatTile, Chip } from '../../components/ui';
import { b2cObjectionService, OBJECTION_TYPES } from '../../api/b2c/b2cObjectionService';
import { useFieldStaff, buildPersonFilterOptions, resolvePersonSelection, FieldPersonSelection } from '../../components/b2c/useFieldStaff';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, gridCardWidth} from '../../hooks/useResponsive';

/** Web parity: B2CCounseling.jsx pages 20 at a time. */
const PAGE_SIZE = 20;
const DASH = '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d?: string) => {
  if (!d) return DASH;
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
};
const fmtDateTime = (d?: string) => {
  if (!d) return DASH;
  const x = new Date(d);
  const h = x.getHours();
  const hh = (h % 12) || 12;
  const ap = h < 12 ? 'am' : 'pm';
  return `${x.getDate()} ${MONTHS[x.getMonth()]}, ${hh}:${String(x.getMinutes()).padStart(2, '0')} ${ap}`;
};

const typeLabel = (v: string) => OBJECTION_TYPES.find(t => t.value === v)?.label || v;
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const STATUS_OPTS = [
  { value: '', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'LostCause', label: 'Lost' },
];

interface Objection {
  id: number; leadId: number;
  studentName?: string; studentMobile?: string; city?: string;
  type: string; details?: string;
  counselorName?: string; raisedByName?: string;
  scheduledAt?: string; createdAt?: string;
  status: string;
  aiBrief?: string; aiPostSession?: string; aiGeneratedAt?: string;
}

export const B2CCounselingScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();

  const statusMeta = (st: string) =>
    st === 'Open' ? { label: 'Open', color: T.warning }
      : st === 'InProgress' ? { label: 'In progress', color: T.accent }
        : st === 'Resolved' ? { label: 'Resolved', color: T.success }
          : st === 'LostCause' ? { label: 'Lost', color: T.danger }
            : { label: st, color: T.sub };

  const [rows, setRows] = useState<Objection[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');           // client-side quick filter on the loaded page
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [personVal, setPersonVal] = useState('');      // '' | 'a:<agentId>' | 'c:<counselorId>'
  const [openPerson, setOpenPerson] = useState(false);
  const [openType, setOpenType] = useState(false);

  // Staff for the admin "view as" filter — this screen is B2CAdmin-only at the
  // route level (registered only in the Admin drawer), so no `enabled` guard needed.
  const { agents, counselors } = useFieldStaff();
  const person: FieldPersonSelection | null = useMemo(
    () => resolvePersonSelection(personVal, agents, counselors),
    [personVal, agents, counselors],
  );

  // The AI brief view/regenerate modal is gone: the /brief endpoint is commented out
  // (B2CObjectionsController.cs) — it let a CallingAgent pull any lead's brief regardless of
  // assignment — so the web dropped it pending a proper re-scoping, and so does this screen.

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // A fast run through the filter chips (status, then type, then a person) fires one request
  // per tap with nothing to stop an earlier one landing after a later one — whichever resolved
  // last won, regardless of which filters were still selected. The token discards any
  // response that isn't from the most recent request.
  const loadTokenRef = useRef(0);
  const fetchQueue = useCallback(async (pg = 1) => {
    const token = ++loadTokenRef.current;
    try {
      const res = await b2cObjectionService.getQueue({
        page: pg, pageSize: PAGE_SIZE,
        status: status || undefined,
        type: type || undefined,
        agentId: person?.kind === 'agent' ? person.agentId : undefined,
        counselorId: person?.kind === 'counselor' ? person.counselorId : undefined,
      });
      if (loadTokenRef.current !== token) return;
      setRows(res.data?.items ?? []);
      setTotalCount(res.data?.totalCount ?? 0);
      setSummary(res.data?.summary ?? {});
    } catch {
      if (loadTokenRef.current !== token) return;
      setRows([]); setTotalCount(0); setSummary({});
    } finally {
      if (loadTokenRef.current === token) { setLoading(false); setRefreshing(false); }
    }
  }, [status, type, person]);

  useEffect(() => { setLoading(true); setPage(1); fetchQueue(1); }, [fetchQueue]);

  const personOptions = useMemo(() => buildPersonFilterOptions(agents, counselors), [agents, counselors]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchQueue(p);
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter(o =>
        [o.studentName, o.studentMobile, o.counselorName, o.raisedByName]
          .some(v => (v || '').toLowerCase().includes(q)))
    : rows;

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  // Shared rule: exact points, and columns capped at the number of cards.
  const cardW = gridCardWidth(r, visible.length);

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(page); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Every counseling booking & objection — filter by any agent or counselor</Text>

        {/* Summary */}
        <View style={s.statGrid}>
          <StatTile style={s.stat} label="Open" value={summary.openCount ?? 0} tint={T.warning} icon={<AlertTriangle size={15} color={T.warning} strokeWidth={ICON_STROKE} />} />
          <StatTile style={s.stat} label="In progress" value={summary.inProgressCount ?? 0} tint={T.accent} icon={<Clock size={15} color={T.accent} strokeWidth={ICON_STROKE} />} />
          <StatTile style={s.stat} label="Resolved" value={summary.resolvedCount ?? 0} tint={T.success} />
          <StatTile style={s.stat} label="Lost cause" value={summary.lostCauseCount ?? 0} tint={T.danger} />
        </View>

        {/* Filters */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.filterRow}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search student, counselor, agent…" style={{ flex: 1, minWidth: 180 }} />
          </View>
          <View style={s.filterRow}>
            <Trigger
              label={person?.name || 'Everyone'}
              open={openPerson}
              onPress={() => { setOpenPerson(v => !v); setOpenType(false); }}
              icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={{ flex: 1, minWidth: 150 }}
            />
            <Trigger
              label={type ? typeLabel(type) : 'All types'}
              open={openType}
              onPress={() => { setOpenType(v => !v); setOpenPerson(false); }}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={{ flex: 1, minWidth: 150 }}
            />
          </View>

          {openPerson && (
            <Dropdown style={{ width: '100%' }} maxHeight={300} value={personVal}
              onSelect={v => { setPersonVal(v); setOpenPerson(false); }}
              options={personOptions} />
          )}
          {openType && (
            <Dropdown style={{ width: '100%' }} maxHeight={300} value={type}
              onSelect={v => { setType(v); setOpenType(false); }}
              options={[{ label: 'All types', value: '' }, ...OBJECTION_TYPES.map(t => ({ label: t.label, value: t.value }))]} />
          )}

          {/* Status */}
          <View style={s.chipWrap}>
            {STATUS_OPTS.map(o => (
              <Chip key={o.value || 'all'} label={o.label} active={status === o.value} onPress={() => setStatus(o.value)} />
            ))}
          </View>

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>{totalCount} record{totalCount === 1 ? '' : 's'}</Text>
            {type !== '' && <FilterChip label={typeLabel(type)} onRemove={() => setType('')} />}
            {personVal !== '' && <FilterChip label={person?.name || 'View'} onRemove={() => setPersonVal('')} />}
          </View>
        </View>

        {person && (
          <View style={s.viewingRow}>
            <Text style={[s.viewing, { color: T.sub }]} numberOfLines={1}>
              Showing counseling for <Text style={{ color: T.text, fontWeight: '700' }}>{person.name}</Text>
            </Text>
            {person.kind === 'agent' && person.isManager && <StatusBadge label="Agent + Manager" color={T.accent} />}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : visible.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No counseling records</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>No counseling records match these filters.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {visible.map(o => {
                const meta = statusMeta(o.status);
                return (
                  <ListCard key={o.id} style={[s.rowCard, { width: cardW }]}>
                    <Avatar initials={initialsOf(o.studentName)} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{o.studentName || DASH}</Text>
                        <StatusBadge label={meta.label} color={meta.color} />
                      </View>

                      {(o.studentMobile || o.city) ? (
                        <View style={s.subRow}>
                          {!!o.studentMobile && <Phone size={10} color={T.dim} strokeWidth={ICON_STROKE} />}
                          {!!o.studentMobile && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{o.studentMobile}</Text>}
                          {!!o.city && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{o.studentMobile ? ` · ${o.city}` : o.city}</Text>}
                        </View>
                      ) : null}

                      <Text style={[s.type, { color: T.text }]} numberOfLines={1}>{typeLabel(o.type)}</Text>
                      {!!o.details && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{o.details}</Text>}

                      <View style={s.metaRow}>
                        <Text style={[s.sub, { color: o.counselorName ? T.sub : T.warning }]} numberOfLines={1}>
                          {o.counselorName || 'Unassigned'}{o.raisedByName ? ` · ${o.raisedByName}` : ''}
                        </Text>
                      </View>

                      <View style={s.visitRow}>
                        {o.scheduledAt ? (
                          <>
                            <CalendarClock size={11} color={T.accent} strokeWidth={ICON_STROKE} />
                            <Text style={[s.sub, { color: T.accent }]} numberOfLines={1}>{fmtDateTime(o.scheduledAt)}</Text>
                          </>
                        ) : (
                          <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{fmtDate(o.createdAt)}</Text>
                        )}
                      </View>

                      <View style={s.actions}>
                        <Btn
                          variant="secondary"
                          label="Open lead"
                          icon={<ExternalLink size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                          onPress={() => navigation?.navigate('B2CLeadDetail', { leadId: o.leadId })}
                        />
                      </View>
                    </View>
                  </ListCard>
                );
              })}
            </View>

            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>Showing {from}{DASH}{to} of {totalCount}</Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

    </SafeAreaView>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  safe: { flex: 1 },
  // Gutter/gap follow the device; the cap keeps a full-bleed iPad line readable.
  scroll: { padding: r.gutter, gap: r.gap, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  stat: { flexBasis: r.isTablet ? '22%' : '47%', flexGrow: 1, minWidth: 140 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: r.rf(11.5), fontWeight: '600' },

  viewingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: -2 },
  viewing: { fontSize: r.rf(12), fontWeight: '500', flexShrink: 1 },

  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  type: { fontSize: r.rf(12.5), fontWeight: '600' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
});
