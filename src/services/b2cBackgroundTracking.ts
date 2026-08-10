/**
 * b2cBackgroundTracking.ts
 *
 * Keeps B2C location capture alive when the app is backgrounded or the phone locks —
 * the gap that previously made B2C tracking stop the moment the screen was left.
 *
 * Layers (mirrors the B2B fallback strategy, but pure-JS so it needs no native changes):
 *  - Android: react-native-background-actions foreground service runs a capture loop
 *    that survives backgrounding. (iOS restricts JS background execution, so there the
 *    foreground watchPosition + BackgroundFetch below do the work.)
 *  - Both: react-native-background-fetch as a periodic (~15 min) OS-wakeup fallback.
 *
 * All ticks go through captureAndSendB2CPing (accuracy gate + client timestamp +
 * offline queue + batch flush). Every native call is guarded so a missing service
 * degrades gracefully instead of crashing the app.
 */

import { Platform } from 'react-native';
import BackgroundService from './backgroundServiceShim';
import BackgroundFetch from 'react-native-background-fetch';
import { captureAndSendB2CPing } from './b2cLocationPingService';

const SEND_INTERVAL_MS = 15000;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** The long-running loop the Android foreground service hosts. */
const backgroundLoop = async () => {
  // First tick immediately, then every SEND_INTERVAL until the service is stopped.
  while (BackgroundService.isRunning()) {
    try { await captureAndSendB2CPing(); } catch {}
    await sleep(SEND_INTERVAL_MS);
  }
};

const options = {
  taskName: 'B2CDayTracking',
  taskTitle: 'Day tracking active',
  taskDesc: 'Sending your location while your day is on',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: '#4a8f28',                 // B2C green
  parameters: {},
};

let bgFetchConfigured = false;

export const startB2CBackgroundTracking = async (): Promise<void> => {
  // Android foreground service — the only reliable way to keep a JS loop alive in
  // the background without a custom native module.
  if (Platform.OS === 'android') {
    try {
      if (!BackgroundService.isRunning()) {
        await BackgroundService.start(backgroundLoop, options);
      }
    } catch (e: any) {
      console.warn('[B2CBgTracking] Foreground service failed to start:', e?.message);
    }
  }

  // Periodic OS-wakeup fallback (min 15 min). Non-headless: the killed-app case is
  // handled by the role-aware headless task registered in index.js.
  try {
    await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15,
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: false,
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
      },
      async (taskId: string) => { await captureAndSendB2CPing(); BackgroundFetch.finish(taskId); },
      (taskId: string) => { BackgroundFetch.finish(taskId); },
    );
    bgFetchConfigured = true;
  } catch (e: any) {
    console.warn('[B2CBgTracking] BackgroundFetch configure failed:', e?.message);
  }
};

export const stopB2CBackgroundTracking = async (): Promise<void> => {
  try { if (BackgroundService.isRunning()) await BackgroundService.stop(); } catch {}
  if (bgFetchConfigured) { try { BackgroundFetch.stop(); } catch {} }
};
