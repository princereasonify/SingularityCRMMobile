// ─── secureStorage: the biometric-gated credential vault ──────────────────────
// Stores the login email + password so a returning user can unlock with Face ID /
// Touch ID / fingerprint instead of typing. See BIOMETRIC_LOGIN.md.
//
//   iOS     → Keychain under BIOMETRY_ANY. iOS itself shows the Face ID / Touch ID
//             sheet on READ and only returns the data on success (auth + storage
//             are one atomic operation).
//   Android → PLAIN (non-biometric) encryption. We must NOT use the Keystore's
//             biometric lock because hardware-backed keys only unlock with Class-3
//             (STRONG) biometrics, which would lock out Class-2 face-unlock users.
//             Authentication is enforced separately by the native module first
//             (see nativeBiometric.ts), then we read the credentials.
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const BIOMETRIC_SERVICE = 'com.singularitycrm.biometric';

/** Save the credentials behind biometric protection (iOS) / plain-encrypted (Android). */
export const saveCredentials = async (email: string, password: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      await Keychain.setGenericPassword(email, password, {
        service: BIOMETRIC_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } else {
      await Keychain.setGenericPassword(email, password, {
        service: BIOMETRIC_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Read the stored credentials.
 *   iOS: triggers the Face ID / Touch ID sheet via authenticationPrompt.
 *   Android: returns silently — the caller MUST run androidAuthenticate() first.
 * Returns null if the user cancelled the sheet or nothing is stored.
 */
export const loadCredentials = async (): Promise<{ email: string; password: string } | null> => {
  try {
    const result = await Keychain.getGenericPassword(
      Platform.OS === 'ios'
        ? {
            service: BIOMETRIC_SERVICE,
            authenticationPrompt: {
              title: 'Sign in to SingularityCRM',
              subtitle: 'Verify your identity to continue',
              cancel: 'Use Password',
            },
          }
        : { service: BIOMETRIC_SERVICE },
    );
    if (!result) return null;
    return { email: result.username, password: result.password };
  } catch {
    return null; // user cancelled the Face ID sheet, or read failed
  }
};

/** Wipe the stored credentials (logout-from-biometrics / self-heal). */
export const clearCredentials = async (): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE });
  } catch {
    /* ignore */
  }
};
