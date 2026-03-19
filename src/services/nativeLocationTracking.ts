/**
 * nativeLocationTracking.ts
 *
 * JS bridge to the native Kotlin LocationTrackingService.
 * The native service runs independently of the JS thread — it survives
 * app kill and uses START_STICKY to restart automatically.
 *
 * Only works on Android. On iOS this is a no-op (iOS has different
 * background modes handled separately).
 */

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const { LocationTrackingModule } = NativeModules;

const isAndroid = Platform.OS === 'android';

export const startNativeTracking = async (): Promise<void> => {
  if (!isAndroid || !LocationTrackingModule) return;

  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    console.warn('[NativeTracking] No auth token — cannot start native service');
    return;
  }

  try {
    await LocationTrackingModule.startTracking(token, API_BASE_URL);
    console.log('[NativeTracking] Native service started');
  } catch (e: any) {
    console.warn('[NativeTracking] Failed to start native service:', e?.message);
  }
};

export const stopNativeTracking = async (): Promise<void> => {
  if (!isAndroid || !LocationTrackingModule) return;

  try {
    await LocationTrackingModule.stopTracking();
    console.log('[NativeTracking] Native service stopped');
  } catch (e: any) {
    console.warn('[NativeTracking] Failed to stop native service:', e?.message);
  }
};
