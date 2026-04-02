import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { dealsApi } from '../../api/deals';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Card } from '../../components/common/Card';
import { ROLE_COLORS, CONTRACT_DURATIONS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <DrawerMenuButton />
        )}
        <Text style={styles.headerTitle}>Create Deal</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, tablet && styles.contentTablet]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Linked Lead */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🏫 Linked Lead</Text>
          <SelectPicker
            label="Select Lead *"
            options={leads.map((l) => ({ label: `${l.school} — ${l.city}`, value: l.id }))}
            value={form.leadId}
            onChange={(v) => set('leadId', v)}
            accentColor={COLOR.primary}
          />
        </Card>

        {/* Pricing & GST */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Pricing & GST</Text>
          <View style={styles.row}>
            <Input label="Base Price (₹ per login) *" value={form.basePrice} onChangeText={(v) => set('basePrice', v)} keyboardType="numeric" placeholder="e.g. 1000" accentColor={COLOR.primary} containerStyle={styles.half} />
            <Input label="Total Logins *" value={form.totalLogins} onChangeText={(v) => set('totalLogins', v)} keyboardType="numeric" placeholder="e.g. 50" accentColor={COLOR.primary} containerStyle={styles.half} />
          </View>
          <View style={styles.row}>
            <View style={[styles.readonlyField, styles.half]}>
              <Text style={styles.readonlyLabel}>Subtotal</Text>
              <Text style={styles.readonlyValue}>{fmt(subtotal)}</Text>
            </View>
            <Input label="Discount %" value={form.discount} onChangeText={(v) => set('discount', v)} keyboardType="numeric" placeholder="0" accentColor={COLOR.primary} containerStyle={styles.half} />
          </View>
          <View style={styles.row}>
            <View style={[styles.readonlyField, styles.half]}>
              <Text style={styles.readonlyLabel}>Amount Without GST</Text>
              <Text style={styles.readonlyValue}>{fmt(amountWithoutGst)}</Text>
            </View>
            <View style={[styles.readonlyField, styles.half]}>
              <Text style={styles.readonlyLabel}>GST (18%)</Text>
              <Text style={styles.readonlyValue}>{fmt(gstAmount)}</Text>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalBanner}>
            <Text style={styles.totalLabel}>Total Amount (incl. GST)</Text>
            <Text style={[styles.totalValue, { color: COLOR.primary }]}>{fmt(totalMoney)}</Text>
          </View>

          {/* Billing + Contract */}
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.half}>
              <SelectPicker label="Billing Frequency" options={BILLING_OPTIONS} value={form.billing} onChange={(v) => set('billing', v)} accentColor={COLOR.primary} />
            </View>
            <View style={[styles.readonlyField, styles.half]}>
              <Text style={styles.readonlyLabel}>Per {billingLabel(form.billing)}</Text>
              <Text style={[styles.readonlyValue, { color: '#3B82F6', fontWeight: '700' }]}>{fmt(perInstallment)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <SelectPicker label="Contract Duration" options={CONTRACT_DURATIONS.map((d) => ({ label: d, value: d }))} value={form.duration} onChange={(v) => set('duration', v)} accentColor={COLOR.primary} />
            </View>
            <Input label="Start Date" value={form.contractStartDate} onChangeText={(v) => set('contractStartDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} containerStyle={styles.half} />
          </View>
          <Input label="End Date" value={form.contractEndDate} onChangeText={(v) => set('contractEndDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} />
        </Card>

        {/* Approval Level */}
        {hasValues && (
          <View style={[styles.approvalBanner, { backgroundColor: approval.color + '15', borderColor: approval.color + '33' }]}>
            <Info size={16} color={approval.color} />
            <View style={styles.approvalInfo}>
              <Text style={[styles.approvalLevel, { color: approval.color }]}>{approval.level}</Text>
              <Text style={styles.approvalDesc}>
                {disc <= 10 ? approval.desc : `Approver: ${approval.approver}. ${approval.desc}`}
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Notes for Approver</Text>
          <Input
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
            numberOfLines={3}
            placeholder="Context for the approver..."
            accentColor={COLOR.primary}
            style={{ textAlignVertical: 'top', minHeight: 70 }}
          />
        </Card>

        <View style={[styles.footerActions, tablet && styles.footerActionsTablet]}>
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" color="#6B7280" style={styles.cancelBtn} />
          <Button title="Submit Deal" onPress={handleSubmit} loading={loading} color={COLOR.primary} style={styles.submitBtn} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: rf(20), fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  contentTablet: { padding: 24, maxWidth: 720, alignSelf: 'center', width: '100%' },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  readonlyField: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  readonlyLabel: { fontSize: rf(11), color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  readonlyValue: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  totalLabel: { fontSize: rf(13), fontWeight: '700', color: '#0F766E' },
  totalValue: { fontSize: rf(20), fontWeight: '800' },
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  approvalInfo: { flex: 1 },
  approvalLevel: { fontSize: rf(14), fontWeight: '700' },
  approvalDesc: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  footerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  footerActionsTablet: { justifyContent: 'flex-end' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },
});
