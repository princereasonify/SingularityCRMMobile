import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, useWindowDimensions,
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
import { Btn, IconBtn, StatusBadge, ConfirmModal } from '../../components/crud';
import { b2cTrackingService } from '../../api/b2c/b2cTrackingService';
import { sendB2CPing } from '../../services/b2cLocationPingService';
import { startB2CBackgroundTracking, stopB2CBackgroundTracking } from '../../services/b2cBackgroundTracking';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { rf } from '../../utils/responsive';

// Continuous high-accuracy capture: watchPosition streams fixes as the device moves; we
// forward the freshest fix on a throttled cadence so the server gets dense-but-bounded data.
const SEND_INTERVAL_MS = 15000;
const INDIA_REGION: MapRegion = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 };

// ─── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => localDateStr(new Date());

const fmtTime = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};
const fmtDuration = (mins?: number | null) => {
  const m = Math.max(0, Number(mins) || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};
const fmtLongDate = (iso: string) => {
  const [y, mo, dd] = iso.split('-').map(Number);
  const d = new Date(y, (mo || 1) - 1, dd || 1);
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};

interface Fix { latitude: number; longitude: number; accuracy?: number; speed?: number | null; }

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
  const { width } = useWindowDimensions();
  const wide = width >= 720;                          // iPad landscape → 4-up KPIs, taller map
  const kpiWidth = wide ? '23.5%' : '48.5%';
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

  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPos = useRef<Fix | null>(null); // freshest high-accuracy fix from watchPosition

  const isToday = date === todayStr();
  const session = me?.activeSession;
  const isActive = !!session && (session.status === 'Active' || session.status === 'active');

  // ─── Data ──────────────────────────────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    try {
      const res = await b2cTrackingService.getMe();
      setMe(res.data || null);
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

  // Forward the freshest fix (from watchPosition) through the resilient sender: it
  // gates low-accuracy fixes on-device, stamps the client capture time, and queues +
  // batch-flushes on network loss so no fix is lost. The server still jitter/teleport
  // filters and snaps to roads.
  const sendPing = useCallback(() => {
    const c = lastPos.current;
    if (!c) return;
    sendB2CPing({
      latitude: c.latitude,
      longitude: c.longitude,
      speedKmh: c.speed != null ? Math.max(0, c.speed * 3.6) : undefined,
      accuracyMetres: c.accuracy != null ? Math.round(c.accuracy) : undefined,
      recordedAt: new Date().toISOString(),
    }).then(sent => { if (sent) fetchMe(); }).catch(() => {});
  }, [fetchMe]);

  // ─── Continuous capture while the day is active ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (watchId.current != null) { Geolocation.clearWatch(watchId.current); watchId.current = null; }
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      stopB2CBackgroundTracking().catch(() => {});
    };

    if (!isActive) { stop(); return; }

    (async () => {
      const ok = await askLocation();
      if (cancelled || !isActive) return;
      if (!ok) { setGeoNote('Location permission is required to track your day.'); return; }

      let firstFix = true;
      watchId.current = Geolocation.watchPosition(
        (pos) => {
          lastPos.current = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
          };
          setGeoNote('');
          if (firstFix) { firstFix = false; sendPing(); } // send immediately on first fix
        },
        (err) => setGeoNote(err?.message || 'Could not read your location. Keep location enabled to track your day.'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000, distanceFilter: 0 },
      );
      pingTimer.current = setInterval(sendPing, SEND_INTERVAL_MS);
      // Keep capturing when the app is backgrounded / the phone locks (Android
      // foreground service + periodic OS wakeup). Foreground pings above stay dense.
      startB2CBackgroundTracking().catch(() => {});
    })();

    return () => { cancelled = true; stop(); };
  }, [isActive, askLocation, sendPing]);

  // ─── Start / End ────────────────────────────────────────────────────────────
  const startDay = async () => {
    setBusy(true); setError(''); setGeoNote('');
    try {
      await b2cTrackingService.startDay();
      toast.success('Day started');
      await fetchMe();
      // capture starts automatically once the session is Active (watchPosition effect).
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to start day';
      setError(msg);
      toast.error(msg);
    } finally { setBusy(false); }
  };

  const endDay = async () => {
    setBusy(true); setError('');
    try {
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
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
    const d = new Date(y, (mo || 1) - 1, (dd || 1) + delta);
    const next = localDateStr(d);
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
        endedAt: null,
      }
    : {
        route: history?.route || [],
        distance: history?.totalDistanceKm ?? 0,
        duration: history?.durationMinutes ?? 0,
        pings: history?.pingCount ?? 0,
        startedAt: history?.startedAt,
        endedAt: history?.endedAt,
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

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      {/* Title + long date */}
      <Text style={[st.title, { color: T.text }]}>My Day</Text>
      <Text style={[st.subtitle, { color: T.sub }]}>{fmtLongDate(date)}</Text>

      {/* Date stepper */}
      <View style={[st.dateBar, { backgroundColor: T.card, borderColor: T.line, marginTop: 14 }]}>
        <IconBtn kind="view" label="Previous day" onPress={() => stepDay(-1)}>
          <ChevronLeft size={16} color={T.accent} strokeWidth={2.2} />
        </IconBtn>
        <Text style={[st.dateTxt, { color: T.text }]}>{isToday ? 'Today' : fmtLongDate(date)}</Text>
        <IconBtn kind="view" label="Next day" onPress={() => canGoNext && stepDay(1)}>
          <ChevronRight size={16} color={canGoNext ? T.accent : T.dim} strokeWidth={2.2} />
        </IconBtn>
      </View>

      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <>
          {/* Day status + start/end (today only) */}
          {isToday && (
            <Card style={{ gap: 12, marginTop: 12 }}>
              <View style={st.statusRow}>
                <View style={[st.statusIcon, { backgroundColor: isActive ? T.success + '26' : T.cardAlt }]}>
                  {isActive && <LivePulse color={T.success} />}
                  <Radio size={20} color={isActive ? T.success : T.dim} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.statusLbl, { color: T.text }]}>Day status</Text>
                  <StatusBadge
                    label={isActive ? 'Active — tracking' : 'Not started'}
                    color={isActive ? T.success : T.sub}
                  />
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

              {!!error && <Text style={[st.noteErr, { color: T.danger }]}>{error}</Text>}
              {!!geoNote && <Text style={[st.noteWarn, { color: T.warning }]}>{geoNote}</Text>}
            </Card>
          )}

          {/* Stats — responsive: 4-up on iPad landscape, 2-up on phone */}
          <View style={[st.grid, { marginTop: 12 }]}>
            <StatTile style={{ width: kpiWidth }} label="Distance" value={`${Number(view.distance).toFixed(1)} km`} icon={<RouteIcon size={15} color={T.accent} />} />
            <StatTile style={{ width: kpiWidth }} label="Duration" value={fmtDuration(view.duration)} tint={T.info} icon={<Clock size={15} color={T.info} />} />
            <StatTile style={{ width: kpiWidth }} label="Start" value={fmtTime(view.startedAt)} tint={T.success} icon={<Play size={15} color={T.success} />} />
            <StatTile style={{ width: kpiWidth }} label="Location pings" value={view.pings} tint={T.warning} icon={<Gauge size={15} color={T.warning} />} />
          </View>

          {/* Route */}
          <SectionLabel style={{ marginTop: 18 }}>
            {isToday ? "Today's route" : 'Route'}
            {view.endedAt ? `  ·  ended ${fmtTime(view.endedAt)}` : ''}
          </SectionLabel>
          {points.length === 0 ? (
            <Card style={st.empty}>
              <MapPin size={30} color={T.dim} />
              <Text style={[st.emptyTitle, { color: T.text }]}>No location yet</Text>
              <Text style={[st.emptyTxt, { color: T.dim }]}>
                {isToday ? 'Start your day to begin tracking your route.' : 'No route recorded for this day.'}
              </Text>
            </Card>
          ) : (
            <>
              <View style={[st.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }, wide && st.mapWrapWide]}>
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
              <Text style={[st.pointsNote, { color: T.dim }]}>{points.length} GPS point{points.length === 1 ? '' : 's'} recorded</Text>
            </>
          )}

          {/* Footer note + manual send */}
          {isToday && (
            <>
              <Text style={[st.footNote, { color: T.dim, marginTop: 12 }]}>
                While your day is active, your location streams continuously at high accuracy.
                Low-accuracy and stray points are filtered out and the route is snapped to roads automatically.
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

const st = StyleSheet.create({
  title: { fontSize: rf(22), fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  dateTxt: { fontSize: rf(13.5), fontWeight: '700' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusLbl: { fontSize: rf(13.5), fontWeight: '700', marginBottom: 4 },
  noteErr: { fontSize: rf(12), fontWeight: '600', lineHeight: 17 },
  noteWarn: { fontSize: rf(12), fontWeight: '600', lineHeight: 17 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  mapWrap: { height: 300, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mapWrapWide: { height: 460 },
  pointsNote: { fontSize: rf(11), fontWeight: '600', textAlign: 'center', marginTop: 8 },

  empty: { paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: 18 },

  footNote: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 17 },
});
