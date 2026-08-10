import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { Plus, CalendarDays, Send } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen } from '../../components/ui';
import { Btn, Field, ListCard, StatusBadge, FormModal, Segmented } from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { b2cLeaveService } from '../../api/b2c/b2cLeaveService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CMyLeaves.jsx — request leave + track approval status. */
const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid'] as const;
type LeaveType = typeof LEAVE_TYPES[number];

interface LeaveRow {
  id: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days?: number;
  status: string;
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const diffDays = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);

// Web: statusTag { Pending:'warn', Approved:'positive', Rejected:'negative' }
const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

const emptyForm = () => ({ leaveType: 'Casual' as LeaveType, fromDate: todayStr(), toDate: todayStr(), reason: '' });

export const B2CMyLeavesScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 720; // iPad landscape → wider modal + 2-up date fields

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await b2cLeaveService.getMine();
      const payload: any = res.data;
      setLeaves(payload?.items ?? payload ?? []);
    } catch {
      setLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const openForm = () => { setForm(emptyForm()); setShowForm(true); };

  const days = diffDays(form.fromDate, form.toDate);
  const rangeInvalid = new Date(form.toDate) < new Date(form.fromDate);

  const submit = async () => {
    if (rangeInvalid) return;
    setSaving(true);
    try {
      await b2cLeaveService.submit({
        leaveType: form.leaveType,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason.trim() || undefined,
      });
      setShowForm(false);
      // Single success confirmation.
      toast.success('Leave submitted');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[s.subtitle, { color: T.sub }]}>Request leave and track approval status</Text>

      <Btn
        label="Request Leave"
        onPress={openForm}
        icon={<Plus size={17} color="#FFF" strokeWidth={2.4} />}
        style={{ marginTop: 14 }}
      />

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : leaves.length === 0 ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.emptyTitle, { color: T.text }]}>No leave requests yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Tap Request Leave to apply.</Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 16 }}>
          {leaves.map(l => {
            const d = l.days ?? diffDays(l.fromDate, l.toDate);
            return (
              <ListCard key={l.id} style={{ alignItems: 'flex-start' }}>
                <View style={[s.iconTile, { backgroundColor: T.accentSoft }]}>
                  <CalendarDays size={18} color={T.accent} strokeWidth={ICON_STROKE} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.rowTop}>
                    <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{l.leaveType}</Text>
                    <StatusBadge label={l.status} color={statusColor(l.status, T)} />
                  </View>
                  <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>
                    {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                  </Text>
                  <Text style={[s.sub, { color: T.dim }]}>{d} day{d === 1 ? '' : 's'}</Text>
                </View>
              </ListCard>
            );
          })}
        </View>
      )}

      <FormModal
        visible={showForm}
        title="Request Leave"
        wide={isWide}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Btn
              label={saving ? 'Submitting…' : 'Request Leave'}
              onPress={submit}
              loading={saving}
              disabled={saving || rangeInvalid}
              icon={<Send size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 14 }}>
          <Field label="Leave Type">
            <Segmented
              value={form.leaveType}
              options={LEAVE_TYPES.map(t => ({ label: t, value: t }))}
              onChange={v => set('leaveType', v)}
            />
          </Field>

          <View style={isWide ? s.dateRow : undefined}>
            <View style={isWide ? { flex: 1 } : undefined}>
              <DateInput
                label="From"
                value={form.fromDate}
                onChange={v => set('fromDate', v)}
                minDate={todayStr()}
              />
            </View>
            <View style={isWide ? { flex: 1 } : undefined}>
              <DateInput
                label="To"
                value={form.toDate}
                onChange={v => set('toDate', v)}
                minDate={form.fromDate}
              />
            </View>
          </View>

          <Field label="Reason">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput
                value={form.reason}
                onChangeText={v => set('reason', v)}
                placeholder="Optional reason…"
                placeholderTextColor={T.dim}
                multiline
                style={[s.textareaTxt, { color: T.text }]}
              />
            </View>
          </Field>

          <View style={[s.durationRow, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <Text style={[s.durationLbl, { color: T.sub }]}>Duration</Text>
            <View style={s.durationVal}>
              <CalendarDays size={15} color={T.text} strokeWidth={ICON_STROKE} />
              <Text style={[s.durationTxt, { color: T.text }]}>{days} day{days === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </View>
      </FormModal>
    </Screen>
  );
};

export default B2CMyLeavesScreen;

const s = StyleSheet.create({
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  dateRow: { flexDirection: 'row', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
  durationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  durationLbl: { fontSize: rf(12.5), fontWeight: '500' },
  durationVal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durationTxt: { fontSize: rf(14), fontWeight: '700' },
});
