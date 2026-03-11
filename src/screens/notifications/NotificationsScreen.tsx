import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Trash2, AlertTriangle, Clock, Sparkles, Bell, Info } from 'lucide-react-native';
import { notificationsApi } from '../../api/notifications';
import { NotificationDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, NOTIFICATION_COLORS } from '../../utils/constants';
import { formatRelativeDate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const NotifIcon = ({ type }: { type: string }) => {
  const color = NOTIFICATION_COLORS[type] || '#6B7280';
  const size = 18;
  switch (type) {
    case 'Urgent': return <AlertTriangle size={size} color={color} />;
    case 'Reminder': return <Clock size={size} color={color} />;
    case 'Success': return <Sparkles size={size} color={color} />;
    case 'Warning': return <AlertTriangle size={size} color={color} />;
    default: return <Bell size={size} color={color} />;
  }
};

export const NotificationsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];

  const [notifs, setNotifs] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setNotifs(res.data);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
    const color = NOTIFICATION_COLORS[item.type] || '#6B7280';
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && { backgroundColor: color + '08', borderLeftWidth: 3, borderLeftColor: color }]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <NotifIcon type={item.type} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle} numberOfLines={1}>{item.title}</Text>
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{formatRelativeDate(item.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteNotif(item.id)}>
          <Trash2 size={14} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
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
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotif}
          contentContainerStyle={[styles.list, notifs.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} colors={[COLOR.primary]} />}
          ListEmptyComponent={<EmptyState title="No notifications" subtitle="You're all caught up!" icon="🔔" />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: rf(20), fontWeight: '700', color: '#FFF' },
  unreadBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: rf(11), color: '#FFF', fontWeight: '700' },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  markAllText: { fontSize: rf(12), color: '#FFF', fontWeight: '600' },
  list: { paddingVertical: 8, backgroundColor: '#F9FAFB' },
  listEmpty: { flex: 1 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { flex: 1, fontSize: rf(14), fontWeight: '700', color: '#111827' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: rf(13), color: '#374151', lineHeight: 19, marginBottom: 5 },
  notifTime: { fontSize: rf(11), color: '#9CA3AF' },
  deleteBtn: { padding: 6 },
  separator: { height: 1, backgroundColor: '#F3F4F6' },
});
