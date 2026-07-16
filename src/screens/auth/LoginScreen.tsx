import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AuthHero } from '../../components/common/AuthHero';
import { GradientButton } from '../../components/common/GradientButton';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { CustomKeyboard } from '../../components/common/CustomKeyboard';
import { Fonts, getAuthTheme } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { applyLoginOrientation, applyAuthedOrientation } from '../../utils/orientation';

export const LoginScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const T = getAuthTheme(mode);

  const isLandscape = width > height;
  const twoPane = isTabletDevice && isLandscape;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  // The in-app keyboard is open for whichever field is active (null = closed).
  const [activeField, setActiveField] = useState<'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      applyLoginOrientation();
    }, []),
  );

  // Lift the form so the active field clears the in-app keyboard.
  useEffect(() => {
    if (activeField) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(t);
    }
  }, [activeField]);

  // ─── In-app keyboard handlers ────────────────────────────────────────────────
  const setActiveValue = (updater: (prev: string) => string) => {
    if (activeField === 'email') setEmail(updater);
    else if (activeField === 'password') setPassword(updater);
  };
  const handleKey = (ch: string) => setActiveValue(v => v + ch);
  const handleBackspace = () => setActiveValue(v => v.slice(0, -1));
  const hideKeyboard = () => {
    setActiveField(null);
    emailRef.current?.blur();
    passwordRef.current?.blur();
  };
  const handleKbSubmit = () => {
    if (activeField === 'email') {
      passwordRef.current?.focus();
      setActiveField('password');
    } else {
      hideKeyboard();
      handleLogin();
    }
  };

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
      applyAuthedOrientation();
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid email or password';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Form ────────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <View style={styles.formInner}>
      <Text style={[styles.welcome, { color: T.text }]}>Welcome back</Text>
      <Text style={[styles.welcomeSub, { color: T.sub }]}>Sign in to your SingularityCRM account</Text>

      {/* Email — label in accent colour (per spec) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: T.accentText }]}>Email</Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: T.fieldBg, borderColor: T.line },
            activeField === 'email' && styles.inputWrapFocus,
            errors.email && { borderColor: T.danger },
          ]}
        >
          <TextInput
            ref={emailRef}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setActiveField('email')}
            showSoftInputOnFocus={false}
            caretHidden={false}
            placeholder="you@singularity.in"
            placeholderTextColor={T.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: T.text }]}
          />
        </View>
        {!!errors.email && <Text style={[styles.errText, { color: T.danger }]}>{errors.email}</Text>}
      </View>

      {/* Password — label matches Email (accent) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: T.accentText }]}>Password</Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: T.fieldBg, borderColor: T.line },
            activeField === 'password' && styles.inputWrapFocus,
            errors.password && { borderColor: T.danger },
          ]}
        >
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setActiveField('password')}
            showSoftInputOnFocus={false}
            caretHidden={false}
            placeholder="Enter password"
            placeholderTextColor={T.dim}
            secureTextEntry={!showPwd}
            style={[styles.input, { color: T.text }]}
          />
          <TouchableOpacity
            onPress={() => setShowPwd((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPwd ? <EyeOff size={18} color={T.dim} /> : <Eye size={18} color={T.dim} />}
          </TouchableOpacity>
        </View>
        {!!errors.password && <Text style={[styles.errText, { color: T.danger }]}>{errors.password}</Text>}
      </View>

      {/* Sign in — Sunstone gradient with sweeping shimmer */}
      <GradientButton
        label="Sign in"
        onPress={handleLogin}
        loading={loading}
        icon={<ArrowRight size={18} color="#FFF" strokeWidth={2.5} />}
        style={styles.signIn}
      />

      {/* Sign-up link */}
      <View style={styles.signupRow}>
        <Text style={[styles.signupText, { color: T.sub }]}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={[styles.signupLink, { color: T.accentText }]}>Sign up</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account — compulsory (App Store / Play Store account-deletion right) */}
      <View style={styles.deleteRow}>
        <Text style={[styles.deleteText, { color: T.dim }]}>Want to delete your account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('DeleteAccount')}>
          <Text style={styles.deleteLink}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footer, { color: T.dim }]}>
        SingularityCRM • Field Sales Platform{'\n'}© 2026 All rights reserved
      </Text>
    </View>
  );

  // Extra scroll space so the lifted form clears the in-app keyboard panel.
  const kbPad = activeField ? 360 : 0;

  const keyboard = (
    <CustomKeyboard
      visible={activeField !== null}
      theme={T}
      onKey={handleKey}
      onBackspace={handleBackspace}
      onSubmit={handleKbSubmit}
      onHide={hideKeyboard}
      submitLabel={activeField === 'email' ? 'Next' : 'Sign in'}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: T.panelBg }]}>
      <StatusBar barStyle="light-content" />
      <ThemeToggle />
      {twoPane ? (
        <View style={styles.splitRow}>
          <View style={styles.splitHero}><AuthHero compact={false} /></View>
          {/* Keyboard lives INSIDE the form pane, so it only covers the right side */}
          <View style={[styles.splitForm, { backgroundColor: T.panelBg }]}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[styles.splitFormScroll, { paddingBottom: 40 + kbPad }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderForm()}
            </ScrollView>
            {keyboard}
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.stackScroll, { paddingBottom: kbPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <AuthHero compact />
            <View
              style={[
                styles.stackForm,
                { backgroundColor: T.panelBg, paddingBottom: insets.bottom + 24 },
              ]}
            >
              {renderForm()}
            </View>
          </ScrollView>
          {keyboard}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Hero
  hero: { justifyContent: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wordmark: { fontFamily: Fonts.bold, color: '#FFFFFF', letterSpacing: -0.6, marginLeft: 2 },
  wordmarkAccent: { color: '#0E0B08' }, // CRM — bold black
  heroBody: {},
  heroBodyCompact: { marginTop: 28 },
  quote: { fontFamily: Fonts.bold, color: '#FFFFFF' },
  tagline: { fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.78)' },

  // Split layout
  splitRow: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 0.52 },
  splitForm: { flex: 0.48 },
  splitFormScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 48, paddingVertical: 40 },

  // Stacked layout
  stackScroll: { flexGrow: 1 },
  stackForm: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 30,
  },

  // Form
  formInner: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  welcome: { fontFamily: Fonts.bold, fontSize: rf(27), letterSpacing: -0.5 },
  welcomeSub: { fontFamily: Fonts.regular, fontSize: rf(15), marginTop: 6, marginBottom: 22 },

  field: { marginBottom: 18 },
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

  signIn: { marginTop: 6 },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signupText: { fontFamily: Fonts.regular, fontSize: rf(14) },
  signupLink: { fontFamily: Fonts.bold, fontSize: rf(14) },

  deleteRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  deleteText: { fontFamily: Fonts.regular, fontSize: rf(12) },
  deleteLink: { fontFamily: Fonts.medium, fontSize: rf(12), color: '#C24E3A' },

  footer: { fontFamily: Fonts.regular, fontSize: rf(11), textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
