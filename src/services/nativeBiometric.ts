// ─── nativeBiometric: the Android bridge ──────────────────────────────────────
// On Android, react-native-biometrics only sees Class-3 (STRONG) fingerprint, so
// face-unlock users would be excluded. We route authentication + availability
// through a custom Kotlin BiometricPrompt module (NativeModules.AppBiometric) that
// accepts BIOMETRIC_STRONG (+ DEVICE_CREDENTIAL fallback on Android 11+).
// iOS never uses this file — its auth happens inside the Keychain read.
import { NativeModules, Platform } from 'react-native';

const getModule = () =>
  NativeModules.AppBiometric as
    | {
        authenticate: (title: string, subtitle: string, cancelText: string) => Promise<boolean>;
        canAuthenticate: () => Promise<boolean>;
      }
    | undefined;

/** Android-only: shows BiometricPrompt (fingerprint + device PIN/password fallback on 11+). */
export const androidAuthenticate = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  const mod = getModule();
  if (!mod) return false;
  try {
    return await mod.authenticate('Sign in to SingularityCRM', 'Use your fingerprint to continue', 'Use Password');
  } catch {
    return false;
  }
};

/** Android-only: true if biometrics are enrolled and usable. */
export const androidBiometricReady = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  const mod = getModule();
  if (!mod) return false;
  try {
    return await mod.canAuthenticate();
  } catch {
    return false;
  }
};
