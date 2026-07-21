/**
 * NetworkMonitor — lightweight connectivity detection.
 * Uses a background fetch to a known endpoint rather than native NetInfo
 * (avoids requiring @react-native-community/netinfo native module).
 *
 * To upgrade to real NetInfo later:
 *   npm install @react-native-community/netinfo
 *   then replace this file with the NetInfo-based version.
 */

import { API_BASE_URL } from '../utils/constants';

type ConnectivityListener = (isOnline: boolean) => void;

/**
 * Connectivity probe URL, derived from whatever API the app is pointed at.
 *
 * This used to be hardcoded to the live host, so when running against a local
 * backend the app reported the health of PRODUCTION — the offline banner could
 * read "online" while the local API was unreachable, and vice versa. Deriving it
 * keeps the probe honest whichever backend is configured.
 *
 * Strip the trailing `/api` to get the origin, then append `/health`.
 *
 * NB this is a CONNECTIVITY check, not an API health check. On the live host
 * `/health` is served by the SPA's catch-all (it returns index.html), and
 * `/api/health` is a 404 — the backend's own `/health` route is not exposed
 * through the proxy. So any HTTP response here proves only that the network and
 * the server are reachable, which is exactly what `isOnline` is meant to mean.
 * Do not tighten this to `res.ok` without first exposing a real API health
 * route publicly, or every live build will show a permanent offline banner.
 */
const healthUrlFor = (apiBase: string) =>
  `${apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '')}/health`;

class NetworkMonitorService {
  private _isOnline = true;
  private _listeners: Set<ConnectivityListener> = new Set();
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  private _checkUrl = healthUrlFor(API_BASE_URL);

  get isOnline() {
    return this._isOnline;
  }

  /** Start polling connectivity every 15 seconds */
  startMonitoring() {
    this._checkConnectivity();
    this._pollInterval = setInterval(() => this._checkConnectivity(), 15_000);
  }

  stopMonitoring() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  subscribe(listener: ConnectivityListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private async _checkConnectivity() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      // GET, not HEAD: the backend maps /health for GET only.
      await fetch(this._checkUrl, { signal: controller.signal });
      clearTimeout(timeout);
      // Any response at all means we reached a server, which is what "online"
      // means here. `fetch` rejects only on a transport failure -> the catch.
      this._notify(true);
    } catch {
      this._notify(false);
    }
  }

  private _notify(online: boolean) {
    if (online === this._isOnline) return;
    this._isOnline = online;
    this._listeners.forEach(l => l(online));
  }
}

export const NetworkMonitor = new NetworkMonitorService();
