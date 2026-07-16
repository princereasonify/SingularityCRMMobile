// ─── biometricService: availability detection + the "enabled" flag ────────────
// - getBiometricInfo(): what hardware exists and its label (Face ID / Touch ID /
//   Fingerprint) so the login screen can show the right icon + copy per device.
// - enabled flag: a plain AsyncStorage boolean (NOT a secret) telling us whether
//   to auto-prompt. The actual credentials live in the Keychain (secureStorage).
import { Platform } from 'react-native';
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { androidBiometricReady } from './nativeBiometric';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });
const BIOMETRIC_ENABLED_KEY = '@singularitycrm:biometric_enabled';

export type BiometricStatus = 'available' | 'not_enrolled' | 'not_supported' | 'unavailable';
export type BiometricType = 'FaceID' | 'TouchID' | 'Fingerprint' | 'Face' | 'Biometrics' | 'Unknown';
export interface BiometricInfo {
  status: BiometricStatus;
  biometryType: BiometricType;
  label: string;
}

export const getBiometricInfo = async (): Promise<BiometricInfo> => {
  try {
    if (Platform.OS === 'android') {
      // Route through the native module so face + fingerprint are both detected
      // (react-native-biometrics only sees Class-3 fingerprint).
      const ready = await androidBiometricReady();
      return ready
        ? { status: 'available', biometryType: 'Fingerprint', label: 'Fingerprint' }
        : { status: 'not_enrolled', biometryType: 'Unknown', label: 'Biometric' };
    }

    const { available, biometryType, error } = await rnBiometrics.isSensorAvailable();
    if (!available) {
      const status: BiometricStatus = error?.includes('not enrolled') ? 'not_enrolled' : 'not_supported';
      return { status, biometryType: 'Unknown', label: 'Biometric' };
    }

    const typeMap: Record<string, { type: BiometricType; label: string }> = {
      [BiometryTypes.FaceID]: { type: 'FaceID', label: 'Face ID' },
      [BiometryTypes.TouchID]: { type: 'TouchID', label: 'Touch ID' },
      [BiometryTypes.Biometrics]: { type: 'Biometrics', label: 'Biometrics' },
    };
    const mapped = biometryType ? typeMap[biometryType] : undefined;
    return {
      status: 'available',
      biometryType: mapped?.type ?? 'Unknown',
      label: mapped?.label ?? 'Biometric',
    };
  } catch {
    return { status: 'unavailable', biometryType: 'Unknown', label: 'Biometric' };
  }
};

export const isBiometricEnabled = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === 'true';

export const setBiometricEnabled = async (v: boolean): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, v ? 'true' : 'false');
};

export const disableBiometric = async (): Promise<void> => {
  await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
};
