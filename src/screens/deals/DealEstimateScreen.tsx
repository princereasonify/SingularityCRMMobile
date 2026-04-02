import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calculator } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Badge } from '../../components/common/Badge';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const BILLING_OPTIONS = [
  { label: 'Annually', value: 'Annually' },
  { label: 'Half-Yearly', value: 'Half-Yearly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Monthly', value: 'Monthly' },
];

const INSTALLMENT_MAP: Record<string, number> = {
  Annually: 1,
  'Half-Yearly': 2,
  Quarterly: 4,
  Monthly: 12,
};

const getApprovalInfo = (discount: number) => {
  if (discount <= 10) return { level: 'Self-Approved (FO)', color: '#16A34A', desc: 'Within FO authority. Deal will be auto-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', color: '#F59E0B', desc: 'Deal will require Zonal Head approval at this discount level.' };
  if (discount <= 30) return { level: 'Regional Head Approval', color: '#EA580C', desc: 'Deal will require Regional Head approval.' };
  return { level: 'Sales Head Approval', color: '#DC2626', desc: 'Deal will require Sales Head approval at this discount level.' };
};

export const DealEstimateScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [basePrice, setBasePrice] = useState('');
  const [totalLogins, setTotalLogins] = useState('');
  const [discount, setDiscount] = useState('');
  const [billingFrequency, setBillingFrequency] = useState('Annually');

  const bp = parseFloat(basePrice) || 0;
  const tl = parseInt(totalLogins) || 0;
  const disc = parseFloat(discount) || 0;

  const subtotal = bp * tl;
  const amountWithoutGst = Math.round(subtotal * (1 - disc / 100));
  const discountAmount = subtotal - amountWithoutGst;
  const gstAmount = Math.round(amountWithoutGst * 0.18);
  const totalMoney = amountWithoutGst + gstAmount;
  const installments = INSTALLMENT_MAP[billingFrequency] || 1;
  const perInstallment = installments > 0 ? Math.round(totalMoney / installments) : 0;

  const hasValues = bp > 0 && tl > 0;
  const approval = disc > 0 && hasValues ? getApprovalInfo(disc) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Deal Estimate" color={COLOR.primary} onMenu={() => navigation.toggleDrawer()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={tablet ? styles.twoColGrid : undefined}>
          {/* Left Column — Input */}
          <View style={tablet ? styles.colLeft : undefined}>
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.iconWrap, { backgroundColor: COLOR.light || '#F0FDF4' }]}>
                  <Calculator size={20} color={COLOR.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Pricing Calculator</Text>
                  <Text style={styles.sectionSub}>Enter values to see live calculation</Text>
                </View>
              </View>

              <Input label="Base Price (₹ per login) *" value={basePrice} onChangeText={setBasePrice} placeholder="e.g. 1000" keyboardType="numeric" accentColor={COLOR.primary} />
              <Input label="Total Logins (Teachers) *" value={totalLogins} onChangeText={setTotalLogins} placeholder="e.g. 50" keyboardType="numeric" accentColor={COLOR.primary} />
              <Input label="Discount %" value={discount} onChangeText={setDiscount} placeholder="e.g. 10" keyboardType="numeric" accentColor={COLOR.primary} />
              <SelectPicker label="Billing Frequency" options={BILLING_OPTIONS} value={billingFrequency} onChange={(v) => setBillingFrequency(String(v))} accentColor={COLOR.primary} />
            </Card>
          </View>

          {/* Right Column — Results */}
          <View style={tablet ? styles.colRight : undefined}>
            {/* Calculation Breakdown */}
            <Card style={styles.section}>
              <Text style={styles.cardTitle}>Calculation Breakdown</Text>
              <InfoRow label="Base Price (per login)" value={fmt(bp)} />
              <InfoRow label="Total Logins" value={String(tl)} />
              <InfoRow label="Subtotal (Base × Logins)" value={fmt(subtotal)} />
              {disc > 0 && <InfoRow label={`Discount (${disc}%)`} value={`- ${fmt(discountAmount)}`} valueColor="#DC2626" />}
              <InfoRow label="Amount Without GST" value={fmt(amountWithoutGst)} />
              <InfoRow label="GST (18%)" value={`+ ${fmt(gstAmount)}`} />
              <View style={styles.totalBanner}>
                <Text style={styles.totalLabel}>Total Amount (incl. GST)</Text>
                <Text style={[styles.totalValue, { color: COLOR.primary }]}>{fmt(totalMoney)}</Text>
              </View>
            </Card>

            {/* Billing Breakdown */}
            {hasValues && (
              <Card style={styles.section}>
                <Text style={styles.cardTitle}>Payment Breakdown ({billingFrequency})</Text>
                <InfoRow label="Total Amount" value={fmt(totalMoney)} />
                <InfoRow label="Number of Installments" value={`${installments} per year`} />
                <View style={styles.billingBanner}>
                  <Text style={styles.billingLabel}>Per {billingFrequency === 'Monthly' ? 'Month' : billingFrequency === 'Quarterly' ? 'Quarter' : billingFrequency === 'Half-Yearly' ? 'Half-Year' : 'Year'}</Text>
                  <Text style={styles.billingValue}>{fmt(perInstallment)}</Text>
                </View>
              </Card>
            )}

            {/* Approval Level */}
            {hasValues && disc > 0 && approval && (
              <Card style={{ ...styles.section, borderLeftWidth: 4, borderLeftColor: approval.color }}>
                <View style={styles.approvalRow}>
                  <Badge label={approval.level} color={approval.color} />
                </View>
                <Text style={styles.approvalDesc}>{approval.desc}</Text>
              </Card>
            )}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  sectionSub: { fontSize: rf(11), color: '#6B7280', marginTop: 2 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  cardTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: rf(13), color: '#6B7280' },
  infoValue: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  totalLabel: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: rf(18), fontWeight: '800' },
  noteText: { fontSize: rf(11), color: '#9CA3AF', marginTop: 8, lineHeight: 16 },
  approvalRow: { marginBottom: 8 },
  approvalDesc: { fontSize: rf(12), color: '#6B7280', lineHeight: 18 },
  twoColGrid: { flexDirection: 'row', gap: 14 },
  colLeft: { flex: 1 },
  colRight: { flex: 1, gap: 14 },
  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8,
  },
  billingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  billingLabel: { fontSize: rf(13), fontWeight: '700', color: '#1E40AF' },
  billingValue: { fontSize: rf(20), fontWeight: '800', color: '#2563EB' },
});
