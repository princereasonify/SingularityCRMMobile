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

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';

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

  /**
   * DELETE /notifications/{id} does NOT delete — NotificationsController calls
   * MarkAsReadAsync and returns "Notification dismissed". Filtering the row out
   * made it reappear on the next refresh, so this dismisses (marks read) instead,
   * which is what the server actually does.
   */
  const dismissNotif = async (id: number) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
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
          !item.isRead && { backgroundColor: withAlpha(color, 0.06), borderLeftWidth: 3, borderLeftColor: color },
        ]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, 0.12) }]}>
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
        <TouchableOpacity style={styles.deleteBtn} onPress={() => dismissNotif(item.id)}>
          <Trash2 size={14} color={T.dim} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: T.bg }]}>
      {/* Plain themed header on T.bg — every page shares one header treatment.
          This is a Stack screen (reached from the topbar bell), so it keeps its
          own back affordance and title. */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.line }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.line }]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>Notifications</Text>
            {unread > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
                <Text style={[styles.unreadBadgeText, { color: T.accent }]}>{unread} unread</Text>
              </View>
            )}
          </View>
          {unread > 0 && (
            <TouchableOpacity
              style={[styles.markAllBtn, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}
              onPress={markAllRead}
            >
              <Check size={15} color={T.accent} />
              <Text style={[styles.markAllText, { color: T.accent }]}>Mark all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 40/r12 bordered face — same back affordance as the other stack screens.
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  // flexShrink:1 — RN defaults to 0, so an unconstrained title paints over the badge.
  headerTitle: { fontWeight: '700', fontSize: rf(20), letterSpacing: -0.3, flexShrink: 1 },
  unreadBadge: {
    borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0,
  },
  unreadBadgeText: { fontWeight: '700', fontSize: rf(11) },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  markAllText: { fontWeight: '600', fontSize: rf(12) },
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
  notifTitle: { flex: 1, fontWeight: '700', fontSize: rf(14) },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontWeight: '400', fontSize: rf(13), lineHeight: 19, marginBottom: 5 },
  notifTime: { fontWeight: '400', fontSize: rf(11) },
  deleteBtn: { padding: 6 },
  separator: { height: StyleSheet.hairlineWidth },
});
