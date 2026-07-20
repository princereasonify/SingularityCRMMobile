import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ArrowLeft, Trash2, Mail } from 'lucide-react-native';
import { authApi } from '../../api/auth';
import { Button } from '../../components/common/Button';
import { useTheme } from '../../context/ThemeContext';
import { getAuthTheme } from '../../theme';
import { rf } from '../../utils/responsive';

export const DeleteAccountScreen = ({ navigation }: any) => {
  const { width } = useWindowDimensions();
  const tablet = width >= 768;
  const { mode } = useTheme();
  const T = getAuthTheme(mode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.deleteAccountRequest(email.trim(), password.trim());
      setSuccess(true);
    } catch (err: any) {
      if (err?.response) {
        setError(err.response.data?.message || 'Failed to submit request.');
      } else if (err?.request) {
        setError('Cannot connect to server. Please check your internet.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Themed field — same structure as the login/signup inputs (label + bordered box).
  const renderField = (
    key: 'email' | 'password',
    label: string,
    props: React.ComponentProps<typeof TextInput> = {},
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: T.accentText }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: T.fieldBg, borderColor: T.line },
          focusKey === key && { borderColor: T.danger },
        ]}
      >
        <TextInput
          value={key === 'email' ? email : password}
          onChangeText={key === 'email' ? setEmail : setPassword}
          onFocus={() => setFocusKey(key)}
          onBlur={() => setFocusKey(null)}
          placeholderTextColor={T.dim}
          style={[styles.input, { color: T.text }]}
          {...props}
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
    </View>
  );

  // ── Success Screen ──
  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: T.panelBg }]} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.brand, tablet && styles.brandTablet]}>
            <View style={[styles.logoWrap, { backgroundColor: T.danger, shadowColor: T.danger }]}>
              <Mail size={tablet ? 40 : 32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, { color: T.text }, tablet && { fontSize: rf(32) }]}>
              SingularityCRM
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.line }, tablet && styles.cardTablet]}>
            <View style={styles.successIcon}>
              <Mail size={40} color={T.accentText} />
            </View>
            <Text style={[styles.successTitle, { color: T.text }]}>Request Submitted</Text>
            <Text style={[styles.successSubtitle, { color: T.sub }]}>
              A confirmation email has been sent to your email address. Your account will be deleted within 7-15 business days.
            </Text>
            <Button
              title="Back to Login"
              onPress={() => navigation.goBack()}
              color={T.danger}
              size="lg"
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Delete Account Form ──
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.panelBg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.brand, tablet && styles.brandTablet]}>
            <View style={[styles.logoWrap, { backgroundColor: T.danger, shadowColor: T.danger }]}>
              <Trash2 size={tablet ? 40 : 32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, { color: T.text }, tablet && { fontSize: rf(32) }]}>
              SingularityCRM
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.line }, tablet && styles.cardTablet]}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={16} color={T.sub} />
              <Text style={[styles.backText, { color: T.sub }]}>Back to Login</Text>
            </TouchableOpacity>

            <Text style={[styles.heading, { color: T.text }]}>Delete Account</Text>
            <Text style={[styles.subheading, { color: T.sub }]}>
              Enter your credentials to request account deletion
            </Text>

            {renderField('email', 'Email Address', {
              placeholder: 'Enter your email',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              autoCorrect: false,
            })}

            {renderField('password', 'Password', {
              placeholder: 'Enter your password',
              secureTextEntry: !showPwd,
            })}

            {/* spec status pattern: colour @ 15% background, solid colour text */}
            {!!error && (
              <View style={[styles.errorBox, { backgroundColor: T.danger + '26' }]}>
                <Text style={[styles.errorText, { color: T.danger }]}>{error}</Text>
              </View>
            )}

            <Button
              title={loading ? 'Submitting...' : 'Delete My Account'}
              onPress={handleDelete}
              loading={loading}
              color={T.danger}
              size="lg"
              style={styles.submitBtn}
              disabled={!email.trim() || !password.trim()}
            />
          </View>

          <Text style={[styles.footer, { color: T.dim }]}>
            SingularityCRM · Account deletion · All rights reserved
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  scrollTablet: { justifyContent: 'center', paddingHorizontal: 60 },
  brand: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  brandTablet: { marginBottom: 36 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  // spec "Typography": display/screen title 800
  appName: { fontSize: rf(24), fontWeight: '800', letterSpacing: -0.5 },
  card: {
    borderRadius: 22, // spec radii: card 16–22
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 12,
  },
  cardTablet: { padding: 36 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: rf(13), fontWeight: '600' },
  heading: { fontSize: rf(24), fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subheading: { fontSize: rf(13), fontWeight: '400', marginBottom: 20 },

  field: { marginBottom: 16 },
  label: { fontWeight: '600', fontSize: rf(13), marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 13, // spec control radius
    paddingHorizontal: 16,
    height: 48, // >= 44 min tap target
  },
  input: { flex: 1, fontWeight: '500', fontSize: rf(15), padding: 0 },

  errorBox: {
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  errorText: { fontSize: rf(12), fontWeight: '600' },
  submitBtn: { marginTop: 12 },
  successIcon: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  successTitle: {
    fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3,
    textAlign: 'center', marginBottom: 8,
  },
  successSubtitle: {
    fontSize: rf(13), fontWeight: '400', textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  footer: {
    fontSize: rf(11), fontWeight: '400',
    textAlign: 'center', marginTop: 24, lineHeight: 18,
  },
});
