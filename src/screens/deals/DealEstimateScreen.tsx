import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calculator } from 'lucide-react-native';
import { Screen, AppHeader, Card, Badge } from '../../components/ui';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
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

type ApprovalTone = 'success' | 'warning' | 'danger';

const getApprovalInfo = (discount: number): { level: string; tone: ApprovalTone; desc: string } => {
  if (discount <= 10) return { level: 'Self-Approved (FO)', tone: 'success', desc: 'Within FO authority. Deal will be auto-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', tone: 'warning', desc: 'Deal will require Zonal Head approval at this discount level.' };
  if (discount <= 30) return { level: 'Regional Head Approval', tone: 'warning', desc: 'Deal will require Regional Head approval.' };
  return { level: 'Sales Head Approval', tone: 'danger', desc: 'Deal will require Sales Head approval at this discount level.' };
};

const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.infoRow, { borderBottomColor: T.line }]}>
      <Text style={[s.infoLabel, { color: T.sub }]}>{label}</Text>
      <Text style={[s.infoValue, { color: valueColor || T.text }]}>{value}</Text>
    </View>
  );
};

export const DealEstimateScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
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
  const approvalColor = approval
    ? (approval.tone === 'success' ? T.success : approval.tone === 'warning' ? T.warning : T.danger)
    : T.accent;

  const billingPeriod = billingFrequency === 'Monthly' ? 'Month' : billingFrequency === 'Quarterly' ? 'Quarter' : billingFrequency === 'Half-Yearly' ? 'Half-Year' : 'Year';

  // ── Input Card ──
  const inputCard = (
    <Card style={s.card}>
      <View style={s.sectionHeader}>
        <View style={[s.iconWrap, { backgroundColor: T.accentSoft }]}>
          <Calculator size={20} color={T.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Pricing Calculator</Text>
          <Text style={[s.sectionSub, { color: T.sub }]}>Enter values to see live calculation</Text>
        </View>
      </View>
      <Input label="Base Price (₹ per login) *" value={basePrice} onChangeText={setBasePrice} placeholder="e.g. 1000" keyboardType="numeric" accentColor={T.accent} />
      <Input label="Total Logins (Teachers) *" value={totalLogins} onChangeText={setTotalLogins} placeholder="e.g. 50" keyboardType="numeric" accentColor={T.accent} />
      <Input label="Discount %" value={discount} onChangeText={setDiscount} placeholder="e.g. 10" keyboardType="numeric" accentColor={T.accent} />
      <SelectPicker label="Billing Frequency" options={BILLING_OPTIONS} value={billingFrequency} onChange={(v) => setBillingFrequency(String(v))} accentColor={T.accent} />
    </Card>
  );

  // ── Results Cards ──
  const resultsCards = (
    <View style={isWide ? { flex: 1 } : undefined}>
      {hasValues ? (
        <Card style={s.card}>
          <Text style={[s.cardTitle, { color: T.text }]}>Calculation Breakdown</Text>
          <InfoRow label="Base Price (per login)" value={fmt(bp)} />
          <InfoRow label="Total Logins" value={String(tl)} />
          <InfoRow label="Subtotal (Base × Logins)" value={fmt(subtotal)} />
          {disc > 0 && <InfoRow label={`Discount (${disc}%)`} value={`- ${fmt(discountAmount)}`} valueColor={T.danger} />}
          <InfoRow label="Amount Without GST" value={fmt(amountWithoutGst)} />
          <InfoRow label="GST (18%)" value={`+ ${fmt(gstAmount)}`} />
          <View style={[s.totalBanner, { backgroundColor: T.accentSoft, borderColor: T.line }]}>
            <Text style={[s.totalLabel, { color: T.accent }]}>Total Amount (incl. GST)</Text>
            <Text style={[s.totalValue, { color: T.accent }]}>{fmt(totalMoney)}</Text>
          </View>
        </Card>
      ) : (
        <Card style={s.emptyCard}>
          <Text style={s.emptyIcon}>🧮</Text>
          <Text style={[s.emptyTitle, { color: T.text }]}>Enter values to see calculation</Text>
          <Text style={[s.emptySub, { color: T.dim }]}>Fill in Base Price and Total Logins to get a live pricing breakdown with GST.</Text>
        </Card>
      )}

      {hasValues && (
        <Card style={{ ...s.card, marginTop: 14 }}>
          <Text style={[s.cardTitle, { color: T.text }]}>Payment Breakdown ({billingFrequency})</Text>
          <InfoRow label="Total Amount" value={fmt(totalMoney)} />
          <InfoRow label="Installments" value={`${installments} per year`} />
          <View style={[s.billingBanner, { backgroundColor: T.info + '22', borderColor: T.line }]}>
            <Text style={[s.billingLabel, { color: T.info }]}>Per {billingPeriod}</Text>
            <Text style={[s.billingValue, { color: T.info }]}>{fmt(perInstallment)}</Text>
          </View>
        </Card>
      )}

      {hasValues && disc > 0 && approval && (
        <View style={[s.approvalCard, { backgroundColor: T.card, borderColor: T.line, borderLeftColor: approvalColor, marginTop: 14 }]}>
          <Badge label={approval.level} color={approvalColor} />
          <Text style={[s.approvalDesc, { color: T.sub }]}>{approval.desc}</Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Deal Estimate" onMenu={() => navigation.toggleDrawer()} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{
          padding: isWide ? 24 : 16,
          paddingBottom: insets.bottom + 40,
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
    </Screen>
  );
};

const s = StyleSheet.create({
  scroll: { flex: 1 },
  grid: { flexDirection: 'row', gap: 16 },
  card: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: Fonts.bold, fontSize: rf(15) },
  sectionSub: { fontFamily: Fonts.regular, fontSize: rf(11), marginTop: 2 },
  cardTitle: { fontFamily: Fonts.bold, fontSize: rf(14), marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1,
  },
  infoLabel: { fontFamily: Fonts.regular, fontSize: rf(13), flex: 1 },
  infoValue: { fontFamily: Fonts.medium, fontSize: rf(13) },
  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8,
  },
  totalLabel: { fontFamily: Fonts.bold, fontSize: rf(13) },
  totalValue: { fontFamily: Fonts.bold, fontSize: rf(18) },
  billingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4,
  },
  billingLabel: { fontFamily: Fonts.bold, fontSize: rf(13) },
  billingValue: { fontFamily: Fonts.bold, fontSize: rf(20) },
  approvalCard: {
    borderRadius: 18, borderWidth: 1, borderLeftWidth: 4,
    padding: 16, gap: 8,
  },
  approvalDesc: { fontFamily: Fonts.regular, fontSize: rf(12), lineHeight: 18 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: Fonts.bold, fontSize: rf(15), marginBottom: 6 },
  emptySub: { fontFamily: Fonts.regular, fontSize: rf(12), textAlign: 'center', lineHeight: 18, maxWidth: 260 },
});
