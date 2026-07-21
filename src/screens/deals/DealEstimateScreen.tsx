import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calculator, Info } from 'lucide-react-native';
import { Screen, AppHeader, Card } from '../../components/ui';
import { Field, Input, Trigger, Dropdown, StatusBadge } from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

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

/**
 * Numeric bounds — web parity with DealEstimate.jsx's `min`/`max` input attributes,
 * which RN's TextInput has no equivalent for.
 *
 * DISCOUNT_MAX is 100, not web's stale `max="50"`. The backend applies no bound at
 * all (no [Range] attribute exists anywhere in SalesCRM.Core / SalesCRM.API, and
 * DealService.CreateDealAsync only reads the value into an approval ladder whose
 * last arm is `_ => ApprovalStatus.PendingSH`), so any discount above 30 is a
 * legitimate Sales-Head-approved deal. 100 is the only real ceiling: past it
 * `subtotal * (1 - disc / 100)` goes negative. CreateDealScreen agrees.
 */
const BASE_PRICE_MIN = 0;
const LOGINS_MIN = 1;
const DISCOUNT_MIN = 0;
const DISCOUNT_MAX = 100;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * Escalation ladder, coloured from the theme. Four tiers, four distinct hues —
 * `accent` sits between warning and danger so no two adjacent tiers share a colour
 * (the same ramp CreateDealScreen uses; the two screens must agree).
 */
const getApprovalInfo = (discount: number, T: AppTheme) => {
  if (discount <= 10) return { level: 'Self-Approved (FO)', color: T.success, desc: 'Within FO authority. Deal will be auto-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', color: T.warning, desc: 'Deal will require Zonal Head approval at this discount level.' };
  if (discount <= 30) return { level: 'Regional Head Approval', color: T.accent, desc: 'Deal will require Regional Head approval.' };
  return { level: 'Sales Head Approval', color: T.danger, desc: 'Deal will require Sales Head approval at this discount level.' };
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
  const wide = isTabletDevice && width > height;

  const [basePrice, setBasePrice] = useState('');
  const [totalLogins, setTotalLogins] = useState('');
  const [discount, setDiscount] = useState('');
  const [billingFrequency, setBillingFrequency] = useState('Annually');
  const [billingOpen, setBillingOpen] = useState(false);

  // Raw typed values. Kept unclamped so the field still shows exactly what the user
  // typed — the spec is "clamp and show a validation message, do not silently coerce",
  // so the clamp lands on the MATHS below, never on the text in the box.
  const rawBp = parseFloat(basePrice);
  const rawTl = parseInt(totalLogins, 10);
  const rawDisc = parseFloat(discount);

  const bpErr = basePrice.trim() !== '' && (Number.isNaN(rawBp) || rawBp < BASE_PRICE_MIN)
    ? `Base Price cannot be below ₹${BASE_PRICE_MIN}.` : undefined;
  const tlErr = totalLogins.trim() !== '' && (Number.isNaN(rawTl) || rawTl < LOGINS_MIN)
    ? `Total Logins must be at least ${LOGINS_MIN}.` : undefined;
  const discErr = discount.trim() !== '' && (Number.isNaN(rawDisc) || rawDisc < DISCOUNT_MIN || rawDisc > DISCOUNT_MAX)
    ? `Discount must be between ${DISCOUNT_MIN} and ${DISCOUNT_MAX}%.` : undefined;

  // Clamped values feed the breakdown, so an out-of-range entry can never render a
  // negative total while the message above tells the user what was wrong.
  const bp = clamp(Number.isNaN(rawBp) ? 0 : rawBp, BASE_PRICE_MIN, Number.MAX_SAFE_INTEGER);
  const tl = Number.isNaN(rawTl) ? 0 : Math.max(rawTl, 0);
  const disc = clamp(Number.isNaN(rawDisc) ? 0 : rawDisc, DISCOUNT_MIN, DISCOUNT_MAX);

  const subtotal = bp * tl;
  const amountWithoutGst = Math.round(subtotal * (1 - disc / 100));
  const discountAmount = subtotal - amountWithoutGst;
  const gstAmount = Math.round(amountWithoutGst * 0.18);
  const totalMoney = amountWithoutGst + gstAmount;
  const installments = INSTALLMENT_MAP[billingFrequency] || 1;
  const perInstallment = installments > 0 ? Math.round(totalMoney / installments) : 0;

  const hasValues = bp > 0 && tl > 0;
  const approval = disc > 0 && hasValues ? getApprovalInfo(disc, T) : null;

  const billingPeriod = billingFrequency === 'Monthly' ? 'Month' : billingFrequency === 'Quarterly' ? 'Quarter' : billingFrequency === 'Half-Yearly' ? 'Half-Year' : 'Year';

  // ── Left panel: Pricing Calculator ──
  const inputCard = (
    <Card style={s.card}>
      <View style={s.sectionHeader}>
        <View style={[s.iconWrap, { backgroundColor: T.accentSoft }]}>
          <Calculator size={20} color={T.accent} strokeWidth={1.9} />
        </View>
        <View style={s.flex}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Pricing Calculator</Text>
          <Text style={[s.sectionSub, { color: T.sub }]}>Enter values to see live calculation</Text>
        </View>
      </View>

      <View style={s.fields}>
        <Input
          label="Base Price (₹ per login) *"
          value={basePrice}
          onChangeText={setBasePrice}
          placeholder="e.g. 1000"
          keyboardType="numeric"
          error={bpErr}
        />
        <Input
          label="Total Logins (Teachers) *"
          value={totalLogins}
          onChangeText={setTotalLogins}
          placeholder="e.g. 50"
          keyboardType="numeric"
          error={tlErr}
        />
        <Input
          label="Discount %"
          value={discount}
          onChangeText={setDiscount}
          placeholder={`0 – ${DISCOUNT_MAX}`}
          keyboardType="numeric"
          error={discErr}
        />
        <Field label="Billing Frequency">
          <Trigger
            label={billingFrequency}
            open={billingOpen}
            onPress={() => setBillingOpen(v => !v)}
          />
          {billingOpen && (
            <Dropdown
              style={s.ddFull}
              value={billingFrequency}
              options={BILLING_OPTIONS}
              onSelect={(v) => { setBillingFrequency(v); setBillingOpen(false); }}
            />
          )}
        </Field>
      </View>
    </Card>
  );

  // ── Right panel: Calculation Breakdown (+ payment split, + approval) ──
  const resultsCards = (
    <View style={wide ? s.flex : undefined}>
      {hasValues ? (
        <Card style={s.card}>
          <Text style={[s.cardTitle, { color: T.text }]}>Calculation Breakdown</Text>
          <InfoRow label="Base Price (per login)" value={fmt(bp)} />
          <InfoRow label="Total Logins" value={String(tl)} />
          <InfoRow label="Subtotal (Base × Logins)" value={fmt(subtotal)} />
          {disc > 0 && <InfoRow label={`Discount (${disc}%)`} value={`- ${fmt(discountAmount)}`} valueColor={T.danger} />}
          <InfoRow label="Amount Without GST" value={fmt(amountWithoutGst)} />
          <InfoRow label="GST (18%)" value={`+ ${fmt(gstAmount)}`} />
          <View style={[s.totalBanner, { backgroundColor: T.accentSoft, borderColor: withAlpha(T.accent, SOFT_TINT) }]}>
            <Text style={[s.totalLabel, { color: T.accent }]}>Total Amount (incl. GST)</Text>
            <Text style={[s.totalValue, { color: T.accent }]}>{fmt(totalMoney)}</Text>
          </View>
        </Card>
      ) : (
        <Card style={s.emptyCard}>
          <View style={[s.emptyIcon, { backgroundColor: T.accentSoft }]}>
            <Calculator size={26} color={T.accent} strokeWidth={1.7} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Enter values to see calculation</Text>
          <Text style={[s.emptySub, { color: T.dim }]}>Fill in Base Price and Total Logins to get a live pricing breakdown with GST.</Text>
        </Card>
      )}

      {hasValues && (
        <Card style={[s.card, s.stack]}>
          <Text style={[s.cardTitle, { color: T.text }]}>Payment Breakdown ({billingFrequency})</Text>
          <InfoRow label="Total Amount" value={fmt(totalMoney)} />
          <InfoRow label="Installments" value={`${installments} per year`} />
          <View style={[s.totalBanner, { backgroundColor: withAlpha(T.info, SOFT_TINT), borderColor: withAlpha(T.info, SOFT_TINT) }]}>
            <Text style={[s.totalLabel, { color: T.info }]}>Per {billingPeriod}</Text>
            <Text style={[s.totalValue, { color: T.info }]}>{fmt(perInstallment)}</Text>
          </View>
        </Card>
      )}

      {hasValues && disc > 0 && approval && (
        <View
          style={[
            s.approvalCard,
            s.stack,
            { backgroundColor: withAlpha(approval.color, SOFT_TINT), borderColor: withAlpha(approval.color, SOFT_TINT) },
          ]}
        >
          <Info size={16} color={approval.color} strokeWidth={2} />
          <View style={s.flex}>
            <StatusBadge label={approval.level} color={approval.color} />
            <Text style={[s.approvalDesc, { color: T.sub }]}>{approval.desc}</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <AppHeader
        title="Deal Estimate"
        subtitle="Calculate pricing with GST before creating a deal"
        onMenu={() => navigation.toggleDrawer()}
      />

      <ScrollView
        style={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { padding: wide ? 24 : 16, paddingBottom: insets.bottom + 40 },
          wide && s.contentWide,
        ]}
      >
        {wide ? (
          <View style={s.grid}>
            <View style={s.flex}>{inputCard}</View>
            {resultsCards}
          </View>
        ) : (
          <>
            {inputCard}
            <View style={s.stack}>{resultsCards}</View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
};

const s = StyleSheet.create({
  scroll: { flex: 1 },
  contentWide: { maxWidth: 960, alignSelf: 'center', width: '100%' },
  grid: { flexDirection: 'row', gap: 16 },
  flex: { flex: 1 },
  stack: { marginTop: 14 },
  card: { padding: 16 },
  fields: { gap: 14 },
  ddFull: { width: '100%' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '700', fontSize: rf(14), letterSpacing: -0.2 },
  sectionSub: { fontWeight: '400', fontSize: rf(11.5), marginTop: 2 },
  cardTitle: { fontWeight: '700', fontSize: rf(14), letterSpacing: -0.2, marginBottom: 8 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontWeight: '400', fontSize: rf(13), flex: 1, minWidth: 0 },
  // RN defaults flexShrink to 0: without this a long value (a full school name,
  // a large figure) paints straight over the label sharing its row.
  infoValue: { fontWeight: '600', fontSize: rf(13), flexShrink: 1, minWidth: 0, textAlign: 'right' },

  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12,
  },
  totalLabel: { fontWeight: '700', fontSize: rf(13), flexShrink: 1, minWidth: 0 },
  totalValue: { fontWeight: '800', fontSize: rf(19), letterSpacing: -0.4, flexShrink: 0, textAlign: 'right' },

  approvalCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  approvalDesc: { fontWeight: '400', fontSize: rf(12), lineHeight: 18, marginTop: 5 },

  emptyCard: { padding: 32, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontWeight: '700', fontSize: rf(14.5), marginBottom: 6, textAlign: 'center' },
  emptySub: { fontWeight: '400', fontSize: rf(12), textAlign: 'center', lineHeight: 18, maxWidth: 260 },
});
