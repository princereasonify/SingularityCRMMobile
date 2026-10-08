import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput, useWindowDimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Calculator, Info } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { leadsApi } from '../../api/leads';
import { LeadListDto } from '../../types';
import { DateInput } from '../../components/common/DateInput';
import { AppHeader, Card } from '../../components/ui';
import { Btn, Field, Trigger, Dropdown, StatusBadge } from '../../components/crud';
import { NumField } from '../../components/common/NumField';
import {
  CONTRACT_DURATIONS, DEALABLE_STAGES, APPROVAL_LABELS, stageLabel, money, approvalRoute,
} from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errorMessage';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

// Up to 2 decimals: amounts are paise-rounded (money()), so whole-rupee display hid real paise.
const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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

// Same module catalog web's staticData.js exposes — the backend stores Deal.Modules
// (JSON) and deal detail renders them, so the picker feeds a real field.
const MODULE_CATALOG = ['AI Voice', 'Curriculum', 'AI Videos', 'Lab Simulator', 'ERP', 'Homework', 'Exam'];

// Approval preview colour — one hue per escalation tier, from the theme. The tier itself
// comes from approvalRoute() (web's leadStages.js port), which also lifts the route past
// the creator's own level and past a missing zone/region, as DealService does.
const approvalColor = (level: string, T: AppTheme) =>
  level === 'Self-Approved' ? T.success
    : level === 'Zonal Head Approval' ? T.warning
      : level === 'Regional Head Approval' ? T.accent
        : T.danger;

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
  const { user } = useAuth();
  const toast = useToast();
  // LeadDetail / Pipeline hand a lead in as { leadId } — preselected only if it is eligible.
  const preselectLeadId = route?.params?.leadId ? String(route.params.leadId) : '';

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDd, setOpenDd] = useState<'lead' | 'billing' | 'duration' | null>(null);
  const [form, setForm] = useState({
    leadId: '',
    basePrice: '',
    totalLogins: '',
    discount: '0',
    billing: 'Annually',
    duration: CONTRACT_DURATIONS[0],
    notes: '',
    contractStartDate: '',
    contractEndDate: '',
    modules: [] as string[],
    numberOfLicenses: '',
  });

  const toggleModule = (m: string) => setForm((f) => ({
    ...f,
    modules: f.modules.includes(m) ? f.modules.filter((x) => x !== m) : [...f.modules, m],
  }));

  useEffect(() => {
    // A deal can be raised once the demo is done (DealService.DealableStages) — the deal's
    // approval is what makes the lead Won. This used to list only leads already marked Won,
    // which forced people to drag leads to Won with no deal behind them. Same as web's
    // CreateDeal.jsx: one request per stage, 500 a page (PaginationParams.MaxPageSize); the
    // server scopes to the caller's team. Nothing is auto-selected.
    const PAGE_SIZE = 500;
    let alive = true;
    Promise.all(DEALABLE_STAGES.map((stage) =>
      leadsApi.getLeads({ page: 1, pageSize: PAGE_SIZE, stage })
        .then((r) => {
          const d: any = r.data;
          return (Array.isArray(d) ? d : (d?.items ?? [])) as LeadListDto[];
        })
        .catch(() => [] as LeadListDto[])))
      .then((lists) => {
        if (!alive) return;
        const byId = new Map<number, LeadListDto>();
        lists.flat().forEach((l) => { if (DEALABLE_STAGES.includes(l.stage)) byId.set(l.id, l); });
        const eligible = [...byId.values()].sort((a, b) => (a.school || '').localeCompare(b.school || ''));
        setLeads(eligible);
        const preselected = preselectLeadId && eligible.find((l) => String(l.id) === preselectLeadId);
        if (preselected) setForm((f) => ({ ...f, leadId: String(preselected.id) }));
        else if (preselectLeadId) toast.warning('That lead is not ready for a deal yet (the demo must be done).');
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectLeadId]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const bp = parseFloat(form.basePrice) || 0;
  const tl = parseInt(form.totalLogins) || 0;
  const disc = parseFloat(form.discount) || 0;

  // Base price is per login; billing only splits the total. Rounded to paise at each step,
  // exactly as DealService stores it — whole-rupee rounding here disagreed with the saved deal.
  const subtotal = money(money(bp) * tl);
  const amountWithoutGst = money(subtotal * (1 - money(disc) / 100));
  const discountAmount = money(subtotal - amountWithoutGst);
  const gstAmount = money(amountWithoutGst * GST_RATE);
  const totalMoney = money(amountWithoutGst + gstAmount);
  const installments = INSTALLMENT_MAP[form.billing] || 1;
  const perInstallment = installments > 0 ? money(totalMoney / installments) : totalMoney;

  // Previews off the signed-in user's own zone/region (accurate for an FO on their own
  // lead). The confirmation after submit reads the real route back from the server.
  const route0 = approvalRoute(money(disc), user?.role, user?.zoneId, user?.regionId);
  const approval = { ...route0, color: approvalColor(route0.level, T) };
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

  const leadOptions = leads.map((l) => ({ label: `${l.school} — ${l.city} (${stageLabel(l.stage)})`, value: String(l.id) }));
  const selectedLead = leadOptions.find((o) => o.value === String(form.leadId));

  const handleSubmit = async () => {
    const leadIdNum = Number(form.leadId);
    if (!form.leadId || !Number.isInteger(leadIdNum) || leadIdNum <= 0) { Alert.alert('Error', 'Please select a valid lead.'); return; }
    if (tl <= 0) { Alert.alert('Error', 'Total Logins is required'); return; }
    if (bp <= 0) { Alert.alert('Error', 'Base Price is required'); return; }
    // Web parity: CreateDeal.jsx rejects discount < 0 || > 100 and start > end.
    if (discErr) { Alert.alert('Error', discErr); return; }
    if (datesErr) { Alert.alert('Error', datesErr); return; }
    const licences = form.numberOfLicenses.trim() === '' ? null : Number(form.numberOfLicenses);
    if (licences !== null && (!Number.isInteger(licences) || licences <= 0)) {
      Alert.alert('Error', 'Licences must be a whole number above 0.'); return;
    }

    setLoading(true);
    try {
      const res = await dealsApi.createDeal({
        leadId: leadIdNum,
        contractValue: subtotal,
        discount: money(disc),
        basePrice: money(bp),
        numberOfLicenses: licences,
        totalLogins: tl,
        billingFrequency: form.billing,
        paymentTerms: form.billing,
        duration: form.duration,
        modules: form.modules,
        notes: form.notes || undefined,
        submitForApproval: true,
        contractStartDate: form.contractStartDate || null,
        contractEndDate: form.contractEndDate || null,
      });
      // Say what actually happened — the server decides the route (it also escalates past a
      // missing zone/region), so read it back instead of guessing from the discount.
      const status = res?.data?.approvalStatus;
      const selfApproved = status ? status === 'SelfApproved' : !!approval.selfApproved;
      const approver = (status && APPROVAL_LABELS[status]?.label?.replace('Awaiting ', '')) || approval.approver;
      Alert.alert(
        'Deal Submitted!',
        selfApproved
          ? 'Deal auto-approved and lead marked as Won.'
          : `Deal submitted for ${approver} approval.`,
        // 'Main' is the role drawer on the root stack — works from both the drawer's
        // Create Deal entry and the stacked CreateDeal screen.
        [{ text: 'OK', onPress: () => navigation.navigate('Main', { screen: 'Deals' }) }],
      );
    } catch (err: any) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to create deal.'));
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
            label={selectedLead ? selectedLead.label : (leads.length === 0 ? 'No leads ready for a deal' : 'Select a lead')}
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
              A deal can be created once a lead's demo is done (Demo Done, Proposal Sent, Negotiation or Contract Sent). Approving the deal marks the lead Won.
            </Text>
          )}
        </Field>

        <View style={s.row}>
          <NumField
            label="Base Price (₹ per login) *"
            value={form.basePrice}
            onChangeText={(v) => set('basePrice', v)}
            placeholder="e.g. 1000"
            style={s.half}
          />
          <NumField
            label="Total Logins *"
            value={form.totalLogins}
            onChangeText={(v) => set('totalLogins', v)}
            placeholder="e.g. 50"
            allowDecimal={false}
            style={s.half}
          />
        </View>

        <NumField
          label="Licences"
          value={form.numberOfLicenses}
          onChangeText={(v) => set('numberOfLicenses', v)}
          placeholder={tl > 0 ? `Same as logins (${tl})` : 'Same as logins'}
          allowDecimal={false}
        />

        <View style={s.row}>
          <NumField
            label="Discount %"
            value={form.discount}
            onChangeText={(v) => set('discount', v)}
            placeholder="0"
            style={s.half}
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

        <Field label="Modules">
          <View style={s.moduleWrap}>
            {MODULE_CATALOG.map((m) => {
              const on = form.modules.includes(m);
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => toggleModule(m)}
                  activeOpacity={0.8}
                  style={[
                    s.moduleChip,
                    { borderColor: on ? T.accent : T.line, backgroundColor: on ? T.accent : T.card },
                  ]}
                >
                  <Text style={[s.moduleChipTxt, { color: on ? T.onAccent : T.sub }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

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
              {approval.selfApproved
                ? 'Within your authority. The deal is approved on submit and the lead is marked Won.'
                : `Approver: ${approval.approver}. The lead is marked Won once the deal is approved.`}
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
    // Pushed as the 'CreateDeal' stack route there is no top bar, so this screen pays the
    // status-bar inset; as the drawer's "Create Deal" the AppTopbar already did.
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={route?.name === 'CreateDeal' ? ['top'] : []}>
      <AppHeader
        title="Create Deal"
        subtitle="Formalise a school's purchase intent"
        onBack={canGoBack ? () => navigation.goBack() : undefined}
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
  moduleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  moduleChipTxt: { fontSize: rf(12), fontWeight: '600' },

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
