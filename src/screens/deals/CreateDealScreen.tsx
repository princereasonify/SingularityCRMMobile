import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info, Check } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Card } from '../../components/common/Card';
import { ROLE_COLORS, PRODUCT_MODULES, PAYMENT_TERMS, CONTRACT_DURATIONS, PAYMENT_STATUSES } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const getApprovalLevel = (discount: number) => {
  if (discount <= 10) return { level: 'Self Approved', color: '#22C55E', desc: 'No approval needed' };
  if (discount <= 20) return { level: 'Zonal Head', color: '#F59E0B', desc: 'ZH approval required' };
  if (discount <= 30) return { level: 'Regional Head', color: '#F97316', desc: 'RH approval required' };
  return { level: 'Sales Head', color: '#EF4444', desc: 'SH approval required' };
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
    contractValue: '',
    discount: '0',
    paymentTerms: PAYMENT_TERMS[0],
    duration: CONTRACT_DURATIONS[0],
    modules: [] as string[],
    notes: '',
    contractStartDate: '',
    contractEndDate: '',
    numberOfLicenses: '',
    paymentStatus: 'Pending',
  });

  useEffect(() => {
    leadsApi.getPipeline().then((r) => setLeads(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
  }, []);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(mod)
        ? f.modules.filter((m) => m !== mod)
        : [...f.modules, mod],
    }));
  };

  const contractVal = parseFloat(form.contractValue) || 0;
  const disc = parseFloat(form.discount) || 0;
  const finalValue = contractVal * (1 - disc / 100);
  const approval = getApprovalLevel(disc);

  const handleSubmit = async () => {
    if (!form.leadId) { Alert.alert('Error', 'Please select a lead'); return; }
    if (!form.contractValue) { Alert.alert('Error', 'Contract value is required'); return; }
    if (form.modules.length === 0) { Alert.alert('Error', 'Select at least one module'); return; }

    setLoading(true);
    try {
      await dealsApi.createDeal({
        leadId: Number(form.leadId),
        contractValue: contractVal,
        discount: disc,
        paymentTerms: form.paymentTerms,
        duration: form.duration,
        modules: form.modules,
        notes: form.notes || undefined,
        submitForApproval: disc > 10,
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
        numberOfLicenses: form.numberOfLicenses ? parseInt(form.numberOfLicenses, 10) : undefined,
        paymentStatus: form.paymentStatus,
      });
      Alert.alert('Deal Created!', disc <= 10 ? 'Deal auto-approved and lead marked as Won.' : `Deal submitted for ${approval.level} approval.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
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

        {/* Commercial Terms */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Commercial Terms</Text>
          <View style={[styles.row, tablet && styles.rowTablet]}>
            <Input
              label="Contract Value (₹) *"
              value={form.contractValue}
              onChangeText={(v) => set('contractValue', v)}
              keyboardType="numeric"
              placeholder="e.g. 500000"
              accentColor={COLOR.primary}
              containerStyle={styles.half}
            />
            <Input
              label="Discount %"
              value={form.discount}
              onChangeText={(v) => set('discount', v)}
              keyboardType="numeric"
              placeholder="0"
              accentColor={COLOR.primary}
              containerStyle={styles.half}
            />
          </View>
          <SelectPicker label="Payment Terms" options={PAYMENT_TERMS.map((t) => ({ label: t, value: t }))} value={form.paymentTerms} onChange={(v) => set('paymentTerms', v)} accentColor={COLOR.primary} />
          <SelectPicker label="Contract Duration" options={CONTRACT_DURATIONS.map((d) => ({ label: d, value: d }))} value={form.duration} onChange={(v) => set('duration', v)} accentColor={COLOR.primary} />
        </Card>

        {/* Final Value + Approval Banner */}
        {contractVal > 0 && (
          <Card style={styles.section}>
            <View style={styles.finalValueRow}>
              <View>
                <Text style={styles.finalLabel}>Final Contract Value</Text>
                <Text style={styles.finalValue}>{formatCurrency(finalValue)}</Text>
                {disc > 0 && (
                  <Text style={styles.discount}>
                    {disc}% discount on {formatCurrency(contractVal)}
                  </Text>
                )}
              </View>
            </View>
            {/* Approval Banner */}
            <View style={[styles.approvalBanner, { backgroundColor: approval.color + '15', borderColor: approval.color + '33' }]}>
              <Info size={16} color={approval.color} />
              <View style={styles.approvalInfo}>
                <Text style={[styles.approvalLevel, { color: approval.color }]}>
                  {approval.level} {disc <= 10 ? '✓' : 'Required'}
                </Text>
                <Text style={styles.approvalDesc}>{approval.desc}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Contract Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Contract Details</Text>
          <View style={[styles.row, tablet && styles.rowTablet]}>
            <Input label="Start Date" value={form.contractStartDate} onChangeText={(v) => set('contractStartDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} containerStyle={styles.half} />
            <Input label="End Date" value={form.contractEndDate} onChangeText={(v) => set('contractEndDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} containerStyle={styles.half} />
          </View>
          <View style={[styles.row, tablet && styles.rowTablet]}>
            <Input label="No. of Licenses" value={form.numberOfLicenses} onChangeText={(v) => set('numberOfLicenses', v)} keyboardType="numeric" placeholder="e.g. 500" accentColor={COLOR.primary} containerStyle={styles.half} />
            <SelectPicker label="Payment Status" options={PAYMENT_STATUSES.map((s) => ({ label: s, value: s }))} value={form.paymentStatus} onChange={(v) => set('paymentStatus', v)} accentColor={COLOR.primary} containerStyle={styles.half} />
          </View>
        </Card>

        {/* Product Modules */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🧩 Product Modules *</Text>
          <Text style={styles.modulesHint}>Select all applicable modules</Text>
          <View style={styles.modulesGrid}>
            {PRODUCT_MODULES.map((mod) => {
              const selected = form.modules.includes(mod);
              return (
                <TouchableOpacity
                  key={mod}
                  style={[styles.moduleChip, selected && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
                  onPress={() => toggleModule(mod)}
                >
                  {selected && <Check size={12} color="#FFF" />}
                  <Text style={[styles.moduleText, selected && { color: '#FFF' }]}>{mod}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Deal Notes</Text>
          <Input
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
            numberOfLines={4}
            placeholder="Context for the approver..."
            accentColor={COLOR.primary}
            style={{ textAlignVertical: 'top', minHeight: 80 }}
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
  rowTablet: { gap: 16 },
  half: { flex: 1 },
  finalValueRow: { marginBottom: 12 },
  finalLabel: { fontSize: rf(12), color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  finalValue: { fontSize: rf(28), fontWeight: '800', color: '#111827' },
  discount: { fontSize: rf(13), color: '#9CA3AF', marginTop: 2 },
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  approvalInfo: { flex: 1 },
  approvalLevel: { fontSize: rf(14), fontWeight: '700' },
  approvalDesc: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  modulesHint: { fontSize: rf(12), color: '#9CA3AF', marginBottom: 12 },
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },
  moduleText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },
  footerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  footerActionsTablet: { justifyContent: 'flex-end' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },
});
