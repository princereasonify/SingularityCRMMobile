/**
 * OfflineQueue — persists actions to AsyncStorage when offline.
 * Queued actions are flushed by SyncManager when connectivity returns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineAction, OfflineActionType } from '../types';

const QUEUE_KEY = '@offline_queue';

let _nextId = Date.now();
const makeId = () => `offline_${_nextId++}`;

export const OfflineQueue = {
  async enqueue(
    type: OfflineActionType,
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH',
    data: any,
  ): Promise<OfflineAction> {
    const action: OfflineAction = {
      id: makeId(),
      type,
      endpoint,
      method,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
    const queue = await this.getAll();
    queue.push(action);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return action;
  },

  async getAll(): Promise<OfflineAction[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async remove(id: string): Promise<void> {
    const queue = await this.getAll();
    const updated = queue.filter(a => a.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  },

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getAll();
    const item = queue.find(a => a.id === id);
    if (item) {
      item.retryCount++;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  async count(): Promise<number> {
    const queue = await this.getAll();
    return queue.length;
  },
};
