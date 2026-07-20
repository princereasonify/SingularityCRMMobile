import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
  Alert, ActivityIndicator, TouchableOpacity, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Filter, Play, ThumbsUp, ThumbsDown, Minus, MessageSquare,
  Video, Music, MonitorPlay,
} from 'lucide-react-native';

import { demosApi } from '../../api/demos';
import { DemoAssignment } from '../../types';
import { DateInput } from '../../components/common/DateInput';
import { Icon, ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, Field, Trigger, Dropdown, StatusBadge, FilterChip, Pagination,
  ListCard, Avatar, FormModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { formatDate } from '../../utils/formatting';

/** House pattern: 10 per page, showing the server's real `total`. */
const PAGE_SIZE = 10;

const DASH = '—';

/** Web parity: DemoManagement.jsx opens this in a new tab for Start / Resume Demo. */
const DEMO_APP_URL = 'https://app.singularity-learn.com/';

/**
 * Web's tab strip is ['', Requested, Scheduled, InProgress, Completed, Cancelled] —
 * it silently omits Approved and Rescheduled even though DemoStatus (and the mobile
 * screen this replaces) has them. Superset kept on purpose: the server parses any
 * DemoStatus, so dropping them would strand those demos behind an unusable filter.
 */
const STATUSES = [
  'Requested', 'Approved', 'Scheduled', 'InProgress',
  'Completed', 'Cancelled', 'Rescheduled',
] as const;

const OUTCOMES = ['Successful', 'Partial', 'Unsuccessful', 'Rescheduled'] as const;
const SENTIMENTS = ['Positive', 'Neutral', 'Negative'] as const;

type Outcome = (typeof OUTCOMES)[number];
type Sentiment = (typeof SENTIMENTS)[number];

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

// ─── Complete Demo modal (web: the `completeModal` dialog) ────────────────────
function CompleteModal({ demoId, onClose, onDone }: {
  demoId: number; onClose: () => void; onDone: () => void;
}) {
  const T = useAppTheme();
  const [outcome, setOutcome] = useState<Outcome>('Successful');
  const [sentiment, setSentiment] = useState<Sentiment | ''>('');
  const [feedback, setFeedback] = useState('');
  const [openDd, setOpenDd] = useState(false);
  const [saving, setSaving] = useState(false);

  const sentimentColor = (s: Sentiment) =>
    s === 'Positive' ? T.success : s === 'Negative' ? T.danger : T.sub;

  const sentimentIcon = (s: Sentiment, color: string) =>
    s === 'Positive' ? <ThumbsUp size={14} color={color} strokeWidth={ICON_STROKE} />
      : s === 'Negative' ? <ThumbsDown size={14} color={color} strokeWidth={ICON_STROKE} />
        : <Minus size={14} color={color} strokeWidth={ICON_STROKE} />;

  const submit = async () => {
    // Web parity: sentiment is the only hard-required field.
    if (!sentiment) {
      Alert.alert('Feedback Sentiment', 'Please select feedback sentiment.');
      return;
    }
    setSaving(true);
    try {
      // Web parity: PUT /demos/{id} { status, outcome, feedback, feedbackSentiment }.
      await demosApi.update(demoId, {
        status: 'Completed',
        outcome,
        feedback,
        feedbackSentiment: sentiment,
      });
      onDone();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to complete demo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      visible
      title="Complete Demo"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn label="Complete Demo" variant="success" onPress={submit} loading={saving} small />
        </>
      }
    >
      <View style={s.mForm}>
        <Text style={[s.mSub, { color: T.sub }]}>Provide feedback after demo completion</Text>

        <Field label="Outcome *">
          <Trigger label={outcome} open={openDd} onPress={() => setOpenDd(v => !v)} />
          {openDd && (
            <Dropdown<Outcome>
              style={{ width: '100%' }}
              value={outcome}
              onSelect={v => { setOutcome(v); setOpenDd(false); }}
              options={OUTCOMES.map(o => ({ label: o, value: o }))}
            />
          )}
        </Field>

        <Field label="Feedback Sentiment *">
          <View style={s.sentRow}>
            {SENTIMENTS.map(x => {
              const on = sentiment === x;
              const c = sentimentColor(x);
              return (
                <TouchableOpacity
                  key={x}
                  activeOpacity={0.8}
                  onPress={() => setSentiment(x)}
                  style={[
                    s.sentBtn,
                    {
                      borderColor: on ? c : T.line,
                      backgroundColor: on ? withAlpha(c, SOFT_TINT) : 'transparent',
                    },
                  ]}
                >
                  {sentimentIcon(x, on ? c : T.dim)}
                  <Text style={[s.sentTxt, { color: on ? c : T.sub }]}>{x}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Feedback Notes">
          <TextInput
            style={[s.area, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={feedback}
            onChangeText={setFeedback}
            placeholder="How did the demo go? School's response…"
            placeholderTextColor={T.dim}
            multiline
            textAlignVertical="top"
          />
        </Field>
      </View>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const DemoListScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the table — never a card grid. Phones get list rows. */
  const table = isTabletDevice;

  const [demos, setDemos] = useState<DemoAssignment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [openDd, setOpenDd] = useState<'status' | null>(null);

  const [completeId, setCompleteId] = useState<number | null>(null);

  const statusColor = (st?: string) =>
    ({
      Requested: T.warning,
      Approved: T.info,
      Scheduled: T.accent,
      InProgress: T.info,
      Completed: T.success,
      Cancelled: T.danger,
      Rescheduled: T.warning,
    } as Record<string, string>)[st || ''] || T.dim;

  const sentimentColor = (x?: string) =>
    x === 'Positive' ? T.success : x === 'Negative' ? T.danger : T.sub;

  const fetchDemos = useCallback(async (pg: number) => {
    try {
      // GET /demos takes (status, assignedToId, from, to, page, limit) and returns
      //   Ok(ApiResponse<object>.Ok(new { demos, total, page, limit }))
      // — see DemosController.GetDemos. apiClient unwraps the ApiResponse envelope,
      // so res.data is the { demos, total, page, limit } object itself.
      const res = await demosApi.getAll({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page: pg,
        limit: PAGE_SIZE,
      });
      const list = res.data?.demos ?? [];
      const total = res.data?.total ?? 0;
      setDemos(list);
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch {
      setDemos([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, from, to]);

  // Any filter change resets to page 1 (web does the same on tab change).
  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchDemos(1);
  }, [status, from, to]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    setLoading(true);
    fetchDemos(p);
  };

  const reload = () => { setLoading(true); fetchDemos(page); };

  // Web parity: handleStatusUpdate — PUT /demos/{id} { status }.
  // `next` is the DemoAssignment union, not `string`: demosApi.update takes
  // Partial<DemoAssignment> & { status?: string }, and that intersection narrows
  // `status` back down to the union.
  const updateStatus = async (id: number, next: DemoAssignment['status']) => {
    try {
      await demosApi.update(id, { status: next });
      reload();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update.');
    }
  };

  const openDemoApp = () => Linking.openURL(DEMO_APP_URL).catch(() => {});

  const activeChips = [
    status ? { label: status, clear: () => setStatus('') } : null,
    from ? { label: `From: ${formatDate(from)}`, clear: () => setFrom('') } : null,
    to ? { label: `To: ${formatDate(to)}`, clear: () => setTo('') } : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  // ── media links (populated by the Record Demo flow / feedback upload) ──
  const mediaLinks = (d: DemoAssignment) => {
    const links = [
      d.feedbackVideoUrl ? { label: 'Video', url: d.feedbackVideoUrl, Ico: Video } : null,
      d.feedbackAudioUrl ? { label: 'Audio', url: d.feedbackAudioUrl, Ico: Music } : null,
      d.screenRecordingUrl ? { label: 'Screen Recording', url: d.screenRecordingUrl, Ico: MonitorPlay } : null,
    ].filter(Boolean) as { label: string; url: string; Ico: any }[];
    if (links.length === 0) return null;
    return (
      <View style={s.linkRow}>
        {links.map(l => (
          <TouchableOpacity
            key={l.label}
            activeOpacity={0.7}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            style={[s.link, { borderColor: T.line }]}
          >
            <l.Ico size={12} color={T.info} strokeWidth={ICON_STROKE} />
            <Text style={[s.linkTxt, { color: T.info }]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ── feedback strip — web renders this for Completed demos with feedback ──
  // `pad` is on only for the table: ListCard already supplies its own 14px inset,
  // so padding here as well would double-indent the strip on phone.
  const feedbackStrip = (d: DemoAssignment, pad: boolean) => {
    if (d.status !== 'Completed' || (!d.feedback && !d.feedbackSentiment)) return null;
    const c = sentimentColor(d.feedbackSentiment);
    return (
      <View style={[s.strip, pad && s.stripPad, { borderTopColor: T.line }]}>
        <View style={s.stripHead}>
          <MessageSquare size={13} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.stripLabel, { color: T.sub }]}>Feedback</Text>
          {!!d.feedbackSentiment && (
            <View style={[s.sentBadge, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
              {d.feedbackSentiment === 'Positive' && <ThumbsUp size={10} color={c} strokeWidth={ICON_STROKE} />}
              {d.feedbackSentiment === 'Negative' && <ThumbsDown size={10} color={c} strokeWidth={ICON_STROKE} />}
              {d.feedbackSentiment === 'Neutral' && <Minus size={10} color={c} strokeWidth={ICON_STROKE} />}
              <Text style={[s.sentBadgeTxt, { color: c }]}>{d.feedbackSentiment}</Text>
            </View>
          )}
          {!!d.outcome && (
            <Text style={[s.stripMeta, { color: T.dim }]}>Outcome: {d.outcome}</Text>
          )}
        </View>
        {!!d.feedback && <Text style={[s.stripTxt, { color: T.sub }]}>{d.feedback}</Text>}
        {mediaLinks(d)}
      </View>
    );
  };

  // ── action strip — mirrors web's per-status button set exactly ──
  const actionStrip = (d: DemoAssignment, pad: boolean) => {
    if (d.status === 'Completed' || d.status === 'Cancelled') return null;
    const markCompleted = () => setCompleteId(d.id);
    return (
      <View style={[s.strip, pad && s.stripPad, s.actionRow, { borderTopColor: T.line }]}>
        {d.status === 'Requested' && (
          <Btn label="Approve & Schedule" variant="soft" small onPress={() => updateStatus(d.id, 'Scheduled')} />
        )}
        {(d.status === 'Scheduled' || d.status === 'Approved') && (
          <>
            <Btn
              label="Start Demo"
              small
              icon={<Play size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
              onPress={() => { updateStatus(d.id, 'InProgress'); openDemoApp(); }}
            />
            <Btn label="Mark Completed" variant="success" small onPress={markCompleted} />
          </>
        )}
        {d.status === 'InProgress' && (
          <>
            <Btn
              label="Resume Demo"
              small
              icon={<Play size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
              onPress={openDemoApp}
            />
            <Btn label="Mark Completed" variant="success" small onPress={markCompleted} />
          </>
        )}
        <Btn label="Cancel" variant="dangerGhost" small onPress={() => updateStatus(d.id, 'Cancelled')} />
      </View>
    );
  };

  const openDetail = (id: number) => navigation.navigate('DemoDetail', { demoId: id });

  // ── table (tablet) ──
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cName]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cUser]}>Assigned To</Text>
        <Text style={[s.th, { color: T.dim }, s.cUser]}>Requested By</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cTime]}>Time</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
      </View>

      {demos.map(d => (
        <View key={d.id} style={{ borderTopColor: T.line, borderTopWidth: 1 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => openDetail(d.id)} style={s.tr}>
            <View style={[s.cName, s.nameCell]}>
              <Avatar initials={initialsOf(d.schoolName)} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{d.schoolName}</Text>
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                  {(d.leadName || 'Lead') + ' • ' + d.demoMode}
                </Text>
              </View>
            </View>
            <Text style={[s.td, { color: T.sub }, s.cUser]} numberOfLines={1}>{d.assignedToName || DASH}</Text>
            <Text style={[s.td, { color: T.sub }, s.cUser]} numberOfLines={1}>{d.requestedByName || DASH}</Text>
            <Text style={[s.td, { color: T.sub }, s.cDate]} numberOfLines={1}>{formatDate(d.scheduledDate) || DASH}</Text>
            <Text style={[s.td, { color: T.sub }, s.cTime]} numberOfLines={1}>
              {d.scheduledStartTime} - {d.scheduledEndTime}
            </Text>
            <View style={s.cStatus}>
              <StatusBadge label={d.status} color={statusColor(d.status)} />
            </View>
          </TouchableOpacity>
          {feedbackStrip(d, true)}
          {actionStrip(d, true)}
        </View>
      ))}
    </View>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {demos.map(d => (
        <ListCard key={d.id} style={s.rowCard}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => openDetail(d.id)} style={s.rowTop}>
            <Avatar initials={initialsOf(d.schoolName)} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{d.schoolName}</Text>
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                {(d.leadName || 'Lead') + ' • ' + d.demoMode}
              </Text>
            </View>
            <StatusBadge label={d.status} color={statusColor(d.status)} />
          </TouchableOpacity>

          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={[s.metaLabel, { color: T.dim }]}>Assigned To</Text>
              <Text style={[s.metaVal, { color: T.text }]} numberOfLines={1}>{d.assignedToName || DASH}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={[s.metaLabel, { color: T.dim }]}>Requested By</Text>
              <Text style={[s.metaVal, { color: T.text }]} numberOfLines={1}>{d.requestedByName || DASH}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={[s.metaLabel, { color: T.dim }]}>Date</Text>
              <Text style={[s.metaVal, { color: T.text }]} numberOfLines={1}>{formatDate(d.scheduledDate) || DASH}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={[s.metaLabel, { color: T.dim }]}>Time</Text>
              <Text style={[s.metaVal, { color: T.text }]} numberOfLines={1}>
                {d.scheduledStartTime} - {d.scheduledEndTime}
              </Text>
            </View>
          </View>

          {feedbackStrip(d, false)}
          {actionStrip(d, false)}
        </ListCard>
      ))}
    </View>
  );

  const fromIdx = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIdx = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDemos(page); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Title block + Assign Demo — web's page header */}
        <View style={[s.header, wide && s.headerWide]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]}>Demo Management</Text>
            <Text style={[s.subtitle, { color: T.sub }]}>Assign, track, and manage product demos</Text>
          </View>
          <Btn
            label="Assign Demo"
            small
            onPress={() => navigation.navigate('AssignDemo')}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        {/* Status + filters + count */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <View style={{ flex: 1 }}>
              <Trigger
                label={status || 'All Statuses'}
                open={openDd === 'status'}
                onPress={() => setOpenDd(openDd === 'status' ? null : 'status')}
              />
            </View>
            <Trigger
              label="Filters"
              open={showFilters}
              onPress={() => setShowFilters(v => !v)}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
          </View>

          {openDd === 'status' && (
            <Dropdown
              style={{ width: wide ? 260 : '100%' }}
              maxHeight={280}
              value={status}
              onSelect={v => { setStatus(v === status ? '' : v); setOpenDd(null); }}
              options={STATUSES.map(st => ({ label: st, value: st }))}
            />
          )}

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>
              {totalCount} demo{totalCount === 1 ? '' : 's'}
            </Text>
            {activeChips.length > 0 && (
              <View style={s.chipWrap}>
                {activeChips.map(c => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
              </View>
            )}
          </View>

          {showFilters && (
            <View style={[s.filters, { borderTopColor: T.line }, wide && s.filtersWide]}>
              <Field label="From" style={wide ? { flex: 1 } : undefined}>
                <DateInput value={from} onChange={setFrom} placeholder="Any date" accentColor={T.accent} />
              </Field>
              <Field label="To" style={wide ? { flex: 1 } : undefined}>
                <DateInput value={to} onChange={setTo} placeholder="Any date" accentColor={T.accent} />
              </Field>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : demos.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Icon name="Demos" size={34} color={T.dim} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No demos found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Assign a demo to get started.</Text>
          </View>
        ) : (
          <>
            {table ? renderTable() : renderRows()}
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  Showing {fromIdx}{DASH}{toIdx} of {totalCount}
                </Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {completeId != null && (
        <CompleteModal
          demoId={completeId}
          onClose={() => setCompleteId(null)}
          onDone={() => { setCompleteId(null); reload(); }}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filters: { borderTopWidth: 1, paddingTop: 12, gap: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'flex-start' },

  // table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line · pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cName: { flex: 2.4 },
  cUser: { flex: 1.3 },
  cDate: { flex: 1.1 },
  cTime: { flex: 1.1 },
  cStatus: { flex: 1 },

  // phone rows
  rowCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  metaCell: { width: '50%', paddingRight: 8 },
  metaLabel: { fontSize: rf(10.5), fontWeight: '600' },
  metaVal: { fontSize: rf(12.5), fontWeight: '700', marginTop: 1 },

  // feedback / action strips
  strip: { borderTopWidth: 1, paddingTop: 10, gap: 7 },
  /** Table rows have no inner padding of their own; ListCard already insets 14. */
  stripPad: { paddingHorizontal: 16, paddingBottom: 12 },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stripLabel: { fontSize: rf(11.5), fontWeight: '700' },
  stripMeta: { fontSize: rf(11.5), fontWeight: '500' },
  stripTxt: { fontSize: rf(12.5), fontWeight: '400', lineHeight: 18 },
  linkRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  linkTxt: { fontSize: rf(11.5), fontWeight: '600' },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 9, borderRadius: 11 },
  sentBadgeTxt: { fontSize: rf(11), fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modal
  mForm: { gap: 14 },
  mSub: { fontSize: rf(12), fontWeight: '500' },
  sentRow: { flexDirection: 'row', gap: 8 },
  sentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: 11, borderWidth: 1,
  },
  sentTxt: { fontSize: rf(12.5), fontWeight: '600' },
  area: {
    minHeight: 92, borderRadius: 13, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: rf(14), fontWeight: '500',
  },
});
