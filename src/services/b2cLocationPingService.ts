/**
 * b2cLocationPingService.ts
 *
 * Resilient B2C location pinging — the B2C counterpart to locationPingService.ts.
 * Used by the foreground B2CMyDayScreen watch loop AND the background drivers
 * (react-native-background-actions / react-native-background-fetch).
 *
 * Guarantees for ~99% route fidelity:
 *  - On-device accuracy gate: a fix worse than 75 m never enters the route.
 *  - Client capture time (recordedAt): the server orders offline/batched fixes
 *    by true capture time instead of receive time.
 *  - Offline queue + batch flush: a fix is never lost to a transient network drop;
 *    queued fixes drain via /b2c/tracking/ping/batch on the next successful cycle.
 *
 * Goes through b2cTrackingService (apiClient), so auth + token refresh are handled
 * centrally and this works from a headless task too.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';
import { b2cTrackingService, B2CPingBody } from '../api/b2c/b2cTrackingService';

const QUEUE_KEY = 'b2c_tracking_ping_queue';

/**
 * On-device accuracy gate (metres). Tightened from 75 m to 35 m: at 75 m a fix can sit on the
 * wrong side of a dual carriageway, and the road-snapper will faithfully snap it there — a bad
 * fix that passes the gate becomes a confident wrong road, which is worse than no fix at all.
 *
 * The server keeps its own 75 m gate as a backstop for older clients; this is the stricter of
 * the two and runs first, so a poor fix never costs a round trip.
 *
 * Trade-off worth knowing: in a dense urban canyon, accuracy often sits in the 20–50 m band, so
 * 35 m will thin the route where buildings are tallest. That is the intended bargain — fewer,
 * trustworthy points beat many that quietly invent distance.
 */
export const B2C_MAX_ACCURACY_METRES = 35;

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

/** Delivers any queued fixes via the batch endpoint. Keeps them on failure; drops on 403 (day over). */
export const flushB2CQueue = async (): Promise<void> => {
  const queue = await readQueue();
  if (queue.length === 0) return;
  try {
    await b2cTrackingService.pingBatch(queue);
    await writeQueue([]);   // delivered → clear
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
  const { latitude, longitude, accuracy, speed } = pos.coords;
  await sendB2CPing({
    latitude,
    longitude,
    accuracyMetres: accuracy != null ? Math.round(accuracy) : undefined,
    speedKmh: speed != null ? Math.max(0, speed * 3.6) : undefined,
    recordedAt: new Date().toISOString(),
  });
};
