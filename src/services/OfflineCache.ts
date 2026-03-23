/**
 * OfflineCache — caches schools, contacts, route plan, and calendar events
 * in AsyncStorage for offline reading.
 *
 * Data refreshed daily (or on manual pull-to-refresh when online).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  cachedAt: string;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > TTL_MS) return null; // stale
    return entry.data;
  } catch {
    return null;
  }
}

async function clearCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export const OfflineCache = {
  schools: {
    set: (data: any[]) => setCache('@cache_schools', data),
    get: () => getCache<any[]>('@cache_schools'),
    clear: () => clearCache('@cache_schools'),
  },
  contacts: {
    set: (data: any[]) => setCache('@cache_contacts', data),
    get: () => getCache<any[]>('@cache_contacts'),
    clear: () => clearCache('@cache_contacts'),
  },
  routePlan: {
    set: (data: any) => setCache('@cache_route_plan', data),
    get: () => getCache<any>('@cache_route_plan'),
    clear: () => clearCache('@cache_route_plan'),
  },
  calendar: {
    set: (data: any[]) => setCache('@cache_calendar', data),
    get: () => getCache<any[]>('@cache_calendar'),
    clear: () => clearCache('@cache_calendar'),
  },

  clearAll: async () => {
    await Promise.all([
      clearCache('@cache_schools'),
      clearCache('@cache_contacts'),
      clearCache('@cache_route_plan'),
      clearCache('@cache_calendar'),
    ]);
  },
};
