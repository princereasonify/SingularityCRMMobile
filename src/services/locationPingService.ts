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

const PING_QUEUE_KEY = 'tracking_ping_queue';

const getPosition = (): Promise<any> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, // WiFi/cell — fast, works indoors
      timeout: 20000,
      maximumAge: 30000,
    });
  });

export const sendLocationPing = async (): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
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
    const pingBody = JSON.stringify({
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

    const res = await fetch(`${API_BASE_URL}/tracking/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: pingBody,
    });

    if (res.ok) {
      console.log('[PingService] Ping sent successfully');
    } else {
      console.warn('[PingService] Server error:', res.status, '— queuing');
      await queuePing(pingBody);
    }
  } catch (err: any) {
    console.warn('[PingService] Network error — queuing:', err?.message);
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
