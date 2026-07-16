import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions } from '@react-navigation/native';
import { Info } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
import { DateInput } from '../../components/common/DateInput';
import { AppHeader, Card } from '../../components/ui';
import { GradientButton } from '../../components/common/GradientButton';
import { CONTRACT_DURATIONS } from '../../utils/constants';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const GST_RATE = 0.18;

const BILLING_OPTIONS = [
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Half-Yearly', value: 'Half-Yearly' },
  { label: 'Annually', value: 'Annually' },
];

const INSTALLMENT_MAP: Record<string, number> = {
  Monthly: 12, Quarterly: 4, 'Half-Yearly': 2, Annually: 1,
};

const getApprovalLevel = (discount: number) => {
  if (discount <= 10) return { level: 'Self-Approved', color: '#22C55E', approver: 'You (FO)', desc: 'Within your authority. Deal will be self-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', color: '#F59E0B', approver: 'Zonal Head', desc: 'Deal will be locked until decision.' };
  if (discount <= 30) return { level: 'Regional Head Approval', color: '#F97316', approver: 'Regional Head', desc: 'Deal will be locked until decision.' };
  return { level: 'Sales Head Approval', color: '#EF4444', approver: 'Sales Head', desc: 'Deal will require approval at this discount level.' };
};

const billingLabel = (b: string) => {
  if (b === 'Monthly') return 'Month';
  if (b === 'Quarterly') return 'Quarter';
  if (b === 'Half-Yearly') return 'Half-Year';
  return 'Year';
};

export const CreateDealScreen = ({ route, navigation }: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    leadId: route?.params?.leadId ? String(route.params.leadId) : '' as any,
    basePrice: '',
    totalLogins: '',
    discount: '0',
    billing: 'Annually',
    duration: CONTRACT_DURATIONS[0],
    notes: '',
    contractStartDate: '',
    contractEndDate: '',
  });

  useEffect(() => {
    leadsApi.getPipeline().then((r) => {
      const items = Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [];
      setLeads(items);
    }).catch(() => {});
  }, []);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const bp = parseFloat(form.basePrice) || 0;
  const tl = parseInt(form.totalLogins) || 0;
  const disc = parseFloat(form.discount) || 0;

  const subtotal = bp * tl;
  const amountWithoutGst = Math.round(subtotal * (1 - disc / 100));
  const gstAmount = Math.round(amountWithoutGst * GST_RATE);
  const totalMoney = amountWithoutGst + gstAmount;
  const installments = INSTALLMENT_MAP[form.billing] || 1;
  const perInstallment = installments > 0 ? Math.round(totalMoney / installments) : 0;

  const approval = getApprovalLevel(disc);
  const hasValues = bp > 0 && tl > 0;

  const handleSubmit = async () => {
    if (!form.leadId) { Alert.alert('Error', 'Please select a lead'); return; }
    if (tl <= 0) { Alert.alert('Error', 'Total Logins is required'); return; }
    if (bp <= 0) { Alert.alert('Error', 'Base Price is required'); return; }

    setLoading(true);
    try {
      await dealsApi.createDeal({
        leadId: Number(form.leadId),
        contractValue: subtotal,
        discount: disc,
        basePrice: bp,
        totalLogins: tl,
        billingFrequency: form.billing,
        paymentTerms: form.billing,
        duration: form.duration,
        modules: [],
        notes: form.notes || undefined,
        submitForApproval: true,
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
      } as any);
      Alert.alert(
        'Deal Submitted!',
        disc <= 10
          ? 'Deal auto-approved and lead marked as Won.'
          : `Deal submitted for ${approval.approver} approval.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  const canGoBack = navigation.canGoBack();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <AppHeader
        title="Create Deal"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
        onMenu={canGoBack ? undefined : () => navigation.dispatch(DrawerActions.toggleDrawer())}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Linked Lead */}
        <Card>
          <Text style={[styles.sectionTitle, { color: T.text }]}>🏫 Linked Lead</Text>
          <SelectPicker
            label="Select Lead *"
            options={leads.map((l) => ({ label: `${l.school} — ${l.city}`, value: l.id }))}
            value={form.leadId}
            onChange={(v) => set('leadId', v)}
            accentColor={T.accent}
          />
        </Card>

        {/* Pricing & GST */}
        <Card>
          <Text style={[styles.sectionTitle, { color: T.text }]}>💰 Pricing & GST</Text>
          <View style={styles.row}>
            <Input label="Base Price (₹ per login) *" value={form.basePrice} onChangeText={(v) => set('basePrice', v)} keyboardType="numeric" placeholder="e.g. 1000" accentColor={T.accent} containerStyle={styles.half} />
            <Input label="Total Logins *" value={form.totalLogins} onChangeText={(v) => set('totalLogins', v)} keyboardType="numeric" placeholder="e.g. 50" accentColor={T.accent} containerStyle={styles.half} />
          </View>
          <View style={styles.row}>
            <View style={[styles.readonlyField, styles.half, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <Text style={[styles.readonlyLabel, { color: T.sub }]}>Subtotal</Text>
              <Text style={[styles.readonlyValue, { color: T.text }]}>{fmt(subtotal)}</Text>
            </View>
            <Input label="Discount %" value={form.discount} onChangeText={(v) => set('discount', v)} keyboardType="numeric" placeholder="0" accentColor={T.accent} containerStyle={styles.half} />
          </View>
          <View style={styles.row}>
            <View style={[styles.readonlyField, styles.half, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <Text style={[styles.readonlyLabel, { color: T.sub }]}>Amount Without GST</Text>
              <Text style={[styles.readonlyValue, { color: T.text }]}>{fmt(amountWithoutGst)}</Text>
            </View>
            <View style={[styles.readonlyField, styles.half, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <Text style={[styles.readonlyLabel, { color: T.sub }]}>GST (18%)</Text>
              <Text style={[styles.readonlyValue, { color: T.text }]}>{fmt(gstAmount)}</Text>
            </View>
          </View>

          {/* Total */}
          <View style={[styles.totalBanner, { backgroundColor: T.accentSoft, borderColor: T.line }]}>
            <Text style={[styles.totalLabel, { color: T.accent }]}>Total Amount (incl. GST)</Text>
            <Text style={[styles.totalValue, { color: T.accent }]}>{fmt(totalMoney)}</Text>
          </View>

          {/* Billing + Contract */}
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.half}>
              <SelectPicker label="Billing Frequency" options={BILLING_OPTIONS} value={form.billing} onChange={(v) => set('billing', v)} accentColor={T.accent} />
            </View>
            <View style={[styles.readonlyField, styles.half, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <Text style={[styles.readonlyLabel, { color: T.sub }]}>Per {billingLabel(form.billing)}</Text>
              <Text style={[styles.readonlyValue, { color: T.info }]}>{fmt(perInstallment)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <SelectPicker label="Contract Duration" options={CONTRACT_DURATIONS.map((d) => ({ label: d, value: d }))} value={form.duration} onChange={(v) => set('duration', v)} accentColor={T.accent} />
            </View>
            <View style={styles.half}>
              <DateInput label="Start Date" value={form.contractStartDate} onChange={(v) => set('contractStartDate', v)} accentColor={T.accent} />
            </View>
          </View>
          <DateInput label="End Date" value={form.contractEndDate} onChange={(v) => set('contractEndDate', v)} accentColor={T.accent} />
        </Card>

        {/* Approval Level */}
        {hasValues && (
          <View style={[styles.approvalBanner, { backgroundColor: approval.color + '15', borderColor: approval.color + '33' }]}>
            <Info size={16} color={approval.color} />
            <View style={styles.approvalInfo}>
              <Text style={[styles.approvalLevel, { color: approval.color }]}>{approval.level}</Text>
              <Text style={[styles.approvalDesc, { color: T.sub }]}>
                {disc <= 10 ? approval.desc : `Approver: ${approval.approver}. ${approval.desc}`}
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        <Card>
          <Text style={[styles.sectionTitle, { color: T.text }]}>📝 Notes for Approver</Text>
          <Input
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
            numberOfLines={3}
            placeholder="Context for the approver..."
            accentColor={T.accent}
            style={{ textAlignVertical: 'top', minHeight: 70, color: T.text }}
          />
        </Card>

        <View style={[styles.footerActions, wide && styles.footerActionsWide]}>
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" color={T.sub} style={styles.cancelBtn} />
          <GradientButton label="Submit Deal" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentWide: { padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%' },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: rf(15), marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  readonlyField: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  readonlyLabel: { fontFamily: Fonts.medium, fontSize: rf(11), marginBottom: 2 },
  readonlyValue: { fontFamily: Fonts.bold, fontSize: rf(14) },
  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  totalLabel: { fontFamily: Fonts.bold, fontSize: rf(13) },
  totalValue: { fontFamily: Fonts.bold, fontSize: rf(20) },
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  approvalInfo: { flex: 1 },
  approvalLevel: { fontFamily: Fonts.bold, fontSize: rf(14) },
  approvalDesc: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  footerActions: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  footerActionsWide: { justifyContent: 'flex-end' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },
});
