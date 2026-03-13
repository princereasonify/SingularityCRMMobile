import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Navigation,
  Clock,
  Check,
  Calendar,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use React Native's built-in Geolocation via navigator.geolocation
const Geolocation = {
  getCurrentPosition: (
    success: (pos: any) => void,
    error: (err: any) => void,
    options?: any,
  ) => navigator.geolocation.getCurrentPosition(success, error, options),
  clearWatch: (id: number) => navigator.geolocation.clearWatch(id),
};
import { trackingApi } from '../../api/tracking';
import {
  SessionResponseDto,
  TrackingSessionDto,
  RoutePointDto,
  AllowanceDto,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ROLE_COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatTime, toISODate } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const COLOR = ROLE_COLORS.FO;
const PING_QUEUE_KEY = 'tracking_ping_queue';
const MIN_MOVEMENT_M = 15; // 15 meter noise filter
const MOVING_INTERVAL_MS = 25000; // 25 seconds when moving
const STATIONARY_INTERVAL_MS = 120000; // 2 minutes when stationary
const SPEED_THRESHOLD_KMH = 3; // Below this = stationary

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const MyDayTrackingScreen = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<TrackingSessionDto | null>(null);
  const [startEnabled, setStartEnabled] = useState(false);
  const [endEnabled, setEndEnabled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedPings, setQueuedPings] = useState(0);

  // GPS tracking refs
  const watchIdRef = useRef<number | null>(null);
  const lastPingRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const isMovingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<any>(null);

  // History
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePointDto[]>([]);
  const [historySession, setHistorySession] = useState<TrackingSessionDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Allowances
  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);

  // Generate last 30 days
  const last30Days = useCallback(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(toISODate(d));
    }
    return days;
  }, []);

  // ─── Network monitoring (using AppState + fetch as lightweight alternative) ──
  useEffect(() => {
    const checkOnline = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch('https://clients3.google.com/generate_204', { signal: controller.signal });
        clearTimeout(timeout);
        setIsOnline(true);
        syncOfflineQueue();
      } catch {
        setIsOnline(false);
      }
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── Offline Queue ──────────────────────────────────────────────────────
  const addToQueue = async (pingData: any) => {
    try {
      const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
      const queue = stored ? JSON.parse(stored) : [];
      queue.push(pingData);
      await AsyncStorage.setItem(PING_QUEUE_KEY, JSON.stringify(queue));
      setQueuedPings(queue.length);
    } catch {}
  };

  const syncOfflineQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
      if (!stored) return;
      const queue = JSON.parse(stored);
      if (queue.length === 0) return;

      await trackingApi.sendBatchPings(queue);
      await AsyncStorage.removeItem(PING_QUEUE_KEY);
      setQueuedPings(0);
    } catch {
      // Will retry on next connectivity change
    }
  };

  // ─── GPS Tracking Engine ────────────────────────────────────────────────
  const sendPing = async (position: any) => {
    const { latitude, longitude, accuracy, speed, altitude } = position.coords;
    const speedKmh = speed != null ? speed * 3.6 : undefined;

    // Client-side noise filter: ignore movements < 15m
    if (lastPingRef.current) {
      const dist = haversineMeters(lastPingRef.current.lat, lastPingRef.current.lon, latitude, longitude);
      if (dist < MIN_MOVEMENT_M) return; // Skip — GPS jitter
    }

    const pingData = {
      latitude,
      longitude,
      accuracyMetres: accuracy,
      speedKmh,
      altitudeMetres: altitude,
      recordedAt: new Date().toISOString(),
      provider: 'GPS',
      isMocked: position.mocked ?? false,
      batteryLevel: undefined as number | undefined,
    };

    lastPingRef.current = { lat: latitude, lon: longitude, time: Date.now() };

    // Adaptive tracking: detect if moving or stationary
    const wasMoving = isMovingRef.current;
    isMovingRef.current = (speedKmh ?? 0) > SPEED_THRESHOLD_KMH;
    if (wasMoving !== isMovingRef.current) {
      restartTracking();
    }

    if (isOnline) {
      try {
        const res = await trackingApi.sendPing(pingData);
        const data = res.data;
        // Update session with latest cumulative data
        if (session && data) {
          setSession(prev => prev ? {
            ...prev,
            totalDistanceKm: data.cumulativeDistanceKm ?? prev.totalDistanceKm,
            allowanceAmount: data.allowanceAmount ?? prev.allowanceAmount,
          } : prev);
        }
      } catch {
        await addToQueue(pingData);
      }
    } else {
      await addToQueue(pingData);
    }
  };

  const startTracking = () => {
    const interval = isMovingRef.current ? MOVING_INTERVAL_MS : STATIONARY_INTERVAL_MS;

    Geolocation.getCurrentPosition(
      pos => {
        lastPositionRef.current = pos;
        sendPing(pos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      Geolocation.getCurrentPosition(
        pos => {
          lastPositionRef.current = pos;
          sendPing(pos);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    }, interval);
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchIdRef.current != null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const restartTracking = () => {
    stopTracking();
    if (session?.status === 'active') startTracking();
  };

  // Auto-start/stop tracking based on session status
  useEffect(() => {
    if (session?.status === 'active') {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [session?.status]);

  // Handle app state changes
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && session?.status === 'active') {
        syncOfflineQueue();
        startTracking();
      }
    });
    return () => sub.remove();
  }, [session?.status]);

  // ─── Data Fetching ──────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const res = await trackingApi.getTodaySession();
      const data = res.data as SessionResponseDto;
      setSession(data.session);
      setStartEnabled(data.buttonState.startDayEnabled);
      setEndEnabled(data.buttonState.endDayEnabled);
    } catch {
      setSession(null);
      setStartEnabled(true);
      setEndEnabled(false);
    }
  }, []);

  const fetchAllowances = useCallback(async () => {
    setAllowancesLoading(true);
    try {
      const now = new Date();
      const from = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = toISODate(now);
      const res = await trackingApi.getAllowances(from, to);
      setAllowances(res.data as AllowanceDto[]);
    } catch {
      setAllowances([]);
    } finally {
      setAllowancesLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchSession(), fetchAllowances()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchSession, fetchAllowances]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const handleStartDay = async () => {
    setActionLoading(true);
    try {
      const res = await trackingApi.startDay();
      const data = res.data as SessionResponseDto;
      setSession(data.session);
      setStartEnabled(data.buttonState.startDayEnabled);
      setEndEnabled(data.buttonState.endDayEnabled);
    } catch {
      Alert.alert('Error', 'Failed to start day. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndDay = () => {
    Alert.alert('End Day', 'Are you sure? This will stop tracking and calculate your allowance.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Day', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            // Sync any queued pings before ending
            await syncOfflineQueue();
            const res = await trackingApi.endDay();
            const data = res.data as SessionResponseDto;
            setSession(data.session);
            setStartEnabled(data.buttonState.startDayEnabled);
            setEndEnabled(data.buttonState.endDayEnabled);
          } catch {
            Alert.alert('Error', 'Failed to end day. Please try again.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDateSelect = async (date: string) => {
    if (!user) return;
    setSelectedDate(date);
    setHistoryLoading(true);
    try {
      const res = await trackingApi.getRoute(user.id, date);
      const data = res.data as { session: TrackingSessionDto; points: RoutePointDto[] };
      setHistorySession(data.session);
      setRoutePoints(data.points);
    } catch {
      setHistorySession(null);
      setRoutePoints([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getSessionDuration = (s: TrackingSessionDto): string => {
    if (!s.startedAt) return '--';
    const start = new Date(s.startedAt);
    const end = s.endedAt ? new Date(s.endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'active': return '#22C55E';
      case 'ended': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getStatusLabel = (status?: string): string => {
    switch (status) {
      case 'active': return 'Active';
      case 'ended': return 'Day Ended';
      default: return 'Not Started';
    }
  };

  const formatDateLabel = (dateStr: string): string => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (toISODate(d) === toISODate(today)) return 'Today';
    if (toISODate(d) === toISODate(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} message="Loading tracking..." />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My Day Tracking" subtitle={user?.zone || 'Field Officer'} color={COLOR.primary} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLOR.primary]} />}
      >
        {/* ─── Connectivity + Queue Status ─────────────────────────────────── */}
        {(!isOnline || queuedPings > 0) && (
          <View style={[styles.statusBanner, !isOnline ? styles.offlineBanner : styles.queueBanner]}>
            {!isOnline ? <WifiOff size={14} color="#DC2626" /> : <Wifi size={14} color="#F59E0B" />}
            <Text style={[styles.statusBannerText, !isOnline ? { color: '#DC2626' } : { color: '#92400E' }]}>
              {!isOnline ? 'Offline — pings are queued locally' : `${queuedPings} queued pings syncing...`}
            </Text>
          </View>
        )}

        {/* ─── My Day Section ─────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>My Day</Text>

          <View style={styles.buttonRow}>
            <Button title="Start My Day" onPress={handleStartDay} color="#22C55E"
              disabled={!startEnabled || actionLoading} loading={actionLoading && startEnabled}
              size="lg" style={styles.actionButton} />
            <Button title="End Day" onPress={handleEndDay} variant="danger"
              disabled={!endEnabled || actionLoading} loading={actionLoading && endEnabled}
              size="lg" style={styles.actionButton} />
          </View>

          {session?.status === 'ended' && (
            <View style={styles.endedBanner}>
              <Check size={16} color="#22C55E" />
              <Text style={styles.endedText}>Day completed! Great work today.</Text>
            </View>
          )}

          {/* Fraud Warning */}
          {session?.isSuspicious && (
            <View style={styles.fraudBanner}>
              <AlertTriangle size={16} color="#DC2626" />
              <Text style={styles.fraudText}>Session flagged — fraud score: {session.fraudScore}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Navigation size={18} color={COLOR.primary} />
              <Text style={styles.statValue}>{session?.totalDistanceKm?.toFixed(1) ?? '0.0'} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCurrency}>{formatCurrency(session?.allowanceAmount ?? 0)}</Text>
              <Text style={styles.statLabel}>Allowance</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(session?.status) }]} />
              <Badge label={getStatusLabel(session?.status)} color={getStatusColor(session?.status)} />
            </View>
            <View style={styles.statCard}>
              <Clock size={18} color="#6B7280" />
              <Text style={styles.statValue}>{session ? getSessionDuration(session) : '--'}</Text>
              <Text style={styles.statLabel}>Session Time</Text>
            </View>
          </View>

          {/* Distance Breakdown (shown after day ends) */}
          {session?.status === 'ended' && session.rawDistanceKm != null && (
            <View style={styles.distanceBreakdown}>
              <Text style={styles.breakdownTitle}>Distance Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Raw GPS</Text>
                <Text style={styles.breakdownValue}>{session.rawDistanceKm?.toFixed(2)} km</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>After Noise Filter</Text>
                <Text style={styles.breakdownValue}>{session.filteredDistanceKm?.toFixed(2)} km</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Reconstructed Path</Text>
                <Text style={[styles.breakdownValue, { fontWeight: '700' }]}>
                  {session.reconstructedDistanceKm?.toFixed(2)} km
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* ─── Tracking History Section ────────────────────────────────────── */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={18} color={COLOR.primary} />
            <Text style={styles.sectionTitle}>Tracking History</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroller}>
            {last30Days().map((date) => (
              <TouchableOpacity key={date}
                style={[styles.dateChip, selectedDate === date && { backgroundColor: COLOR.primary }]}
                onPress={() => handleDateSelect(date)}>
                <Text style={[styles.dateChipText, selectedDate === date && { color: '#FFF' }]}>
                  {formatDateLabel(date)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {historyLoading ? (
            <LoadingSpinner color={COLOR.primary} message="Loading route..." />
          ) : selectedDate && historySession ? (
            <View style={styles.historySummary}>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Distance</Text>
                <Text style={styles.historyValue}>{historySession.totalDistanceKm?.toFixed(1)} km</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Allowance</Text>
                <Text style={styles.historyValue}>{formatCurrency(historySession.allowanceAmount)}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Start Time</Text>
                <Text style={styles.historyValue}>{formatTime(historySession.startedAt)}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>End Time</Text>
                <Text style={styles.historyValue}>{historySession.endedAt ? formatTime(historySession.endedAt) : '--'}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Duration</Text>
                <Text style={styles.historyValue}>{getSessionDuration(historySession)}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Ping Count</Text>
                <Text style={styles.historyValue}>{historySession.pingCount ?? 0}</Text>
              </View>
              {historySession.fraudScore != null && historySession.fraudScore > 0 && (
                <View style={styles.historyRow}>
                  <Text style={styles.historyLabel}>Fraud Score</Text>
                  <Text style={[styles.historyValue, historySession.isSuspicious ? { color: '#DC2626' } : {}]}>
                    {historySession.fraudScore}/100
                  </Text>
                </View>
              )}
            </View>
          ) : selectedDate ? (
            <EmptyState title="No tracking data" subtitle="No route data available for this date." icon="📍" />
          ) : (
            <View style={styles.selectDateHint}>
              <MapPin size={20} color="#9CA3AF" />
              <Text style={styles.hintText}>Select a date to view route history</Text>
            </View>
          )}
        </Card>

        {/* ─── Allowances Section ──────────────────────────────────────────── */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>This Month's Allowances</Text>

          {allowancesLoading ? (
            <LoadingSpinner color={COLOR.primary} />
          ) : allowances.length === 0 ? (
            <EmptyState title="No allowances" subtitle="No allowance records for this month." icon="💰" />
          ) : (
            allowances.map((a) => (
              <View key={a.id} style={styles.allowanceRow}>
                <View style={styles.allowanceInfo}>
                  <Text style={styles.allowanceDate}>{formatDate(a.allowanceDate)}</Text>
                  <Text style={styles.allowanceMeta}>{a.distanceKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.allowanceRight}>
                  <Text style={styles.allowanceAmount}>{formatCurrency(a.grossAmount)}</Text>
                  <Badge
                    label={a.approved ? 'Approved' : 'Pending'}
                    color={a.approved ? '#22C55E' : '#F59E0B'}
                  />
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 12 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionButton: { flex: 1 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, padding: 10, marginBottom: 4,
  },
  offlineBanner: { backgroundColor: '#FEF2F2' },
  queueBanner: { backgroundColor: '#FFFBEB' },
  statusBannerText: { fontSize: rf(12), fontWeight: '600' },
  endedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 8, padding: 12, marginBottom: 16,
  },
  endedText: { fontSize: rf(13), fontWeight: '600', color: '#22C55E' },
  fraudBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16,
  },
  fraudText: { fontSize: rf(13), fontWeight: '600', color: '#DC2626' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#F9FAFB',
    borderRadius: 12, padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  statCurrency: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  distanceBreakdown: {
    marginTop: 16, backgroundColor: '#F0F9FF', borderRadius: 12, padding: 14,
  },
  breakdownTitle: { fontSize: rf(13), fontWeight: '700', color: '#0369A1', marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: { fontSize: rf(12), color: '#6B7280' },
  breakdownValue: { fontSize: rf(12), fontWeight: '600', color: '#111827' },
  dateScroller: { gap: 8, paddingVertical: 8 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  dateChipText: { fontSize: rf(12), fontWeight: '600', color: '#374151' },
  historySummary: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  historyLabel: { fontSize: rf(13), color: '#6B7280', fontWeight: '500' },
  historyValue: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  selectDateHint: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  hintText: { fontSize: rf(13), color: '#9CA3AF' },
  allowanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  allowanceInfo: { flex: 1 },
  allowanceDate: { fontSize: rf(13), fontWeight: '600', color: '#111827' },
  allowanceMeta: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  allowanceRight: { alignItems: 'flex-end', gap: 4 },
  allowanceAmount: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
});
