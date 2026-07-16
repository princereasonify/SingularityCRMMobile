import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, EyeOff, ArrowLeft, CheckCircle, Check } from 'lucide-react-native';
import { authApi } from '../../api/auth';
import { useTheme } from '../../context/ThemeContext';
import { AuthHero } from '../../components/common/AuthHero';
import { GradientButton } from '../../components/common/GradientButton';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { SelectPicker } from '../../components/common/SelectPicker';
import { Fonts, getAuthTheme } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { applyLoginOrientation } from '../../utils/orientation';

const ROLE_OPTIONS = [
  { label: 'Field Officer', value: 'FO' },
  { label: 'Zonal Head', value: 'ZH' },
  { label: 'Regional Head', value: 'RH' },
  { label: 'Sales Head', value: 'SH' },
];

const isPasswordValid = (pwd: string) =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);

const getPasswordRules = (pwd: string) => [
  { label: 'At least 8 characters', met: pwd.length >= 8 },
  { label: 'One uppercase letter', met: /[A-Z]/.test(pwd) },
  { label: 'One number', met: /[0-9]/.test(pwd) },
  { label: 'One special character', met: /[^A-Za-z0-9]/.test(pwd) },
];

export const SignupScreen = ({ navigation }: any) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const T = getAuthTheme(mode);
  const twoPane = isTabletDevice && width > height;

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      applyLoginOrientation();
    }, []),
  );

  const set = (key: string) => (value: string | number) =>
    setForm((f) => ({ ...f, [key]: String(value) }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format';
    if (!form.password) e.password = 'Password is required';
    else if (!isPasswordValid(form.password)) e.password = 'Password does not meet requirements';
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
    else if (!/^\d{10}$/.test(form.phoneNumber.trim())) e.phoneNumber = 'Phone number must be exactly 10 digits';
    if (!form.role) e.role = 'Please select a role';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setError('');
    setLoading(true);
    try {
      await authApi.signup({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phoneNumber: form.phoneNumber.trim(),
        role: form.role,
      });
      setSuccess(true);
    } catch (err: any) {
      if (err?.response) setError(err.response.data?.message || 'Signup failed.');
      else if (err?.request) setError('Cannot connect to server. Please check your internet.');
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Reusable input ──────────────────────────────────────────────────────────
  const renderField = (
    key: string,
    label: string,
    props: React.ComponentProps<typeof TextInput> & { accentLabel?: boolean } = {},
  ) => {
    const { accentLabel, ...inputProps } = props;
    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: accentLabel ? T.accentText : T.sub }]}>{label}</Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: T.fieldBg, borderColor: T.line },
            focusKey === key && styles.inputWrapFocus,
            errors[key] && { borderColor: T.danger },
          ]}
        >
          <TextInput
            value={(form as any)[key]}
            onFocus={() => setFocusKey(key)}
            onBlur={() => setFocusKey(null)}
            placeholderTextColor={T.dim}
            style={[styles.input, { color: T.text }]}
            {...inputProps}
          />
          {key === 'password' && (
            <TouchableOpacity
              onPress={() => setShowPwd((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPwd ? <EyeOff size={18} color={T.dim} /> : <Eye size={18} color={T.dim} />}
            </TouchableOpacity>
          )}
        </View>
        {!!errors[key] && <Text style={[styles.errText, { color: T.danger }]}>{errors[key]}</Text>}
      </View>
    );
  };

  // ─── Success ─────────────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <View style={styles.formInner}>
      <View style={styles.successIcon}>
        <CheckCircle size={52} color="#4C8C5C" />
      </View>
      <Text style={[styles.welcome, { color: T.text, textAlign: 'center' }]}>Signed up successfully</Text>
      <Text style={[styles.welcomeSub, { color: T.sub, textAlign: 'center', marginBottom: 26 }]}>
        Your account has been created. Once an admin approves it, you'll be able to sign in.
      </Text>
      <GradientButton label="Back to Sign in" onPress={() => navigation.goBack()} />
    </View>
  );

  // ─── Form ────────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <View style={styles.formInner}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <ArrowLeft size={16} color={T.sub} />
        <Text style={[styles.backText, { color: T.sub }]}>Back to Sign in</Text>
      </TouchableOpacity>

      <Text style={[styles.welcome, { color: T.text }]}>Create your account</Text>
      <Text style={[styles.welcomeSub, { color: T.sub }]}>Join SingularityCRM to plan your day in the field</Text>

      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          {renderField('firstName', 'First name', {
            placeholder: 'First name',
            autoCapitalize: 'words',
            onChangeText: (t) => set('firstName')(t),
            accentLabel: true,
          })}
        </View>
        <View style={styles.nameCol}>
          {renderField('lastName', 'Last name', {
            placeholder: 'Last name',
            autoCapitalize: 'words',
            onChangeText: (t) => set('lastName')(t),
          })}
        </View>
      </View>

      {renderField('email', 'Email', {
        placeholder: 'you@singularity.in',
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        onChangeText: (t) => set('email')(t),
        accentLabel: true,
      })}

      {renderField('password', 'Password', {
        placeholder: 'Create a password',
        secureTextEntry: !showPwd,
        onChangeText: (t) => set('password')(t),
      })}

      {form.password.length > 0 && (
        <View style={[styles.pwdRules, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
          {getPasswordRules(form.password).map((rule) => (
            <View key={rule.label} style={styles.pwdRuleRow}>
              <Check size={13} color={rule.met ? '#4C8C5C' : T.dim} />
              <Text style={[styles.pwdRuleText, { color: rule.met ? '#4C8C5C' : T.sub }]}>{rule.label}</Text>
            </View>
          ))}
        </View>
      )}

      {renderField('phoneNumber', 'Phone number', {
        placeholder: 'Enter phone number',
        keyboardType: 'phone-pad',
        maxLength: 10,
        onChangeText: (t) => set('phoneNumber')(t.replace(/[^0-9]/g, '').slice(0, 10)),
      })}

      {/* Role */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: T.sub }]}>Role</Text>
        <SelectPicker
          placeholder="Select your role"
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={(v) => set('role')(v)}
          accentColor={T.accentText}
          error={errors.role}
        />
      </View>

      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: T.isDark ? 'rgba(224,114,92,0.14)' : '#FBEDEA' }]}>
          <Text style={[styles.errorText, { color: T.danger }]}>{error}</Text>
        </View>
      )}

      <GradientButton
        label={loading ? 'Creating account…' : 'Create account'}
        onPress={handleSignup}
        loading={loading}
        disabled={form.password.length > 0 && !isPasswordValid(form.password)}
        style={{ marginTop: 8 }}
      />

      <View style={styles.signupRow}>
        <Text style={[styles.signupText, { color: T.sub }]}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.signupLink, { color: T.accentText }]}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const body = success ? renderSuccess() : renderForm();

  return (
    <View style={[styles.root, { backgroundColor: T.panelBg }]}>
      <StatusBar barStyle="light-content" />
      <ThemeToggle />
      {twoPane ? (
        <View style={styles.splitRow}>
          <View style={styles.splitHero}><AuthHero compact={false} /></View>
          <View style={[styles.splitForm, { backgroundColor: T.panelBg }]}>
            <KeyboardAwareScrollView
              contentContainerStyle={styles.splitFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bottomOffset={24}
            >
              {body}
            </KeyboardAwareScrollView>
          </View>
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.stackScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          bottomOffset={24}
        >
          <AuthHero compact />
          <View style={[styles.stackForm, { backgroundColor: T.panelBg, paddingBottom: insets.bottom + 24 }]}>
            {body}
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  splitRow: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 0.52 },
  splitForm: { flex: 0.48 },
  splitFormScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 48, paddingVertical: 40 },

  stackScroll: { flexGrow: 1 },
  stackForm: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 26,
  },

  formInner: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontFamily: Fonts.medium, fontSize: rf(13) },
  welcome: { fontFamily: Fonts.bold, fontSize: rf(26), letterSpacing: -0.5 },
  welcomeSub: { fontFamily: Fonts.regular, fontSize: rf(14), marginTop: 6, marginBottom: 20 },

  nameRow: { flexDirection: 'row', gap: 12 },
  nameCol: { flex: 1 },

  field: { marginBottom: 16 },
  label: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 52,
  },
  inputWrapFocus: { borderColor: '#C99A3E' },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(16), padding: 0 },
  errText: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 6 },

  pwdRules: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: -6, marginBottom: 16, gap: 7 },
  pwdRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pwdRuleText: { fontFamily: Fonts.regular, fontSize: rf(12) },

  errorBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText: { fontFamily: Fonts.medium, fontSize: rf(12) },

  successIcon: { alignItems: 'center', marginBottom: 18, marginTop: 8 },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signupText: { fontFamily: Fonts.regular, fontSize: rf(14) },
  signupLink: { fontFamily: Fonts.bold, fontSize: rf(14) },
});
