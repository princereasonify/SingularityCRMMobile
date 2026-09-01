/**
 * b2cBackgroundTracking.ts
 *
 * Keeps a B2C "Start My Day" session capturing while the app is backgrounded, the phone is
 * locked, or the app has been killed.
 *
 * This used to be a pure-JS driver (react-native-background-actions + background-fetch running
 * a JS loop). That approach cannot win: both platforms' power managers suspend JS timers, iOS
 * gives no equivalent of a foreground service to a JS runner at all, and background-fetch wakes
 * at the OS's convenience — around fifteen minutes at best — which is far too coarse to draw a
 * route. A shift tracked that way has holes in it, and the holes are exactly when the agent was
 * driving with the screen off.
 *
 * It now delegates to the SAME native engine B2B uses (Kotlin foreground service with
 * START_STICKY + persistent notification; CLLocationManager with BestForNavigation and
 * background updates). The only thing that differs between the tiers is the endpoint, which is
 * passed in as a tier — see nativeLocationTracking.ts.
 *
 * The exported API is unchanged so callers did not have to move.
 */

import {
  startNativeTracking,
  stopNativeTracking,
  isNativeTrackingAvailable,
} from './nativeLocationTracking';

/**
 * Begins background capture for the B2C tier.
 *
 * Safe to call more than once: the native services are idempotent (Android reuses the running
 * foreground service, iOS re-arms its timer), which matters because the screen calls this
 * whenever the session becomes active.
 */
export const startB2CBackgroundTracking = async (): Promise<void> => {
  if (!isNativeTrackingAvailable()) {
    // A JS-only fallback would be worse than none: it would look like it was working while
    // silently losing every fix the OS suspended, and the route would be quietly wrong.
    console.warn('[B2CBgTracking] Native tracking module unavailable — background capture is OFF');
    return;
  }
  await startNativeTracking('b2c');
};

export const stopB2CBackgroundTracking = async (): Promise<void> => {
  if (!isNativeTrackingAvailable()) return;
  await stopNativeTracking();
};
