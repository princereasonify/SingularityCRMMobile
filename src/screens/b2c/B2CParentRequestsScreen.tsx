/**
 * Parent Requests — "please call me" requests from the Parent Portal. Mobile twin of web's
 * B2CParentRequests.jsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhoneIncoming, CheckCircle2, Clock, ArrowRight, AlertTriangle } from 'lucide-react-native';
import { Btn, StatusBadge, Dropdown, Trigger, FormModal, Input } from '../../components/crud';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { DateInput } from '../../components/common/DateInput';
import {
  b2cParentRequestService, CALL_OUTCOMES, CALL_REQUEST_STATUSES, statusMeta, ParentCallRequestRow,
} from '../../api/b2c/b2cParentRequestService';

const fmtSlot = (start?: string | null, end?: string | null) => {
  if (!start) return '—';
  const s = new Date(start);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(s); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const t = (x: string) => new Date(x).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel}, ${t(start)}${end ? `–${t(end)}` : ''}`;
};

const isLate = (r: ParentCallRequestRow) => {
  const end = r.confirmedSlotEnd || r.preferredSlotEnd;
  return !!end && new Date(end) < new Date() && !!statusMeta(r.status)?.open;
};

const toneColor = (T: ReturnType<typeof useAppTheme>, tone?: string) => {
  switch (tone) {
    case 'accent': return T.accent;
    case 'violet': return T.info;
    case 'warn': return T.warning;
    case 'negative': return T.danger;
    case 'positive': return T.success;
    default: return T.dim;
  }
};

const inAnHourInput = () => {
  const d = new Date(Date.now() + 3600000);
  return d.toISOString();
};

export const B2CParentRequestsScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const { user } = useAuth();

  const [status, setStatus] = useState('');
  const [openStatus, setOpenStatus] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [rows, setRows] = useState<ParentCallRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [logging, setLogging] = useState<ParentCallRequestRow | null>(null);
  const [outcome, setOutcome] = useState('');
  const [openOutcome, setOpenOutcome] = useState(false);
  const [notes, setNotes] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    b2cParentRequestService.getQueue({ status: status || undefined, mine: mineOnly || undefined })
      .then((res) => { setRows(res.data?.callRequests || []); setLoadError(''); })
      .catch((err: any) => { setRows([]); setLoadError(err?.response?.data?.message || 'Could not load the queue.'); })
      .finally(() => setLoading(false));
  }, [status, mineOnly]);

  useEffect(() => { load(); }, [load]);

  const take = async (row: ParentCallRequestRow) => {
    try {
      await b2cParentRequestService.take(row.parentCallRequestId);
      toast.success(`Assigned to you — ${row.parentName} expects a call ${fmtSlot(row.preferredSlotStart, row.preferredSlotEnd).toLowerCase()}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not take this request');
      load();
    }
  };

  const confirm = async (row: ParentCallRequestRow) => {
    try {
      await b2cParentRequestService.confirm(row.parentCallRequestId);
      toast.success(`Confirmed — you'll call ${fmtSlot(row.preferredSlotStart, row.preferredSlotEnd).toLowerCase()}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not confirm');
    }
  };

  const openLog = (row: ParentCallRequestRow) => {
    setLogging(row); setOutcome(''); setNotes(''); setCallbackAt('');
  };

  const submitLog = async () => {
    if (!logging || !outcome) return;
    setSaving(true);
    try {
      await b2cParentRequestService.logCall(logging.parentCallRequestId, {
        outcome, notes: notes || undefined,
        callbackAt: outcome === 'CallBackLater' ? new Date(callbackAt).toISOString() : undefined,
      });
      toast.success('Call logged');
      setLogging(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not log the call');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 14 }}>
        <View>
          <Text style={[styles.h1, { color: T.text }]}>Parent Requests</Text>
          <Text style={[styles.h2, { color: T.sub }]}>
            {user?.role === 'CallingAgent' ? '"Please call me" requests from the families assigned to you' : '"Please call me" requests raised in the Parent Portal'}
          </Text>
        </View>

        {!!loadError && (
          <View style={[styles.alert, { backgroundColor: T.warning + '18', borderColor: T.warning + '40' }]}>
            <AlertTriangle size={16} color={T.warning} strokeWidth={ICON_STROKE} />
            <Text style={[styles.alertTxt, { color: T.text }]}>
              <Text style={{ fontWeight: '700' }}>Not available yet. </Text>{loadError}
            </Text>
          </View>
        )}

        <View style={styles.filters}>
          <View style={{ flex: 1 }}>
            <Trigger label={status ? CALL_REQUEST_STATUSES.find((s) => s.value === status)?.label || status : 'Open work (default)'} open={openStatus} onPress={() => setOpenStatus((o) => !o)} />
            {openStatus && (
              <Dropdown
                options={[{ label: 'Open work (default)', value: '' }, ...CALL_REQUEST_STATUSES.map((s) => ({ label: s.label, value: s.value }))]}
                value={status}
                onSelect={(v) => { setStatus(v); setOpenStatus(false); }}
              />
            )}
          </View>
          <Btn label="Taken by me" small variant={mineOnly ? 'primary' : 'secondary'} onPress={() => setMineOnly((m) => !m)} />
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <PhoneIncoming size={28} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[styles.emptyTxt, { color: T.sub }]}>Nothing matches these filters.</Text>
            {user?.role === 'CallingAgent' && (
              <Text style={[styles.emptyHint, { color: T.dim }]}>You only see requests from families assigned to you. Missing one? Ask your admin to assign it on Caller Assignments.</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((row) => {
              const sMeta = statusMeta(row.status);
              const late = isLate(row);
              return (
                <View key={row.parentCallRequestId} style={[styles.card, { backgroundColor: T.card, borderColor: T.line }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.parent, { color: T.text }]} numberOfLines={1}>{row.parentName || '—'}</Text>
                      <Text style={[styles.sub, { color: T.sub }]} numberOfLines={1}>{row.studentName || 'no student linked'}</Text>
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${row.phoneNumber}`)}>
                        <Text style={[styles.phone, { color: T.accent }]}>{row.phoneNumber}</Text>
                      </TouchableOpacity>
                    </View>
                    <StatusBadge label={sMeta?.label || row.status} color={toneColor(T, sMeta?.tone)} />
                  </View>

                  <Text style={[styles.category, { color: T.text }]}>{row.category}</Text>
                  {row.source === 'feedback' && <StatusBadge label="via Feedback" color={T.info} />}
                  {!!row.message && <Text style={[styles.message, { color: T.sub }]} numberOfLines={2}>{row.message}</Text>}

                  <View style={styles.slotRow}>
                    <Clock size={12} color={late ? T.danger : T.dim} strokeWidth={ICON_STROKE} />
                    <Text style={[styles.slot, { color: late ? T.danger : T.sub, fontWeight: late ? '700' : '500' }]}>
                      {fmtSlot(row.confirmedSlotStart || row.preferredSlotStart, row.confirmedSlotEnd || row.preferredSlotEnd)}
                    </Text>
                    {!!row.confirmedSlotStart && <CheckCircle2 size={12} color={T.success} strokeWidth={ICON_STROKE} />}
                    {late && <Text style={{ color: T.danger, fontSize: 11, fontWeight: '600' }}>slot has passed</Text>}
                  </View>

                  <View style={styles.footer}>
                    <Text style={[styles.agent, { color: T.dim }]}>{row.assignedAgentName || 'unassigned'}</Text>
                    {row.status === 'Waiting' && <Btn label="Take & Call" small onPress={() => take(row)} />}
                    {row.status === 'Assigned' && <Btn label="Confirm" small onPress={() => confirm(row)} icon={<ArrowRight size={13} color="#FFF" strokeWidth={ICON_STROKE} />} />}
                    {['Confirmed', 'Attempted', 'Rescheduled'].includes(row.status) && <Btn label="Log Call" small variant="secondary" onPress={() => openLog(row)} />}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <FormModal visible={!!logging} onClose={() => !saving && setLogging(null)} title={logging ? `Call — ${logging.parentName}` : ''}>
        {logging && (
          <View style={{ gap: 14 }}>
            <View style={[styles.callInfo, { backgroundColor: T.cardAlt }]}>
              <View>
                <Text style={[styles.parent, { color: T.text }]}>{logging.parentName}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${logging.phoneNumber}`)}>
                  <Text style={[styles.phoneLg, { color: T.accent }]}>{logging.phoneNumber}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.categorySm, { color: T.sub }]}>{logging.category} — {logging.message}</Text>
            </View>

            <View>
              <Trigger label={outcome ? CALL_OUTCOMES.find((o) => o.value === outcome)?.label || outcome : 'Select an outcome…'} open={openOutcome} onPress={() => setOpenOutcome((o) => !o)} />
              {openOutcome && (
                <Dropdown
                  options={CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))}
                  value={outcome}
                  onSelect={(v) => {
                    setOutcome(v);
                    if (v === 'CallBackLater' && !callbackAt) setCallbackAt(inAnHourInput());
                    setOpenOutcome(false);
                  }}
                />
              )}
            </View>

            {outcome === 'CallBackLater' && (
              <DateInput label="Call them back on *" value={callbackAt.slice(0, 10)} onChange={(d) => setCallbackAt(new Date(`${d}T${callbackAt.slice(11, 16) || '10:00'}`).toISOString())} />
            )}

            {outcome === 'Connected' && (
              <View style={[styles.alert, { backgroundColor: T.success + '18', borderColor: T.success + '40' }]}>
                <CheckCircle2 size={16} color={T.success} strokeWidth={ICON_STROKE} />
                <Text style={[styles.alertTxt, { color: T.text }]}>This closes the request as Completed.</Text>
              </View>
            )}

            <Input label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} placeholder="What was discussed, or why the attempt didn't connect." />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label="Cancel" variant="secondary" onPress={() => setLogging(null)} style={{ flex: 1 }} disabled={saving} />
              <Btn label={saving ? 'Saving…' : 'Save call'} onPress={submitLog} loading={saving} disabled={!outcome || (outcome === 'CallBackLater' && !callbackAt)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </FormModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 3 },
  alert: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'flex-start' },
  alertTxt: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  filters: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 40 },
  emptyTxt: { fontSize: 13, fontWeight: '500' },
  emptyHint: { fontSize: 11.5, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  parent: { fontWeight: '700', fontSize: 14 },
  sub: { fontWeight: '500', fontSize: 12, marginTop: 1 },
  phone: { fontWeight: '700', fontSize: 12.5, marginTop: 2 },
  category: { fontWeight: '600', fontSize: 12.5 },
  message: { fontWeight: '500', fontSize: 12 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slot: { fontSize: 12.5 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  agent: { fontSize: 11.5, fontWeight: '500' },
  callInfo: { borderRadius: 12, padding: 12, gap: 6 },
  phoneLg: { fontWeight: '800', fontSize: 18 },
  categorySm: { fontSize: 11.5, fontWeight: '500' },
});

export default B2CParentRequestsScreen;
