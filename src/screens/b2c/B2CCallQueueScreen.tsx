/**
 * Call Queue — who to ring, overdue first. Mobile twin of web's B2CCallQueue.jsx. The heart of
 * the Calling Agent's job: log a call, optionally hand the family to a field agent or counsellor
 * in the same step.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Phone, PhoneCall, Clock, AlertTriangle, UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import {
  Btn, StatusBadge, SearchBar, Dropdown, Trigger, FormModal, Input, Segmented, Checkbox,
} from '../../components/crud';
import { StatTile } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { CoinBalance } from '../../components/b2c/CoinBalance';
import { StaffAvailabilityPicker } from '../../components/b2c/StaffAvailabilityPicker';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useToast } from '../../context/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { todayStr, joinLocal, splitLocal } from '../../utils/dates';
import {
  b2cCallingService, CALL_OUTCOMES, outcomeMeta, HANDOFF_REASONS, CallQueueRow, CallQueueSummary,
} from '../../api/b2c/b2cCallingService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cObjectionService } from '../../api/b2c/b2cObjectionService';
import { StaffAvailabilityRow } from '../../api/b2c/b2cCallingService';

const PAGE_SIZE = 20;

const STAGES = ['New', 'Contacted', 'Interested', 'AppointmentBooked', 'DocumentPending',
  'CounselingBooked', 'CounselingDone', 'DemoDone', 'ApplicationSent', 'FollowUp'];
const SOURCES = ['Website', 'Facebook', 'Instagram', 'GoogleAds', 'WhatsApp', 'WalkIn', 'Event', 'Other'];
const PRIORITIES = ['Hot', 'Warm', 'Cold'];

const BUCKETS: { key: CallQueueRow['bucket']; title: string; tone: 'danger' | 'warning' | 'accent' | 'dim'; hint: string }[] = [
  { key: 'Overdue', title: 'Overdue', tone: 'danger', hint: 'Promised a call that never happened' },
  { key: 'DueToday', title: 'Due', tone: 'warning', hint: 'Callbacks scheduled for this day' },
  { key: 'NeverCalled', title: 'Never called', tone: 'accent', hint: 'No call logged yet — check Stage and Owner, someone may already have met them' },
  { key: 'Later', title: 'Other leads', tone: 'dim', hint: 'Called before, nothing scheduled' },
];

const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');
const stageColor = (T: ReturnType<typeof useAppTheme>, stage: string) => {
  if (['Interested', 'AppointmentBooked'].includes(stage)) return T.success;
  if (['CounselingBooked', 'CounselingDone', 'DemoDone', 'Contacted'].includes(stage)) return T.accent;
  if (stage === 'FollowUp') return T.warning;
  return T.dim;
};
const bucketColor = (T: ReturnType<typeof useAppTheme>, tone: string) =>
  tone === 'danger' ? T.danger : tone === 'warning' ? T.warning : tone === 'accent' ? T.accent : T.dim;

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const sinceLabel = (d?: string | null) => {
  if (!d) return 'never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const timeLabel = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  return `${h % 12 || 12}:${pad2(m || 0)} ${h >= 12 ? 'pm' : 'am'}`;
};
const TIME_SLOTS: { label: string; value: string }[] = (() => {
  const out: { label: string; value: string }[] = [];
  for (let h = 6; h <= 21; h++) for (const m of [0, 15, 30, 45]) out.push({ value: `${pad2(h)}:${pad2(m)}`, label: timeLabel(`${pad2(h)}:${pad2(m)}`) });
  return out;
})();
/** A local ISO instant one hour from now — a sane default for "call back later". */
const inAnHour = () => new Date(Date.now() + 3600000).toISOString();

interface HandoffState {
  kind: 'Agent' | 'Counselor';
  staff: StaffAvailabilityRow | null;
  at: string; // ISO
  notes: string;
  reason: string;
}

export const B2CCallQueueScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();

  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState('');
  const [neverCalled, setNeverCalled] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openDd, setOpenDd] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<CallQueueRow[]>([]);
  const [summary, setSummary] = useState<CallQueueSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Log Call modal
  const [active, setActive] = useState<CallQueueRow | null>(null);
  const [lockWarning, setLockWarning] = useState('');
  const [outcome, setOutcome] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [notes, setNotes] = useState('');
  const [nextCallAt, setNextCallAt] = useState(''); // ISO
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState<HandoffState | null>(null);

  const meta = outcomeMeta(outcome);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    b2cCallingService.getQueue({
      page, pageSize: PAGE_SIZE, date,
      search: debouncedSearch || undefined, stage: stage || undefined, source: source || undefined,
      priority: priority || undefined, neverCalled: neverCalled || undefined,
    })
      .then((res) => {
        setRows(res.data?.items || []);
        setSummary(res.data?.summary || null);
        setTotalCount(res.data?.totalCount || 0);
      })
      .catch(() => { setRows([]); setSummary(null); setTotalCount(0); })
      .finally(() => setLoading(false));
  }, [page, date, debouncedSearch, stage, source, priority, neverCalled]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (fn: (v: any) => void) => (v: any) => { fn(v); setPage(1); };
  const clearFilters = () => { setSearch(''); setStage(''); setSource(''); setPriority(''); setNeverCalled(false); setPage(1); };
  const anyFilter = !!(search || stage || source || priority || neverCalled);

  const grouped = useMemo(
    () => BUCKETS.map((b) => ({ ...b, rows: rows.filter((row) => row.bucket === b.key) })).filter((b) => b.rows.length > 0),
    [rows],
  );

  // ── Calling ───────────────────────────────────────────────────────────────
  const startCall = async (row: CallQueueRow) => {
    setActive(row);
    setOutcome(''); setDiscussion(''); setNotes(''); setNextCallAt('');
    setHandoff(null); setError(''); setLockWarning('');
    try {
      const res = await b2cCallingService.acquireLock(row.id);
      if (res.data && res.data.acquired === false) {
        setLockWarning(`${res.data.heldByName || 'Someone'} is on this lead right now.`);
      }
    } catch { /* the lock is a nicety; never block a call on it */ }
  };

  const closeCall = () => {
    const leadId = active?.id;
    setActive(null);
    if (leadId) b2cCallingService.releaseLock(leadId).catch(() => {});
  };

  const submitCall = async () => {
    if (!active) return;
    setSaving(true); setError('');
    try {
      const res = await b2cCallingService.logCall({
        leadId: active.id,
        outcome,
        discussion: discussion || undefined,
        notes: notes || undefined,
        nextCallAt: !meta?.terminal && nextCallAt ? nextCallAt : undefined,
      });

      let handoffNote = '';
      if (handoff?.staff) {
        try {
          if (handoff.kind === 'Agent') {
            await b2cLeadService.assignLead(active.id, handoff.staff.userId, handoff.at || undefined, handoff.notes || undefined);
          } else {
            await b2cObjectionService.escalate(active.id, {
              counselorId: handoff.staff.counselorId,
              type: handoff.reason || 'Other',
              details: handoff.notes || discussion || undefined,
              scheduledAt: handoff.at || undefined,
            });
          }
          handoffNote = ` · handed to ${handoff.staff.name}`;
        } catch (err: any) {
          toast.error(`Call saved, but the hand-off failed: ${err?.response?.data?.message || 'try again from the lead'}`);
          setActive(null);
          load();
          return;
        }
      }

      toast.success((res.data?.stageAdvanced ? 'Call logged — lead moved on' : 'Call logged') + handoffNote);
      setActive(null);
      b2cCallingService.releaseLock(active.id).catch(() => {});
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not log the call');
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || !outcome
    || (!!meta?.connected && !discussion.trim())
    || (outcome === 'CallBackLater' && !nextCallAt)
    || (!!handoff && (!handoff.staff || !handoff.at || (handoff.kind === 'Counselor' && !handoff.reason)));

  const kpiW = r.isTablet ? '24%' : '48.5%';
  const nextCallSplit = splitLocal(nextCallAt);
  const handoffSplit = splitLocal(handoff?.at || '');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: T.text }]}>Call Queue</Text>
            <Text style={[styles.h2, { color: T.sub }]}>Who to ring — overdue first, then today's callbacks</Text>
          </View>
        </View>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}><DateInput label="Day" value={date} onChange={(d) => { setDate(d); setPage(1); }} /></View>
          <Btn label="Today" small variant={date === todayStr() ? 'primary' : 'secondary'} onPress={() => { setDate(todayStr()); setPage(1); }} />
        </View>

        <View style={styles.kpiGrid}>
          <StatTile style={{ width: kpiW }} label="Overdue" value={summary?.overdue ?? '—'} icon={<AlertTriangle size={17} color={T.danger} strokeWidth={ICON_STROKE} />} tint={T.danger} />
          <StatTile style={{ width: kpiW }} label="Due this day" value={summary?.dueToday ?? '—'} icon={<Clock size={17} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={{ width: kpiW }} label="Never called" value={summary?.neverCalled ?? '—'} icon={<PhoneCall size={17} color={T.accent} strokeWidth={ICON_STROKE} />} />
          <StatTile style={{ width: kpiW }} label="In queue" value={summary?.total ?? totalCount} icon={<Phone size={17} color={T.text} strokeWidth={ICON_STROKE} />} />
        </View>

        <View style={styles.searchRow}>
          <SearchBar value={search} onChangeText={setFilter(setSearch)} placeholder="Student, parent, mobile, area…" style={{ flex: 1 }} />
          <Btn label={`Filters${anyFilter ? ' •' : ''}`} small variant={showFilters || anyFilter ? 'primary' : 'secondary'} onPress={() => setShowFilters((s) => !s)} icon={showFilters ? <ChevronUp size={14} color={showFilters ? '#FFF' : T.text} strokeWidth={ICON_STROKE} /> : <ChevronDown size={14} color={showFilters ? '#FFF' : T.text} strokeWidth={ICON_STROKE} />} />
        </View>

        {showFilters && (
          <View style={[styles.filterPanel, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={styles.filterGrid}>
              <View style={styles.filterCell}>
                <Trigger label={stage ? spaced(stage) : 'All stages'} open={openDd === 'stage'} onPress={() => setOpenDd((d) => (d === 'stage' ? null : 'stage'))} />
                {openDd === 'stage' && <Dropdown options={[{ label: 'All stages', value: '' }, ...STAGES.map((s) => ({ label: spaced(s), value: s }))]} value={stage} onSelect={(v) => { setFilter(setStage)(v); setOpenDd(null); }} />}
              </View>
              <View style={styles.filterCell}>
                <Trigger label={source ? spaced(source) : 'All sources'} open={openDd === 'source'} onPress={() => setOpenDd((d) => (d === 'source' ? null : 'source'))} />
                {openDd === 'source' && <Dropdown options={[{ label: 'All sources', value: '' }, ...SOURCES.map((s) => ({ label: spaced(s), value: s }))]} value={source} onSelect={(v) => { setFilter(setSource)(v); setOpenDd(null); }} />}
              </View>
              <View style={styles.filterCell}>
                <Trigger label={priority || 'Any priority'} open={openDd === 'priority'} onPress={() => setOpenDd((d) => (d === 'priority' ? null : 'priority'))} />
                {openDd === 'priority' && <Dropdown options={[{ label: 'Any priority', value: '' }, ...PRIORITIES.map((p) => ({ label: p, value: p }))]} value={priority} onSelect={(v) => { setFilter(setPriority)(v); setOpenDd(null); }} />}
              </View>
              <Checkbox on={neverCalled} onToggle={() => setFilter(setNeverCalled)(!neverCalled)} label="Never called only" />
            </View>
            {anyFilter && <Btn label="Clear filters" small variant="secondary" onPress={clearFilters} style={{ alignSelf: 'flex-start', marginTop: 10 }} />}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: T.sub, fontSize: 13, fontWeight: '500' }}>Nothing to call for this day.</Text>
            {anyFilter && <TouchableOpacity onPress={clearFilters}><Text style={{ color: T.accent, marginTop: 8 }}>Clear filters</Text></TouchableOpacity>}
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {grouped.map((bucket) => (
              <View key={bucket.key} style={{ gap: 8 }}>
                <View style={styles.bucketHead}>
                  <StatusBadge label={`${bucket.title} · ${bucket.rows.length}`} color={bucketColor(T, bucket.tone)} />
                  <Text style={[styles.bucketHint, { color: T.dim }]} numberOfLines={1}>{bucket.hint}</Text>
                </View>
                {bucket.rows.map((row) => (
                  <View key={row.id} style={[styles.card, { backgroundColor: T.card, borderColor: T.line }]}>
                    <View style={styles.cardTop}>
                      <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => navigation.navigate('B2CLeadDetail', { leadId: row.id })}>
                        <Text style={[styles.student, { color: T.text }]} numberOfLines={1}>{row.studentName}</Text>
                        <Text style={[styles.subLine, { color: T.sub }]} numberOfLines={1}>{[row.city, row.area].filter(Boolean).join(' · ')}{row.grade ? ` · ${row.grade}` : ''}</Text>
                        {!!row.callLockedByName && !row.lockedByMe && <Text style={{ color: T.danger, fontSize: 11, fontWeight: '600', marginTop: 2 }}>● {row.callLockedByName} is calling</Text>}
                      </TouchableOpacity>
                      <StatusBadge label={spaced(row.stage)} color={stageColor(T, row.stage)} />
                    </View>

                    <View style={styles.phoneRow}>
                      <Text style={[styles.subLine, { color: T.text }]}>{row.parentName || 'no parent name'}</Text>
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${row.parentMobile || row.mobileNumber}`)}>
                        <Text style={[styles.phone, { color: T.accent }]}>{row.parentMobile || row.mobileNumber}</Text>
                      </TouchableOpacity>
                      {!row.parentMobile && <Text style={{ color: T.warning, fontSize: 11, fontWeight: '600' }}>student's own number</Text>}
                      <CoinBalance value={row.coinBalance} />
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={[styles.metaTxt, { color: T.sub }]}>Last call: {sinceLabel(row.lastCalledAt)} · {row.callAttempts === 0 ? 'no attempts' : `${row.callAttempts} attempt${row.callAttempts > 1 ? 's' : ''}`}</Text>
                    </View>
                    {!!row.lastCallNote && <Text style={[styles.note, { color: T.dim }]} numberOfLines={2}>"{row.lastCallNote}"</Text>}

                    <View style={styles.footerRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.metaTxt, { color: row.bucket === 'Overdue' ? T.danger : T.sub, fontWeight: row.bucket === 'Overdue' ? '700' : '500' }]}>
                          Due: {row.nextCallAt ? fmtDateTime(row.nextCallAt) : '—'}
                        </Text>
                        {!!row.appointmentAt && <Text style={[styles.metaTxt, { color: T.dim }]}>visit {fmtDate(row.appointmentAt)}</Text>}
                        <Text style={[styles.metaTxt, { color: T.dim }]}>{row.assignedAgentName || row.assignedCounselorName || 'unassigned'}</Text>
                      </View>
                      <Btn label="Log Call" small onPress={() => startCall(row)} icon={<Phone size={13} color="#FFF" strokeWidth={ICON_STROKE} />} />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Log Call ─────────────────────────────────────────────────────────── */}
      <FormModal visible={!!active} onClose={closeCall} title={active ? `Call — ${active.studentName}` : ''} wide>
        {active && (
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 14 }}>
              {!!lockWarning && (
                <View style={[styles.alert, { backgroundColor: T.warning + '18', borderColor: T.warning + '40' }]}>
                  <AlertTriangle size={14} color={T.warning} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.alertTxt, { color: T.text }]}>{lockWarning} You can still call — just check with them first.</Text>
                </View>
              )}
              {!!error && (
                <View style={[styles.alert, { backgroundColor: T.danger + '18', borderColor: T.danger + '40' }]}>
                  <AlertTriangle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.alertTxt, { color: T.text }]}>{error}</Text>
                </View>
              )}

              <View style={[styles.callInfo, { backgroundColor: T.cardAlt }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.parent, { color: T.text }]}>{active.parentMobile ? (active.parentName || 'Parent') : `${active.studentName} (student)`}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${active.parentMobile || active.mobileNumber}`)}>
                    <Text style={[styles.phoneLg, { color: T.accent }]}>{active.parentMobile || active.mobileNumber}</Text>
                  </TouchableOpacity>
                  {!active.parentMobile && <Text style={{ color: T.warning, fontSize: 11, fontWeight: '600' }}>No parent number on file — this is the student's own.</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusBadge label={spaced(active.stage)} color={stageColor(T, active.stage)} />
                  <CoinBalance value={active.coinBalance} />
                </View>
              </View>

              {!!active.lastCallNote && (
                <Text style={[styles.lastNote, { color: T.dim, borderLeftColor: T.line }]}>
                  Last time ({sinceLabel(active.lastCalledAt)}): "{active.lastCallNote}"
                </Text>
              )}

              <View>
                <Text style={[styles.fieldLabel, { color: T.text }]}>How did the call go? *</Text>
                <Trigger label={outcome ? CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome : 'Select an outcome…'} open={openDd === 'outcome'} onPress={() => setOpenDd((d) => (d === 'outcome' ? null : 'outcome'))} />
                {openDd === 'outcome' && (
                  <Dropdown
                    options={CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))}
                    value={outcome}
                    onSelect={(v) => {
                      const m = outcomeMeta(v);
                      setOutcome(v);
                      if (v === 'CallBackLater' && !nextCallAt) setNextCallAt(inAnHour());
                      if (!m?.connected) setDiscussion('');
                      setOpenDd(null);
                    }}
                  />
                )}
              </View>

              {meta?.connected && (
                <Input label="What did you discuss with the parent? *" value={discussion} onChangeText={setDiscussion} multiline numberOfLines={3} placeholder="What they asked, what they were worried about, what you promised…" />
              )}

              {!meta?.terminal && (
                <View>
                  <Text style={[styles.fieldLabel, { color: T.text }]}>Call them back on{outcome === 'CallBackLater' ? ' *' : ''}</Text>
                  <View style={styles.slotRow}>
                    <View style={{ flex: 1 }}><DateInput value={nextCallSplit.date} onChange={(d) => setNextCallAt(joinLocal(d, nextCallSplit.time || '10:00') || '')} placeholder="Pick a day" /></View>
                    <View style={{ flex: 1 }}>
                      <Trigger label={nextCallSplit.time ? timeLabel(nextCallSplit.time) : 'Pick a time'} open={openDd === 'nextTime'} onPress={() => setOpenDd((d) => (d === 'nextTime' ? null : 'nextTime'))} />
                      {openDd === 'nextTime' && <Dropdown options={TIME_SLOTS} value={nextCallSplit.time} onSelect={(v) => { setNextCallAt(joinLocal(nextCallSplit.date || todayStr(), v) || ''); setOpenDd(null); }} maxHeight={220} />}
                    </View>
                  </View>
                </View>
              )}

              {meta?.terminal && (
                <View style={[styles.alert, { backgroundColor: T.info + '18', borderColor: T.info + '40' }]}>
                  <Text style={[styles.alertTxt, { color: T.text }]}>This closes the family off from the call queue — no callback will be scheduled.</Text>
                </View>
              )}

              <Input label="Internal note" value={notes} onChangeText={setNotes} multiline numberOfLines={2} placeholder="Not about the conversation — anything the team should know." />

              {/* ── Hand the family on ───────────────────────────────────────── */}
              <View style={[styles.handoffBox, { borderTopColor: T.line }]}>
                {!handoff ? (
                  <TouchableOpacity onPress={() => setHandoff({ kind: 'Agent', staff: null, at: nextCallAt || '', notes: '', reason: '' })} style={styles.handoffToggle}>
                    <UserCheck size={14} color={T.accent} strokeWidth={ICON_STROKE} />
                    <Text style={[styles.handoffToggleTxt, { color: T.accent }]}>Hand this family to someone</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={styles.handoffHead}>
                      <Text style={[styles.fieldLabel, { color: T.text, marginBottom: 0 }]}>Hand this family to</Text>
                      <TouchableOpacity onPress={() => setHandoff(null)}><Text style={{ color: T.dim, fontSize: 11, fontWeight: '600' }}>Remove</Text></TouchableOpacity>
                    </View>

                    <Segmented
                      value={handoff.kind}
                      options={[{ value: 'Agent', label: 'Field agent' }, { value: 'Counselor', label: 'Counsellor' }]}
                      onChange={(v) => setHandoff((h) => (h ? { ...h, kind: v as 'Agent' | 'Counselor', staff: null } : h))}
                    />

                    <View>
                      <Text style={[styles.fieldLabel, { color: T.text }]}>When *</Text>
                      <View style={styles.slotRow}>
                        <View style={{ flex: 1 }}><DateInput value={handoffSplit.date} onChange={(d) => setHandoff((h) => (h ? { ...h, at: joinLocal(d, handoffSplit.time || '10:00') || '', staff: null } : h))} placeholder="Pick a day" /></View>
                        <View style={{ flex: 1 }}>
                          <Trigger label={handoffSplit.time ? timeLabel(handoffSplit.time) : 'Pick a time'} open={openDd === 'handoffTime'} onPress={() => setOpenDd((d) => (d === 'handoffTime' ? null : 'handoffTime'))} />
                          {openDd === 'handoffTime' && <Dropdown options={TIME_SLOTS} value={handoffSplit.time} onSelect={(v) => { setHandoff((h) => (h ? { ...h, at: joinLocal(handoffSplit.date || todayStr(), v) || '', staff: null } : h)); setOpenDd(null); }} maxHeight={220} />}
                        </View>
                      </View>
                    </View>

                    {handoff.kind === 'Counselor' && (
                      <View>
                        <Text style={[styles.fieldLabel, { color: T.text }]}>Why are they being handed over? *</Text>
                        <Trigger label={handoff.reason ? HANDOFF_REASONS.find((h) => h.value === handoff.reason)?.label || handoff.reason : 'Select a reason…'} open={openDd === 'reason'} onPress={() => setOpenDd((d) => (d === 'reason' ? null : 'reason'))} />
                        {openDd === 'reason' && <Dropdown options={HANDOFF_REASONS} value={handoff.reason} onSelect={(v) => { setHandoff((h) => (h ? { ...h, reason: v } : h)); setOpenDd(null); }} />}
                      </View>
                    )}

                    <StaffAvailabilityPicker
                      kind={handoff.kind}
                      at={handoff.at}
                      value={handoff.staff?.userId}
                      onChange={(row) => setHandoff((h) => (h ? { ...h, staff: row } : h))}
                      label={handoff.kind === 'Agent' ? 'Field agent' : 'Counsellor'}
                    />

                    <Input
                      label="What should they know?"
                      value={handoff.notes}
                      onChangeText={(v: string) => setHandoff((h) => (h ? { ...h, notes: v } : h))}
                      multiline numberOfLines={2}
                      placeholder={handoff.kind === 'Agent' ? 'Who will be home, parking, anything agreed on the call.' : 'Defaults to what you wrote above if left blank.'}
                    />
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn label="Cancel" variant="secondary" onPress={closeCall} style={{ flex: 1 }} disabled={saving} />
                <Btn label={saving ? 'Saving…' : 'Save call'} onPress={submitCall} loading={saving} disabled={saveDisabled} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        )}
      </FormModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 3 },
  dateRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterPanel: { borderRadius: 14, borderWidth: 1, padding: 12 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  filterCell: { minWidth: 140, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  bucketHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucketHint: { fontSize: 11, fontWeight: '500', flexShrink: 1 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  student: { fontWeight: '700', fontSize: 14 },
  subLine: { fontWeight: '500', fontSize: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  phone: { fontWeight: '700', fontSize: 14 },
  metaRow: { flexDirection: 'row' },
  metaTxt: { fontSize: 11.5, fontWeight: '500' },
  note: { fontSize: 11.5, fontWeight: '500', fontStyle: 'italic' },
  footerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  alert: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'flex-start' },
  alertTxt: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  callInfo: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderRadius: 12, padding: 12 },
  parent: { fontWeight: '700', fontSize: 14 },
  phoneLg: { fontWeight: '800', fontSize: 18, marginTop: 2 },
  lastNote: { fontSize: 12, fontWeight: '500', fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  slotRow: { flexDirection: 'row', gap: 10 },
  handoffBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  handoffToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handoffToggleTxt: { fontWeight: '600', fontSize: 13 },
  handoffHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

export default B2CCallQueueScreen;
