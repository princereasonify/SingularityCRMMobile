/**
 * locationPingService.ts
 *
 * Shared logic for sending a location ping to the server.
 * Used by:
 *  - react-native-background-fetch headless task (app killed)
 *  - react-native-background-actions foreground service (app alive)
 *
 * Does NOT import React or use hooks — safe to call from any context.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { API_BASE_URL } from '../utils/constants';
import { ensureFreshToken, refreshAccessToken } from '../api/client';

const PING_QUEUE_KEY = 'tracking_ping_queue';

/**
 * On-device accuracy gate (metres). Fixes worse than this are dropped before we
 * even send them — the server applies the same 75 m gate, so this just saves a
 * round-trip and keeps low-quality WiFi/cell fixes out of the route entirely.
 */
const MAX_ACCURACY_METRES = 75;

const getPosition = (): Promise<any> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,  // GPS — required for field-grade (sub-20 m) accuracy
      timeout: 20000,
      maximumAge: 5000,          // never accept a fix older than 5 s (was 30 s → stale routes)
    });
  });

export const sendLocationPing = async (): Promise<void> => {
  // Hoisted so the outer catch can still queue the fix if the request throws.
  let pingBody: string | null = null;

  try {
    // Runs from a headless task after the app has been backgrounded for a long time,
    // so the stored access token may well be expired. Roll it forward before using it.
    const token = (await ensureFreshToken()) ?? (await AsyncStorage.getItem('auth_token'));
    if (!token) {
      console.log('[PingService] No auth token — skipping');
      return;
    }

    let position: any;
    try {
      position = await getPosition();
    } catch (err: any) {
      console.warn('[PingService] GPS error:', err?.message);
      return;
    }

    const { latitude, longitude, accuracy, speed, altitude } = position.coords;

    // On-device accuracy gate: drop clearly-bad fixes (null or > 75 m) so a poor
    // WiFi/cell fix never enters the route. The server gates identically.
    if (accuracy == null || accuracy > MAX_ACCURACY_METRES) {
      console.log('[PingService] Dropping low-accuracy fix:', accuracy, 'm');
      return;
    }

    pingBody = JSON.stringify({
      latitude,
      longitude,
      accuracyMetres: accuracy ?? undefined,
      speedKmh: speed != null ? speed * 3.6 : undefined,
      altitudeMetres: altitude ?? undefined,
      recordedAt: new Date().toISOString(),
      provider: 'GPS',
      isMocked: (position as any).mocked ?? false,
    });

    console.log('[PingService] Sending ping:', latitude, longitude);

    const body = pingBody;
    const post = (bearer: string) =>
      fetch(`${API_BASE_URL}/tracking/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body,
      });

    let res = await post(token);

    // Token went stale mid-flight (or ensureFreshToken had nothing to go on) — refresh
    // once and retry rather than losing the fix.
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        res = await post(refreshed);
      }
    }

    if (res.ok) {
      console.log('[PingService] Ping sent successfully');
    } else if (res.status === 403) {
      // No active tracking session — the day is over. Queueing would never drain.
      console.log('[PingService] No active session — dropping ping');
    } else {
      console.warn('[PingService] Server error:', res.status, '— queuing');
      await queuePing(pingBody);
    }
  } catch (err: any) {
    console.warn('[PingService] Network error — queuing:', err?.message);
    // The catch used to drop the ping outright, so every offline fix was lost.
    if (pingBody) await queuePing(pingBody);
  }
};

const queuePing = async (pingBody: string) => {
  try {
    const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
    let queue: any[] = [];
    try { queue = stored ? JSON.parse(stored) : []; } catch {}
    queue.push(JSON.parse(pingBody));
    await AsyncStorage.setItem(PING_QUEUE_KEY, JSON.stringify(queue));
    console.log('[PingService] Queued. Total queued:', queue.length);
  } catch {}
};
