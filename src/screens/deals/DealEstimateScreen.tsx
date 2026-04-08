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
  Annually: 1, 'Half-Yearly': 2, Quarterly: 4, Monthly: 12,
};

const getApprovalInfo = (discount: number) => {
  if (discount <= 10) return { level: 'Self-Approved (FO)', color: '#16A34A', desc: 'Within FO authority. Deal will be auto-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', color: '#F59E0B', desc: 'Deal will require Zonal Head approval at this discount level.' };
  if (discount <= 30) return { level: 'Regional Head Approval', color: '#EA580C', desc: 'Deal will require Regional Head approval.' };
  return { level: 'Sales Head Approval', color: '#DC2626', desc: 'Deal will require Sales Head approval at this discount level.' };
};

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
  <View style={s.infoRow}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={[s.infoValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
  </View>
);

export const DealEstimateScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
  const { width, height } = useWindowDimensions();
  const isWide = width >= 700 || (width > height && width >= 580);

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

  const billingPeriod = billingFrequency === 'Monthly' ? 'Month' : billingFrequency === 'Quarterly' ? 'Quarter' : billingFrequency === 'Half-Yearly' ? 'Half-Year' : 'Year';

  // ── Input Card ──
  const inputCard = (
    <Card style={s.card}>
      <View style={s.sectionHeader}>
        <View style={[s.iconWrap, { backgroundColor: COLOR.light || '#F0FDF4' }]}>
          <Calculator size={20} color={COLOR.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Pricing Calculator</Text>
          <Text style={s.sectionSub}>Enter values to see live calculation</Text>
        </View>
      </View>
      <Input label="Base Price (₹ per login) *" value={basePrice} onChangeText={setBasePrice} placeholder="e.g. 1000" keyboardType="numeric" accentColor={COLOR.primary} />
      <Input label="Total Logins (Teachers) *" value={totalLogins} onChangeText={setTotalLogins} placeholder="e.g. 50" keyboardType="numeric" accentColor={COLOR.primary} />
      <Input label="Discount %" value={discount} onChangeText={setDiscount} placeholder="e.g. 10" keyboardType="numeric" accentColor={COLOR.primary} />
      <SelectPicker label="Billing Frequency" options={BILLING_OPTIONS} value={billingFrequency} onChange={(v) => setBillingFrequency(String(v))} accentColor={COLOR.primary} />
    </Card>
  );

  // ── Results Cards ──
  const resultsCards = (
    <View style={isWide ? { flex: 1 } : undefined}>
      {hasValues ? (
        <Card style={s.card}>
          <Text style={s.cardTitle}>Calculation Breakdown</Text>
          <InfoRow label="Base Price (per login)" value={fmt(bp)} />
          <InfoRow label="Total Logins" value={String(tl)} />
          <InfoRow label="Subtotal (Base × Logins)" value={fmt(subtotal)} />
          {disc > 0 && <InfoRow label={`Discount (${disc}%)`} value={`- ${fmt(discountAmount)}`} valueColor="#DC2626" />}
          <InfoRow label="Amount Without GST" value={fmt(amountWithoutGst)} />
          <InfoRow label="GST (18%)" value={`+ ${fmt(gstAmount)}`} />
          <View style={s.totalBanner}>
            <Text style={s.totalLabel}>Total Amount (incl. GST)</Text>
            <Text style={[s.totalValue, { color: COLOR.primary }]}>{fmt(totalMoney)}</Text>
          </View>
        </Card>
      ) : (
        <Card style={s.emptyCard}>
          <Text style={s.emptyIcon}>🧮</Text>
          <Text style={s.emptyTitle}>Enter values to see calculation</Text>
          <Text style={s.emptySub}>Fill in Base Price and Total Logins to get a live pricing breakdown with GST.</Text>
        </Card>
      )}

      {hasValues && (
        <Card style={{ ...s.card, marginTop: 14 }}>
          <Text style={s.cardTitle}>Payment Breakdown ({billingFrequency})</Text>
          <InfoRow label="Total Amount" value={fmt(totalMoney)} />
          <InfoRow label="Installments" value={`${installments} per year`} />
          <View style={s.billingBanner}>
            <Text style={s.billingLabel}>Per {billingPeriod}</Text>
            <Text style={s.billingValue}>{fmt(perInstallment)}</Text>
          </View>
        </Card>
      )}

      {hasValues && disc > 0 && approval && (
        <View style={[s.approvalCard, { marginTop: 14, borderLeftColor: approval.color }]}>
          <Badge label={approval.level} color={approval.color} />
          <Text style={s.approvalDesc}>{approval.desc}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScreenHeader title="Deal Estimate" color={COLOR.primary} onMenu={() => navigation.toggleDrawer()} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{
          padding: isWide ? 24 : 16,
          paddingBottom: 40,
          maxWidth: isWide ? 960 : undefined,
          alignSelf: isWide ? 'center' : undefined,
          width: isWide ? '100%' : undefined,
        }}
      >
        {isWide ? (
          <View style={s.grid}>
            <View style={{ flex: 1 }}>{inputCard}</View>
            {resultsCards}
          </View>
        ) : (
          <>
            {inputCard}
            <View style={{ height: 14 }} />
            {resultsCards}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  grid: { flexDirection: 'row', gap: 16 },
  card: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  sectionSub: { fontSize: rf(11), color: '#6B7280', marginTop: 2 },
  cardTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: rf(13), color: '#6B7280', flex: 1 },
  infoValue: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8,
  },
  totalLabel: { fontSize: rf(13), fontWeight: '700', color: '#0F766E' },
  totalValue: { fontSize: rf(18), fontWeight: '800' },
  billingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  billingLabel: { fontSize: rf(13), fontWeight: '700', color: '#1E40AF' },
  billingValue: { fontSize: rf(20), fontWeight: '800', color: '#2563EB' },
  approvalCard: {
    backgroundColor: '#FFF', borderRadius: 16, borderLeftWidth: 4,
    padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  approvalDesc: { fontSize: rf(12), color: '#6B7280', lineHeight: 18 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: rf(15), fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub: { fontSize: rf(12), color: '#9CA3AF', textAlign: 'center', lineHeight: 18, maxWidth: 260 },
});
