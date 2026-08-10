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
import { b2cTrackingService, B2CPingBody } from '../api/b2c/b2cTrackingService';

const QUEUE_KEY = 'b2c_tracking_ping_queue';

/** On-device accuracy gate (metres); mirrors the server's 75 m gate. */
export const B2C_MAX_ACCURACY_METRES = 75;

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

  const withTime: B2CPingBody = { ...body, recordedAt: body.recordedAt ?? new Date().toISOString() };

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
