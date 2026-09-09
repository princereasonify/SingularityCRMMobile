/**
 * b2cLocationPingService.ts
 *
 * Resilient B2C location pinging — the B2C counterpart to locationPingService.ts.
 * Used by the foreground B2CMyDayScreen watch loop AND the background drivers
 * (react-native-background-actions / react-native-background-fetch).
 *
 * What this guarantees:
 *  - On-device accuracy gate (B2C_MAX_ACCURACY_METRES): unusable fixes never leave the device,
 *    while every fix that does carries its own accuracy for the server's matcher to weigh.
 *  - Client capture time (recordedAt): the server orders offline/batched fixes by true capture
 *    time instead of receive time.
 *  - Sequence numbers (seq): a re-sent fix is recognised and dropped by the server rather than
 *    counted a second time, so retrying after a lost response is free.
 *  - Offline queue + batch flush: a fix is never lost to a transient network drop; queued fixes
 *    drain via /b2c/tracking/ping/batch and are trimmed against the server's acceptedThroughSeq.
 *
 * Goes through b2cTrackingService (apiClient), so auth + token refresh are handled
 * centrally and this works from a headless task too.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';
import { b2cTrackingService, B2CPingBody } from '../api/b2c/b2cTrackingService';
import { nextPingSeq } from './pingSequence';

const QUEUE_KEY = 'b2c_tracking_ping_queue';

/**
 * On-device accuracy gate (metres).
 *
 * LOOSENED from 35 m, and that is deliberate rather than a regression. Under per-point road
 * snapping a poor fix became a confident WRONG road, so a tight gate genuinely helped. A
 * sequence-aware map matcher inverts the trade: each fix's accuracy is sent with it and becomes
 * the matcher's search radius, so an uncertain point is weighed against its neighbours and the
 * road network rather than trusted outright.
 *
 * What a matcher cannot recover from is a STARVED trace. In a dense urban canyon accuracy sits
 * in the 20–50 m band, so a 35 m gate discarded most of the day exactly where the route was
 * hardest to infer — and with too few points, parallel roads and turns become genuinely
 * ambiguous. 50 m keeps the evidence and lets the algorithm weigh it. Kept in step with the
 * native services and the server so one walk cannot be measured two different ways.
 */
export const B2C_MAX_ACCURACY_METRES = 50;

/**
 * A fix older than this is stale and dropped. A GPS chip will happily hand back a cached fix
 * from minutes ago; stamped with "now" it drags the route backwards to where the agent used to
 * be, then forwards again — two phantom legs from one stale reading.
 */
export const B2C_MAX_FIX_AGE_MS = 30_000;

/** Below this the device is standing still, whatever the coordinates wobble by. */
const STATIONARY_SPEED_KMH = 1.5;

/** Displacement under this, at low speed, is jitter rather than travel. */
const STATIONARY_DISPLACEMENT_M = 20;

/**
 * How many consecutive stationary checks before distance accumulation is suppressed. Three,
 * not one: a single slow fix at a traffic light is not the same as a parked phone, and
 * suppressing on the first would eat real crawling-traffic movement.
 */
const STATIONARY_STREAK = 3;

/** Rolling stationary state. Module-level so the background driver and the foreground watch
 *  share one streak — they are the same physical device and must not disagree about it. */
let stationaryStreak = 0;
let lastAccepted: { lat: number; lon: number } | null = null;

/** Metres between two coordinates (equirectangular — exact enough at these distances). */
const metresBetween = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const x = (toRad(bLon - aLon)) * Math.cos(toRad((aLat + bLat) / 2));
  const y = toRad(bLat - aLat);
  return Math.sqrt(x * x + y * y) * R;
};

/** Resets the stationary streak. Call when a day starts or ends so one shift cannot inherit
 *  the previous one's state. */
export const resetB2CMotionState = (): void => {
  stationaryStreak = 0;
  lastAccepted = null;
};

/**
 * Battery at capture, 0–100. Cached for a minute: the native read is cheap but not free, and
 * this runs on every fix. Never throws — a missing battery reading must not cost a location.
 */
let batteryCache: { pct: number; at: number } | null = null;
const readBatteryPct = async (): Promise<number | undefined> => {
  if (batteryCache && Date.now() - batteryCache.at < 60_000) return batteryCache.pct;
  try {
    const level = await DeviceInfo.getBatteryLevel();   // 0–1, or -1 when unknown
    if (level == null || level < 0) return undefined;
    const pct = Math.round(level * 100);
    batteryCache = { pct, at: Date.now() };
    return pct;
  } catch {
    return undefined;
  }
};

/** Cap the offline queue so a device left offline for days can't grow it without bound. */
const MAX_QUEUED = 500;

const readQueue = async (): Promise<B2CPingBody[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as B2CPingBody[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: B2CPingBody[]): Promise<void> => {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED))); } catch {}
};

const enqueue = async (body: B2CPingBody): Promise<void> => {
  const queue = await readQueue();
  queue.push(body);
  await writeQueue(queue);
};

const statusOf = (err: any): number | undefined => err?.response?.status ?? err?.status;

/**
 * Delivers any queued fixes via the batch endpoint.
 *
 * Trimming is driven by the server's `acceptedThroughSeq`, not by the call merely not throwing.
 * A 200 says the request was handled; it does not say every fix in it was stored, and clearing
 * the whole queue on a 200 is how a partially-processed batch silently loses its tail. Anything
 * at or below the acknowledged sequence is durable and safe to drop; anything above it stays for
 * the next cycle, where the server's deduplication makes the re-send free.
 *
 * Keeps the queue on failure; drops it on 403 (the day is over, so these can never be accepted).
 */
export const flushB2CQueue = async (): Promise<void> => {
  const queue = await readQueue();
  if (queue.length === 0) return;
  try {
    const res: any = await b2cTrackingService.pingBatch(queue);
    const through = res?.data?.acceptedThroughSeq;
    if (typeof through === 'number') {
      // Re-read rather than filtering the snapshot: fixes captured while the flush was in
      // flight are already in the queue and must not be discarded along with it. A row whose
      // sequence cannot be read is KEPT — losing a fix is worse than re-sending one the server
      // will recognise and drop.
      const remaining = (await readQueue()).filter(p => typeof p.seq !== 'number' || p.seq > through);
      await writeQueue(remaining);
    } else {
      await writeQueue([]);
    }
  } catch (err: any) {
    if (statusOf(err) === 403) await writeQueue([]);   // no active session — these will never be accepted
    // else: keep the queue and retry next cycle
  }
};

/**
 * Sends one fix. Flushes the offline queue first so order is preserved, then posts
 * the new fix. On network/server failure the fix is queued; on 403 it's dropped.
 * Returns true when the fix reached the server.
 */
export const sendB2CPing = async (body: B2CPingBody): Promise<boolean> => {
  // On-device accuracy gate — drop clearly-bad fixes before they cost a round-trip.
  if (body.accuracyMetres != null && body.accuracyMetres > B2C_MAX_ACCURACY_METRES) return false;

  // Stale fix: a cached reading stamped "now" would teleport the route to where the agent was
  // minutes ago and straight back again.
  if (body.recordedAt) {
    const age = Date.now() - new Date(body.recordedAt).getTime();
    if (age > B2C_MAX_FIX_AGE_MS) return false;
  }

  // Stationary suppression. A phone on a desk still wanders several metres a minute; over an
  // eight-hour shift that is kilometres of distance nobody walked. Suppress only after the
  // device has looked stationary three checks running, so a slow crawl in traffic still counts.
  const speed = body.speedKmh ?? 0;
  const moved = lastAccepted
    ? metresBetween(lastAccepted.lat, lastAccepted.lon, body.latitude, body.longitude)
    : Number.POSITIVE_INFINITY;
  const looksStationary = speed < STATIONARY_SPEED_KMH && moved < STATIONARY_DISPLACEMENT_M;

  if (looksStationary) {
    stationaryStreak += 1;
    // Past the streak the device is parked: stop feeding the route entirely. The session stays
    // open and the next real movement resumes it — we are dropping jitter, not ending the day.
    if (stationaryStreak >= STATIONARY_STREAK) return false;
  } else {
    stationaryStreak = 0;
  }
  lastAccepted = { lat: body.latitude, lon: body.longitude };

  const withTime: B2CPingBody = {
    ...body,
    // Allocated once, here, and carried through every retry and every queue flush — that is the
    // whole point. Re-allocating on retry would make the retry look like a new fix and defeat
    // the deduplication it exists to enable.
    seq: body.seq ?? (await nextPingSeq()),
    recordedAt: body.recordedAt ?? new Date().toISOString(),
    batteryLevel: body.batteryLevel ?? (await readBatteryPct()),
  };

  await flushB2CQueue();
  try {
    await b2cTrackingService.ping(withTime);
    return true;
  } catch (err: any) {
    const status = statusOf(err);
    if (status === 403) return false;          // no active session — the day is over, drop it
    await enqueue(withTime);                    // network/5xx — keep it for the next cycle
    return false;
  }
};

const getPosition = (): Promise<any> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,   // GPS — field-grade accuracy
      timeout: 20000,
      maximumAge: 5000,           // never accept a fix older than 5 s
    });
  });

/**
 * Captures a fresh fix and sends it. For the background drivers, which (unlike the
 * foreground screen) have no live watchPosition stream to read from.
 */
export const captureAndSendB2CPing = async (): Promise<void> => {
  let pos: any;
  try {
    pos = await getPosition();
  } catch {
    await flushB2CQueue();   // no fix this cycle, but still try to drain anything queued
    return;
  }
  const { latitude, longitude, accuracy, speed, heading } = pos.coords;
  await sendB2CPing({
    latitude,
    longitude,
    accuracyMetres: accuracy != null ? Math.round(accuracy) : undefined,
    speedKmh: speed != null ? Math.max(0, speed * 3.6) : undefined,
    // Course over ground. The foreground screen has always sent this; the background drivers
    // dropped it, so precisely the fixes taken while the app was backgrounded — most of a
    // driving day — reached the matcher with no direction to disambiguate them. Negative means
    // the OS could not determine a heading (typically stationary), and sending 0 there would
    // assert "due north" rather than "unknown".
    bearing: heading != null && heading >= 0 ? Math.round(heading) : undefined,
    // The fix's OWN capture time. Stamping "now" onto a position the OS took a minute ago
    // drags the route back to where the agent used to be and forward again — two phantom legs
    // out of one stale reading — and it defeats the staleness check above, which is measured
    // against exactly this field.
    recordedAt: pos.timestamp ? new Date(pos.timestamp).toISOString() : new Date().toISOString(),
  });
};
