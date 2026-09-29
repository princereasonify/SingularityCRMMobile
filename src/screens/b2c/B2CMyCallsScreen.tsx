/**
 * My Calls — a Calling Agent's own call history. Mobile twin of web's B2CMyCalls.jsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { StatusBadge, Btn, Dropdown, Trigger } from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive } from '../../hooks/useResponsive';
import { todayStr } from '../../utils/dates';
import { b2cCallingService, CALL_OUTCOMES, MyCallRow } from '../../api/b2c/b2cCallingService';

const PAGE_SIZE = 20;

const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');

const outcomeTone = (T: ReturnType<typeof useAppTheme>, o?: string | null) => {
  if (o === 'Connected') return T.success;
  if (o === 'CallBackLater') return T.accent;
  if (o === 'NotInterested' || o === 'WrongNumber') return T.danger;
  if (o === 'NotReachable' || o === 'Busy' || o === 'SwitchedOff') return T.warning;
  return T.dim;
};
const stageTone = (T: ReturnType<typeof useAppTheme>, s?: string | null) => {
  if (['Interested', 'AppointmentBooked', 'Converted'].includes(s || '')) return T.success;
  if (['NotInterested', 'Lost'].includes(s || '')) return T.danger;
  if (['Contacted', 'CounselingBooked'].includes(s || '')) return T.accent;
  return T.dim;
};

const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const B2CMyCallsScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outcome, setOutcome] = useState('');
  const [openOutcome, setOpenOutcome] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MyCallRow[]>([]);
  const [total, setTotal] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    b2cCallingService.getMyCalls({ page, pageSize: PAGE_SIZE, from: from || undefined, to: to || undefined, outcome: outcome || undefined })
      .then((res) => {
        setRows(res.data?.items || []);
        setTotal(res.data?.totalCount || 0);
        setConnectedCount(res.data?.connectedCount || 0);
      })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, from, to, outcome]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };
  const anyFilter = !!(from || to || outcome);
  const pageCount = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 14 }}>
        <View>
          <Text style={[styles.h1, { color: T.text }]}>My Calls</Text>
          <Text style={[styles.h2, { color: T.sub }]}>
            {total > 0 ? `${connectedCount} of ${total} reached someone${anyFilter ? ' in this range' : ''}` : 'Every call you log appears here'}
          </Text>
        </View>

        <View style={styles.filters}>
          <View style={{ flex: 1 }}><DateInput label="From" value={from} onChange={setFilter(setFrom)} maxDate={todayStr()} /></View>
          <View style={{ flex: 1 }}><DateInput label="To" value={to} onChange={setFilter(setTo)} maxDate={todayStr()} /></View>
        </View>
        <View>
          <Trigger label={outcome ? CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome : 'All outcomes'} open={openOutcome} onPress={() => setOpenOutcome((o) => !o)} />
          {openOutcome && (
            <Dropdown
              options={[{ label: 'All outcomes', value: '' }, ...CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))]}
              value={outcome}
              onSelect={(v) => { setFilter(setOutcome)(v); setOpenOutcome(false); }}
            />
          )}
        </View>
        {anyFilter && (
          <Btn label="Clear filters" variant="secondary" small onPress={() => { setFrom(''); setTo(''); setOutcome(''); setPage(1); }} icon={<X size={13} color={T.text} strokeWidth={ICON_STROKE} />} style={{ alignSelf: 'flex-start' }} />
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <Text style={{ color: T.sub, textAlign: 'center', marginTop: 40 }}>{anyFilter ? 'No calls in this range.' : 'No calls logged yet.'}</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => navigation.navigate('B2CLeadDetail', { leadId: c.leadId })} activeOpacity={0.7} style={[styles.card, { backgroundColor: T.card, borderColor: T.line }]}>
                <View style={styles.cardTop}>
                  <Text style={[styles.student, { color: T.text }]} numberOfLines={1}>{c.studentName}</Text>
                  <Text style={[styles.when, { color: T.dim }]}>{fmtDateTime(c.calledAt)}</Text>
                </View>
                <Text style={[styles.sub, { color: T.sub }]} numberOfLines={1}>{c.parentName || '—'} · {c.city || '—'}</Text>
                <View style={styles.badgeRow}>
                  {c.outcome ? <StatusBadge label={spaced(c.outcome)} color={outcomeTone(T, c.outcome)} /> : <Text style={{ color: T.dim, fontSize: 12 }}>—</Text>}
                  <StatusBadge label={spaced(c.leadStage)} color={stageTone(T, c.leadStage)} />
                </View>
                {!!(c.discussion || c.notes) && (
                  <Text style={[styles.discussion, { color: T.text }]} numberOfLines={2}>
                    {c.discussion}{c.notes ? `${c.discussion ? ' — ' : ''}Note: ${c.notes}` : ''}
                  </Text>
                )}
                {!!c.nextCallAt && <Text style={[styles.next, { color: T.accent }]}>Next call: {fmtDateTime(c.nextCallAt)}</Text>}
              </TouchableOpacity>
            ))}
            {pageCount > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                <Btn label="Prev" small variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                <Text style={{ color: T.sub, alignSelf: 'center', fontSize: 12 }}>{page} / {pageCount}</Text>
                <Btn label="Next" small variant="secondary" disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 3 },
  filters: { flexDirection: 'row', gap: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  student: { fontWeight: '700', fontSize: 14, flexShrink: 1 },
  when: { fontWeight: '500', fontSize: 11 },
  sub: { fontWeight: '500', fontSize: 12 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  discussion: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  next: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
});

export default B2CMyCallsScreen;
