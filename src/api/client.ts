import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/constants';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Token refresh ──────────────────────────────────────────────────────────
// A 401 means "this access token is stale", NOT "this user is gone". Logging out
// on the first 401 is what used to eject field officers the moment they returned
// to the app after the token had expired in the background. We now try to refresh
// once; logout is reserved for a refresh that actually fails.

let onUnauthorized: (() => void) | null = null;
let onTokenRefreshed: ((token: string) => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

/** Notified whenever a new access token is minted, so listeners (e.g. the native
 *  tracking service) can be handed the fresh token. */
export const setTokenRefreshedHandler = (handler: (token: string) => void) => {
  onTokenRefreshed = handler;
};

/** A day-tracking session runs for a whole shift, and the native service can't refresh
 *  on its own — so when tracking starts we want a token that outlives the working day,
 *  not one with two hours left on it. */
export const TRACKING_TOKEN_THRESHOLD_MS = 12 * 60 * 60 * 1000;

/**
 * Why this is an outcome and not just `string | null`:
 *
 * "The server rejected my refresh token" and "I couldn't reach the server" are completely
 * different situations, and collapsing them into null would log a user out just because
 * their train went into a tunnel. Only `rejected` is allowed to end a session.
 */
export type RefreshOutcome =
  | { ok: true; token: string }
  | { ok: false; reason: 'no_refresh_token' | 'rejected' | 'unreachable' };

/** In-flight refresh, shared by every request that 401s while it runs, so N
 *  concurrent 401s trigger exactly one /auth/refresh call. Without this, the
 *  30s session poll + a screen fetch + a queue flush would each rotate the
 *  refresh token and invalidate each other. */
let refreshPromise: Promise<RefreshOutcome> | null = null;

export const refreshSession = async (): Promise<RefreshOutcome> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      // Logged in on a build that predates refresh tokens — they must sign in once more.
      if (!refreshToken) return { ok: false, reason: 'no_refresh_token' };

      // Bare axios, not apiClient — must not recurse through this interceptor.
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
      );

      const payload = data?.data ?? data;
      const newToken: string | undefined = payload?.token;
      const newRefresh: string | undefined = payload?.refreshToken;
      if (!newToken) return { ok: false, reason: 'rejected' };

      const writes: [string, string][] = [['auth_token', newToken]];
      if (newRefresh) writes.push(['refresh_token', newRefresh]);
      if (payload?.expiresAt) writes.push(['auth_token_expires_at', String(payload.expiresAt)]);
      await AsyncStorage.multiSet(writes);

      onTokenRefreshed?.(newToken);
      return { ok: true, token: newToken };
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;

      // The server actually answered and said no: the refresh token is expired or revoked.
      // This — and only this — is a genuine end of session.
      if (status === 401 || status === 403) return { ok: false, reason: 'rejected' };

      // No response at all (offline, DNS, timeout) or a 5xx. The session may well still be
      // valid; we simply couldn't check. Keep the user logged in and retry later.
      return { ok: false, reason: 'unreachable' };
    } finally {
      // Safe to clear synchronously: everyone who joined this refresh already holds a
      // reference to the promise, so nulling the variable only affects *future* callers,
      // who should get a fresh attempt rather than a stale cached result.
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/** Convenience wrapper for callers that only care whether they got a token. */
export const refreshAccessToken = async (): Promise<string | null> => {
  const outcome = await refreshSession();
  return outcome.ok ? outcome.token : null;
};

/** Refreshes ahead of expiry so background tracking never pings with a dead token.
 *  Call on app start, on foreground, and when a tracking session starts.
 *
 *  The threshold MUST stay well below the server's access-token lifetime (currently 24h,
 *  Jwt:AccessTokenMinutes). If it were >= the lifetime, every token would always look
 *  "about to expire" and we'd rotate the refresh token on every single foreground.
 *
 *  Tracking start passes a much wider window — see TRACKING_TOKEN_THRESHOLD_MS. */
export const ensureFreshToken = async (thresholdMs = 2 * 60 * 60 * 1000): Promise<string | null> => {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) return null;

  const expiresAtRaw = await AsyncStorage.getItem('auth_token_expires_at');
  if (!expiresAtRaw) return token; // pre-refresh-token login; leave it to the 401 path

  const expiresAt = new Date(expiresAtRaw).getTime();
  if (Number.isNaN(expiresAt)) return token;

  if (expiresAt - Date.now() > thresholdMs) return token;

  return (await refreshAccessToken()) ?? token;
};

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap ApiResponse<T> — backend always returns { success, data, message }
    // so callers can access res.data directly as the typed payload
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    const isAuthCall = typeof original?.url === 'string' &&
      (original.url.includes('/auth/login') || original.url.includes('/auth/refresh'));

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;

      // If another request already refreshed while this one was in flight, reuse its
      // token instead of refreshing again — a second refresh would rotate the (already
      // rotated) token and hand us a rejection, logging the user out for no reason.
      const usedToken = String(original.headers?.Authorization ?? '').replace('Bearer ', '');
      const storedToken = await AsyncStorage.getItem('auth_token');

      if (storedToken && storedToken !== usedToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${storedToken}` };
        return apiClient.request(original);
      }

      const outcome = await refreshSession();

      if (outcome.ok) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${outcome.token}` };
        return apiClient.request(original);
      }

      // Couldn't reach the server to find out. Leave the session alone — dropping the
      // user at the login screen over a dead connection is precisely the behaviour we
      // set out to remove. The next successful request will sort it out.
      if (outcome.reason === 'unreachable') {
        return Promise.reject(error);
      }

      // Refresh failed — this is a real session expiry, so log out.
      onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);
