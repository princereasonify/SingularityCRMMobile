import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, BookOpen, ArrowLeft, CheckCircle, Check } from 'lucide-react-native';
import { authApi } from '../../api/auth';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SelectPicker } from '../../components/common/SelectPicker';
import { rf } from '../../utils/responsive';

const ROLE_OPTIONS = [
  { label: 'Field Officer', value: 'FO' },
  { label: 'Zonal Head', value: 'ZH' },
  { label: 'Regional Head', value: 'RH' },
  { label: 'Sales Head', value: 'SH' },
];

const ACCENT = '#0d9488';

const isPasswordValid = (pwd: string) => (
  pwd.length >= 8 &&
  /[A-Z]/.test(pwd) &&
  /[0-9]/.test(pwd) &&
  /[^A-Za-z0-9]/.test(pwd)
);

const getPasswordRules = (pwd: string) => [
  { label: 'At least 8 characters', met: pwd.length >= 8 },
  { label: 'One uppercase letter', met: /[A-Z]/.test(pwd) },
  { label: 'One number', met: /[0-9]/.test(pwd) },
  { label: 'One special character', met: /[^A-Za-z0-9]/.test(pwd) },
];

export const SignupScreen = ({ navigation }: any) => {
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

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
      if (err?.response) {
        setError(err.response.data?.message || 'Signup failed.');
      } else if (err?.request) {
        setError('Cannot connect to server. Please check your internet.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ──
  if (success) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.brand, tablet && styles.brandTablet]}>
            <View style={styles.logoWrap}>
              <BookOpen size={tablet ? 40 : 32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, tablet && { fontSize: rf(32) }]}>EduCRM</Text>
          </View>

          <View style={[styles.card, tablet && styles.cardTablet]}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color="#16A34A" />
            </View>
            <Text style={styles.successTitle}>Signed Up Successfully!</Text>
            <Text style={styles.successSubtitle}>
              Your account has been created. Once the admin approves your account, you will be able to login.
            </Text>
            <Button
              title="Back to Login"
              onPress={() => navigation.goBack()}
              color={ACCENT}
              size="lg"
              style={styles.signupBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Signup Form ──
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={[styles.brand, tablet && styles.brandTablet]}>
            <View style={styles.logoWrap}>
              <BookOpen size={tablet ? 40 : 32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, tablet && { fontSize: rf(32) }]}>EduCRM</Text>
            <Text style={styles.tagline}>AI-powered CRM for EdTech sales teams</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, tablet && styles.cardTablet]}>
            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={16} color="#6B7280" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Sign up to get started with EduCRM</Text>

            {/* First & Last Name */}
            <View style={styles.nameRow}>
              <Input
                label="First Name"
                value={form.firstName}
                onChangeText={(t) => set('firstName')(t)}
                placeholder="First name"
                autoCapitalize="words"
                error={errors.firstName}
                accentColor={ACCENT}
                containerStyle={styles.nameInput}
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChangeText={(t) => set('lastName')(t)}
                placeholder="Last name"
                autoCapitalize="words"
                error={errors.lastName}
                accentColor={ACCENT}
                containerStyle={styles.nameInput}
              />
            </View>

            <Input
              label="Email Address"
              value={form.email}
              onChangeText={(t) => set('email')(t)}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              accentColor={ACCENT}
            />

            <Input
              label="Password"
              value={form.password}
              onChangeText={(t) => set('password')(t)}
              placeholder="Create a password"
              secureTextEntry={!showPwd}
              error={errors.password}
              accentColor={ACCENT}
              rightIcon={
                showPwd ? (
                  <EyeOff size={18} color="#9CA3AF" />
                ) : (
                  <Eye size={18} color="#9CA3AF" />
                )
              }
              onRightIconPress={() => setShowPwd((v) => !v)}
            />

            {form.password.length > 0 && (
              <View style={styles.pwdRules}>
                {getPasswordRules(form.password).map((rule) => (
                  <View key={rule.label} style={styles.pwdRuleRow}>
                    <Check size={12} color={rule.met ? '#16A34A' : '#D1D5DB'} />
                    <Text style={[styles.pwdRuleText, { color: rule.met ? '#16A34A' : '#9CA3AF' }]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Input
              label="Phone Number"
              value={form.phoneNumber}
              onChangeText={(t) => set('phoneNumber')(t.replace(/[^0-9]/g, '').slice(0, 10))}
              maxLength={10}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              error={errors.phoneNumber}
              accentColor={ACCENT}
            />

            <SelectPicker
              label="Role"
              placeholder="Select your role"
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={(v) => set('role')(v)}
              accentColor={ACCENT}
              error={errors.role}
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              title={loading ? 'Creating Account...' : 'Sign Up'}
              onPress={handleSignup}
              loading={loading}
              color={ACCENT}
              style={styles.signupBtn}
              size="lg"
              disabled={form.password.length > 0 && !isPasswordValid(form.password)}
            />
          </View>

          <Text style={styles.footer}>
            EduCRM v2.1 · Secure signup · All rights reserved
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  scrollTablet: {
    justifyContent: 'center',
    paddingHorizontal: 60,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  brandTablet: { marginBottom: 36 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: rf(28),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: rf(13),
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },
  cardTablet: { padding: 36 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: rf(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  heading: {
    fontSize: rf(22),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subheading: {
    fontSize: rf(13),
    color: '#6B7280',
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameInput: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  errorText: {
    fontSize: rf(12),
    color: '#DC2626',
    fontWeight: '500',
  },
  signupBtn: {
    marginTop: 8,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  successTitle: {
    fontSize: rf(20),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: rf(13),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  footer: {
    fontSize: rf(11),
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  pwdRules: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: -8, marginBottom: 8, gap: 6 },
  pwdRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwdRuleText: { fontSize: rf(12) },
});
