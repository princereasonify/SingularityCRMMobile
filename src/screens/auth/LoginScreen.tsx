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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AuthHero } from '../../components/common/AuthHero';
import { GradientButton } from '../../components/common/GradientButton';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { CustomKeyboard, KEYBOARD_PANEL_H } from '../../components/common/CustomKeyboard';
import { Wordmark, getAuthTheme } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';
import { applyLoginOrientation, applyAuthedOrientation } from '../../utils/orientation';
import { BiometricButton } from '../../components/common/BiometricButton';
import {
  getBiometricInfo,
  isBiometricEnabled,
  setBiometricEnabled,
  disableBiometric,
  BiometricInfo,
} from '../../services/biometricService';
import { saveCredentials, loadCredentials, clearCredentials } from '../../services/secureStorage';
import { androidAuthenticate } from '../../services/nativeBiometric';

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

  // ── Biometric quick sign-in ──
  const [biometricInfo, setBiometricInfo] = useState<BiometricInfo | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const biometricEnabledRef = useRef(false);      // live value for the focus-effect closure
  const biometricAutoTriggered = useRef(false);   // one-shot guard for the auto-prompt

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
      const em = email.trim().toLowerCase();
      await login(em, password);
      // Auto-enroll biometrics silently on the first successful password login
      // (only when the hardware is available). Fire-and-forget so it can never
      // block or fail the login — the screen is already navigating away.
      if (biometricInfo?.status === 'available' && !biometricEnabledRef.current) {
        saveCredentials(em, password)
          .then(ok => {
            if (ok) {
              biometricEnabledRef.current = true;
              return setBiometricEnabled(true);
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid email or password';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Biometric sign-in: unlock stored credentials and replay the login. ──
  const handleBiometricLogin = useCallback(async () => {
    if (!biometricEnabledRef.current) return;
    setBiometricLoading(true);
    try {
      // Android authenticates via the native prompt FIRST; iOS does it inside the
      // Keychain read (loadCredentials shows the Face ID / Touch ID sheet).
      if (Platform.OS === 'android') {
        const ok = await androidAuthenticate();
        if (!ok) return; // cancelled — stay on the password screen, silently
      }
      const creds = await loadCredentials();
      if (!creds) return; // cancelled the sheet, or nothing stored — silent

      applyAuthedOrientation();
      setLoading(true);
      await login(creds.email, creds.password); // success → app auto-navigates
    } catch {
      // login rejected → the stored credentials are stale (password changed, etc.).
      // Self-heal: wipe them and fall back to password sign-in.
      await clearCredentials();
      await disableBiometric();
      biometricEnabledRef.current = false;
      setBiometricEnabledState(false);
      Alert.alert('Biometric sign-in unavailable', 'Please sign in with your password.');
    } finally {
      setBiometricLoading(false);
      setLoading(false);
    }
  }, [login]);

  // Detect hardware + enabled state on focus, and auto-prompt once if enabled.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timerId: ReturnType<typeof setTimeout>;
      biometricAutoTriggered.current = false;

      getBiometricInfo().then(info => { if (!cancelled) setBiometricInfo(info); });

      isBiometricEnabled().then(enabled => {
        if (cancelled) return;
        biometricEnabledRef.current = enabled;
        setBiometricEnabledState(enabled);
        if (!enabled || biometricAutoTriggered.current) return;
        biometricAutoTriggered.current = true;
        // small delay so the screen is mounted before the system sheet appears
        timerId = setTimeout(() => { if (!cancelled) handleBiometricLogin(); }, 500);
      });

      return () => { cancelled = true; if (timerId) clearTimeout(timerId); };
    }, [handleBiometricLogin]),
  );

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
            activeField === 'email' && { borderColor: T.accentText },
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
            placeholder="Enter your email"
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
            activeField === 'password' && { borderColor: T.accentText },
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

      {/* Biometric quick sign-in — only when the device has it AND it's enrolled */}
      {biometricInfo?.status === 'available' && biometricEnabled && (
        <BiometricButton
          theme={T}
          label={biometricInfo.label}
          biometryType={biometricInfo.biometryType}
          loading={biometricLoading}
          disabled={loading}
          onPress={() => {
            biometricAutoTriggered.current = true; // manual tap — don't also auto-fire
            handleBiometricLogin();
          }}
        />
      )}

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
          <Text style={[styles.deleteLink, { color: T.danger }]}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footer, { color: T.dim }]}>
        SingularityCRM • Field Sales Platform{'\n'}© 2026 All rights reserved
      </Text>
    </View>
  );

  // Scroll space so the lifted form clears the in-app keyboard — EXACTLY the panel's
  // height plus a small breathing gap. A larger guess both over-scrolls the form (the
  // title ends up clipped under the status bar) and leaves dead space above the keys.
  const kbPad = activeField ? KEYBOARD_PANEL_H + insets.bottom + 12 : 0;

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
  wordmark: { fontFamily: Wordmark.bold, color: '#FFFFFF', letterSpacing: -0.6, marginLeft: 2 },
  wordmarkAccent: { color: '#0E0B08' }, // CRM — bold black
  heroBody: {},
  heroBodyCompact: { marginTop: 28 },
  quote: { fontWeight: '700', color: '#FFFFFF' },
  tagline: { fontWeight: '400', color: 'rgba(255,255,255,0.78)' },

  // Split layout
  splitRow: { flex: 1, flexDirection: 'row' },
  splitHero: { flex: 0.52 },
  splitForm: { flex: 0.48 },
  splitFormScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 48, paddingVertical: 40 },

  // Stacked layout
  stackScroll: { flexGrow: 1 },
  stackForm: {
    // spec radii: card 16–22
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 30,
  },

  // Form — type scale per SingularityCRM-Components.html → "Typography"
  formInner: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  welcome: { fontWeight: '800', fontSize: rf(24), letterSpacing: -0.5 }, // screen title 24/800/-0.5
  welcomeSub: { fontWeight: '400', fontSize: rf(13), marginTop: 6, marginBottom: 22 }, // sub-text

  field: { marginBottom: 18 },
  label: { fontWeight: '600', fontSize: rf(13), marginBottom: 8 }, // row label 13–14/600
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 13, // spec control radius (btn 12–14 · dd-trigger 13)
    paddingHorizontal: 16,
    height: 48, // >= 44 min tap target
  },
  input: { flex: 1, fontWeight: '500', fontSize: rf(15), padding: 0 },
  errText: { fontWeight: '400', fontSize: rf(12), marginTop: 6 }, // caption 11–12

  signIn: { marginTop: 6 },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signupText: { fontWeight: '400', fontSize: rf(14) },
  signupLink: { fontWeight: '700', fontSize: rf(14) },

  deleteRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  deleteText: { fontWeight: '400', fontSize: rf(12) },
  deleteLink: { fontWeight: '600', fontSize: rf(12) }, // colour comes from T.danger

  footer: { fontWeight: '400', fontSize: rf(11), textAlign: 'center', marginTop: 18, lineHeight: 17 },
});
