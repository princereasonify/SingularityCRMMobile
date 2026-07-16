import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert, DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Trash2, AlertTriangle, Clock, Sparkles, Bell, Info } from 'lucide-react-native';
import { notificationsApi } from '../../api/notifications';
import { NotificationDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, NOTIFICATION_COLORS } from '../../utils/constants';
import { formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { GradientBackground } from '../../components/common/GradientBackground';

const NotifIcon = ({ type }: { type: string }) => {
  const T = useAppTheme();
  const color = NOTIFICATION_COLORS[type] || T.sub;
  const size = 18;
  switch (type) {
    case 'Urgent': return <AlertTriangle size={size} color={color} />;
    case 'Reminder': return <Clock size={size} color={color} />;
    case 'Success': return <Sparkles size={size} color={color} />;
    case 'Warning': return <AlertTriangle size={size} color={color} />;
    case 'Info': return <Info size={size} color={color} />;
    default: return <Bell size={size} color={color} />;
  }
};

export const NotificationsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { clearBadge, refreshUnreadCount } = useNotifications();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];

  const [notifs, setNotifs] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifs(Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? []);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Clear badge when screen opens, refresh when leaving so bell stays accurate
  useEffect(() => {
    clearBadge();
    return () => { refreshUnreadCount(); };
  }, [clearBadge, refreshUnreadCount]);

  useEffect(() => { fetch(); }, [fetch]);

  // Refresh list when a new FCM notification arrives in foreground
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('new-notification', fetch);
    return () => sub.remove();
  }, [fetch]);

  const markRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const deleteNotif = async (id: number) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const unread = notifs.filter((n) => !n.isRead).length;

  const renderNotif = ({ item }: { item: NotificationDto }) => {
    const color = NOTIFICATION_COLORS[item.type] || T.sub;
    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          { backgroundColor: T.card },
          !item.isRead && { backgroundColor: color + '10', borderLeftWidth: 3, borderLeftColor: color },
        ]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, { backgroundColor: color + '1E' }]}>
          <NotifIcon type={item.type} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, { color: T.text }]} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
          </View>
          <Text style={[styles.notifBody, { color: T.sub }]} numberOfLines={2}>{item.body}</Text>
          <Text style={[styles.notifTime, { color: T.dim }]}>{formatRelativeDate(item.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotif(item.id)}>
          <Trash2 size={14} color={T.dim} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: T.bg }]}>
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread} unread</Text>
              </View>
            )}
          </View>
          {unread > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <Check size={16} color="#FFF" />
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          )}
        </View>
      </GradientBackground>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotif}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }, notifs.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={T.accent} colors={[T.accent]} />}
          ListEmptyComponent={<EmptyState title="No notifications" subtitle="You're all caught up!" icon="🔔" />}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: T.line }]} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  unreadBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  unreadBadgeText: { fontFamily: Fonts.bold, fontSize: rf(11), color: '#FFF' },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  markAllText: { fontFamily: Fonts.medium, fontSize: rf(12), color: '#FFF' },
  list: { paddingVertical: 8 },
  listEmpty: { flex: 1 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: rf(14) },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontFamily: Fonts.regular, fontSize: rf(13), lineHeight: 19, marginBottom: 5 },
  notifTime: { fontFamily: Fonts.regular, fontSize: rf(11) },
  deleteBtn: { padding: 6 },
  separator: { height: StyleSheet.hairlineWidth },
});
