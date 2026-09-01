import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Field, Input, Checkbox } from '../../components/crud';
import { Screen, Card } from '../../components/ui';
import { b2cCounselorService } from '../../api/b2c/b2cCounselorService';
import { invalidateFieldStaff } from '../../components/b2c/useFieldStaff';
import { CreateB2CCounselorRequest } from '../../types/b2c';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, MIN_TAP } from '../../hooks/useResponsive';
import {
  PayoutFields, payoutState, payoutPayload, digitsOnly, EMPTY_PAYOUT,
} from './B2CCreateUserScreen';

/**
 * Add Counselor — the mobile twin of web's B2CCreateCounselor.jsx. Same payout/KYC block as
 * Add User because the server applies the same [Required] rules to both paths: a counselor
 * created here and one created through /b2c/users must end up with identical details on file.
 *
 * Specializations are deliberately not collected here — web's create page posts an empty
 * list and leaves them to the counselor's edit dialog, so there is one place they are set.
 */

const emptyForm = { name: '', email: '', mobile: '', password: '', bio: '', ...EMPTY_PAYOUT };

export const B2CCreateCounselorScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();
  const navigation = useNavigation<any>();

  const twoCol = r.width >= 700;
  const colW = twoCol ? '48.5%' : '100%';

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Drawer screens stay mounted after you leave them, so the form is cleared on blur —
  // otherwise the next visit opens on the last submission.
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
      const body: CreateB2CCounselorRequest = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        specializations: [],
        bio: form.bio.trim() || null,
        ...payoutPayload(form),
      };
      await b2cCounselorService.createCounselor(body);
      invalidateFieldStaff();
      toast.success('Counselor created');
      setForm(emptyForm);
      navigation.navigate('Counselors');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create counselor');
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
          <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>Add Counselor</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>Create a counselor account</Text>
        </View>
      </View>

      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Account</Text>
        <View style={s.grid}>
          <Input label="Full Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="Counselor name" containerStyle={{ width: colW as any }} />
          <Input label="Email *" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="counselor@example.com" containerStyle={{ width: colW as any }} />
          <Input label="Mobile *" value={form.mobile} onChangeText={v => set('mobile', digitsOnly(v).slice(0, 10))} error={mobileError} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile" containerStyle={{ width: colW as any }} />
          <Input label="Password *" value={form.password} onChangeText={v => set('password', v)} error={passwordError} secureTextEntry={!showPassword} placeholder="Temporary password (min 6 chars)" containerStyle={{ width: colW as any }} />
        </View>
        <Checkbox on={showPassword} onToggle={() => setShowPassword(v => !v)} label="Show password" />
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
      </Card>

      <Card style={s.card}>
        <Text style={[s.sectionTitle, { color: T.accent }]}>Payout Details</Text>
        <Text style={[s.sectionHint, { color: T.dim }]}>
          All four are needed before commission can be paid.
        </Text>
        <View style={s.grid}>
          <PayoutFields values={form} onChange={(k, v) => set(k, v)} colW={colW} />
        </View>
      </Card>

      <View style={s.footerActions}>
        <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
        <Btn label={saving ? 'Creating…' : 'Create Counselor'} onPress={submit} loading={saving} disabled={!canSubmit || saving} style={{ flex: 1 }} />
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
  footerActions: { flexDirection: 'row', gap: r.rs(10), marginTop: 4 },
});

export default B2CCreateCounselorScreen;
