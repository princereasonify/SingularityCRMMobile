import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Remember me" — persists the EMAIL ADDRESS ONLY, so a returning user lands on
 * the login screen with the address already filled in.
 *
 * Deliberately NOT the password. The password already has a secure, passwordless
 * path on this platform: biometricService + secureStorage keep it in the OS
 * Keychain/Keystore behind Face ID / Touch ID / fingerprint. Writing a second
 * copy into AsyncStorage would defeat that — AsyncStorage is unencrypted plain
 * text on disk, readable by anyone with the device unlocked or a filesystem
 * dump, and it would survive as a plaintext credential long after the user
 * disabled biometrics.
 *
 * So: this remembers who you are, biometrics remembers your password.
 *
 * The email is not a secret in the same sense, but it is still personal data, so
 * unchecking the box clears it immediately rather than merely stopping updates.
 */
const REMEMBER_EMAIL_KEY = '@singularitycrm:remembered_email';

/** The stored address, or null when the user has not opted in. */
export const loadRememberedEmail = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
  } catch {
    // A storage failure must never block sign-in — fall back to an empty field.
    return null;
  }
};

export const saveRememberedEmail = async (email: string): Promise<void> => {
  try {
    const trimmed = email.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, trimmed);
  } catch {
    // Non-fatal: the user simply retypes their address next time.
  }
};

export const clearRememberedEmail = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    // Non-fatal.
  }
};
