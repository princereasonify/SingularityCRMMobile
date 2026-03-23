/**
 * SyncManager — flushes the OfflineQueue FIFO when connectivity returns.
 * Call `SyncManager.flush()` from the OfflineContext whenever isOnline turns true.
 */

import { OfflineQueue } from './OfflineQueue';
import { apiClient } from '../api/client';

export interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

export const SyncManager = {
  _isSyncing: false,

  async flush(): Promise<SyncResult> {
    if (this._isSyncing) return { synced: 0, failed: 0, total: 0 };
    this._isSyncing = true;

    let synced = 0;
    let failed = 0;

    try {
      const queue = await OfflineQueue.getAll();
      const total = queue.length;

      // Sort by timestamp — FIFO
      queue.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      for (const action of queue) {
        // Skip items that have failed too many times
        if (action.retryCount >= 3) {
          await OfflineQueue.remove(action.id);
          failed++;
          continue;
        }

        try {
          if (action.method === 'POST') {
            await apiClient.post(action.endpoint, action.data);
          } else if (action.method === 'PUT') {
            await apiClient.put(action.endpoint, action.data);
          } else {
            await (apiClient as any).patch(action.endpoint, action.data);
          }
          await OfflineQueue.remove(action.id);
          synced++;
        } catch {
          await OfflineQueue.incrementRetry(action.id);
          failed++;
        }
      }

      return { synced, failed, total };
    } finally {
      this._isSyncing = false;
    }
  },
};
