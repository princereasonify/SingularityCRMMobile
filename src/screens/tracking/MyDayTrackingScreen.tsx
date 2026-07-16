import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  PermissionsAndroid,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import {
  MapPin,
  Navigation,
  Clock,
  Check,
  Calendar,
  AlertTriangle,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Wallet,
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
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Card, StatTile, SectionLabel, Badge } from '../../components/ui';
import { formatCurrency, formatDate, formatTime, toISODate, toISTISOString } from '../../utils/formatting';
import { rf, isTabletDevice, getCardWidth } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { BackgroundLocationDisclosure } from '../../components/common/BackgroundLocationDisclosure';
import { DateInput } from '../../components/common/DateInput';


const PING_QUEUE_KEY = 'tracking_ping_queue';
const PING_INTERVAL_MS = 30000; // 30 seconds

// ─── Module-level background task (app alive: foreground + background) ────────
// BackgroundService is no longer used for active tracking (native modules handle both platforms).
// Kept imported via shim for the headless-task infrastructure on Android.

export const MyDayTrackingScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<TrackingSessionDto | null>(null);
  const [startEnabled, setStartEnabled] = useState(false);
  const [endEnabled, setEndEnabled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedPings, setQueuedPings] = useState(0);

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [routePoints, setRoutePoints] = useState<RoutePointDto[]>([]);
  const [historySession, setHistorySession] = useState<TrackingSessionDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);

  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain' | 'hybrid'>('standard');
  const [routePointsExpanded, setRoutePointsExpanded] = useState(false);

  const [locationGranted, setLocationGranted] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [showBgDisclosure, setShowBgDisclosure] = useState(false);
  const bgPermissionResolveRef = React.useRef<((accepted: boolean) => void) | null>(null);

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
        // Google Play REQUIRES a Prominent Disclosure dialog BEFORE requesting
        // ACCESS_BACKGROUND_LOCATION. A simple Alert.alert() does NOT comply.
        if (Platform.Version >= 29) {
          const bgStatus = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          );
          if (!bgStatus) {
            // Show the full-screen Prominent Disclosure and wait for user's choice
            const accepted = await new Promise<boolean>((resolve) => {
              bgPermissionResolveRef.current = resolve;
              setShowBgDisclosure(true);
            });
            if (accepted) {
              await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
              );
            }
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

        // 403 — no active session: these pings will never be accepted, so let them go.
        // 401 — the interceptor already tried to refresh and failed; the user is being
        //   logged out, and the queue is cleared with the rest of the session.
        // Everything else (5xx, timeouts, no response) is transient: KEEP the queue.
        //   The old code discarded on any status >= 400, which silently destroyed a
        //   day's worth of route data whenever the token expired or the server hiccuped.
        if (status === 403) {
          await AsyncStorage.removeItem(PING_QUEUE_KEY);
          setQueuedPings(0);
        } else {
          setQueuedPings(queue.length);
        }
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

  useEffect(() => {
    fetchAll().catch(() => {}).finally(() => {
      handleDateSelect(toISODate(new Date())).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const pts: RoutePointDto[] = data?.route ?? [];
      setRoutePoints(pts);
      // Auto-fit map to route bounds
      const validPts = pts.filter((p: RoutePointDto) => p.lat && p.lon && !p.isFiltered);
      if (validPts.length > 1) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            validPts.map((p: RoutePointDto) => ({ latitude: p.lat, longitude: p.lon })),
            { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
          );
        }, 400);
      }
    } catch {
      setHistorySession(null);
      setRoutePoints([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

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
      case 'active': return T.success;
      case 'ended': return T.danger;
      default: return T.dim;
    }
  };

  const getStatusLabel = (status?: string): string => {
    switch (status) {
      case 'active': return 'Active';
      case 'ended': return 'Day Ended';
      default: return 'Not Started';
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} message="Loading tracking..." />;

  const cols = twoWide ? 4 : 2;
  const cardW = getCardWidth(cols, 32);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <DrawerMenuButton />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>My Day Tracking</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{user?.zone || user?.name || 'Tracking'}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusPillDot, { backgroundColor: getStatusColor(session?.status) }]} />
            <Text style={styles.statusPillText}>{getStatusLabel(session?.status)}</Text>
          </View>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        {/* Location permission warning */}
        {locationChecked && !locationGranted && (
          <TouchableOpacity
            style={[styles.locationBanner, { backgroundColor: T.danger + '18', borderColor: T.danger + '40' }]}
            onPress={requestLocationPermission}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={T.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.locationBannerTitle, { color: T.danger }]}>Location Access Required</Text>
              <Text style={[styles.locationBannerSubtitle, { color: T.sub }]}>Tap here to enable location for tracking</Text>
            </View>
            <View style={[styles.locationBannerActionWrap, { backgroundColor: T.danger + '22' }]}>
              <Text style={[styles.locationBannerAction, { color: T.danger }]}>Enable</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Connectivity + Queue Status */}
        {(!isOnline || queuedPings > 0) && (
          <View style={[styles.statusBanner, { backgroundColor: (!isOnline ? T.danger : T.warning) + '18' }]}>
            {!isOnline ? <WifiOff size={14} color={T.danger} /> : <Wifi size={14} color={T.warning} />}
            <Text style={[styles.statusBannerText, { color: !isOnline ? T.danger : T.warning }]}>
              {!isOnline ? 'Offline — pings are queued locally' : `${queuedPings} queued pings syncing...`}
            </Text>
          </View>
        )}

        {/* My Day */}
        <Card>
          <SectionLabel style={{ marginTop: 0 }}>My Day</SectionLabel>

          <View style={styles.buttonRow}>
            <GradientButton
              label="Start My Day"
              onPress={handleStartDay}
              disabled={!startEnabled || actionLoading}
              loading={actionLoading && startEnabled}
              style={styles.actionButton}
            />
            <TouchableOpacity
              style={[styles.dangerBtn, { backgroundColor: T.danger }, (!endEnabled || actionLoading) && styles.btnDisabled]}
              onPress={handleEndDay}
              disabled={!endEnabled || actionLoading}
              activeOpacity={0.9}
            >
              {actionLoading && endEnabled
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.dangerBtnText}>End Day</Text>}
            </TouchableOpacity>
          </View>

          {session?.status === 'ended' && (
            <View style={[styles.inlineBanner, { backgroundColor: T.success + '18' }]}>
              <Check size={16} color={T.success} />
              <Text style={[styles.inlineBannerText, { color: T.success }]}>Session ended. You can start again anytime.</Text>
            </View>
          )}

          {session?.isSuspicious && (
            <View style={[styles.inlineBanner, { backgroundColor: T.danger + '18' }]}>
              <AlertTriangle size={16} color={T.danger} />
              <Text style={[styles.inlineBannerText, { color: T.danger }]}>Session flagged — fraud score: {session.fraudScore}</Text>
            </View>
          )}

          {session?.status === 'ended' && session.rawDistanceKm != null && (
            <View style={[styles.distanceBreakdown, { backgroundColor: T.cardAlt }]}>
              <Text style={[styles.breakdownTitle, { color: T.accent }]}>Distance Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: T.sub }]}>Raw GPS</Text>
                <Text style={[styles.breakdownValue, { color: T.text }]}>{session.rawDistanceKm?.toFixed(2)} km</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: T.sub }]}>After Noise Filter</Text>
                <Text style={[styles.breakdownValue, { color: T.text }]}>{session.filteredDistanceKm?.toFixed(2)} km</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: T.sub }]}>Reconstructed Path</Text>
                <Text style={[styles.breakdownValue, styles.breakdownValueStrong, { color: T.text }]}>
                  {session.reconstructedDistanceKm?.toFixed(2)} km
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <StatTile
            label="Distance" value={`${session?.totalDistanceKm?.toFixed(1) ?? '0.0'} km`}
            icon={<Navigation size={15} color={T.accent} />} tint={T.accent} style={{ width: cardW }}
          />
          <StatTile
            label="Allowance" value={formatCurrency(session?.allowanceAmount ?? 0)}
            icon={<Wallet size={15} color={T.success} />} tint={T.success} style={{ width: cardW }}
          />
          <StatTile
            label="Status" value={getStatusLabel(session?.status)}
            icon={<View style={[styles.statTileDot, { backgroundColor: getStatusColor(session?.status) }]} />}
            tint={getStatusColor(session?.status)} style={{ width: cardW }}
          />
          <StatTile
            label="Session Time" value={session ? getSessionDuration(session) : '--'}
            icon={<Clock size={15} color={T.info} />} tint={T.info} style={{ width: cardW }}
          />
        </View>

        {/* Tracking History */}
        <Card>
          <View style={styles.sectionHeaderRow}>
            <Calendar size={18} color={T.accent} />
            <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>Tracking History</SectionLabel>
          </View>

          <DateInput
            value={selectedDate}
            onChange={handleDateSelect}
            placeholder="Select a date"
            accentColor={T.accent}
          />

          {historyLoading ? (
            <LoadingSpinner color={T.accent} message="Loading route..." />
          ) : historySession ? (
            <>
              {/* Stats summary */}
              <View style={styles.historySummary}>
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                    <Text style={[styles.statBoxLabel, { color: T.sub }]}>Distance</Text>
                    <Text style={[styles.statBoxValue, { color: T.text }]}>{historySession.totalDistanceKm?.toFixed(1)} km</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                    <Text style={[styles.statBoxLabel, { color: T.sub }]}>Allowance</Text>
                    <Text style={[styles.statBoxValue, { color: T.text }]}>{formatCurrency(historySession.allowanceAmount)}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                    <Text style={[styles.statBoxLabel, { color: T.sub }]}>Start</Text>
                    <Text style={[styles.statBoxValue, { color: T.text }]}>{formatTime(historySession.startedAt)}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                    <Text style={[styles.statBoxLabel, { color: T.sub }]}>End</Text>
                    <Text style={[styles.statBoxValue, { color: T.text }]}>{historySession.endedAt ? formatTime(historySession.endedAt) : '--'}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                    <Text style={[styles.statBoxLabel, { color: T.sub }]}>Duration</Text>
                    <Text style={[styles.statBoxValue, { color: T.text }]}>{getSessionDuration(historySession)}</Text>
                  </View>
                  {(historySession.fraudScore ?? 0) > 0 && (
                    <View style={[styles.statBox, { backgroundColor: T.cardAlt }]}>
                      <Text style={[styles.statBoxLabel, { color: T.sub }]}>Fraud Score</Text>
                      <Text style={[styles.statBoxValue, { color: historySession.isSuspicious ? T.danger : T.text }]}>
                        {historySession.fraudScore}/100
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Map */}
              <View style={[styles.mapContainer, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
                {/* Map type selector */}
                <View style={[styles.mapTypeRow, { backgroundColor: T.cardAlt, borderBottomColor: T.line }]}>
                  {(['standard', 'satellite', 'terrain', 'hybrid'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.mapTypeChip, { backgroundColor: mapType === type ? T.accent : T.card }]}
                      onPress={() => setMapType(type)}
                    >
                      <Text style={[styles.mapTypeText, { color: mapType === type ? T.onAccent : T.sub }]}>
                        {type === 'standard' ? 'Default' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <MapView
                  ref={mapRef}
                  style={[styles.map, { backgroundColor: T.cardAlt }]}
                  mapType={mapType}
                  initialRegion={{ latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 }}
                >
                  {routePoints.filter(p => !p.isFiltered).length > 1 && (
                    <Polyline
                      coordinates={routePoints.filter(p => !p.isFiltered).map(p => ({ latitude: p.lat, longitude: p.lon }))}
                      strokeColor={T.accent}
                      strokeWidth={4}
                    />
                  )}
                  {routePoints.filter(p => !p.isFiltered).length > 0 && (
                    <Marker
                      coordinate={{ latitude: routePoints.filter(p => !p.isFiltered)[0].lat, longitude: routePoints.filter(p => !p.isFiltered)[0].lon }}
                      pinColor={T.success}
                      title="Start"
                    />
                  )}
                  {routePoints.filter(p => !p.isFiltered).length > 1 && (
                    <Marker
                      coordinate={{
                        latitude: routePoints.filter(p => !p.isFiltered)[routePoints.filter(p => !p.isFiltered).length - 1].lat,
                        longitude: routePoints.filter(p => !p.isFiltered)[routePoints.filter(p => !p.isFiltered).length - 1].lon,
                      }}
                      pinColor={T.danger}
                      title="End"
                    />
                  )}
                </MapView>
              </View>

              {/* Route Points Accordion */}
              {routePoints.length > 0 && (
                <View style={[styles.routePointsContainer, { borderTopColor: T.line }]}>
                  <TouchableOpacity
                    style={styles.routePointsHeader}
                    onPress={() => setRoutePointsExpanded(e => !e)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.routePointsTitle, { color: T.text }]}>Route Points ({routePoints.length})</Text>
                    {routePointsExpanded
                      ? <ChevronDown size={18} color={T.sub} />
                      : <ChevronRight size={18} color={T.sub} />
                    }
                  </TouchableOpacity>
                  {routePointsExpanded && (
                    <>
                      {routePoints.slice(0, 100).map((pt, idx) => (
                        <View key={idx} style={[styles.routePointRow, { borderBottomColor: T.line }]}>
                          <View style={[styles.routePointDot, { backgroundColor: pt.isFiltered ? T.dim : T.success }]} />
                          <Text style={[styles.routePointCoords, { color: T.sub }]}>
                            {pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}
                          </Text>
                          <Text style={[styles.routePointTime, { color: T.dim }]}>{formatTime(pt.recordedAt)}</Text>
                        </View>
                      ))}
                      {routePoints.length > 100 && (
                        <Text style={[styles.routePointsMore, { color: T.dim }]}>+{routePoints.length - 100} more points</Text>
                      )}
                    </>
                  )}
                </View>
              )}
            </>
          ) : (
            <EmptyState title="No tracking data" subtitle="No route data available for this date." icon="📍" />
          )}
        </Card>

        {/* Allowances */}
        <Card>
          <SectionLabel style={{ marginTop: 0 }}>This Month's Allowances</SectionLabel>
          {allowancesLoading ? (
            <LoadingSpinner color={T.accent} />
          ) : allowances.length === 0 ? (
            <EmptyState title="No allowances" subtitle="No allowance records for this month." icon="💰" />
          ) : (
            allowances.map((a, i, arr) => (
              <View key={a.id} style={[styles.allowanceRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line }]}>
                <View style={styles.allowanceInfo}>
                  <Text style={[styles.allowanceDate, { color: T.text }]}>{formatDate(a.allowanceDate)}</Text>
                  <Text style={[styles.allowanceMeta, { color: T.dim }]}>{a.distanceKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.allowanceRight}>
                  <Text style={[styles.allowanceAmount, { color: T.text }]}>{formatCurrency(a.grossAmount)}</Text>
                  <Badge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? T.success : T.warning} />
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Prominent Disclosure modal — required by Google Play before background location request */}
      <BackgroundLocationDisclosure
        visible={showBgDisclosure}
        onAccept={() => {
          setShowBgDisclosure(false);
          bgPermissionResolveRef.current?.(true);
          bgPermissionResolveRef.current = null;
        }}
        onDecline={() => {
          setShowBgDisclosure(false);
          bgPermissionResolveRef.current?.(false);
          bgPermissionResolveRef.current = null;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12.5), color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  statusPillDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontFamily: Fonts.bold, fontSize: rf(11.5), color: '#8C5A2E' },

  scroll: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statTileDot: { width: 12, height: 12, borderRadius: 6 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },

  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionButton: { flex: 1 },
  dangerBtn: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { fontFamily: Fonts.bold, fontSize: rf(16), color: '#FFF', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.5 },

  inlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginTop: 12,
  },
  inlineBannerText: { fontFamily: Fonts.medium, fontSize: rf(13), flex: 1 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12,
  },
  statusBannerText: { fontFamily: Fonts.medium, fontSize: rf(12) },

  locationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  locationBannerTitle: { fontFamily: Fonts.bold, fontSize: rf(13) },
  locationBannerSubtitle: { fontFamily: Fonts.regular, fontSize: rf(11), marginTop: 2 },
  locationBannerActionWrap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  locationBannerAction: { fontFamily: Fonts.bold, fontSize: rf(12) },

  distanceBreakdown: { marginTop: 16, borderRadius: 14, padding: 14 },
  breakdownTitle: { fontFamily: Fonts.bold, fontSize: rf(13), marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
  },
  breakdownLabel: { fontFamily: Fonts.regular, fontSize: rf(12) },
  breakdownValue: { fontFamily: Fonts.medium, fontSize: rf(12) },
  breakdownValueStrong: { fontFamily: Fonts.bold },

  historySummary: { marginTop: 12, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 12, padding: 12 },
  statBoxLabel: { fontFamily: Fonts.medium, fontSize: rf(11), marginBottom: 4 },
  statBoxValue: { fontFamily: Fonts.bold, fontSize: rf(14) },

  mapContainer: { marginTop: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  mapTypeRow: {
    flexDirection: 'row', gap: 6, padding: 8, borderBottomWidth: 1,
  },
  mapTypeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  mapTypeText: { fontFamily: Fonts.medium, fontSize: rf(11) },
  map: { height: 220 },

  routePointsContainer: { marginTop: 14, borderTopWidth: 1, paddingTop: 12 },
  routePointsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, marginBottom: 4,
  },
  routePointsTitle: { fontFamily: Fonts.bold, fontSize: rf(13) },
  routePointRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 5, borderBottomWidth: 1,
  },
  routePointDot: { width: 8, height: 8, borderRadius: 4 },
  routePointCoords: { flex: 1, fontSize: rf(11), fontFamily: 'monospace' },
  routePointTime: { fontFamily: Fonts.regular, fontSize: rf(11) },
  routePointsMore: { fontFamily: Fonts.regular, fontSize: rf(12), textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },

  allowanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  allowanceInfo: { flex: 1 },
  allowanceDate: { fontFamily: Fonts.medium, fontSize: rf(13) },
  allowanceMeta: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  allowanceRight: { alignItems: 'flex-end', gap: 4 },
  allowanceAmount: { fontFamily: Fonts.bold, fontSize: rf(14) },
});
