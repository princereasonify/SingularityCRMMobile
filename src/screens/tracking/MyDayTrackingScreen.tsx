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
  Platform,
  PermissionsAndroid,
  Linking,
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
import Geolocation from '@react-native-community/geolocation';
import BackgroundService from '../../services/backgroundServiceShim';
import BackgroundFetch from 'react-native-background-fetch';
import { trackingApi } from '../../api/tracking';
import { sendLocationPing } from '../../services/locationPingService';
import { startNativeTracking, stopNativeTracking, requestIOSLocationPermission, checkIOSPermission } from '../../services/nativeLocationTracking';
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
import { formatCurrency, formatDate, formatTime, toISODate, toISTISOString } from '../../utils/formatting';
import { rf } from '../../utils/responsive';


const COLOR = ROLE_COLORS.FO;
const PING_QUEUE_KEY = 'tracking_ping_queue';
const PING_INTERVAL_MS = 30000; // 30 seconds

// ─── Module-level background task (app alive: foreground + background) ────────
// BackgroundService is no longer used for active tracking (native modules handle both platforms).
// Kept imported via shim for the headless-task infrastructure on Android.

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

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePointDto[]>([]);
  const [historySession, setHistorySession] = useState<TrackingSessionDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);

  const [locationGranted, setLocationGranted] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);

  // iOS: JS-level ping interval ref (Android uses native Kotlin service instead)
  const iosPingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Permission Handling ─────────────────────────────────────────────────

  // Request notification permission on mount (Android 13+ / API 33+)
  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(granted => {
        if (!granted) {
          PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
            title: 'Allow Notifications',
            message: 'SingularityCRM needs notification permission to show location tracking status while the app is in the background.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          });
        }
      });
    }
  }, []);

  const showPermissionDeniedAlert = () => {
    Alert.alert(
      'Location Permission Required',
      'Location access is required for tracking. Please enable it in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Platform.OS === 'android' ? Linking.openSettings() : Linking.openURL('app-settings:'),
        },
      ],
    );
  };

  const showLocationDisabledAlert = () => {
    Alert.alert(
      'Location Services Disabled',
      'Please turn on Location Services in your device settings to use tracking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Platform.OS === 'android' ? Linking.openSettings() : Linking.openURL('app-settings:'),
        },
      ],
    );
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        // Step 1: Fine location
        const fineStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (!fineStatus) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission Required',
              message: 'SingularityCRM needs location access to track your daily travel and calculate travel allowance.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'Allow',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setLocationGranted(false);
            showPermissionDeniedAlert();
            return false;
          }
        }

        // Step 2: Background location (Android 10+)
        if (Platform.Version >= 29) {
          const bgStatus = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          if (!bgStatus) {
            Alert.alert(
              'Background Location Needed',
              'To track your location when the app is in background, please select "Allow all the time" on the next screen.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => {} },
                {
                  text: 'Continue',
                  onPress: async () => {
                    await PermissionsAndroid.request(
                      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                    );
                  },
                },
              ],
            );
          }
        }

        setLocationGranted(true);
        return true;
      } catch {
        setLocationGranted(false);
        return false;
      }
    } else {
      // iOS — use the native Swift module for permission.
      // Skip the native call entirely if already granted (avoids re-prompting).
      if (locationGranted) return true;

      const status = await requestIOSLocationPermission();

      if (status === 'granted' || status === 'whenInUse') {
        setLocationGranted(true);
        if (status === 'whenInUse') {
          // Inform user that "Always Allow" gives better background tracking
          Alert.alert(
            'Better Tracking Available',
            'For tracking to work in the background, please select "Always" in location settings.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
            ],
          );
        }
        return true;
      } else if (status === 'restricted') {
        setLocationGranted(false);
        Alert.alert(
          'Location Restricted',
          'Location access is restricted on this device (e.g. parental controls). Tracking cannot be enabled.',
          [{ text: 'OK' }],
        );
        return false;
      } else {
        // denied
        setLocationGranted(false);
        showPermissionDeniedAlert();
        return false;
      }
    }
  };

  // Restore queued ping count from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(PING_QUEUE_KEY).then(stored => {
      if (!stored) return;
      try {
        const q = JSON.parse(stored);
        if (Array.isArray(q) && q.length > 0) setQueuedPings(q.length);
      } catch {}
    }).catch(() => {});
  }, []);

  // Configure geolocation on mount — must be inside component so errors don't crash at module level
  useEffect(() => {
    try {
      Geolocation.setRNConfiguration({
        skipPermissionRequests: false,
        authorizationLevel: 'always',
        enableBackgroundLocationUpdates: false,
        ...(Platform.OS === 'android' ? { locationProvider: 'auto' } : {}),
      });
    } catch (e) {
      console.warn('[Tracking] Geolocation config failed:', e);
    }
  }, []);

  // Check permission on mount + when app returns to foreground
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          setLocationGranted(granted);
          setLocationChecked(true);
          if (!granted) await requestLocationPermission();
        } else {
          // iOS: use native module to check status — no dialog, no Geolocation call.
          // Geolocation.getCurrentPosition() is unreliable for status checks with
          // New Architecture (callbacks may drop silently).
          const status = await checkIOSPermission();
          const isGranted = status === 'granted' || status === 'whenInUse';
          setLocationGranted(isGranted);
          setLocationChecked(true);
        }
      } catch {
        setLocationGranted(false);
        setLocationChecked(true);
      }
    };
    checkPermission().catch(() => {
      setLocationGranted(false);
      setLocationChecked(true);
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (Platform.OS === 'android') {
          PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
            .then(granted => setLocationGranted(granted))
            .catch(() => {});
        } else {
          // Re-check iOS permission when returning to foreground (user may have
          // changed it in Settings while the app was backgrounded)
          checkIOSPermission()
            .then(status => setLocationGranted(status === 'granted' || status === 'whenInUse'))
            .catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Network monitoring ──────────────────────────────────────────────────
  const syncOfflineQueue = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
      if (!stored) return;
      let queue: any[];
      try { queue = JSON.parse(stored); if (!Array.isArray(queue)) queue = []; } catch { return; }
      if (queue.length === 0) return;

      // Drop pings older than 24 hours — server will reject stale session data anyway
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      queue = queue.filter((p: any) => !p.recordedAt || new Date(p.recordedAt).getTime() > cutoff);
      if (queue.length === 0) {
        await AsyncStorage.removeItem(PING_QUEUE_KEY);
        setQueuedPings(0);
        return;
      }

      try {
        await trackingApi.sendBatchPings(queue);
        await AsyncStorage.removeItem(PING_QUEUE_KEY);
        setQueuedPings(0);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status && status >= 400) {
          // 4xx — server rejected (session ended, auth error, etc.)
          // 5xx — server crashed (unhandled exception on batch endpoint)
          // Either way, clear the queue — retrying won't help
          await AsyncStorage.removeItem(PING_QUEUE_KEY);
          setQueuedPings(0);
        }
        // Network error (no response / status undefined) — keep in queue and retry on next cycle
      }
    } catch {
      // AsyncStorage read error — ignore
    }
  }, []);

  useEffect(() => {
    const checkOnline = async () => {
      try {
        // Use the app's own API as the connectivity probe — no external calls
        await trackingApi.getTodaySession();
        setIsOnline(true);
        syncOfflineQueue();
      } catch (err: any) {
        // Network error (no internet) vs server error (we're online but API failed)
        const isNetworkError = !err?.response;
        setIsOnline(!isNetworkError);
        if (!isNetworkError) syncOfflineQueue();
      }
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, [syncOfflineQueue]);

  // ─── Offline Queue ───────────────────────────────────────────────────────

  // ─── GPS Tracking Engine ─────────────────────────────────────────────────
  // Strategy: always use BackgroundService (Android Foreground Service).
  // It works in foreground AND background — no switching logic needed.
  // The background task owns watchPosition + 30s send interval internally.

  const startTracking = useCallback(async () => {
    if (Platform.OS === 'android') {
      // ── Android ──────────────────────────────────────────────────────────
      // Native Kotlin foreground service — runs independently of JS thread,
      // survives app kill via START_STICKY, sends 30 s pings natively.
      await startNativeTracking();

      // WorkManager fallback: fires every 15 min even after kill (OS minimum)
      try {
        BackgroundFetch.configure(
          { minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: true, requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY },
          async (taskId) => { await sendLocationPing(); BackgroundFetch.finish(taskId); },
          (taskId) => { BackgroundFetch.finish(taskId); },
        ).then(status => console.log('[BackgroundFetch] Android status:', status))
          .catch(e => console.warn('[BackgroundFetch] Android error:', e));
      } catch (e) { console.warn('[BackgroundFetch] Android threw:', e); }

    } else {
      // ── iOS ──────────────────────────────────────────────────────────────
      // JS setInterval drives the 30 s pings — proven working (same mechanism
      // as the session-polling timer that fires every 30 s).
      // sendLocationPing() gets location via Geolocation + sends fetch() to server.
      // App stays alive in background because UIBackgroundModes:location is set
      // in Info.plist and CLLocationManager is active inside the native module.
      if (!iosPingRef.current) {
        console.log('[iOS Tracking] Starting 30 s ping interval');
        sendLocationPing(); // immediate first ping
        iosPingRef.current = setInterval(() => {
          console.log('[iOS Tracking] Interval fired — sending ping');
          sendLocationPing();
        }, PING_INTERVAL_MS);
      }

      // Native module: starts CLLocationManager so iOS keeps the app alive
      // in background. Pings come from JS above; native only provides keepalive.
      startNativeTracking().catch(e =>
        console.warn('[iOS Tracking] Native module unavailable (OK):', e?.message),
      );

      // BGAppRefresh fallback for periodic background wakeup
      try {
        BackgroundFetch.configure(
          { minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: false, requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY },
          async (taskId) => { await sendLocationPing(); BackgroundFetch.finish(taskId); },
          (taskId) => { BackgroundFetch.finish(taskId); },
        ).then(status => console.log('[BackgroundFetch] iOS status:', status))
          .catch(e => console.warn('[BackgroundFetch] iOS error:', e));
      } catch (e) { console.warn('[BackgroundFetch] iOS threw:', e); }
    }
  }, []);

  const stopTracking = useCallback(async () => {
    if (Platform.OS === 'android') {
      // Android: stop the native Kotlin service
      await stopNativeTracking();
    } else {
      // iOS: clear JS ping interval
      if (iosPingRef.current) {
        clearInterval(iosPingRef.current);
        iosPingRef.current = null;
        console.log('[iOS Tracking] Ping interval cleared');
      }
      // Also stop the native location manager (keepalive)
      stopNativeTracking().catch(() => {});
    }
    try { BackgroundFetch.stop(); } catch {}
  }, []);

  // Start when session active, stop when session ends or permission revoked.
  // NO cleanup return — cleanup would call stopTracking() when app is killed,
  // which sends an explicit stopService() and prevents START_STICKY from restarting.
  useEffect(() => {
    console.log('[Tracking] session:', session?.status, '| locationGranted:', locationGranted);
    if (session?.status === 'active' && locationGranted) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [session?.status, locationGranted, startTracking, stopTracking]);

  // Sync queue when coming to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && session?.status === 'active') {
        syncOfflineQueue();
      }
    });
    return () => sub.remove();
  }, [session?.status, syncOfflineQueue]);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    try {
      const res = await trackingApi.getTodaySession();
      const data = res.data as SessionResponseDto;
      const s = data?.session ?? null;
      setSession(s);
      // Always derive button state from session status — not server buttonState,
      // so users can start/end multiple times in a day.
      const isActive = s?.status === 'active';
      setStartEnabled(!isActive);
      setEndEnabled(isActive);
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
      const inner = res.data as any;
      setAllowances(inner?.allowances ?? inner?.items ?? (Array.isArray(inner) ? inner : []));
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

  useEffect(() => { fetchAll().catch(() => {}); }, [fetchAll]);

  const onRefresh = () => { setRefreshing(true); fetchAll().catch(() => {}); };

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleStartDay = async () => {
    if (actionLoading) return; // guard against double tap
    setActionLoading(true);

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) { setActionLoading(false); return; }

    // Verify GPS is accessible (low accuracy / allow cache — fast on all platforms)
    const locationAvailable = await new Promise<boolean>(resolve => {
      Geolocation.getCurrentPosition(
        () => resolve(true),
        (err) => {
          if (err.code === 2) { showLocationDisabledAlert(); resolve(false); }
          else resolve(true); // timeout or other — permission is OK, proceed
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
      );
    });
    if (!locationAvailable) { setActionLoading(false); return; }
    try {
      const res = await trackingApi.startDay();
      const data = res.data as SessionResponseDto;
      setSession(data?.session ?? null);
      setStartEnabled(false);
      setEndEnabled(true);
    } catch (err: any) {
      const serverMsg: string = err?.response?.data?.message ?? '';
      if (err?.response?.status === 400 && serverMsg.toLowerCase().includes('already')) {
        // Server doesn't support multiple sessions per day yet —
        // refresh state silently so UI stays consistent
        await fetchSession();
      } else {
        Alert.alert('Error', serverMsg || 'Failed to start day. Please try again.');
      }
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
            await stopTracking();
            await syncOfflineQueue();
            const res = await trackingApi.endDay();
            const data = res.data as SessionResponseDto;
            setSession(data?.session ?? null);
            // Allow starting again immediately after ending
            setStartEnabled(true);
            setEndEnabled(false);
            // Clear any remaining queued pings — session is now closed
            await AsyncStorage.removeItem(PING_QUEUE_KEY);
            setQueuedPings(0);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to end day. Please try again.');
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
      const data = res.data as any;
      setHistorySession(data?.session ?? null);
      setRoutePoints(data?.route ?? []);
    } catch {
      setHistorySession(null);
      setRoutePoints([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

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
        {/* Location permission warning */}
        {locationChecked && !locationGranted && (
          <TouchableOpacity
            style={styles.locationBanner}
            onPress={requestLocationPermission}
            activeOpacity={0.7}
          >
            <MapPin size={16} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationBannerTitle}>Location Access Required</Text>
              <Text style={styles.locationBannerSubtitle}>Tap here to enable location for tracking</Text>
            </View>
            <Text style={styles.locationBannerAction}>Enable</Text>
          </TouchableOpacity>
        )}

        {/* Connectivity + Queue Status */}
        {(!isOnline || queuedPings > 0) && (
          <View style={[styles.statusBanner, !isOnline ? styles.offlineBanner : styles.queueBanner]}>
            {!isOnline ? <WifiOff size={14} color="#DC2626" /> : <Wifi size={14} color="#F59E0B" />}
            <Text style={[styles.statusBannerText, !isOnline ? { color: '#DC2626' } : { color: '#92400E' }]}>
              {!isOnline ? 'Offline — pings are queued locally' : `${queuedPings} queued pings syncing...`}
            </Text>
          </View>
        )}

        {/* My Day */}
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
              <Text style={styles.endedText}>Session ended. You can start again anytime.</Text>
            </View>
          )}

          {session?.isSuspicious && (
            <View style={styles.fraudBanner}>
              <AlertTriangle size={16} color="#DC2626" />
              <Text style={styles.fraudText}>Session flagged — fraud score: {session.fraudScore}</Text>
            </View>
          )}

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

        {/* Tracking History */}
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
              {(historySession.fraudScore ?? 0) > 0 && (
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

        {/* Allowances */}
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
                  <Badge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? '#22C55E' : '#F59E0B'} />
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
  locationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 4,
  },
  locationBannerTitle: { fontSize: rf(13), fontWeight: '700', color: '#DC2626' },
  locationBannerSubtitle: { fontSize: rf(11), color: '#991B1B', marginTop: 2 },
  locationBannerAction: {
    fontSize: rf(12), fontWeight: '700', color: '#DC2626',
    backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
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
  distanceBreakdown: { marginTop: 16, backgroundColor: '#F0F9FF', borderRadius: 12, padding: 14 },
  breakdownTitle: { fontSize: rf(13), fontWeight: '700', color: '#0369A1', marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
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
