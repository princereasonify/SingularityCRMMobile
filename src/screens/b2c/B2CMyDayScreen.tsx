import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Platform, PermissionsAndroid, Linking, Alert, Animated, Easing,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region as MapRegion } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {
  Play, Square, Radio, Route as RouteIcon, Clock, MapPin, Gauge,
  ChevronLeft, ChevronRight, Send,
} from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { Btn, StatusBadge, ConfirmModal } from '../../components/crud';
import { b2cTrackingService } from '../../api/b2c/b2cTrackingService';
import { sendB2CPing } from '../../services/b2cLocationPingService';
import { startB2CBackgroundTracking, stopB2CBackgroundTracking } from '../../services/b2cBackgroundTracking';
import { isNativeTrackingAvailable } from '../../services/nativeLocationTracking';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { isoDate, todayStr, timeOnly } from '../../utils/dates';

// Continuous high-accuracy capture: watchPosition streams fixes as the device moves; we
// forward the freshest fix on a throttled cadence so the server gets dense-but-bounded data.
const SEND_INTERVAL_MS = 15000;
const INDIA_REGION: MapRegion = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 };

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtTime = (v?: string | null) => (v ? timeOnly(v) : '—');
const fmtDuration = (mins?: number | null) => {
  const m = Math.max(0, Number(mins) || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};
const fmtLongDate = (dateStr: string) => {
  const [y, mo, dd] = dateStr.split('-').map(Number);
  const d = new Date(y, (mo || 1) - 1, dd || 1);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};

interface Fix {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  /** The OS's capture time for THIS fix. Stamping send-time instead is what lets a cached
   *  reading from minutes ago enter the route as if it were current. */
  capturedAt?: number;
  heading?: number | null;
  altitude?: number | null;
  isMock?: boolean;
}

/** Expanding ring behind the live indicator — a quiet "we're capturing right now" pulse. */
const LivePulse = ({ color }: { color: string }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: color,
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
      }}
    />
  );
};

export const B2CMyDayScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const r = useResponsive();
  const mapRef = useRef<MapView>(null);

  const [me, setMe] = useState<any>(null);           // /me for today (session + route)
  const [history, setHistory] = useState<any>(null); // /route for a past date
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [geoNote, setGeoNote] = useState('');
  const [endConfirm, setEndConfirm] = useState(false);
  /**
   * Whether /tracking/me has actually answered. Until it has, "no active session" is an
   * absence of information, not a fact — and tearing the background service down on that
   * would kill a running day every time this screen is opened offline.
   */
  const [sessionKnown, setSessionKnown] = useState(false);

  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPos = useRef<Fix | null>(null); // freshest high-accuracy fix from watchPosition

  const isToday = date === todayStr();
  const session = me?.activeSession;
  // The ONLY source of truth for "is my day on". A session abandoned overnight is auto-closed
  // server-side after 16h, so the next morning this is null and nothing here starts capturing.
  const isActive = !!session && (session.status === 'Active' || session.status === 'active');
  // "Never started today" and "started, worked, and ended today" are different days to an agent,
  // but both leave activeSession null. Reporting them identically put "Not started" directly above
  // a start time, a 2h duration, a distance and a drawn route — which reads as the tracker having
  // lost the day's work. Today's pings are the evidence that the day did happen.
  const dayEnded = isToday && !isActive && ((me?.todayPingCount ?? 0) > 0 || !!me?.firstPingAt);
  // The native engine, when present, is the single source of captured fixes — see the effect
  // below. Stable for the lifetime of the process, so it is not state.
  const nativeOwnsCapture = isNativeTrackingAvailable();

  // ─── Data ──────────────────────────────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    try {
      const res = await b2cTrackingService.getMe();
      setMe(res.data || null);
      setSessionKnown(true);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHistory = useCallback(async (d: string) => {
    if (!user?.id) { setHistory(null); setLoading(false); setRefreshing(false); return; }
    setLoading(true);
    try {
      const res = await b2cTrackingService.getRoute(user.id, d);
      setHistory(res.data || null);
    } catch {
      setHistory(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchMe(); }, [fetchMe]);
  useEffect(() => { if (!isToday) fetchHistory(date); }, [date, isToday, fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isToday) fetchMe(); else fetchHistory(date);
  }, [isToday, date, fetchMe, fetchHistory]);

  // ─── Android location permission (same pattern as B2CAgentVisitScreen) ──────
  const askLocation = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const perm = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      if (await PermissionsAndroid.check(perm)) return true;
      const result = await PermissionsAndroid.request(perm, {
        title: 'Location Permission Required',
        message: 'The app needs your location to track your day.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert('Location Permission', 'Access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  // Forward the freshest fix (from watchPosition) through the resilient sender: it gates
  // low-accuracy fixes on-device, stamps the client capture time, and queues + batch-flushes
  // on network loss so no fix is lost. The server still jitter/teleport filters and snaps.
  const sendPing = useCallback(() => {
    const c = lastPos.current;
    if (!c) return;
    sendB2CPing({
      latitude: c.latitude,
      longitude: c.longitude,
      speedKmh: c.speed != null ? Math.max(0, c.speed * 3.6) : undefined,
      accuracyMetres: c.accuracy != null ? Math.round(c.accuracy) : undefined,
      // The fix's own capture time, not now — see Fix.capturedAt.
      recordedAt: new Date(c.capturedAt ?? Date.now()).toISOString(),
      // heading is -1 when the device cannot determine course (stationary); send nothing rather
      // than a bearing that would point the map arrow due north for no reason.
      bearing: c.heading != null && c.heading >= 0 ? Math.round(c.heading) : undefined,
      altitude: c.altitude != null ? Math.round(c.altitude) : undefined,
      isMock: c.isMock === true,
    }).then(sent => { if (sent) fetchMe(); }).catch(() => {});
  }, [fetchMe]);

  /** Tears down only the dense foreground stream this screen owns. */
  const stopForeground = useCallback(() => {
    if (watchId.current != null) { Geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
  }, []);

  // ─── Continuous capture while the day is active ─────────────────────────────
  useEffect(() => {
    if (!isActive) {
      stopForeground();
      // Only tear the background service down once the server has actually said there is no
      // live session. While /me is in flight (or failed) that is unknown, and stopping on a
      // guess is how a running day loses its foreground service.
      if (sessionKnown) stopB2CBackgroundTracking().catch(() => {});
      return;
    }

    let cancelled = false;
    (async () => {
      const ok = await askLocation();
      if (cancelled) return;
      if (!ok) { setGeoNote('Location permission is required to track your day.'); return; }

      let firstFix = true;
      watchId.current = Geolocation.watchPosition(
        (pos) => {
          lastPos.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            capturedAt: pos.timestamp,
            heading: pos.coords.heading,
            altitude: pos.coords.altitude,
            // Android surfaces the mock-provider flag on the position; iOS does not, so this is
            // undefined there and the server simply has nothing to invalidate on.
            isMock: (pos as any).mocked === true,
          };
          setGeoNote('');
          // Only seed the route from JS when nothing else is capturing. With the native engine
          // running, this watch exists purely to move the dot on THIS screen.
          if (firstFix && !nativeOwnsCapture) { firstFix = false; sendPing(); }
        },
        (err) => setGeoNote(err?.message || 'Could not read your location. Keep location enabled to track your day.'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000, distanceFilter: 0 },
      );

      // Capture ownership is exclusive. The native engine captures and posts on its own — 
      // running the JS loop as well would double every fix, and the two would disagree
      // whenever their filters landed differently. JS pings only where there is no native
      // module to do it (older builds, Jest), which is also the only place it ever worked.
      if (!nativeOwnsCapture) {
        pingTimer.current = setInterval(sendPing, SEND_INTERVAL_MS);
      }

      // Background capture: Android foreground service (START_STICKY) / iOS CLLocationManager
      // with background updates. Survives the app being backgrounded, locked, or killed.
      startB2CBackgroundTracking().catch(() => {});
    })();

    // Leaving this screen stops the dense foreground stream but NOT the background service:
    // the day is still running, and killing it on navigation is exactly how continuous
    // tracking used to die the moment the agent opened another screen.
    return () => { cancelled = true; stopForeground(); };
  }, [isActive, sessionKnown, askLocation, sendPing, stopForeground, nativeOwnsCapture]);

  // ─── Start / End ────────────────────────────────────────────────────────────
  const startDay = async () => {
    setBusy(true); setError(''); setGeoNote('');
    try {
      await b2cTrackingService.startDay();
      toast.success('Day started');
      await fetchMe();
      // capture starts automatically once the server reports the session Active.
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to start day';
      setError(msg);
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const endDay = async () => {
    setBusy(true); setError('');
    try {
      stopForeground();
      await stopB2CBackgroundTracking();
      await b2cTrackingService.endDay();
      toast.success('Day ended');
      setEndConfirm(false);
      await fetchMe();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to end day';
      setError(msg);
      toast.error(msg);
    } finally { setBusy(false); }
  };

  // ─── Date stepper ───────────────────────────────────────────────────────────
  const canGoNext = date < todayStr();
  const stepDay = (delta: number) => {
    const [y, mo, dd] = date.split('-').map(Number);
    const next = isoDate(new Date(y, (mo || 1) - 1, (dd || 1) + delta));
    if (next > todayStr()) return;
    setDate(next);
  };

  // Unify today (/me) and history (/route) into one view for the stats + map.
  const view = isToday
    ? {
        route: me?.route || [],
        distance: me?.totalDistanceKm ?? 0,
        duration: me?.durationMinutes ?? 0,
        pings: me?.todayPingCount ?? 0,
        startedAt: session?.startedAt || me?.firstPingAt,
        endedAt: null as string | null,
      }
    : {
        route: history?.route || [],
        distance: history?.totalDistanceKm ?? 0,
        duration: history?.durationMinutes ?? 0,
        pings: history?.pingCount ?? 0,
        startedAt: history?.startedAt,
        endedAt: (history?.endedAt ?? null) as string | null,
      };

  const points = useMemo(
    () => (view.route as any[])
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude), recordedAt: p.recordedAt })),
    [view.route],
  );

  useEffect(() => {
    if (points.length === 0) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [points]);

  const s = useMemo(() => makeStyles(r), [r]);
  // Two up everywhere: on a wide screen the stats share the left pane with the day controls,
  // so four across would squeeze each tile narrower than its own label.
  const kpiWidth = '48.5%';

  const statusCard = isToday ? (
    <Card style={{ gap: 12 }}>
      <View style={s.statusRow}>
        <View style={[s.statusIcon, { backgroundColor: isActive ? T.success + '26' : T.cardAlt }]}>
          {isActive && <LivePulse color={T.success} />}
          <Radio size={20} color={isActive ? T.success : T.dim} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.statusLbl, { color: T.text }]}>Day status</Text>
          <View style={s.badgeRow}>
            <StatusBadge
              label={isActive ? 'Active — tracking' : dayEnded ? 'Ended for today' : 'Not started'}
              color={isActive ? T.success : dayEnded ? T.accent : T.sub}
            />
          </View>
        </View>
      </View>

      {isActive ? (
        <Btn
          label={busy ? 'Ending…' : 'End Day'}
          variant="danger"
          onPress={() => setEndConfirm(true)}
          loading={busy}
          icon={<Square size={15} color="#FFF" strokeWidth={2.4} />}
        />
      ) : (
        <Btn
          label={busy ? 'Starting…' : 'Start Day'}
          onPress={startDay}
          loading={busy}
          icon={<Play size={15} color="#FFF" strokeWidth={2.4} />}
        />
      )}

      {!!error && <Text style={[s.noteErr, { color: T.danger }]}>{error}</Text>}
      {!!geoNote && <Text style={[s.noteWarn, { color: T.warning }]}>{geoNote}</Text>}
    </Card>
  ) : null;

  const stats = (
    <View style={s.grid}>
      <StatTile style={{ width: kpiWidth }} label="Distance" value={`${Number(view.distance).toFixed(1)} km`} icon={<RouteIcon size={15} color={T.accent} />} />
      <StatTile style={{ width: kpiWidth }} label="Duration" value={fmtDuration(view.duration)} tint={T.info} icon={<Clock size={15} color={T.info} />} />
      <StatTile style={{ width: kpiWidth }} label="Start" value={fmtTime(view.startedAt)} tint={T.success} icon={<Play size={15} color={T.success} />} />
      <StatTile style={{ width: kpiWidth }} label="Location pings" value={view.pings} tint={T.warning} icon={<Gauge size={15} color={T.warning} />} />
    </View>
  );

  const routeBlock = (
    <View style={{ width: '100%' }}>
      <SectionLabel style={{ marginTop: r.isWide ? 0 : 18 }}>
        {isToday ? "Today's route" : 'Route'}
        {view.endedAt ? `  ·  ended ${fmtTime(view.endedAt)}` : ''}
      </SectionLabel>
      {points.length === 0 ? (
        <Card style={s.empty}>
          <MapPin size={30} color={T.dim} />
          <Text style={[s.emptyTitle, { color: T.text }]}>No location yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            {isToday ? 'Start your day to begin tracking your route.' : 'No route recorded for this day.'}
          </Text>
        </Card>
      ) : (
        <>
          <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
            <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={INDIA_REGION}>
              {points.length > 1 && <Polyline coordinates={points} strokeColor={T.accent} strokeWidth={4} />}
              <Marker coordinate={points[0]} pinColor={T.success} title="Start" description={fmtTime(points[0].recordedAt)} />
              {points.length > 1 && (
                <Marker
                  coordinate={points[points.length - 1]}
                  pinColor={T.danger}
                  title={isToday ? 'Latest' : 'End'}
                  description={fmtTime(points[points.length - 1].recordedAt)}
                />
              )}
            </MapView>
          </View>
          <Text style={[s.pointsNote, { color: T.dim }]}>
            {points.length} GPS point{points.length === 1 ? '' : 's'} recorded
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } : undefined}
    >
      <Text style={[s.title, { color: T.text }]}>My Day</Text>
      <Text style={[s.subtitle, { color: T.sub }]}>{fmtLongDate(date)}</Text>

      {/* Date stepper */}
      <View style={[s.dateBar, { backgroundColor: T.card, borderColor: T.line }]}>
        <TouchableOpacity
          onPress={() => stepDay(-1)}
          activeOpacity={0.8}
          accessibilityLabel="Previous day"
          style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
        >
          <ChevronLeft size={18} color={T.accent} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={[s.dateTxt, { color: T.text }]} numberOfLines={1}>
          {isToday ? 'Today' : fmtLongDate(date)}
        </Text>
        <TouchableOpacity
          onPress={() => canGoNext && stepDay(1)}
          activeOpacity={0.8}
          disabled={!canGoNext}
          accessibilityLabel="Next day"
          style={[s.tapBtn, { backgroundColor: canGoNext ? T.accentSoft : T.cardAlt }]}
        >
          <ChevronRight size={18} color={canGoNext ? T.accent : T.dim} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <>
          {/* Controls beside the map on a wide tablet; stacked on a phone. */}
          <View style={s.panes}>
            <View style={s.leftPane}>
              {statusCard}
              {stats}
            </View>
            <View style={s.rightPane}>{routeBlock}</View>
          </View>

          {isToday && (
            <>
              <Text style={[s.footNote, { color: T.dim }]}>
                While your day is active, your location streams continuously at high accuracy and keeps
                going when the app is in the background. Low-accuracy and stray points are filtered out
                and the route is snapped to roads automatically.
              </Text>
              {isActive && (
                <Btn
                  label="Send location now"
                  variant="soft"
                  onPress={sendPing}
                  icon={<Send size={14} color={T.accent} strokeWidth={2.2} />}
                  style={{ marginTop: 12 }}
                />
              )}
            </>
          )}
        </>
      )}

      <ConfirmModal
        visible={endConfirm}
        title="End your day?"
        message="This stops tracking and closes today's session. You can't reopen it."
        icon={<Square size={24} color={T.danger} />}
        tone="danger"
        confirmLabel={busy ? 'Ending…' : 'End Day'}
        onConfirm={endDay}
        onCancel={() => setEndConfirm(false)}
      />
    </Screen>
  );
};

const makeStyles = (r: ReturnType<typeof useResponsive>) =>
  StyleSheet.create({
    title: { fontSize: r.rf(22), fontWeight: '800', letterSpacing: -0.5 },
    subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginTop: 2 },

    dateBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, marginTop: 14,
    },
    dateTxt: { flex: 1, textAlign: 'center', fontSize: r.rf(13.5), fontWeight: '700' },
    /** Every touchable is at least the HIG minimum in both dimensions. */
    tapBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    panes: {
      flexDirection: r.isWide ? 'row' : 'column',
      alignItems: 'flex-start',
      gap: r.gap + 4,
      marginTop: 12,
    },
    leftPane: { flex: r.isWide ? 1 : undefined, width: r.isWide ? undefined : '100%', gap: 12 },
    rightPane: { flex: r.isWide ? 1.2 : undefined, width: r.isWide ? undefined : '100%' },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statusLbl: { fontSize: r.rf(13.5), fontWeight: '700' },
    badgeRow: { flexDirection: 'row' },
    noteErr: { fontSize: r.rf(12), fontWeight: '600', lineHeight: r.rf(17) },
    noteWarn: { fontSize: r.rf(12), fontWeight: '600', lineHeight: r.rf(17) },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },

    // A map has to be a map in both orientations — a squashed strip on a landscape iPad tells
    // you nothing, so the height tracks the window rather than a baked-in constant.
    mapWrap: {
      height: Math.round(Math.min(Math.max(r.height * (r.isLandscape ? 0.52 : 0.36), 260), 560)),
      borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    },
    pointsNote: { fontSize: r.rf(11), fontWeight: '600', textAlign: 'center', marginTop: 8 },

    empty: { paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
    emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: r.rf(18) },

    footNote: { fontSize: r.rf(11.5), fontWeight: '500', lineHeight: r.rf(17), marginTop: 14 },
  });

export default B2CMyDayScreen;
