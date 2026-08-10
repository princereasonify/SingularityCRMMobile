import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Clock, Sparkles, RefreshCw, CalendarClock, Phone, ExternalLink, Filter, Play, CheckCircle2, XCircle } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, SearchBar, Trigger, Dropdown, FilterChip, Pagination, ListCard, Avatar, StatusBadge, FormModal,
} from '../../components/crud';
import { StatTile, Chip } from '../../components/ui';
import { b2cObjectionService, OBJECTION_TYPES } from '../../api/b2c/b2cObjectionService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Mirrors web B2CReengagementQueue.jsx — counselor's own declined-student objection queue. Pages 20 at a time. */
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

/** Web parity: '' = Active (Open + InProgress), then each explicit status. */
const STATUS_OPTS = [
  { value: '', label: 'Active' },
  { value: 'Open', label: 'Open' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'LostCause', label: 'Lost' },
];

interface Objection {
  id: number; leadId: number;
  studentName?: string; studentMobile?: string; city?: string;
  type: string; details?: string; leadStage?: string;
  counselorName?: string; resolution?: string;
  scheduledAt?: string; createdAt?: string;
  status: string;
  aiBrief?: string; aiPostSession?: string; aiGeneratedAt?: string;
}

type NextStatus = 'InProgress' | 'Resolved' | 'LostCause';

export const B2CReengagementScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const toast = useToast();

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
  const [search, setSearch] = useState('');   // client-side quick filter on the loaded page
  const [status, setStatus] = useState('');    // '' = Active (Open + InProgress)
  const [type, setType] = useState('');
  const [openType, setOpenType] = useState(false);

  // Action modal (Start / Resolve / Lost + note)
  const [action, setAction] = useState<{ row: Objection; next: NextStatus } | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState('');

  // AI brief modal
  const [briefRow, setBriefRow] = useState<Objection | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchQueue = useCallback(async (pg = 1) => {
    try {
      const res = await b2cObjectionService.getQueue({
        page: pg, pageSize: PAGE_SIZE,
        status: status || undefined,
        type: type || undefined,
      });
      setRows(res.data?.items ?? []);
      setTotalCount(res.data?.totalCount ?? 0);
      setSummary(res.data?.summary ?? {});
    } catch {
      setRows([]); setTotalCount(0); setSummary({});
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status, type]);

  useEffect(() => { setLoading(true); setPage(1); fetchQueue(1); }, [fetchQueue]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchQueue(p);
  };

  const openAction = (row: Objection, next: NextStatus) => {
    setAction({ row, next });
    setResolution(row.resolution || '');
    setActionErr('');
  };

  const runAction = async () => {
    if (!action) return;
    setBusy(true); setActionErr('');
    try {
      await b2cObjectionService.update(action.row.id, {
        status: action.next,
        resolution: resolution.trim() || undefined,
      });
      setAction(null); setResolution('');
      toast.success(
        action.next === 'Resolved' ? 'Marked resolved'
          : action.next === 'LostCause' ? 'Marked lost'
            : 'Marked in progress',
      );
      fetchQueue(page);
    } catch (e: any) {
      setActionErr(e?.response?.data?.message || 'Action failed');
      toast.error(e?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const regenerateBrief = async () => {
    if (!briefRow) return;
    setBriefBusy(true); setBriefErr('');
    try {
      const res = await b2cObjectionService.generateBrief(briefRow.id);
      setBriefRow(res.data ?? briefRow);
      toast.success('Brief generated');
      fetchQueue(page);
    } catch (e: any) {
      setBriefErr(e?.response?.data?.message || 'Could not generate the brief');
      toast.error(e?.response?.data?.message || 'Could not generate the brief');
    } finally {
      setBriefBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter(o =>
        [o.studentName, o.studentMobile, o.city].some(v => (v || '').toLowerCase().includes(q)))
    : rows;

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const actionTitle = action?.next === 'Resolved' ? 'Mark resolved'
    : action?.next === 'LostCause' ? 'Mark lost cause' : 'Start working';
  const noteLabel = action?.next === 'Resolved' ? 'How did you resolve it?' : 'Note (optional)';
  const notePlaceholder = action?.next === 'Resolved' ? 'What convinced the student?' : 'Add a note…';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(page); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Students who declined — work each objection and win them back</Text>

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
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search student, mobile, city…" style={{ flex: 1, minWidth: 180 }} />
          </View>
          <View style={s.filterRow}>
            <Trigger
              label={type ? typeLabel(type) : 'All types'}
              open={openType}
              onPress={() => setOpenType(v => !v)}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={{ flex: 1, minWidth: 150 }}
            />
          </View>

          {openType && (
            <Dropdown style={{ width: '100%' }} maxHeight={300} value={type}
              onSelect={v => { setType(v); setOpenType(false); setPage(1); }}
              options={[{ label: 'All types', value: '' }, ...OBJECTION_TYPES.map(t => ({ label: t.label, value: t.value }))]} />
          )}

          {/* Status */}
          <View style={s.chipWrap}>
            {STATUS_OPTS.map(o => (
              <Chip key={o.value || 'active'} label={o.label} active={status === o.value} onPress={() => { setStatus(o.value); setPage(1); }} />
            ))}
          </View>

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>{totalCount} objection{totalCount === 1 ? '' : 's'}</Text>
            {type !== '' && <FilterChip label={typeLabel(type)} onRemove={() => { setType(''); setPage(1); }} />}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : visible.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>Nothing in the queue 🎉</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>No objections match these filters.</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              {visible.map(o => {
                const meta = statusMeta(o.status);
                const canStart = o.status !== 'InProgress' && o.status !== 'Resolved';
                const canResolve = o.status !== 'Resolved';
                const canLose = o.status !== 'LostCause' && o.status !== 'Resolved';
                return (
                  <ListCard key={o.id} style={s.rowCard}>
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
                      {!!o.details && <Text style={[s.sub, { color: T.dim }]} numberOfLines={2}>{o.details}</Text>}

                      <View style={s.metaRow}>
                        {!!o.leadStage && <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>{o.leadStage}</Text>}
                        <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{!!o.leadStage ? ` · ${fmtDate(o.createdAt)}` : `Raised ${fmtDate(o.createdAt)}`}</Text>
                      </View>

                      {!!o.scheduledAt && (
                        <View style={s.visitRow}>
                          <CalendarClock size={11} color={T.accent} strokeWidth={ICON_STROKE} />
                          <Text style={[s.sub, { color: T.accent }]} numberOfLines={1}>Visit: {fmtDateTime(o.scheduledAt)}</Text>
                        </View>
                      )}

                      <View style={s.actions}>
                        {canStart && (
                          <Btn small variant="soft" label="Start"
                            icon={<Play size={13} color={T.accent} strokeWidth={ICON_STROKE} />}
                            onPress={() => openAction(o, 'InProgress')} />
                        )}
                        {canResolve && (
                          <Btn small label="Resolve"
                            icon={<CheckCircle2 size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
                            onPress={() => openAction(o, 'Resolved')} />
                        )}
                        {canLose && (
                          <Btn small variant="dangerGhost" label="Lost"
                            icon={<XCircle size={13} color={T.danger} strokeWidth={ICON_STROKE} />}
                            onPress={() => openAction(o, 'LostCause')} />
                        )}
                        <Btn small variant={o.aiBrief ? 'secondary' : 'soft'}
                          label={o.aiBrief ? 'Brief' : 'No brief'}
                          icon={<Sparkles size={13} color={o.aiBrief ? T.text : T.accent} strokeWidth={ICON_STROKE} />}
                          onPress={() => { setBriefRow(o); setBriefErr(''); }} />
                        <Btn small variant="secondary" label="Open lead"
                          icon={<ExternalLink size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                          onPress={() => navigation?.navigate('B2CLeadDetail', { leadId: o.leadId })} />
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

      {/* Action modal — Start / Resolve / Lost with note */}
      <FormModal
        visible={!!action}
        title={actionTitle}
        onClose={() => { setAction(null); setActionErr(''); }}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => { setAction(null); setActionErr(''); }} disabled={busy} style={{ flex: 1 }} />
            <Btn
              label={busy ? 'Saving…' : 'Confirm'}
              variant={action?.next === 'LostCause' ? 'danger' : 'primary'}
              onPress={runAction}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {action && (
          <View style={{ gap: 12 }}>
            {!!actionErr && (
              <View style={[s.errBox, { backgroundColor: T.danger + '1A', borderColor: T.danger }]}>
                <Text style={[s.errTxt, { color: T.danger }]}>{actionErr}</Text>
              </View>
            )}
            <Text style={[s.briefMeta, { color: T.sub }]}>
              {action.row.studentName} · {typeLabel(action.row.type)}
            </Text>
            <View style={{ gap: 7 }}>
              <Text style={[s.blockLabel, { color: T.text }]}>{noteLabel}</Text>
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput
                  value={resolution}
                  onChangeText={setResolution}
                  placeholder={notePlaceholder}
                  placeholderTextColor={T.dim}
                  multiline
                  style={[s.textareaTxt, { color: T.text }]}
                />
              </View>
            </View>
          </View>
        )}
      </FormModal>

      {/* AI brief modal — view + regenerate */}
      <FormModal
        visible={!!briefRow}
        title="AI Counseling Brief"
        onClose={() => setBriefRow(null)}
        footer={
          <>
            <Btn label="Close" variant="secondary" onPress={() => setBriefRow(null)} disabled={briefBusy} style={{ flex: 1 }} />
            <Btn label={briefBusy ? 'Generating…' : 'Regenerate'} onPress={regenerateBrief} loading={briefBusy} disabled={briefBusy} icon={!briefBusy ? <RefreshCw size={14} color="#FFF" strokeWidth={ICON_STROKE} /> : undefined} style={{ flex: 1 }} />
          </>
        }
      >
        {briefRow && (
          <View style={{ gap: 12 }}>
            {!!briefErr && (
              <View style={[s.errBox, { backgroundColor: T.danger + '1A', borderColor: T.danger }]}>
                <Text style={[s.errTxt, { color: T.danger }]}>{briefErr}</Text>
              </View>
            )}
            <Text style={[s.briefMeta, { color: T.sub }]}>
              {briefRow.studentName} · {typeLabel(briefRow.type)} · {briefRow.counselorName || 'Unassigned'}
            </Text>

            {briefRow.aiBrief ? (
              <View style={[s.briefBox, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <Text style={[s.briefTxt, { color: T.text }]}>{briefRow.aiBrief}</Text>
              </View>
            ) : (
              <Text style={[s.sub, { color: T.dim }]}>No brief yet — tap Regenerate to create one.</Text>
            )}

            {!!briefRow.aiPostSession && (
              <View style={{ gap: 6 }}>
                <Text style={[s.blockLabel, { color: T.sub }]}>Post-session next step</Text>
                <View style={[s.briefBox, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                  <Text style={[s.briefTxt, { color: T.text }]}>{briefRow.aiPostSession}</Text>
                </View>
              </View>
            )}

            {!!briefRow.aiGeneratedAt && <Text style={[s.sub, { color: T.dim }]}>Generated {fmtDateTime(briefRow.aiGeneratedAt)}</Text>}
          </View>
        )}
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, minWidth: 140 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  type: { fontSize: rf(12.5), fontWeight: '600' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  briefMeta: { fontSize: rf(12), fontWeight: '500' },
  briefBox: { borderRadius: 13, borderWidth: 1, padding: 12 },
  briefTxt: { fontSize: rf(13), fontWeight: '500', lineHeight: 20 },
  blockLabel: { fontSize: rf(12.5), fontWeight: '600' },
  textarea: { minHeight: 84, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 60 },
  errBox: { borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  errTxt: { fontSize: rf(12), fontWeight: '600' },
});
