import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter, AppState } from 'react-native';
import { notificationsApi } from '../api/notifications';

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => void;
  clearBadge: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshUnreadCount: () => {},
  clearBadge: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
      const count = items.filter((n: any) => !n.isRead).length;
      setUnreadCount(count);
    } catch {
      // silently ignore
    }
  }, []);

  const clearBadge = useCallback(() => setUnreadCount(0), []);

  // Fetch on mount
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Increment immediately on new notification, then sync with server
  const handleNewNotification = useCallback(() => {
    setUnreadCount(prev => prev + 1);
    // Delayed sync to avoid race condition where API hasn't saved yet
    setTimeout(() => { refreshUnreadCount(); }, 2000);
  }, [refreshUnreadCount]);

  // Refresh when new notification arrives via foreground FCM
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('new-notification', handleNewNotification);
    return () => sub.remove();
  }, [handleNewNotification]);

  // Refresh when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refreshUnreadCount();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount, clearBadge }}>
      {children}
    </NotificationContext.Provider>
  );
};
