import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerActions } from '@react-navigation/native';
import { Building2, Calculator, Info } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { DateInput } from '../../components/common/DateInput';
import { AppHeader, Card } from '../../components/ui';
import { Btn, Field, Input, Trigger, Dropdown, StatusBadge } from '../../components/crud';
import { CONTRACT_DURATIONS } from '../../utils/constants';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
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

/**
 * Discount bounds — the ONE rule both platforms and both deal screens now use.
 *
 * The backend enforces nothing: there is no [Range] attribute anywhere in
 * SalesCRM.Core or SalesCRM.API, and CreateDealRequest.Discount is a bare
 * `decimal`. The only discount logic server-side is DealService.CreateDealAsync's
 * approval ladder (`<= 10 => SelfApproved, <= 20 => PendingZH, <= 30 => PendingRH,
 * _ => PendingSH`) — whose open-ended last arm means a discount above 30 is a
 * normal Sales-Head-approved deal, not an error. So web's `max="50"` was an
 * arbitrary cap that contradicted web's own 0–100 submit check. 100 is the real
 * ceiling: beyond it `subtotal * (1 - discount / 100)` turns negative.
 */
const DISCOUNT_MIN = 0;
const DISCOUNT_MAX = 100;

// Escalation ladder, coloured from the theme. Four tiers, four distinct hues:
// `accent` sits between warning and danger because two adjacent escalation tiers
// sharing a colour makes the banner unreadable. DealEstimateScreen uses this same
// ramp — the two screens must agree.
const getApprovalLevel = (discount: number, T: AppTheme) => {
  if (discount <= 10) return { level: 'Self-Approved', color: T.success, approver: 'You (FO)', desc: 'Within your authority. Deal will be self-approved.' };
  if (discount <= 20) return { level: 'Zonal Head Approval', color: T.warning, approver: 'Zonal Head', desc: 'Deal will be locked until decision.' };
  if (discount <= 30) return { level: 'Regional Head Approval', color: T.accent, approver: 'Regional Head', desc: 'Deal will be locked until decision.' };
  return { level: 'Sales Head Approval', color: T.danger, approver: 'Sales Head', desc: 'Deal will require approval at this discount level.' };
};

const billingLabel = (b: string) => {
  if (b === 'Monthly') return 'Month';
  if (b === 'Quarterly') return 'Quarter';
  if (b === 'Half-Yearly') return 'Half-Year';
  return 'Year';
};

/** One line of the live breakdown panel — mirrors DealEstimateScreen's InfoRow. */
const InfoRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.infoRow, { borderBottomColor: T.line }]}>
      <Text style={[s.infoLabel, { color: T.sub }]}>{label}</Text>
      <Text style={[s.infoValue, { color: valueColor || T.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
};

export const CreateDealScreen = ({ route, navigation }: any) => {
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDd, setOpenDd] = useState<'lead' | 'billing' | 'duration' | null>(null);
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
    // GET /leads/pipeline returns ApiResponse<List<LeadListDto>>; the client's response
    // interceptor unwraps `success/data`, so `r.data` is already the array.
    //
    // Only Won leads may become deals — the same gate web's CreateDeal.jsx enforces.
    // LeadListDto.Stage is a string projected server-side as `l.Stage.ToString()` over
    // the LeadStage enum, so the wire value for the Won member is exactly "Won";
    // the lowercase check mirrors web's defensive filter.
    leadsApi.getPipeline().then((r) => {
      const items = Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [];
      const wonOnly = (items as LeadListDto[]).filter((l) => {
        const st = (l.stage || '').toString();
        return st === 'Won' || st === 'won';
      });
      setLeads(wonOnly);
      // Auto-select the first Won lead, as web does — but never clobber a lead
      // handed in by the caller via route params.
      if (wonOnly.length > 0) {
        setForm((f) => (f.leadId ? f : { ...f, leadId: String(wonOnly[0].id) }));
      }
    }).catch(() => {});
  }, []);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const bp = parseFloat(form.basePrice) || 0;
  const tl = parseInt(form.totalLogins) || 0;
  const disc = parseFloat(form.discount) || 0;

  const subtotal = bp * tl;
  const amountWithoutGst = Math.round(subtotal * (1 - disc / 100));
  const discountAmount = subtotal - amountWithoutGst;
  const gstAmount = Math.round(amountWithoutGst * GST_RATE);
  const totalMoney = amountWithoutGst + gstAmount;
  const installments = INSTALLMENT_MAP[form.billing] || 1;
  const perInstallment = installments > 0 ? Math.round(totalMoney / installments) : 0;

  const approval = getApprovalLevel(disc, T);
  const hasValues = bp > 0 && tl > 0;

  const discErr =
    form.discount.trim() !== '' && (Number.isNaN(parseFloat(form.discount)) || disc < DISCOUNT_MIN || disc > DISCOUNT_MAX)
      ? `Discount must be between ${DISCOUNT_MIN} and ${DISCOUNT_MAX}%.`
      : undefined;

  // Dates arrive from DateInput as YYYY-MM-DD, which Date() parses as UTC midnight
  // — comparing two of them is offset-free, so a plain `>` is safe here.
  const datesErr =
    form.contractStartDate && form.contractEndDate &&
    new Date(form.contractStartDate) > new Date(form.contractEndDate)
      ? 'Contract start date must be before end date.'
      : undefined;

  const leadOptions = leads.map((l) => ({ label: `${l.school} — ${l.city}`, value: String(l.id) }));
  const selectedLead = leadOptions.find((o) => o.value === String(form.leadId));

  const handleSubmit = async () => {
    if (!form.leadId) { Alert.alert('Error', 'Please select a lead'); return; }
    if (tl <= 0) { Alert.alert('Error', 'Total Logins is required'); return; }
    if (bp <= 0) { Alert.alert('Error', 'Base Price is required'); return; }
    // Web parity: CreateDeal.jsx rejects discount < 0 || > 100 and start > end.
    if (discErr) { Alert.alert('Error', discErr); return; }
    if (datesErr) { Alert.alert('Error', datesErr); return; }

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

  // ── Left panel: the whole form. The lead picker lives here rather than in a card
  // of its own — a card holding one dropdown is what made this screen read empty.
  const formPanel = (
    <Card style={s.card}>
      <View style={s.sectionHeader}>
        <View style={[s.iconWrap, { backgroundColor: T.accentSoft }]}>
          <Building2 size={20} color={T.accent} strokeWidth={1.9} />
        </View>
        <View style={s.flex}>
          <Text style={[s.sectionTitle, { color: T.text }]}>Deal Details</Text>
          <Text style={[s.sectionSub, { color: T.sub }]}>Linked lead, pricing and contract</Text>
        </View>
      </View>

      <View style={s.fields}>
        <Field label="Linked Lead *">
          <Trigger
            label={selectedLead ? selectedLead.label : (leads.length === 0 ? 'No Won leads available' : 'Select a Won lead')}
            open={openDd === 'lead'}
            onPress={() => leads.length > 0 && setOpenDd(openDd === 'lead' ? null : 'lead')}
          />
          {openDd === 'lead' && (
            <Dropdown
              style={s.ddFull}
              value={String(form.leadId)}
              options={leadOptions}
              maxHeight={220}
              onSelect={(v) => { set('leadId', v); setOpenDd(null); }}
            />
          )}
          {leads.length === 0 && (
            <Text style={[s.hint, { color: T.warning }]}>
              Deals can only be created from leads that are marked as Won. Move a lead to the Won stage first.
            </Text>
          )}
        </Field>

        <View style={s.row}>
          <Input
            label="Base Price (₹ per login) *"
            value={form.basePrice}
            onChangeText={(v) => set('basePrice', v)}
            keyboardType="numeric"
            placeholder="e.g. 1000"
            containerStyle={s.half}
          />
          <Input
            label="Total Logins *"
            value={form.totalLogins}
            onChangeText={(v) => set('totalLogins', v)}
            keyboardType="numeric"
            placeholder="e.g. 50"
            containerStyle={s.half}
          />
        </View>

        <View style={s.row}>
          <Input
            label="Discount %"
            value={form.discount}
            onChangeText={(v) => set('discount', v)}
            keyboardType="numeric"
            placeholder="0"
            containerStyle={s.half}
            error={discErr}
          />
          <Field label="Billing Frequency" style={s.half}>
            <Trigger
              label={form.billing}
              open={openDd === 'billing'}
              onPress={() => setOpenDd(openDd === 'billing' ? null : 'billing')}
            />
            {openDd === 'billing' && (
              <Dropdown
                style={s.ddFull}
                value={form.billing}
                options={BILLING_OPTIONS}
                onSelect={(v) => { set('billing', v); setOpenDd(null); }}
              />
            )}
          </Field>
        </View>

        <View style={s.row}>
          <Field label="Contract Duration" style={s.half}>
            <Trigger
              label={form.duration}
              open={openDd === 'duration'}
              onPress={() => setOpenDd(openDd === 'duration' ? null : 'duration')}
            />
            {openDd === 'duration' && (
              <Dropdown
                style={s.ddFull}
                value={form.duration}
                options={CONTRACT_DURATIONS.map((d) => ({ label: d, value: d }))}
                onSelect={(v) => { set('duration', v); setOpenDd(null); }}
              />
            )}
          </Field>
          <View style={s.half}>
            <DateInput label="Start Date" value={form.contractStartDate} onChange={(v) => set('contractStartDate', v)} accentColor={T.accent} />
          </View>
        </View>

        <View>
          <DateInput label="End Date" value={form.contractEndDate} onChange={(v) => set('contractEndDate', v)} accentColor={T.accent} />
          {!!datesErr && <Text style={[s.hint, { color: T.danger }]}>{datesErr}</Text>}
        </View>

        {/* The kit's Input is a fixed 46px row, so a 3-row textarea uses the kit's
            Field + the kit's input face at a taller height. */}
        <Field label="Notes for Approver">
          <TextInput
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
            numberOfLines={3}
            placeholder="Context for the approver..."
            placeholderTextColor={T.dim}
            style={[s.textarea, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
          />
        </Field>
      </View>
    </Card>
  );

  // ── Right panel: the live money breakdown, visible while typing instead of
  // buried below the form. Mirrors DealEstimateScreen's results column.
  const summaryPanel = (
    <View style={wide ? s.flex : undefined}>
      {hasValues ? (
        <Card style={s.card}>
          <Text style={[s.cardTitle, { color: T.text }]}>Deal Summary</Text>
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
          <View style={[s.totalBanner, { backgroundColor: withAlpha(T.info, SOFT_TINT), borderColor: withAlpha(T.info, SOFT_TINT) }]}>
            <View style={s.flex}>
              <Text style={[s.totalLabel, { color: T.info }]}>Per {billingLabel(form.billing)}</Text>
              <Text style={[s.totalNote, { color: T.sub }]}>{installments} per year · {form.billing}</Text>
            </View>
            <Text style={[s.totalValue, { color: T.info }]}>{fmt(perInstallment)}</Text>
          </View>
        </Card>
      ) : (
        <Card style={s.emptyCard}>
          <View style={[s.emptyIcon, { backgroundColor: T.accentSoft }]}>
            <Calculator size={26} color={T.accent} strokeWidth={1.7} />
          </View>
          <Text style={[s.emptyTitle, { color: T.text }]}>Enter values to see the deal total</Text>
          <Text style={[s.emptySub, { color: T.dim }]}>Fill in Base Price and Total Logins for a live pricing breakdown with GST.</Text>
        </Card>
      )}

      {hasValues && (
        <View
          style={[
            s.approvalBanner,
            s.stack,
            { backgroundColor: withAlpha(approval.color, SOFT_TINT), borderColor: withAlpha(approval.color, SOFT_TINT) },
          ]}
        >
          <Info size={16} color={approval.color} strokeWidth={2} />
          <View style={s.flex}>
            <StatusBadge label={approval.level} color={approval.color} />
            <Text style={[s.approvalDesc, { color: T.sub }]}>
              {disc <= 10 ? approval.desc : `Approver: ${approval.approver}. ${approval.desc}`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const actions = (
    <View style={[s.footerActions, s.stack]}>
      <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={s.cancelBtn} />
      <Btn label="Submit Deal" onPress={handleSubmit} loading={loading} style={s.submitBtn} />
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <AppHeader
        title="Create Deal"
        subtitle="Formalise a school's purchase intent"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
        onMenu={canGoBack ? undefined : () => navigation.dispatch(DrawerActions.toggleDrawer())}
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
            <View style={s.flex}>{formPanel}</View>
            <View style={s.flex}>
              {summaryPanel}
              {actions}
            </View>
          </View>
        ) : (
          <>
            {formPanel}
            <View style={s.stack}>{summaryPanel}</View>
            {actions}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  flex: { flex: 1 },
  contentWide: { maxWidth: 1040, alignSelf: 'center', width: '100%' },
  grid: { flexDirection: 'row', gap: 16 },
  stack: { marginTop: 14 },
  card: { padding: 16 },
  fields: { gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  ddFull: { width: '100%' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '700', fontSize: rf(14), letterSpacing: -0.2 },
  sectionSub: { fontWeight: '400', fontSize: rf(11.5), marginTop: 2 },
  cardTitle: { fontWeight: '700', fontSize: rf(14), letterSpacing: -0.2, marginBottom: 8 },
  hint: { fontWeight: '500', fontSize: rf(11.5), lineHeight: 16, marginTop: 6 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontWeight: '400', fontSize: rf(13), flex: 1 },
  infoValue: { fontWeight: '600', fontSize: rf(13) },

  textarea: {
    minHeight: 88, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: rf(14), fontWeight: '500', textAlignVertical: 'top',
  },

  totalBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12,
  },
  totalLabel: { fontWeight: '700', fontSize: rf(13) },
  totalNote: { fontWeight: '400', fontSize: rf(11), marginTop: 2 },
  totalValue: { fontWeight: '800', fontSize: rf(19), letterSpacing: -0.4 },

  approvalBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  approvalDesc: { fontWeight: '400', fontSize: rf(12), lineHeight: 18, marginTop: 5 },

  emptyCard: { padding: 32, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontWeight: '700', fontSize: rf(14.5), marginBottom: 6, textAlign: 'center' },
  emptySub: { fontWeight: '400', fontSize: rf(12), textAlign: 'center', lineHeight: 18, maxWidth: 260 },

  footerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cancelBtn: { flex: 1 },
  submitBtn: { flex: 2 },

});
