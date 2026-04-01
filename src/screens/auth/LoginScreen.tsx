import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, BookOpen } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { rf } from '../../utils/responsive';

const DEMO_CREDS = [
  { role: 'FO',  email: 'arjun@educrm.in',  password: 'fo123',  color: '#0d9488' },
  { role: 'ZH',  email: 'priya@educrm.in',  password: 'zh123',  color: '#7c3aed' },
  { role: 'RH',  email: 'rajesh@educrm.in', password: 'rh123',  color: '#ea580c' },
  { role: 'SH',  email: 'anita@educrm.in',  password: 'sh123',  color: '#2563eb' },
  { role: 'SCA', email: 'supersaleadmin@gmail.com', password: 'admin123', color: '#E11D48' },
];

export const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid email or password';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const fillCreds = (cred: (typeof DEMO_CREDS)[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setErrors({});
  };

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
            <Text style={styles.tagline}>Sales Portal — Mobile Edition</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, tablet && styles.cardTablet]}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to your account</Text>

            <Input
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@educrm.in"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              accentColor="#2563eb"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry={!showPwd}
              error={errors.password}
              accentColor="#2563eb"
              rightIcon={
                showPwd ? (
                  <EyeOff size={18} color="#9CA3AF" />
                ) : (
                  <Eye size={18} color="#9CA3AF" />
                )
              }
              onRightIconPress={() => setShowPwd((v) => !v)}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              color="#2563eb"
              style={styles.loginBtn}
              size="lg"
            />

            {/* Sign Up Link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Demo Credentials */}
            <View style={styles.demoSection}>
              <View style={styles.divider}>
                <View style={styles.divLine} />
                <Text style={styles.divText}>Quick Login (Demo)</Text>
                <View style={styles.divLine} />
              </View>
              <View style={styles.demoGrid}>
                {DEMO_CREDS.map((c) => (
                  <TouchableOpacity
                    key={c.role}
                    style={[styles.demoChip, { borderColor: c.color + '44', backgroundColor: c.color + '0D' }]}
                    onPress={() => fillCreds(c)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.demoRolePill, { backgroundColor: c.color }]}>
                      <Text style={styles.demoRoleText}>{c.role}</Text>
                    </View>
                    <Text style={[styles.demoEmail, { color: c.color }]} numberOfLines={1}>
                      {c.email.split('@')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Delete Account */}
          <View style={styles.deleteRow}>
            <Text style={styles.deleteText}>Want to delete your account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('DeleteAccount')}>
              <Text style={styles.deleteLink}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            EduCRM • EdTech Sales Platform{'\n'}© 2026 All rights reserved
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
    marginBottom: 32,
    marginTop: 8,
  },
  brandTablet: {
    marginBottom: 40,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#2563eb',
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
  cardTablet: {
    padding: 36,
  },
  heading: {
    fontSize: rf(24),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subheading: {
    fontSize: rf(14),
    color: '#6B7280',
    marginBottom: 24,
  },
  loginBtn: {
    marginTop: 4,
  },
  demoSection: {
    marginTop: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  divText: {
    fontSize: rf(12),
    color: '#9CA3AF',
    marginHorizontal: 12,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    width: '48%',
  },
  demoRolePill: {
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoRoleText: {
    fontSize: rf(11),
    fontWeight: '700',
    color: '#FFF',
  },
  demoEmail: {
    fontSize: rf(12),
    fontWeight: '500',
    flex: 1,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signupText: {
    fontSize: rf(13),
    color: '#6B7280',
  },
  signupLink: {
    fontSize: rf(13),
    color: '#0d9488',
    fontWeight: '600',
  },
  deleteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  deleteText: {
    fontSize: rf(12),
    color: 'rgba(255,255,255,0.5)',
  },
  deleteLink: {
    fontSize: rf(12),
    color: '#EF4444',
    fontWeight: '600',
  },
  footer: {
    fontSize: rf(11),
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
