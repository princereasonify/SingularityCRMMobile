import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { NetworkMonitor } from '../services/NetworkMonitor';
import { SyncManager, SyncResult } from '../services/SyncManager';
import { OfflineQueue } from '../services/OfflineQueue';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncManually: () => Promise<SyncResult | null>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncManually: async () => null,
});

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await OfflineQueue.count();
    setPendingCount(count);
  }, []);

  const doSync = useCallback(async (): Promise<SyncResult | null> => {
    if (!isOnline || isSyncing) return null;
    setIsSyncing(true);
    try {
      const result = await SyncManager.flush();
      await refreshPendingCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPendingCount]);

  useEffect(() => {
    NetworkMonitor.startMonitoring();
    refreshPendingCount();

    const unsubscribe = NetworkMonitor.subscribe(async (online) => {
      setIsOnline(online);
      if (online) {
        const result = await doSync();
        if (result && result.synced > 0) {
          Alert.alert(
            'Sync Complete',
            `${result.synced} item${result.synced !== 1 ? 's' : ''} synced successfully.`,
          );
        }
      }
    });

    return () => {
      unsubscribe();
      NetworkMonitor.stopMonitoring();
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, syncManually: doSync }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => useContext(OfflineContext);
