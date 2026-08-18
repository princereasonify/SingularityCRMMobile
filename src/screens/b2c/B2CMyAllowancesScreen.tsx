import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, useWindowDimensions } from 'react-native';
import { IndianRupee, Send, Car } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen } from '../../components/ui';
import { Btn, Field, Input, ListCard, StatusBadge, FormModal } from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { b2cAllowanceService } from '../../api/b2c/b2cAllowanceService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CMyAllowances.jsx — submit a travel/visit allowance claim + track approval. */
interface AllowanceRow {
  id: number;
  claimDate: string;
  visitCount: number;
  distanceKm: number;
  amount: number;
  status: string;
}

interface RateConfig {
  ratePerVisit: number;
  ratePerKm: number;
  fixedDailyAmount: number;
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtRupee = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

const emptyForm = () => ({ claimDate: todayStr(), visitCount: '', distanceKm: '', notes: '' });

export const B2CMyAllowancesScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [claims, setClaims] = useState<AllowanceRow[]>([]);
  const [cfg, setCfg] = useState<RateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await b2cAllowanceService.getMyClaims();
      const payload: any = res.data;
      setClaims(payload?.items ?? payload ?? []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    b2cAllowanceService.getConfig().then(res => setCfg(res.data ?? null)).catch(() => setCfg(null));
  }, []);

  const openForm = () => { setForm(emptyForm()); setShowForm(true); };

  const computed = cfg
    ? (Number(form.visitCount) || 0) * (cfg.ratePerVisit || 0)
      + (Number(form.distanceKm) || 0) * (cfg.ratePerKm || 0)
      + (cfg.fixedDailyAmount || 0)
    : null;

  const submit = async () => {
    setSaving(true);
    try {
      await b2cAllowanceService.submitClaim({
        claimDate: form.claimDate,
        visitCount: Number(form.visitCount) || 0,
        distanceKm: Number(form.distanceKm) || 0,
        notes: form.notes.trim() || undefined,
      });
      setShowForm(false);
      toast.success('Claim submitted');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[s.subtitle, { color: T.sub }]}>Submit a claim and track its approval status</Text>

      <Btn
        label="Submit Claim"
        onPress={openForm}
        icon={<Send size={16} color="#FFF" strokeWidth={2.4} />}
        style={{ marginTop: 14 }}
      />

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : claims.length === 0 ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.emptyTitle, { color: T.text }]}>No claims yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Tap Submit Claim to request an allowance.</Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 16 }}>
          {claims.map(c => (
            <ListCard key={c.id} style={{ alignItems: 'flex-start' }}>
              <View style={[s.iconTile, { backgroundColor: T.accentSoft }]}>
                <Car size={18} color={T.accent} strokeWidth={ICON_STROKE} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.rowTop}>
                  <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{fmtDate(c.claimDate)}</Text>
                  <StatusBadge label={c.status} color={statusColor(c.status, T)} />
                </View>
                <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>
                  {c.visitCount ?? 0} visit{c.visitCount === 1 ? '' : 's'} · {c.distanceKm != null ? `${c.distanceKm} km` : '—'}
                </Text>
                <Text style={[s.amount, { color: T.text }]}>{fmtRupee(c.amount)}</Text>
              </View>
            </ListCard>
          ))}
        </View>
      )}

      <FormModal
        visible={showForm}
        title="Submit Claim"
        wide={isWide}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Btn
              label={saving ? 'Submitting…' : 'Submit Claim'}
              onPress={submit}
              loading={saving}
              disabled={saving || !form.claimDate}
              icon={<Send size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 14 }}>
          <DateInput label="Claim Date" value={form.claimDate} onChange={v => set('claimDate', v)} maxDate={todayStr()} />

          <View style={isWide ? s.row : undefined}>
            <View style={isWide ? { flex: 1 } : undefined}>
              <Input label="Visit Count" value={form.visitCount} onChangeText={v => set('visitCount', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" />
            </View>
            <View style={isWide ? { flex: 1 } : undefined}>
              <Input label="Distance (km)" value={form.distanceKm} onChangeText={v => set('distanceKm', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
            </View>
          </View>

          <Field label="Notes">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput
                value={form.notes}
                onChangeText={v => set('notes', v)}
                placeholder="Optional notes…"
                placeholderTextColor={T.dim}
                multiline
                style={[s.textareaTxt, { color: T.text }]}
              />
            </View>
          </Field>

          <View style={[s.durationRow, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <Text style={[s.durationLbl, { color: T.sub }]}>Computed amount</Text>
            <View style={s.durationVal}>
              <IndianRupee size={15} color={T.text} strokeWidth={ICON_STROKE} />
              <Text style={[s.durationTxt, { color: T.text }]}>
                {computed != null ? computed.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
              </Text>
            </View>
          </View>
          <Text style={[s.hint, { color: T.dim }]}>Amount is calculated from the admin-configured rates.</Text>
        </View>
      </FormModal>
    </Screen>
  );
};

export default B2CMyAllowancesScreen;

const s = StyleSheet.create({
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  amount: { fontSize: rf(13.5), fontWeight: '700', marginTop: 2 },
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
  hint: { fontSize: rf(11), fontWeight: '500' },
});
