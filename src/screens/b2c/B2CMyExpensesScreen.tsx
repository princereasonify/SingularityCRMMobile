import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Linking } from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import { Send, Receipt, Paperclip, FileText } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen } from '../../components/ui';
import { Btn, Field, Input, ListCard, StatusBadge, FormModal, Trigger, Dropdown } from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { b2cExpenseService, EXPENSE_CATEGORIES } from '../../api/b2c/b2cExpenseService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive } from '../../hooks/useResponsive';
import { todayStr } from '../../utils/dates';

/** Web parity: B2CMyExpenses.jsx — claim a reimbursable expense + track approval. */
interface ExpenseRow {
  id: number;
  expenseDate: string;
  category: string;
  amount: number;
  receiptUrl?: string | null;
  status: string;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtRupee = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

const emptyForm = () => ({ expenseDate: todayStr(), category: 'Travel', amount: '', description: '' });

export const B2CMyExpensesScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const isWide = r.width >= 720;

  const [claims, setClaims] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [receipt, setReceipt] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [openDd, setOpenDd] = useState(false);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await b2cExpenseService.getMine();
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

  const openForm = () => { setForm(emptyForm()); setReceipt(null); setShowForm(true); };

  const pickReceipt = async () => {
    let file: any;
    try {
      [file] = await pick({ type: [types.images, types.pdf] });
    } catch { return; } // user cancelled
    if (!file?.uri) return;
    setReceipt({ uri: file.uri, name: file.name || `receipt-${Date.now()}`, type: file.type || 'application/octet-stream' });
  };

  const submit = async () => {
    if (!(Number(form.amount) > 0)) return;
    setSaving(true);
    try {
      const res = await b2cExpenseService.submit({
        expenseDate: form.expenseDate,
        category: form.category,
        amount: Number(form.amount),
        description: form.description.trim() || undefined,
      });
      const createdId = res.data?.id;
      if (receipt && createdId) {
        try { await b2cExpenseService.uploadReceipt(createdId, receipt); }
        catch { toast.error('Claim saved, but receipt upload failed. You can add it later.'); }
      }
      setShowForm(false);
      toast.success('Expense submitted');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit expense');
    } finally {
      setSaving(false);
    }
  };

  // The page gutter and the readable-width cap both track the live window size.
  // paddingHorizontal/Top rather than the `padding` shorthand: Screen's own contentContainerStyle
  // sets paddingBottom from the bottom safe-area inset, and the shorthand would overwrite it and
  // push the last card under the home indicator.
  const content = { paddingHorizontal: r.gutter, paddingTop: r.gutter, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } as const;

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <Screen scroll contentStyle={content} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <Text style={[s.subtitle, { color: T.sub }]}>Claim reimbursements and track their approval status</Text>

      <Btn
        label="Submit Expense"
        onPress={openForm}
        icon={<Send size={16} color="#FFF" strokeWidth={2.4} />}
        style={{ marginTop: 14 }}
      />

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : claims.length === 0 ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.emptyTitle, { color: T.text }]}>No expenses yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Tap Submit Expense to claim a reimbursement.</Text>
        </View>
      ) : (
        <View style={[s.grid, { marginTop: 16 }]}>
          {claims.map(c => (
            <ListCard key={c.id} style={{ alignItems: 'flex-start', width: cardW }}>
              <View style={[s.iconTile, { backgroundColor: T.accentSoft }]}>
                <Receipt size={18} color={T.accent} strokeWidth={ICON_STROKE} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.rowTop}>
                  <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{c.category}</Text>
                  <StatusBadge label={c.status} color={statusColor(c.status, T)} />
                </View>
                <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>{fmtDate(c.expenseDate)}</Text>
                <View style={s.rowTop}>
                  <Text style={[s.amount, { color: T.text, flex: 1 }]}>{fmtRupee(c.amount)}</Text>
                  {!!c.receiptUrl && (
                    <TouchableOpacity onPress={() => Linking.openURL(c.receiptUrl!)} hitSlop={8}>
                      <Text style={[s.receiptLink, { color: T.accent }]}>View receipt</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ListCard>
          ))}
        </View>
      )}

      <FormModal
        visible={showForm}
        title="Submit Expense"
        wide={isWide}
        onClose={() => setShowForm(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
            <Btn
              label={saving ? 'Submitting…' : 'Submit Expense'}
              onPress={submit}
              loading={saving}
              disabled={saving || !form.expenseDate || !(Number(form.amount) > 0)}
              icon={<Send size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 14 }}>
          <DateInput label="Expense Date" value={form.expenseDate} onChange={v => set('expenseDate', v)} maxDate={todayStr()} />

          <Field label="Category">
            <Trigger label={form.category} open={openDd} onPress={() => setOpenDd(v => !v)} />
            {openDd && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={240}
                value={form.category}
                options={EXPENSE_CATEGORIES.map(c => ({ label: c, value: c }))}
                onSelect={v => { set('category', v); setOpenDd(false); }}
              />
            )}
          </Field>

          <Input label="Amount (₹) *" value={form.amount} onChangeText={v => set('amount', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />

          <Field label="Description">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput
                value={form.description}
                onChangeText={v => set('description', v)}
                placeholder="What was this for?"
                placeholderTextColor={T.dim}
                multiline
                style={[s.textareaTxt, { color: T.text }]}
              />
            </View>
          </Field>

          <Field label="Receipt (optional)">
            <Btn
              label={receipt ? 'Replace receipt' : 'Attach receipt'}
              variant="secondary"
              onPress={pickReceipt}
              icon={<Paperclip size={14} color={T.text} strokeWidth={ICON_STROKE} />}
            />
            {!!receipt && (
              <View style={s.receiptRow}>
                <FileText size={13} color={T.accent} strokeWidth={ICON_STROKE} />
                <Text style={[s.receiptName, { color: T.sub }]} numberOfLines={1}>{receipt.name}</Text>
              </View>
            )}
          </Field>
        </View>
      </FormModal>
    </Screen>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  amount: { fontSize: r.rf(13.5), fontWeight: '700', marginTop: 2 },
  receiptLink: { fontSize: r.rf(11.5), fontWeight: '700' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  receiptName: { fontSize: r.rf(12), fontWeight: '500', flex: 1 },
});

export default B2CMyExpensesScreen;

