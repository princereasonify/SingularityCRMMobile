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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Wallet,
  Play,
  Square,
  Route as RouteIcon,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import BackgroundService from '../../services/backgroundServiceShim';
import BackgroundFetch from 'react-native-background-fetch';
import { trackingApi, VehicleType } from '../../api/tracking';
import { sendLocationPing } from '../../services/locationPingService';
import { startNativeTracking, stopNativeTracking, requestIOSLocationPermission, checkIOSPermission } from '../../services/nativeLocationTracking';
import {
  SessionResponseDto,
  TrackingSessionDto,
  RoutePointDto,
  AllowanceDto,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Btn, Segmented, StatusBadge, ConfirmModal, FormModal } from '../../components/crud';
import { ICON_STROKE } from '../../components/common/Icon';
import { formatCurrency, formatDate, formatTime, toISODate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { BackgroundLocationDisclosure } from '../../components/common/BackgroundLocationDisclosure';
import { DateInput } from '../../components/common/DateInput';

/** Values must stay parseable by the backend's VehicleType enum; labels match web. */
const VEHICLE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: 'TwoWheeler', label: 'Two Wheeler (Activa / Bike)' },
  { value: 'FourWheeler', label: 'Four Wheeler (Car)' },
  { value: 'PublicTransport', label: 'Public Transport' },
  { value: 'Other', label: 'Other' },
];

const PING_QUEUE_KEY = 'tracking_ping_queue';
const PING_INTERVAL_MS = 30000; // 30 seconds

const DASH = '—';

/**
 * Web renders every route point; a full 8-hour day at one ping / 30 s is ~960 rows.
 * The bounded list below scrolls, so the cap only protects the render pass.
 */
const MAX_POINT_ROWS = 100;

/** Web parity: the history point list is a 220px scroll area (LiveTracking.jsx). */
const POINT_LIST_H = 220;

type MapKind = 'standard' | 'satellite' | 'terrain' | 'hybrid';

const MAP_TYPES: { label: string; value: MapKind }[] = [
  { label: 'Default', value: 'standard' },
  { label: 'Satellite', value: 'satellite' },
  { label: 'Terrain', value: 'terrain' },
  { label: 'Hybrid', value: 'hybrid' },
];

// ─── Presentational blocks ───────────────────────────────────────────────────
// Module level, not defined during render: a nested definition is a new component
// type every pass, which remounts the whole subtree (and would restart the map).

/** KPI tile. Wraps by flex-basis — 4-up on iPad landscape, 2-up on a phone. */
const Tile = ({ label, value, icon, tint, wide }: {
  label: string; value: string; icon: React.ReactNode; tint: string; wide: boolean;
}) => {
  const T = useAppTheme();
  return (
    <View style={[s.tile, { backgroundColor: T.card, borderColor: T.line }, wide ? s.tileWide : s.tilePhone]}>
      <View style={s.tileTop}>
        <View style={[s.tileIcon, { backgroundColor: withAlpha(tint, SOFT_TINT) }]}>{icon}</View>
        <Text style={[s.tileLabel, { color: T.sub }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.tileValue, { color: T.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
};

/** Compact label/value cell used by the history summary and distance breakdown. */
const MiniStat = ({ label, value, color }: { label: string; value: string; color?: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.mini, { backgroundColor: T.cardAlt }]}>
      <Text style={[s.miniLabel, { color: T.dim }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.miniValue, { color: color || T.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
};

const Empty = ({ title, subtitle }: { title: string; subtitle: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.empty, { borderColor: T.line }]}>
      <RouteIcon size={30} color={T.dim} strokeWidth={ICON_STROKE} />
      <Text style={[s.emptyTitle, { color: T.text }]}>{title}</Text>
      <Text style={[s.emptyTxt, { color: T.dim }]}>{subtitle}</Text>
    </View>
  );
};

// ─── Module-level background task (app alive: foreground + background) ────────
// BackgroundService is no longer used for active tracking (native modules handle both platforms).
// Kept imported via shim for the headless-task infrastructure on Android.

export const MyDayTrackingScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<TrackingSessionDto | null>(null);
  const [startEnabled, setStartEnabled] = useState(false);
  // Web parity (LiveTracking.jsx): Start My Day opens a vehicle picker first —
  // the allowance rate is set from the vehicle, so starting without one silently
  // costs the FO money. Same default as web.
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('TwoWheeler');
  const [endEnabled, setEndEnabled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedPings, setQueuedPings] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [routePoints, setRoutePoints] = useState<RoutePointDto[]>([]);
  const [historySession, setHistorySession] = useState<TrackingSessionDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);

  const mapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<MapKind>('standard');

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

  // ─── Live elapsed clock ──────────────────────────────────────────────────
  // Display only — the "Session Time" tile read `new Date()` at render, so it
  // froze at whatever it was when the screen last re-rendered. Ticking `now`
  // while a session is open is what makes "am I being tracked right now" true.
  // Touches nothing in the ping/upload pipeline.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (session?.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.status]);

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
      const now2 = new Date();
      const from = toISODate(new Date(now2.getFullYear(), now2.getMonth(), 1));
      const to = toISODate(now2);
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

  const handleStartDay = async (vehicleType: VehicleType) => {
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
      const res = await trackingApi.startDay(vehicleType);
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

  const handleEndDay = async () => {
    setConfirmEnd(false);
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
    if (!s.startedAt) return DASH;
    const start = new Date(s.startedAt);
    const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
    const diffMs = end - start.getTime();
    if (diffMs < 0) return DASH;
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

  const livePoints = routePoints.filter(p => !p.isFiltered);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <View style={s.loadWrap}>
          <ActivityIndicator color={T.accent} />
          <Text style={[s.loadTxt, { color: T.dim }]}>Loading tracking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── history: stats + point list (left column on iPad, stacked on phone) ──
  const renderHistoryStats = () => (
    <View style={s.histStats}>
      <View style={s.miniRow}>
        <MiniStat label="Distance" value={`${historySession?.totalDistanceKm?.toFixed(1) ?? '0.0'} km`} />
        <MiniStat label="Allowance" value={formatCurrency(historySession?.allowanceAmount ?? 0)} />
      </View>
      <View style={s.miniRow}>
        <MiniStat label="Start" value={formatTime(historySession?.startedAt) || DASH} />
        <MiniStat label="End" value={historySession?.endedAt ? formatTime(historySession.endedAt) : DASH} />
      </View>
      <View style={s.miniRow}>
        <MiniStat label="Duration" value={historySession ? getSessionDuration(historySession) : DASH} />
        {(historySession?.fraudScore ?? 0) > 0 && (
          <MiniStat
            label="Fraud Score"
            value={`${historySession?.fraudScore}/100`}
            color={historySession?.isSuspicious ? T.danger : T.text}
          />
        )}
      </View>
    </View>
  );

  const renderPointList = () => {
    if (routePoints.length === 0) return null;
    const shown = routePoints.slice(0, MAX_POINT_ROWS);
    return (
      <View style={s.pointsWrap}>
        <Text style={[s.pointsTitle, { color: T.dim }]}>Route Points ({routePoints.length})</Text>
        <ScrollView
          style={[s.pointsScroll, { borderColor: T.line }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {shown.map((pt, idx) => {
            const dot = pt.isFiltered
              ? T.dim
              : idx === 0
                ? T.success
                : idx === routePoints.length - 1
                  ? T.danger
                  : T.accent;
            return (
              <View key={idx} style={[s.pointRow, { borderBottomColor: T.line }]}>
                <View style={[s.pointDot, { backgroundColor: dot }]} />
                <Text style={[s.pointCoords, { color: T.sub }]} numberOfLines={1}>
                  {pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}
                </Text>
                <Text style={[s.pointTime, { color: T.dim }]}>{formatTime(pt.recordedAt)}</Text>
              </View>
            );
          })}
          {routePoints.length > MAX_POINT_ROWS && (
            <Text style={[s.pointsMore, { color: T.dim }]}>
              +{routePoints.length - MAX_POINT_ROWS} more points
            </Text>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderMap = () => (
    <View style={s.mapCol}>
      <Segmented<MapKind> value={mapType} onChange={setMapType} options={MAP_TYPES} />
      {livePoints.length === 0 ? (
        <Empty title="No GPS points recorded" subtitle="Pings appear here once your day is running." />
      ) : (
        <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }, wide && s.mapWrapWide]}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            mapType={mapType}
            initialRegion={{ latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 }}
          >
            {livePoints.length > 1 && (
              <Polyline
                coordinates={livePoints.map(p => ({ latitude: p.lat, longitude: p.lon }))}
                strokeColor={T.accent}
                strokeWidth={4}
              />
            )}
            {livePoints.length > 0 && (
              <Marker
                coordinate={{ latitude: livePoints[0].lat, longitude: livePoints[0].lon }}
                pinColor={T.success}
                title="Start"
                description={formatTime(livePoints[0].recordedAt)}
              />
            )}
            {livePoints.length > 1 && (
              <Marker
                coordinate={{
                  latitude: livePoints[livePoints.length - 1].lat,
                  longitude: livePoints[livePoints.length - 1].lon,
                }}
                pinColor={T.danger}
                title="End"
                description={formatTime(livePoints[livePoints.length - 1].recordedAt)}
              />
            )}
          </MapView>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />
        }
      >
        {locationChecked && !locationGranted && (
          <TouchableOpacity
            style={[s.banner, { backgroundColor: withAlpha(T.danger, SOFT_TINT), borderColor: withAlpha(T.danger, 0.35) }]}
            onPress={requestLocationPermission}
            activeOpacity={0.75}
          >
            <MapPin size={16} color={T.danger} strokeWidth={ICON_STROKE} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: T.danger }]}>Location Access Required</Text>
              <Text style={[s.bannerTxt, { color: T.sub }]}>Tap to enable location so your day can be tracked.</Text>
            </View>
            <View style={[s.bannerAction, { backgroundColor: withAlpha(T.danger, 0.18) }]}>
              <Text style={[s.bannerActionTxt, { color: T.danger }]}>Enable</Text>
            </View>
          </TouchableOpacity>
        )}

        {(!isOnline || queuedPings > 0) && (
          <View
            style={[
              s.banner,
              {
                backgroundColor: withAlpha(!isOnline ? T.danger : T.warning, SOFT_TINT),
                borderColor: withAlpha(!isOnline ? T.danger : T.warning, 0.3),
              },
            ]}
          >
            {!isOnline
              ? <WifiOff size={15} color={T.danger} strokeWidth={ICON_STROKE} />
              : <Wifi size={15} color={T.warning} strokeWidth={ICON_STROKE} />}
            <Text style={[s.bannerTxt, { color: !isOnline ? T.danger : T.warning, flex: 1, fontWeight: '600' }]}>
              {!isOnline
                ? 'Offline — pings are queued on this device and will sync automatically.'
                : `${queuedPings} queued ping${queuedPings === 1 ? '' : 's'} syncing…`}
            </Text>
          </View>
        )}

        {/* ── My Day ── */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: T.text }]}>My Day</Text>
              <Text style={[s.cardSub, { color: T.dim }]}>{formatDate(toISODate(new Date()))}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: withAlpha(getStatusColor(session?.status), SOFT_TINT) }]}>
              <View style={[s.pillDot, { backgroundColor: getStatusColor(session?.status) }]} />
              <Text style={[s.pillTxt, { color: getStatusColor(session?.status) }]}>
                {getStatusLabel(session?.status)}
              </Text>
            </View>
          </View>

          <View style={s.btnRow}>
            <Btn
              label="Start My Day"
              onPress={() => setShowVehiclePicker(true)}
              disabled={!startEnabled || actionLoading}
              loading={actionLoading && startEnabled}
              style={{ flex: 1 }}
              icon={<Play size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
            <Btn
              label="End Day"
              variant="danger"
              onPress={() => setConfirmEnd(true)}
              disabled={!endEnabled || actionLoading}
              loading={actionLoading && endEnabled}
              style={{ flex: 1 }}
              icon={<Square size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </View>

          <View style={s.tileGrid}>
            <Tile
              wide={wide}
              label="Today's Distance"
              value={`${session?.totalDistanceKm?.toFixed(1) ?? '0.0'} km`}
              icon={<Navigation size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
              tint={T.accent}
            />
            <Tile
              wide={wide}
              label="Today's Allowance"
              value={formatCurrency(session?.allowanceAmount ?? 0)}
              icon={<Wallet size={14} color={T.success} strokeWidth={ICON_STROKE} />}
              tint={T.success}
            />
            <Tile
              wide={wide}
              label="Session Status"
              value={getStatusLabel(session?.status)}
              icon={<View style={[s.pillDot, { backgroundColor: getStatusColor(session?.status) }]} />}
              tint={getStatusColor(session?.status)}
            />
            <Tile
              wide={wide}
              label="Session Time"
              value={session ? getSessionDuration(session) : DASH}
              icon={<Clock size={14} color={T.info} strokeWidth={ICON_STROKE} />}
              tint={T.info}
            />
          </View>

          {session?.status === 'ended' && (
            <View style={[s.inline, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
              <Check size={15} color={T.success} strokeWidth={ICON_STROKE} />
              <Text style={[s.inlineTxt, { color: T.success }]}>Session ended. You can start again anytime.</Text>
            </View>
          )}

          {session?.isSuspicious && (
            <View style={[s.inline, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
              <AlertTriangle size={15} color={T.danger} strokeWidth={ICON_STROKE} />
              <Text style={[s.inlineTxt, { color: T.danger }]}>
                Session flagged — fraud score: {session.fraudScore}/100
              </Text>
            </View>
          )}

          {session?.status === 'ended' && session.rawDistanceKm != null && (
            <View style={[s.breakdown, { backgroundColor: T.cardAlt }]}>
              <Text style={[s.breakdownTitle, { color: T.accent }]}>Distance Breakdown</Text>
              <View style={s.breakdownRow}>
                <View style={s.breakdownCell}>
                  <Text style={[s.miniLabel, { color: T.dim }]}>Raw GPS</Text>
                  <Text style={[s.miniValue, { color: T.text }]}>{session.rawDistanceKm?.toFixed(2)} km</Text>
                </View>
                <View style={s.breakdownCell}>
                  <Text style={[s.miniLabel, { color: T.dim }]}>After Filtering</Text>
                  <Text style={[s.miniValue, { color: T.text }]}>{session.filteredDistanceKm?.toFixed(2)} km</Text>
                </View>
                <View style={s.breakdownCell}>
                  <Text style={[s.miniLabel, { color: T.dim }]}>Reconstructed</Text>
                  <Text style={[s.miniValue, { color: T.text }]}>{session.reconstructedDistanceKm?.toFixed(2)} km</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Tracking History ── */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.cardHead}>
            <View style={s.titleRow}>
              <Calendar size={16} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.cardTitle, { color: T.text }]}>My Tracking History</Text>
            </View>
          </View>

          <View style={wide ? s.dateWide : undefined}>
            <DateInput
              value={selectedDate}
              onChange={handleDateSelect}
              placeholder="Select a date"
              accentColor={T.accent}
            />
          </View>

          {historyLoading ? (
            <View style={s.loadWrap}>
              <ActivityIndicator color={T.accent} />
              <Text style={[s.loadTxt, { color: T.dim }]}>Loading route…</Text>
            </View>
          ) : historySession ? (
            <View style={wide ? s.histWide : s.histPhone}>
              <View style={wide ? s.histSideWide : undefined}>
                {renderHistoryStats()}
                {renderPointList()}
              </View>
              {renderMap()}
            </View>
          ) : (
            <Empty title="No tracking data" subtitle="No route data was recorded for this date." />
          )}
        </View>

        {/* ── This Month's Allowances ── */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.cardHead}>
            <View style={s.titleRow}>
              <Wallet size={16} color={T.accent} strokeWidth={ICON_STROKE} />
              <Text style={[s.cardTitle, { color: T.text }]}>This Month's Allowances</Text>
            </View>
          </View>

          {allowancesLoading ? (
            <View style={s.loadWrap}>
              <ActivityIndicator color={T.accent} />
            </View>
          ) : allowances.length === 0 ? (
            <Empty title="No allowances" subtitle="No allowance records for this month yet." />
          ) : (
            allowances.map((a, i, arr) => (
              <View
                key={a.id}
                style={[
                  s.allowRow,
                  i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.allowDate, { color: T.text }]} numberOfLines={1}>{formatDate(a.allowanceDate)}</Text>
                  <Text style={[s.allowMeta, { color: T.dim }]} numberOfLines={1}>{a.distanceKm.toFixed(1)} km</Text>
                </View>
                <View style={s.allowRight}>
                  <Text style={[s.allowAmt, { color: T.text }]}>{formatCurrency(a.grossAmount)}</Text>
                  <StatusBadge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? T.success : T.warning} />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmEnd}
        tone="danger"
        title="End Your Day?"
        message="This will stop location tracking and calculate your travel allowance."
        icon={<Square size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="End Day"
        onConfirm={handleEndDay}
        onCancel={() => setConfirmEnd(false)}
      />

      <FormModal
        visible={showVehiclePicker}
        title="Select Your Vehicle"
        onClose={() => setShowVehiclePicker(false)}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" small onPress={() => setShowVehiclePicker(false)} />
            <Btn
              label="Start My Day"
              small
              onPress={() => { setShowVehiclePicker(false); handleStartDay(selectedVehicle); }}
            />
          </>
        }
      >
        <Text style={[s.vehHint, { color: T.sub }]}>
          Your allowance rate will be set based on the vehicle you select.
        </Text>
        {VEHICLE_OPTIONS.map(v => {
          const on = selectedVehicle === v.value;
          return (
            <TouchableOpacity
              key={v.value}
              activeOpacity={0.8}
              onPress={() => setSelectedVehicle(v.value)}
              style={[
                s.vehRow,
                { borderColor: on ? T.accent : T.line, backgroundColor: on ? T.accentSoft : T.cardAlt },
              ]}
            >
              <Text style={[s.vehTxt, { color: on ? T.accent : T.text, fontWeight: on ? '700' : '500' }]}>
                {v.label}
              </Text>
              {on && <Check size={16} color={T.accent} strokeWidth={2.4} />}
            </TouchableOpacity>
          );
        })}
      </FormModal>

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
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from the theme, inline) ─────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  scrollWide: { paddingHorizontal: 22 },

  loadWrap: { paddingVertical: 34, alignItems: 'center', gap: 8 },
  loadTxt: { fontSize: rf(12.5), fontWeight: '500' },

  // card — matches SchoolsListScreen: r16 · 1px line · pad 12 · gap 10
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  cardTitle: { fontSize: rf(14.5), fontWeight: '700' },
  cardSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillTxt: { fontSize: rf(11), fontWeight: '700' },

  // Vehicle picker (spec: r13 field face, 1.5px border, soft tint + check when on)
  vehHint: { fontSize: rf(12), lineHeight: 17, marginBottom: 12 },
  vehRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 46, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 13, borderWidth: 1.5, marginBottom: 8,
  },
  vehTxt: { fontSize: rf(13), flex: 1 },

  btnRow: { flexDirection: 'row', gap: 10 },

  // Tiles wrap by flex-basis — 4-up on iPad landscape, 2-up on a phone. No window math,
  // so nothing can be clipped or leave a dead column at any width.
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 13, borderWidth: 1, padding: 11, gap: 7, flexGrow: 1 },
  tileWide: { flexBasis: '22%' },
  tilePhone: { flexBasis: '46%' },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tileIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: rf(11), fontWeight: '600', flex: 1 },
  tileValue: { fontSize: rf(16), fontWeight: '700', letterSpacing: -0.2 },

  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 11 },
  inlineTxt: { fontSize: rf(12.5), fontWeight: '600', flex: 1 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  bannerTitle: { fontSize: rf(12.5), fontWeight: '700' },
  bannerTxt: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  bannerAction: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 },
  bannerActionTxt: { fontSize: rf(11.5), fontWeight: '700' },

  breakdown: { borderRadius: 13, padding: 12, gap: 9 },
  breakdownTitle: { fontSize: rf(12), fontWeight: '700' },
  breakdownRow: { flexDirection: 'row', gap: 10 },
  breakdownCell: { flex: 1, gap: 2 },

  // history — iPad puts the summary/points beside the map (web parity: 260px rail + flex map)
  histPhone: { gap: 12 },
  histWide: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  histSideWide: { width: 268, flexShrink: 0, gap: 12 },
  dateWide: { maxWidth: 320 },

  histStats: { gap: 8 },
  miniRow: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, borderRadius: 12, padding: 10, gap: 2 },
  miniLabel: { fontSize: rf(10.5), fontWeight: '600' },
  miniValue: { fontSize: rf(13.5), fontWeight: '700' },

  pointsWrap: { gap: 6 },
  pointsTitle: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  pointsScroll: { maxHeight: POINT_LIST_H, borderRadius: 12, borderWidth: 1 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  pointDot: { width: 7, height: 7, borderRadius: 3.5 },
  pointCoords: { flex: 1, fontSize: rf(11), fontWeight: '500' },
  pointTime: { fontSize: rf(10.5), fontWeight: '500' },
  pointsMore: { fontSize: rf(11), fontWeight: '500', textAlign: 'center', paddingVertical: 8 },

  mapCol: { flex: 1, minWidth: 0, gap: 8 },
  mapWrap: { height: 260, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  mapWrapWide: { height: 420 },

  empty: { borderRadius: 14, borderWidth: 1, paddingVertical: 34, paddingHorizontal: 16, alignItems: 'center', gap: 7 },
  emptyTitle: { fontSize: rf(13.5), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12), fontWeight: '500', textAlign: 'center' },

  allowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  allowDate: { fontSize: rf(13), fontWeight: '600' },
  allowMeta: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2 },
  allowRight: { alignItems: 'flex-end', gap: 5 },
  allowAmt: { fontSize: rf(13.5), fontWeight: '700' },
});
