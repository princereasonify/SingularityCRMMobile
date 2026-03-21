/**
 * nativeLocationTracking.ts
 *
 * Unified JS bridge to the platform native location tracking service:
 *   Android → Kotlin LocationTrackingService (START_STICKY foreground service)
 *   iOS     → Swift LocationTrackingModule   (CLLocationManager + Timer)
 *
 * Both expose the same NativeModule name: "LocationTrackingModule"
 */

import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

const { LocationTrackingModule } = NativeModules;

/** iOS only — returns current permission status WITHOUT showing any dialog.
 *  Returns: "granted" | "whenInUse" | "denied" | "restricted" | "notDetermined"
 */
export const checkIOSPermission = async (): Promise<string> => {
  if (!LocationTrackingModule?.checkPermission) return 'notDetermined';
  try {
    return await LocationTrackingModule.checkPermission();
  } catch (e: any) {
    console.warn('[NativeTracking] checkPermission error:', e?.message);
    return 'notDetermined';
  }
};

/** iOS only — shows the native location permission dialog (only if notDetermined).
 *  Returns: "granted" | "whenInUse" | "denied" | "restricted"
 */
export const requestIOSLocationPermission = async (): Promise<string> => {
  if (!LocationTrackingModule?.requestPermission) return 'denied';
  try {
    const result: string = await LocationTrackingModule.requestPermission();
    return result;
  } catch (e: any) {
    console.warn('[NativeTracking] requestPermission error:', e?.message);
    return 'denied';
  }
};

export const startNativeTracking = async (): Promise<void> => {
  if (!LocationTrackingModule) {
    console.warn('[NativeTracking] LocationTrackingModule not available');
    return;
  }
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) {
    console.warn('[NativeTracking] No auth token — cannot start');
    return;
  }
  try {
    await LocationTrackingModule.startTracking(token, API_BASE_URL);
    console.log('[NativeTracking] Started successfully');
  } catch (e: any) {
    console.warn('[NativeTracking] Failed to start:', e?.message);
  }
};

export const stopNativeTracking = async (): Promise<void> => {
  if (!LocationTrackingModule) return;
  try {
    await LocationTrackingModule.stopTracking();
    console.log('[NativeTracking] Stopped successfully');
  } catch (e: any) {
    console.warn('[NativeTracking] Failed to stop:', e?.message);
  }
};
