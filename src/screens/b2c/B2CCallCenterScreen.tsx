/**
 * Calling Agents (B2CAdmin) — call-centre performance, who called whom. Mobile twin of web's
 * B2CCallCenter.jsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneCall, PhoneOff, CalendarClock, UserCheck, AlertTriangle, ExternalLink } from 'lucide-react-native';
import { Btn, StatusBadge, SearchBar, Dropdown, Trigger } from '../../components/crud';
import { StatTile, Card, SectionLabel } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive } from '../../hooks/useResponsive';
import { todayStr } from '../../utils/dates';
import {
  b2cCallingService, CALL_OUTCOMES, CallCenterSummary, CallLogRow,
} from '../../api/b2c/b2cCallingService';

const PAGE_SIZE = 20;
const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');
const outcomeTone = (T: ReturnType<typeof useAppTheme>, o?: string | null) => {
  if (o === 'Connected') return T.success;
  if (o === 'CallBackLater') return T.accent;
  if (o === 'NotInterested' || o === 'WrongNumber') return T.danger;
  if (o === 'NotReachable' || o === 'Busy' || o === 'SwitchedOff') return T.warning;
  return T.dim;
};
const stageColor = (T: ReturnType<typeof useAppTheme>, s?: string | null) => {
  if (['Interested', 'AppointmentBooked', 'Converted'].includes(s || '')) return T.success;
  if (['NotInterested', 'Lost'].includes(s || '')) return T.danger;
  if (['Contacted', 'CounselingBooked'].includes(s || '')) return T.accent;
  return T.dim;
};
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const sinceLabel = (d?: string | null) => {
  if (!d) return 'never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};
const rateText = (r: number, calls: number) => (calls === 0 ? '—' : `${r}%`);

export const B2CCallCenterScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<CallCenterSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [callerId, setCallerId] = useState('');
  const [outcome, setOutcome] = useState('');
  const [openDd, setOpenDd] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingLog, setLoadingLog] = useState(true);

  const loadSummary = useCallback(() => {
    setLoadingSummary(true);
    b2cCallingService.getCallCenterSummary({ from: from || undefined, to: to || undefined })
      .then((res) => setSummary(res.data || null))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [from, to]);

  const loadLog = useCallback(() => {
    setLoadingLog(true);
    b2cCallingService.getCallLog({ page, pageSize: PAGE_SIZE, from: from || undefined, to: to || undefined, callerId: callerId || undefined, outcome: outcome || undefined, search: search || undefined })
      .then((res) => { setRows(res.data?.items || []); setTotal(res.data?.totalCount || 0); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoadingLog(false));
  }, [page, from, to, callerId, outcome, search]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadLog(); }, [loadLog]);

  const setWindow = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1); };
  const quick = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 86400000);
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setWindow(iso(start), iso(end));
  };

  const callers = summary?.callers || [];
  const pageCount = Math.ceil(total / PAGE_SIZE) || 1;
  const kpiW = r.isTablet ? '24%' : '48.5%';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.h1, { color: T.text }]}>Calling Agents</Text>
          <Text style={[styles.h2, { color: T.sub }]}>{summary ? `Who called whom — ${summary.startDate} to ${summary.endDate}` : 'Who called whom, and what came of it'}</Text>
        </View>

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}><DateInput label="From" value={from} onChange={(d) => setWindow(d, to)} maxDate={todayStr()} /></View>
          <View style={{ flex: 1 }}><DateInput label="To" value={to} onChange={(d) => setWindow(from, d)} maxDate={todayStr()} /></View>
        </View>
        <View style={styles.quickRow}>
          <Btn label="7 days" small variant="secondary" onPress={() => quick(7)} />
          <Btn label="30 days" small variant="secondary" onPress={() => quick(30)} />
        </View>

        <View style={styles.kpiGrid}>
          <StatTile style={{ width: kpiW }} label="Calls" value={loadingSummary ? '…' : summary?.totalCalls ?? '—'} icon={<PhoneCall size={17} color={T.text} strokeWidth={ICON_STROKE} />} sub={summary ? `${summary.connected} reached someone` : ''} />
          <StatTile style={{ width: kpiW }} label="Connect rate" value={loadingSummary ? '…' : (summary ? rateText(summary.connectRate, summary.totalCalls) : '—')} icon={<PhoneOff size={17} color={T.text} strokeWidth={ICON_STROKE} />} sub="Of calls made in this window" />
          <StatTile style={{ width: kpiW }} label="Callbacks booked" value={loadingSummary ? '…' : summary?.callbacksBooked ?? '—'} icon={<CalendarClock size={17} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} sub="Parents promised a call back" />
          <StatTile style={{ width: kpiW }} label="Handed over" value={loadingSummary ? '…' : summary?.handoffs ?? '—'} icon={<UserCheck size={17} color={T.text} strokeWidth={ICON_STROKE} />} sub="Sent to an agent or counsellor" />
        </View>

        {!!summary && (summary.overdue > 0 || summary.leadsNeverCalled > 0) && (
          <View style={[styles.alert, { backgroundColor: T.warning + '18', borderColor: T.warning + '40' }]}>
            <AlertTriangle size={16} color={T.warning} strokeWidth={ICON_STROKE} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTxt, { color: T.text }]}>
                <Text style={{ color: T.danger, fontWeight: '700' }}>{summary.overdue}</Text> overdue callback{summary.overdue === 1 ? '' : 's'} · <Text style={{ fontWeight: '700' }}>{summary.leadsNeverCalled}</Text> lead{summary.leadsNeverCalled === 1 ? '' : 's'} never called
              </Text>
              <Text style={{ color: T.dim, fontSize: 10.5, marginTop: 2 }}>Whole pool — not affected by the date filter</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Call Queue')}><Text style={{ color: T.accent, fontSize: 11.5, fontWeight: '600' }}>Open queue →</Text></TouchableOpacity>
          </View>
        )}

        <Card>
          <SectionLabel>By caller</SectionLabel>
          {loadingSummary ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 16 }} />
          ) : callers.length === 0 ? (
            <Text style={{ color: T.sub, textAlign: 'center', paddingVertical: 20 }}>No calling agents yet.</Text>
          ) : (
            <View style={{ gap: 8, marginTop: 8 }}>
              {callers.map((c) => (
                <TouchableOpacity key={c.userId} onPress={() => { setCallerId(String(c.userId)); setPage(1); }} style={[styles.callerRow, { backgroundColor: T.cardAlt }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.callerName, { color: T.text }]} numberOfLines={1}>{c.name}{!c.isActive ? ' (Inactive)' : ''}</Text>
                    <Text style={[styles.callerStats, { color: T.sub }]}>{c.calls} calls · {c.connected} reached · {rateText(c.connectRate, c.calls)} · {c.callbacksBooked} callbacks · {c.handoffs} handed over</Text>
                  </View>
                  <Text style={{ color: c.lastCallAt ? T.text : T.dim, fontSize: 11, fontWeight: '500' }}>{sinceLabel(c.lastCallAt)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <SearchBar value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Student, parent, number, or what was discussed…" />
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Trigger label={callerId ? callers.find((c) => String(c.userId) === callerId)?.name || 'Everyone' : 'Everyone'} open={openDd === 'caller'} onPress={() => setOpenDd((d) => (d === 'caller' ? null : 'caller'))} />
              {openDd === 'caller' && <Dropdown options={[{ label: 'Everyone', value: '' }, ...callers.map((c) => ({ label: c.name, value: String(c.userId) }))]} value={callerId} onSelect={(v) => { setCallerId(v); setPage(1); setOpenDd(null); }} />}
            </View>
            <View style={{ flex: 1 }}>
              <Trigger label={outcome ? CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome : 'All outcomes'} open={openDd === 'outcome'} onPress={() => setOpenDd((d) => (d === 'outcome' ? null : 'outcome'))} />
              {openDd === 'outcome' && <Dropdown options={[{ label: 'All outcomes', value: '' }, ...CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))]} value={outcome} onSelect={(v) => { setOutcome(v); setPage(1); setOpenDd(null); }} />}
            </View>
          </View>

          {loadingLog ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 20 }} />
          ) : rows.length === 0 ? (
            <Text style={{ color: T.sub, textAlign: 'center', paddingVertical: 30 }}>No calls match these filters.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map((c) => (
                <View key={c.id} style={[styles.logCard, { backgroundColor: T.card, borderColor: T.line }]}>
                  <View style={styles.logTop}>
                    <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => navigation.navigate('B2CLeadDetail', { leadId: c.leadId })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.student, { color: T.text }]} numberOfLines={1}>{c.studentName}</Text>
                        <ExternalLink size={11} color={T.dim} />
                      </View>
                      <Text style={[styles.sub, { color: T.sub }]} numberOfLines={1}>{c.parentName || '—'} · {c.city || '—'} · by {c.callerName}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.when, { color: T.dim }]}>{fmtDateTime(c.calledAt)}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    {c.outcome ? <StatusBadge label={spaced(c.outcome)} color={outcomeTone(T, c.outcome)} /> : <Text style={{ color: T.dim, fontSize: 12 }}>—</Text>}
                    <StatusBadge label={spaced(c.leadStage)} color={stageColor(T, c.leadStage)} />
                  </View>
                  {!!(c.discussion || c.notes) && (
                    <Text style={[styles.discussion, { color: T.text }]} numberOfLines={2}>
                      {c.discussion}{c.notes ? `${c.discussion ? ' — ' : ''}Note: ${c.notes}` : ''}
                    </Text>
                  )}
                </View>
              ))}
              {pageCount > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Btn label="Prev" small variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                  <Text style={{ color: T.sub, alignSelf: 'center', fontSize: 12 }}>{page} / {pageCount}</Text>
                  <Btn label="Next" small variant="secondary" disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)} />
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 3 },
  dateRow: { flexDirection: 'row', gap: 10 },
  quickRow: { flexDirection: 'row', gap: 8 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  alert: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'flex-start' },
  alertTxt: { fontSize: 12, fontWeight: '500' },
  callerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  callerName: { fontWeight: '700', fontSize: 13 },
  callerStats: { fontWeight: '500', fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 10 },
  logCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  logTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  student: { fontWeight: '700', fontSize: 13.5 },
  sub: { fontWeight: '500', fontSize: 11.5, marginTop: 1 },
  when: { fontWeight: '500', fontSize: 11 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  discussion: { fontSize: 12, fontWeight: '500' },
});

export default B2CCallCenterScreen;
