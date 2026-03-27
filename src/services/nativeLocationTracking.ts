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
import { SchoolAssignment } from '../types';

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

/**
 * Registers CLCircularRegion geofences for today's assigned schools (iOS).
 * Field officers get local notifications when they enter/exit a school zone,
 * and visit logs are automatically sent to the backend.
 *
 * Returns the number of regions successfully registered (iOS max: 20).
 */
export const updateGeofences = async (schools: SchoolAssignment[]): Promise<number> => {
  if (!LocationTrackingModule?.updateGeofences) return 0;
  try {
    const payload = schools.map(s => ({
      schoolId:     s.id,
      schoolName:   s.schoolName,
      latitude:     s.schoolLatitude,
      longitude:    s.schoolLongitude,
      radiusMetres: s.geofenceRadiusMetres,
    }));
    const count: number = await LocationTrackingModule.updateGeofences(payload);
    console.log(`[NativeTracking] Geofences registered: ${count}`);
    return count;
  } catch (e: any) {
    console.warn('[NativeTracking] updateGeofences error:', e?.message);
    return 0;
  }
};

/**
 * Stops all school geofence monitoring. Call when the tracking session ends.
 */
export const clearGeofences = async (): Promise<void> => {
  if (!LocationTrackingModule?.clearGeofences) return;
  try {
    await LocationTrackingModule.clearGeofences();
    console.log('[NativeTracking] Geofences cleared');
  } catch (e: any) {
    console.warn('[NativeTracking] clearGeofences error:', e?.message);
  }
};
