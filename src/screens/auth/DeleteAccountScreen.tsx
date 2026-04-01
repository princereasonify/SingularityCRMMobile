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
import { Eye, EyeOff, BookOpen, ArrowLeft, Trash2, Mail } from 'lucide-react-native';
import { authApi } from '../../api/auth';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { rf } from '../../utils/responsive';

export const DeleteAccountScreen = ({ navigation }: any) => {
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
              <Mail size={40} color="#F59E0B" />
            </View>
            <Text style={styles.successTitle}>Request Submitted</Text>
            <Text style={styles.successSubtitle}>
              A confirmation email has been sent to your email address. Your account will be deleted within 7-15 business days.
            </Text>
            <Button
              title="Back to Login"
              onPress={() => navigation.goBack()}
              color="#DC2626"
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
          <View style={[styles.brand, tablet && styles.brandTablet]}>
            <View style={[styles.logoWrap, { backgroundColor: '#DC2626' }]}>
              <Trash2 size={tablet ? 40 : 32} color="#FFF" strokeWidth={2.5} />
            </View>
            <Text style={[styles.appName, tablet && { fontSize: rf(32) }]}>EduCRM</Text>
          </View>

          <View style={[styles.card, tablet && styles.cardTablet]}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={16} color="#6B7280" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            <Text style={styles.heading}>Delete Account</Text>
            <Text style={styles.subheading}>Enter your credentials to request account deletion</Text>

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accentColor="#DC2626"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPwd}
              accentColor="#DC2626"
              rightIcon={
                showPwd ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />
              }
              onRightIconPress={() => setShowPwd((v) => !v)}
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              title={loading ? 'Submitting...' : 'Delete My Account'}
              onPress={handleDelete}
              loading={loading}
              color="#DC2626"
              size="lg"
              style={styles.submitBtn}
              disabled={!email.trim() || !password.trim()}
            />
          </View>

          <Text style={styles.footer}>
            EduCRM v2.1 · Account deletion · All rights reserved
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
  scrollTablet: { justifyContent: 'center', paddingHorizontal: 60 },
  brand: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  brandTablet: { marginBottom: 36 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: rf(28), fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15, shadowRadius: 32, elevation: 12,
  },
  cardTablet: { padding: 36 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: rf(13), color: '#6B7280', fontWeight: '500' },
  heading: { fontSize: rf(22), fontWeight: '700', color: '#111827', marginBottom: 4 },
  subheading: { fontSize: rf(13), color: '#6B7280', marginBottom: 20 },
  warningBox: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4,
  },
  warningText: { fontSize: rf(12), color: '#DC2626', fontWeight: '500', lineHeight: 18 },
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  errorText: { fontSize: rf(12), color: '#DC2626', fontWeight: '500' },
  submitBtn: { marginTop: 12 },
  successIcon: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  successTitle: {
    fontSize: rf(20), fontWeight: '700', color: '#111827',
    textAlign: 'center', marginBottom: 8,
  },
  successSubtitle: {
    fontSize: rf(13), color: '#6B7280', textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  footer: {
    fontSize: rf(11), color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 24, lineHeight: 18,
  },
});
