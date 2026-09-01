import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Field, Input, Checkbox, Segmented } from '../../components/crud';
import { Screen, Card } from '../../components/ui';
import { b2cUserService, CreateB2CUserBody } from '../../api/b2c/b2cUserService';
import { invalidateFieldStaff } from '../../components/b2c/useFieldStaff';
import { B2CUserListDto } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP } from '../../hooks/useResponsive';

/**
 * Add User — the mobile twin of web's B2CCreateUser.jsx. Creates an Agent or a Counselor,
 * with the payout/KYC block the server now makes MANDATORY on create (CreateB2CUserRequest
 * marks all four [Required]); a create without them is a 400, which is why this replaced the
 * quick inline modal the list screen used to open.
 */

// ── Payout / KYC ─────────────────────────────────────────────────────────────
// Lives here rather than in components/b2c because that directory belongs to another
// agent in this workstream; the counselor screen imports these so the two forms cannot
// drift apart the way three hand-copied field sets would. Every rule mirrors the
// server's PayoutValidation — the client catches mistakes while they're still cheap,
// the server stays the authority.

/** Server: PanPattern. */
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Server: IfscPattern — four letters, a reserved '0', then six characters. */
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
/** Server: AccountPattern. Length varies by bank, so the rule bounds it rather than pins it. */
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const digitsOnly = (v: string) => (v || '').replace(/\D/g, '');
/** Aadhaar grouped 4-4-4 while typing, the way it is printed on the card. */
export const formatAadhaar = (v: string) =>
  digitsOnly(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
const upperAlnum = (v: string, max: number) =>
  (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);

export interface PayoutValues {
  panNumber: string;
  aadhaarNumber: string;
  accountNumber: string;
  ifscCode: string;
}

export const EMPTY_PAYOUT: PayoutValues = {
  panNumber: '', aadhaarNumber: '', accountNumber: '', ifscCode: '',
};

/**
 * Validity of the current values, derived in one place so the fields and the submit
 * button can never disagree about whether the details are usable.
 */
export function payoutState(v: PayoutValues) {
  const panValid = PAN_RE.test(v.panNumber);
  const aadhaarValid = digitsOnly(v.aadhaarNumber).length === 12;
  const accountValid = ACCOUNT_RE.test(digitsOnly(v.accountNumber));
  const ifscValid = IFSC_RE.test(v.ifscCode);
  return {
    panError: v.panNumber.length > 0 && !panValid ? 'Format: ABCDE1234F' : '',
    aadhaarError: v.aadhaarNumber.length > 0 && !aadhaarValid ? 'Aadhaar must be 12 digits' : '',
    accountError: v.accountNumber.length > 0 && !accountValid ? 'Account number must be 9-18 digits' : '',
    ifscError: v.ifscCode.length > 0 && !ifscValid ? 'Format: HDFC0001234' : '',
    // All four, with no partial state: a transfer needs the account AND the IFSC, and the
    // tax identifiers are reported together.
    isComplete: panValid && aadhaarValid && accountValid && ifscValid,
  };
}

/** The payload fields, canonicalised the way the server stores them. */
export const payoutPayload = (v: PayoutValues) => ({
  panNumber: v.panNumber,
  aadhaarNumber: digitsOnly(v.aadhaarNumber),
  accountNumber: digitsOnly(v.accountNumber),
  ifscCode: v.ifscCode,
});

/** PAN / Aadhaar / bank-account capture, shared by the Add User and Add Counselor forms. */
export const PayoutFields = ({ values, onChange, colW }: {
  values: PayoutValues;
  onChange: (k: keyof PayoutValues, v: string) => void;
  colW: string;
}) => {
  const st = payoutState(values);
  const w = { width: colW as any };
  return (
    <>
      <Input
        label="PAN Number *"
        value={values.panNumber}
        error={st.panError}
        onChangeText={v => onChange('panNumber', upperAlnum(v, 10))}
        placeholder="ABCDE1234F"
        containerStyle={w}
      />
      <Input
        label="Aadhaar Number *"
        value={values.aadhaarNumber}
        error={st.aadhaarError}
        onChangeText={v => onChange('aadhaarNumber', formatAadhaar(v))}
        keyboardType="number-pad"
        maxLength={14}
        placeholder="1234 5678 9012"
        containerStyle={w}
      />
      <Input
        label="Bank Account Number *"
        value={values.accountNumber}
        error={st.accountError}
        onChangeText={v => onChange('accountNumber', digitsOnly(v).slice(0, 18))}
        keyboardType="number-pad"
        maxLength={18}
        placeholder="9-18 digits"
        containerStyle={w}
      />
      <Input
        label="IFSC Code *"
        value={values.ifscCode}
        error={st.ifscError}
        onChangeText={v => onChange('ifscCode', upperAlnum(v, 11))}
        placeholder="HDFC0001234"
        containerStyle={w}
      />
    </>
  );
};

// ── Screen ───────────────────────────────────────────────────────────────────
type Role = 'Agent' | 'Counselor';

const emptyForm = {
  name: '', email: '', mobile: '', address: '', password: '',
  role: 'Agent' as Role, bio: '', isManager: false, agentIds: [] as number[],
  ...EMPTY_PAYOUT,
};

const toggleId = (arr: number[], id: number) =>
  arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

export const B2CCreateUserScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const navigation = useNavigation<any>();

  const twoCol = r.width >= 700;                 // iPad (either orientation) → 2-up fields
  const colW = twoCol ? '48.5%' : '100%';

  const [form, setForm] = useState(emptyForm);
  const [allAgents, setAllAgents] = useState<B2CUserListDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    b2cUserService.getUsers({ page: 1, pageSize: 200, role: 'Agent' })
      .then(res => setAllAgents(res.data?.items ?? []))
      .catch(() => setAllAgents([]));
  }, []);

  // This is a drawer screen, so it stays mounted after you navigate away — without this a
  // second visit would show the previous submission still filled in.
  useFocusEffect(useCallback(() => () => {
    setForm(emptyForm);
    setShowPassword(false);
  }, []));

  const mobileValid = /^\d{10}$/.test(form.mobile);
  const mobileError = form.mobile.length > 0 && !mobileValid ? 'Enter a valid 10-digit mobile number' : '';
  const passwordError = form.password.length > 0 && form.password.length < 6 ? 'At least 6 characters' : '';
  const kyc = payoutState(form);

  const canSubmit = !!form.name.trim() && !!form.email.trim() && mobileValid
    && form.password.length >= 6 && kyc.isComplete;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const body: CreateB2CUserBody = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim() || undefined,
        password: form.password,
        role: form.role,
        bio: form.role === 'Counselor' ? form.bio.trim() || undefined : undefined,
        isManager: form.role === 'Agent' ? form.isManager : false,
        agentIds: form.role === 'Agent' && form.isManager ? form.agentIds : undefined,
        ...payoutPayload(form),
      };
      const res = await b2cUserService.createUser(body);
      const referralCode = res.data?.referralCode;
      invalidateFieldStaff();
      toast.success(
        referralCode ? `User created — referral code ${referralCode}` : 'User created',
      );
      setForm(emptyForm);
      navigation.navigate('User Management');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const s = useMemo(() => makeStyles(r), [r]);

  // paddingHorizontal/Top rather than `padding`: Screen already sets paddingBottom from the
  // bottom safe-area inset, and the shorthand would overwrite it.
  const content = { paddingHorizontal: r.gutter, paddingTop: r.gutter, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } as const;

  return (
    <Screen scroll contentStyle={content}>
      <View style={s.header}>
        {/* Not `IconBtn`: that draws a 32px chip with no hitSlop, under the 44pt minimum. */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={[s.back, { backgroundColor: T.accentSoft }]}
        >
          <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>Add User</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>Create an agent or counselor account</Text>
        </View>
      </View>

      {/* Account */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Account</Text>
        <Field label="Role *">
          <Segmented<Role>
            value={form.role}
            onChange={v => set('role', v)}
            options={[{ label: 'Agent', value: 'Agent' }, { label: 'Counselor', value: 'Counselor' }]}
          />
        </Field>
        <View style={s.grid}>
          <Input label="Full Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="Full name" containerStyle={{ width: colW as any }} />
          <Input label="Email *" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="user@example.com" containerStyle={{ width: colW as any }} />
          <Input label="Mobile *" value={form.mobile} onChangeText={v => set('mobile', digitsOnly(v).slice(0, 10))} error={mobileError} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile" containerStyle={{ width: colW as any }} />
          <Input label="Password *" value={form.password} onChangeText={v => set('password', v)} error={passwordError} secureTextEntry={!showPassword} placeholder="Temporary password (min 6 chars)" containerStyle={{ width: colW as any }} />
        </View>
        {/* A reveal button nested inside the field would fight it for the press — the field
            itself is one big touchable that opens the app's keyboard — so the toggle is its
            own full-size control instead. */}
        <Checkbox on={showPassword} onToggle={() => setShowPassword(v => !v)} label="Show password" />
        <Field label="Address">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={form.address}
              onChangeText={v => set('address', v)}
              placeholder="Residential / base address"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textareaTxt, { color: T.text }]}
            />
          </View>
        </Field>
        {form.role === 'Counselor' && (
          <Field label="Bio">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput
                value={form.bio}
                onChangeText={v => set('bio', v)}
                placeholder="Short bio…"
                placeholderTextColor={T.dim}
                multiline
                style={[s.textareaTxt, { color: T.text }]}
              />
            </View>
          </Field>
        )}
      </Card>

      {/* Payout / KYC */}
      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Payout Details</Text>
        <Text style={[s.sectionHint, { color: T.dim }]}>
          All four are needed before commission can be paid.
        </Text>
        <View style={s.grid}>
          <PayoutFields values={form} onChange={(k, v) => set(k, v)} colW={colW} />
        </View>
      </Card>

      {/* Manager — agents only */}
      {form.role === 'Agent' && (
        <Card style={s.card}>
          <Text style={[s.sectionTitle, { color: T.accent }]}>Manager</Text>
          <Checkbox
            on={form.isManager}
            onToggle={() => set('isManager', !form.isManager)}
            label="Also a Manager (oversees a team)"
          />
          {form.isManager && (
            <Field label="Agents under this manager">
              <View style={[s.pickList, { borderColor: T.line }]}>
                {allAgents.length === 0 ? (
                  <Text style={[s.pickEmpty, { color: T.dim }]}>No agents yet.</Text>
                ) : (
                  <ScrollView
                    style={{ maxHeight: r.rs(200) }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {allAgents.map(a => (
                      <Checkbox
                        key={a.id}
                        on={form.agentIds.includes(a.id)}
                        onToggle={() => set('agentIds', toggleId(form.agentIds, a.id))}
                        label={a.name}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            </Field>
          )}
        </Card>
      )}

      <View style={s.footerActions}>
        <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Btn label={saving ? 'Creating…' : 'Create User'} onPress={submit} loading={saving} disabled={!canSubmit || saving} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
};

/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: r.rs(10), marginBottom: r.rs(16) },
  back: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: r.rf(20), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: r.rf(12.5) },
  card: { gap: r.gap, marginBottom: r.gap },
  sectionTitle: { fontWeight: '700', fontSize: r.rf(12), letterSpacing: 1, textTransform: 'uppercase' },
  sectionHint: { fontSize: r.rf(11.5), fontWeight: '500', marginTop: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  textarea: { minHeight: r.rs(72), borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: r.rs(52) },
  pickList: { borderWidth: 1.5, borderRadius: 13, padding: 12 },
  pickEmpty: { fontSize: r.rf(12), fontWeight: '500' },
  footerActions: { flexDirection: 'row', gap: r.rs(10), marginTop: 4 },
});

export default B2CCreateUserScreen;
