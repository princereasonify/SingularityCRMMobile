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
import { trackingApi } from '../api/tracking';

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

/** Cap the offline queue so a device left offline for days can't grow it without bound — the
 *  same 500 the native engine and the B2C queue use. Oldest-first eviction: a stale position
 *  matters less than a recent one. */
const MAX_QUEUED_PINGS = 500;

const readPingQueue = async (): Promise<any[]> => {
  try {
    const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePingQueue = async (queue: any[]): Promise<void> => {
  try {
    if (queue.length === 0) await AsyncStorage.removeItem(PING_QUEUE_KEY);
    else await AsyncStorage.setItem(PING_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_PINGS)));
  } catch {}
};

const queuePing = async (pingBody: string) => {
  try {
    const queue = await readPingQueue();
    queue.push(JSON.parse(pingBody));
    await writePingQueue(queue);
    console.log('[PingService] Queued. Total queued:', Math.min(queue.length, MAX_QUEUED_PINGS));
  } catch {}
};

export interface B2BQueueFlushResult {
  /** True when nothing is left queued afterwards. */
  ok: boolean;
  /** Rows still queued after the attempt. */
  remaining: number;
}

/**
 * Drains the B2B JS offline queue (`tracking_ping_queue`) via /tracking/ping/batch.
 *
 * Trimming is driven by the server's `acceptedThroughSeq` (scoped to THIS batch), not by the call
 * merely not throwing: a 200 says the request was handled, not that every fix was stored, and
 * the server deliberately stops its ack just below the first ping that failed to save. Rows at or
 * below the ack are durable and dropped; rows above it — and any row without a numeric seq — are
 * KEPT for the next attempt, where the server's (session, seq) dedup makes the re-send free. The
 * queue is cleared wholesale only when the field is absent (older server) or on 403 (no session —
 * these can never be accepted). Every other failure keeps the queue intact.
 *
 * Every row this module queues carries a seq (allocated before pingBody is built; if allocation
 * throws nothing is queued), so the keep-seqless rule only affects rows from older builds.
 *
 * `dropOlderThanMs` optionally discards rows whose recordedAt is older than that window before
 * sending (MyDayTrackingScreen's existing 24 h rule). Never throws.
 */
export const flushB2BPingQueue = async (
  opts: { dropOlderThanMs?: number } = {},
): Promise<B2BQueueFlushResult> => {
  const cutoff = opts.dropOlderThanMs != null ? Date.now() - opts.dropOlderThanMs : null;
  const isFresh = (p: any) =>
    cutoff == null || !p?.recordedAt || new Date(p.recordedAt).getTime() > cutoff;

  const stored = await readPingQueue();
  if (stored.length === 0) return { ok: true, remaining: 0 };

  const queue = stored.filter(isFresh);
  if (queue.length === 0) {
    await writePingQueue([]);
    return { ok: true, remaining: 0 };
  }

  try {
    const res: any = await trackingApi.sendBatchPings(queue);
    const through = res?.data?.acceptedThroughSeq;
    if (typeof through === 'number') {
      // Re-read rather than filtering the snapshot: a fix queued while the batch was in flight
      // must not be discarded along with it.
      const remaining = (await readPingQueue()).filter(
        p => isFresh(p) && (typeof p?.seq !== 'number' || p.seq > through),
      );
      await writePingQueue(remaining);
      return { ok: remaining.length === 0, remaining: remaining.length };
    }
    await writePingQueue([]);
    return { ok: true, remaining: 0 };
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status;
    if (status === 403) {
      // No active session — these pings will never be accepted, so let them go.
      await writePingQueue([]);
      return { ok: true, remaining: 0 };
    }
    // 5xx, timeouts, no response, 401 after a failed refresh: KEEP the queue.
    // Storage is left untouched (not rewritten from the snapshot) so a fix queued while the
    // request was in flight cannot be overwritten.
    return { ok: false, remaining: queue.length };
  }
};
