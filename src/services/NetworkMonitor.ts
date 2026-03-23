/**
 * NetworkMonitor — lightweight connectivity detection.
 * Uses a background fetch to a known endpoint rather than native NetInfo
 * (avoids requiring @react-native-community/netinfo native module).
 *
 * To upgrade to real NetInfo later:
 *   npm install @react-native-community/netinfo
 *   then replace this file with the NetInfo-based version.
 */

type ConnectivityListener = (isOnline: boolean) => void;

class NetworkMonitorService {
  private _isOnline = true;
  private _listeners: Set<ConnectivityListener> = new Set();
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  private _checkUrl = 'https://singularity-learn.com/sales-crm/api/health';

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
      await fetch(this._checkUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
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
