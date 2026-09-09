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
import { nextPingSeq } from './pingSequence';

const PING_QUEUE_KEY = 'tracking_ping_queue';

/**
 * On-device accuracy gate (metres). Kept in step with the native services and the server so one
 * walk cannot be measured two different ways depending on which sender happened to be running.
 *
 * Deliberately loose. A poor fix is no longer dangerous the way it was under per-point snapping,
 * because the fix's own accuracy travels with it and becomes the map matcher's search radius —
 * an uncertain point is weighed rather than trusted. What the matcher cannot recover from is a
 * starved trace, so the gate excludes only the unusable.
 */
const MAX_ACCURACY_METRES = 50;

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

    const { latitude, longitude, accuracy, speed, altitude, heading } = position.coords;

    // On-device accuracy gate: drop clearly-bad fixes (null or > 75 m) so a poor
    // WiFi/cell fix never enters the route. The server gates identically.
    if (accuracy == null || accuracy > MAX_ACCURACY_METRES) {
      console.log('[PingService] Dropping low-accuracy fix:', accuracy, 'm');
      return;
    }

    // The fix's OWN capture time, not send time. A ping stamped "now" from a position taken
    // minutes ago drags the route back to where the agent used to be and then forward again —
    // two phantom legs out of one stale reading — and it defeats every staleness check
    // downstream, because the server has no way to know the timestamp is a lie.
    const capturedAt = position.timestamp
      ? new Date(position.timestamp).toISOString()
      : new Date().toISOString();

    pingBody = JSON.stringify({
      // Allocated once, before the first attempt, and carried through every retry — that is the
      // whole point. Re-allocating on retry would make the retry look like a new fix and defeat
      // the deduplication it exists to enable.
      seq: await nextPingSeq(),
      latitude,
      longitude,
      accuracyMetres: accuracy ?? undefined,
      speedKmh: speed != null ? speed * 3.6 : undefined,
      altitudeMetres: altitude ?? undefined,
      // Course over ground, which the server hands to the map matcher as a direction constraint —
      // it is what separates the two carriageways of a divided road, and the two arms of a fork,
      // long before the trace itself has travelled far enough to make the choice obvious.
      // Negative means the OS has no heading (stationary); omit rather than claim north.
      bearing: heading != null && heading >= 0 ? Math.round(heading) : undefined,
      recordedAt: capturedAt,
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
