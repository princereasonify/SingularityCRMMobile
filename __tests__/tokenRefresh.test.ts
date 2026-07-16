/**
 * Regression tests for the "logged out when returning to the app" bug.
 *
 * The app used to log the user out on the first 401 it saw. Because the access token
 * expired while the app sat in the background, the 30s session poll would 401 the moment
 * the user came back — ejecting them to the login screen and killing location tracking.
 *
 * These tests drive the real apiClient through a stub transport that behaves like the
 * backend: it rejects a stale access token with 401, and rotates refresh tokens on
 * /auth/refresh (a consumed refresh token is dead, exactly as server-side).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/utils/constants', () => ({ API_BASE_URL: 'https://api.test' }));

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, setUnauthorizedHandler, refreshAccessToken } from '../src/api/client';

const STALE = 'stale-access-token';
const FRESH = 'fresh-access-token';
const VALID_REFRESH = 'valid-refresh-token';

let refreshCalls = 0;
let protectedCalls = 0;
let liveRefreshTokens = new Set<string>();
let rotationCounter = 0;

const reject = (status: number, data: any, config: any) => {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.config = config;
  err.response = { status, data, statusText: '', headers: {}, config };
  return Promise.reject(err);
};

const ok = (data: any, config: any) =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as any);

/** Stands in for the SalesCRM API. */
const stubTransport = (config: any) => {
  const url: string = config.url ?? '';

  if (url.includes('/auth/refresh')) {
    refreshCalls++;
    const { refreshToken } = JSON.parse(config.data ?? '{}');

    // Rotation: a refresh token can only be spent once.
    if (!liveRefreshTokens.has(refreshToken)) {
      return reject(401, { success: false, message: 'Session expired' }, config);
    }
    liveRefreshTokens.delete(refreshToken);
    const rotated = `rotated-refresh-token-${++rotationCounter}`;
    liveRefreshTokens.add(rotated);

    return ok(
      {
        success: true,
        data: {
          token: FRESH,
          refreshToken: rotated,
          expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        },
      },
      config,
    );
  }

  // Any protected endpoint: only the fresh access token is accepted.
  protectedCalls++;
  if (config.headers?.Authorization !== `Bearer ${FRESH}`) {
    return reject(
      401,
      { success: false, message: 'Access token expired', code: 'token_expired' },
      config,
    );
  }
  return ok({ success: true, data: { session: { status: 'active' } } }, config);
};

beforeEach(async () => {
  refreshCalls = 0;
  protectedCalls = 0;
  rotationCounter = 0;
  liveRefreshTokens = new Set([VALID_REFRESH]);
  await AsyncStorage.clear();
  setUnauthorizedHandler(() => {});

  // apiClient makes the protected calls; the bare axios instance is what
  // refreshAccessToken() uses to hit /auth/refresh.
  apiClient.defaults.adapter = stubTransport;
  axios.defaults.adapter = stubTransport;
});

test('a 401 on an expired token is refreshed and retried — the user is NOT logged out', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', VALID_REFRESH],
  ]);

  const loggedOut = jest.fn();
  setUnauthorizedHandler(loggedOut);

  const res = await apiClient.get('/tracking/session/today');

  // The request that used to eject the user now succeeds transparently.
  expect(res.status).toBe(200);
  expect(res.data).toEqual({ session: { status: 'active' } });

  // This is the bug: the old client called onUnauthorized() right here.
  expect(loggedOut).not.toHaveBeenCalled();

  // Rotated credentials persisted, ready for the next call and the native service.
  expect(await AsyncStorage.getItem('auth_token')).toBe(FRESH);
  expect(await AsyncStorage.getItem('refresh_token')).toBe('rotated-refresh-token-1');
  expect(refreshCalls).toBe(1);
});

test('concurrent 401s trigger exactly ONE refresh (no rotation race)', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', VALID_REFRESH],
  ]);

  const loggedOut = jest.fn();
  setUnauthorizedHandler(loggedOut);

  const results = await Promise.all([
    apiClient.get('/tracking/session/today'),
    apiClient.get('/tracking/live-locations'),
    apiClient.get('/notifications'),
  ]);

  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(loggedOut).not.toHaveBeenCalled();

  // Without single-flight + "did someone already refresh?" checking, each 401 would
  // spend the refresh token again, get rejected, and log the user out anyway.
  expect(refreshCalls).toBe(1);
});

test('logout only happens when the refresh itself fails', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', 'revoked-refresh-token'],
  ]);

  const loggedOut = jest.fn();
  setUnauthorizedHandler(loggedOut);

  await expect(apiClient.get('/tracking/session/today')).rejects.toThrow();

  expect(refreshCalls).toBe(1);
  expect(loggedOut).toHaveBeenCalledTimes(1);
});

test('a request is retried only once, never looped', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', 'revoked-refresh-token'],
  ]);

  await expect(apiClient.get('/tracking/session/today')).rejects.toThrow();

  // One original attempt, and no retry because the refresh failed.
  expect(protectedCalls).toBe(1);
});

test('refreshAccessToken resolves null (rather than throwing) when there is nothing to refresh with', async () => {
  await AsyncStorage.setItem('auth_token', STALE);
  await expect(refreshAccessToken()).resolves.toBeNull();
  expect(refreshCalls).toBe(0);
});

test('a dead connection does NOT log the user out — the session survives to retry later', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', VALID_REFRESH],
  ]);

  const loggedOut = jest.fn();
  setUnauthorizedHandler(loggedOut);

  // The protected call reaches the server and 401s (token genuinely expired), but the
  // follow-up /auth/refresh never completes — phone went through a tunnel.
  const flaky = (config: any) => {
    if ((config.url ?? '').includes('/auth/refresh')) {
      const err: any = new Error('Network Error');
      err.isAxiosError = true;
      err.config = config;
      err.response = undefined; // no response at all — this is the signature of offline
      return Promise.reject(err);
    }
    return stubTransport(config);
  };
  apiClient.defaults.adapter = flaky;
  axios.defaults.adapter = flaky;

  await expect(apiClient.get('/tracking/session/today')).rejects.toThrow();

  // The old code collapsed "couldn't reach the server" into "session over" and ejected
  // the user. Losing signal must never cost someone their session.
  expect(loggedOut).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('auth_token')).toBe(STALE);
  expect(await AsyncStorage.getItem('refresh_token')).toBe(VALID_REFRESH);
});

test('a server 5xx during refresh does NOT log the user out either', async () => {
  await AsyncStorage.multiSet([
    ['auth_token', STALE],
    ['refresh_token', VALID_REFRESH],
  ]);

  const loggedOut = jest.fn();
  setUnauthorizedHandler(loggedOut);

  const brokenServer = (config: any) => {
    if ((config.url ?? '').includes('/auth/refresh')) {
      return reject(500, { success: false, message: 'Internal Server Error' }, config);
    }
    return stubTransport(config);
  };
  apiClient.defaults.adapter = brokenServer;
  axios.defaults.adapter = brokenServer;

  await expect(apiClient.get('/tracking/session/today')).rejects.toThrow();

  expect(loggedOut).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('refresh_token')).toBe(VALID_REFRESH);
});
