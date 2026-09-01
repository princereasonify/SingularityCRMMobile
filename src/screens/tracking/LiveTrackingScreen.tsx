import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigation, DrawerActions } from '@react-navigation/native';
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
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region as MapRegion } from 'react-native-maps';
import {
  MapPin,
  Navigation,
  Clock,
  X,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Activity,
  Radio,
  Check,
  AlertTriangle,
  DollarSign,
  Calendar,
  RefreshCw,
  Trash2,
  Layers,
  FileText,
  Route as RouteIcon,
  School as SchoolIcon,
  Sparkles,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import BackgroundFetch from 'react-native-background-fetch';
import { sendLocationPing } from '../../services/locationPingService';
import { startNativeTracking, stopNativeTracking, requestIOSLocationPermission, checkIOSPermission } from '../../services/nativeLocationTracking';
import { BackgroundLocationDisclosure } from '../../components/common/BackgroundLocationDisclosure';
import { DateInput } from '../../components/common/DateInput';
import { trackingApi } from '../../api/tracking';
import { apiClient } from '../../api/client';
import type { VehicleType } from '../../api/tracking';
import { schoolAssignmentsApi } from '../../api/schoolAssignments';
import { leadsApi } from '../../api/leads';
import {
  LiveLocationDto, RoutePointDto, SessionResponseDto, TrackingSessionDto,
  SchoolAssignment, SchoolGeofence, UserDto,
} from '../../types';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import type { AppTheme } from '../../theme';
import {
  Btn, SearchBar, Checkbox, FilterChip, FormModal, ConfirmModal, StatusBadge, Segmented,
  Pagination,
} from '../../components/crud';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  formatTime,
  toISODate,
} from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

const PING_QUEUE_KEY = 'tracking_ping_queue';
const PING_INTERVAL_MS = 30000;

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'myDay' | 'map' | 'team' | 'assignments';
type StatusFilter = 'all' | 'active' | 'ended';

/** react-native-maps MapView `mapType` values web offers on its map-type selector. */
type MapKind = 'standard' | 'satellite' | 'terrain' | 'hybrid';
const MAP_KINDS: { key: MapKind; label: string }[] = [
  { key: 'standard', label: 'Default' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'hybrid', label: 'Hybrid' },
];

/**
 * Mirrors web's Start-Day vehicle modal (LiveTracking.jsx:1324-1353).
 * Values are the literal `SalesCRM.Core.Enums.VehicleType` members — the service
 * does `Enum.TryParse<VehicleType>(vehicleType, true, out var vt)` so anything
 * outside this set silently falls back to the "applies to all vehicles" config.
 */
const VEHICLE_OPTIONS: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'TwoWheeler', label: 'Two Wheeler (Activa / Bike)', icon: '🏍️' },
  { value: 'FourWheeler', label: 'Four Wheeler (Car)', icon: '🚗' },
  { value: 'PublicTransport', label: 'Public Transport', icon: '🚌' },
  { value: 'Other', label: 'Other', icon: '🚶' },
];

/** Result of the Google Directions optimisation for the FO's day plan. */
interface RouteStats { distanceKm: string; durationMin: number }

/**
 * Why the optimisation did not run, in a form we can put on screen. `status` is the
 * literal Directions API `status` field (REQUEST_DENIED / ZERO_RESULTS / OVER_QUERY_LIMIT
 * / …) and `detail` the API's own `error_message` when it sends one — without those two
 * a misconfigured key is indistinguishable from "optimisation just does nothing".
 */
interface RouteOptFailure { status: string; detail?: string }

interface ZoneGroup {
  zoneName: string;
  zoneId?: number;
  zh?: LiveLocationDto;
  fos: LiveLocationDto[];
}

interface RegionGroup {
  regionName: string;
  regionId?: number;
  rh?: LiveLocationDto;
  zones: ZoneGroup[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIA_REGION: MapRegion = {
  latitude: 20.5937, longitude: 78.9629,
  latitudeDelta: 20, longitudeDelta: 20,
};

const LIVE_REFRESH_MS = 30000;

/**
 * House page size (SchoolsListScreen, LeadsListScreen, … all use 10).
 *
 * Both lists on this screen page CLIENT-SIDE, because neither endpoint accepts a
 * page/limit:
 *   TrackingController.cs:68-69
 *     [HttpGet("live-locations")]
 *     public async Task<IActionResult> GetLiveLocations([FromQuery] string? role = null)
 *   SchoolAssignmentsController.cs:58-59
 *     [HttpGet("team")]
 *     public async Task<IActionResult> GetTeamAssignments([FromQuery] string date)
 * `role` and `date` are the only bound query parameters — a `page`/`limit` we sent
 * would be silently dropped, so the full list is fetched and sliced on device.
 */
const PAGE_SIZE = 10;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** lucide stroke weight used across the design system. */
const ICON_STROKE = 1.9;

/**
 * Role identity, expressed in design-system tokens instead of the legacy role palette
 * (teal / purple / orange / blue / rose). Each role keeps a distinct hue so a map full
 * of markers is still readable, but every hue is a theme token so light/dark both work.
 * `T` is passed in — a theme token can never live in a default parameter.
 */
const roleTint = (role: string, T: AppTheme): string =>
  role === 'ZH' ? T.info
    : role === 'RH' ? T.warning
      : role === 'SH' ? T.success
        : role === 'SCA' ? T.danger
          : T.accent; // FO and anything unrecognised

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getLast7Days = (): string[] =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return toISODate(d);
  });

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const routeKm = (pts: RoutePointDto[]) =>
  pts.slice(1).reduce((s, p, i) => s + haversineKm(pts[i].lat, pts[i].lon, p.lat, p.lon), 0);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const buildZoneGroups = (users: LiveLocationDto[]): ZoneGroup[] => {
  const names = [...new Set(users.map(u => u.zoneName).filter(Boolean))] as string[];
  const groups = names.map(zoneName => ({
    zoneName,
    zoneId: users.find(u => u.zoneName === zoneName)?.zoneId,
    zh: users.find(u => u.role === 'ZH' && u.zoneName === zoneName),
    fos: users.filter(u => u.role === 'FO' && u.zoneName === zoneName),
  })).filter(g => g.zh || g.fos.length > 0);
  const unzoned = users.filter(u => u.role === 'FO' && !u.zoneName);
  if (unzoned.length) groups.push({ zoneName: 'Unassigned FOs', zoneId: undefined, zh: undefined, fos: unzoned });
  return groups;
};

const buildRegionGroups = (users: LiveLocationDto[]): RegionGroup[] => {
  const names = [...new Set(users.map(u => u.regionName).filter(Boolean))] as string[];
  return names.map(regionName => ({
    regionName,
    regionId: users.find(u => u.regionName === regionName)?.regionId,
    rh: users.find(u => u.role === 'RH' && u.regionName === regionName),
    zones: buildZoneGroups(users.filter(u => u.regionName === regionName && u.role !== 'RH')),
  })).filter(g => g.rh || g.zones.length > 0);
};

// ─── Shared themed pieces ─────────────────────────────────────────────────────

/**
 * Themed replacement for the un-themed common/EmptyState (it paints fixed light-mode
 * greys from the legacy CS stylesheet, which is unreadable on the dark surfaces).
 */
const Empty = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => {
  const T = useAppTheme();
  return (
    <View style={[nStyles.stateCard, { backgroundColor: T.card, borderColor: T.line }]}>
      {icon}
      <Text style={[nStyles.stateTitle, { color: T.text }]}>{title}</Text>
      {!!subtitle && <Text style={[nStyles.stateTxt, { color: T.dim }]}>{subtitle}</Text>}
    </View>
  );
};

/** Role pill — the kit's StatusBadge tinted by role, replacing the legacy RoleBadge. */
const RolePill = ({ role }: { role: string }) => {
  const T = useAppTheme();
  return <StatusBadge label={role} color={roleTint(role, T)} />;
};

// ─── Map marker components ────────────────────────────────────────────────────

const AllUsersMarker = React.memo(({ user }: { user: LiveLocationDto }) => {
  const T = useAppTheme();
  const c = roleTint(user.role, T);
  const active = user.status === 'active';
  return (
    <View style={amStyles.wrap}>
      {active && <View style={[amStyles.pulse, { borderColor: c }]} />}
      <View style={[amStyles.bubble, { backgroundColor: c, borderColor: T.card, opacity: active ? 1 : 0.6 }]}>
        <Text style={[amStyles.ini, { color: T.onAccent }]}>{initials(user.name)}</Text>
        <Text style={[amStyles.role, { color: withAlpha(T.onAccent, 0.85) }]}>{user.role}</Text>
      </View>
      <View style={[amStyles.pin, { borderTopColor: c, opacity: active ? 1 : 0.6 }]} />
    </View>
  );
});

const amStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pulse: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2, top: -8, opacity: 0.3 },
  bubble: {
    minWidth: 40, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 9,
    alignItems: 'center', borderWidth: 2.5,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, elevation: 6,
  },
  ini: { fontSize: rf(11), fontWeight: '800' },
  role: { fontSize: rf(7), fontWeight: '700', marginTop: 1 },
  pin: {
    width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1,
  },
});

// Live marker — larger, pulsing ring for individual tracking
const LiveUserMarker = ({ user }: { user: LiveLocationDto }) => {
  const T = useAppTheme();
  const c = roleTint(user.role, T);
  return (
    <View style={lvStyles.wrap}>
      <View style={[lvStyles.outerRing, { borderColor: c }]} />
      <View style={[lvStyles.innerRing, { borderColor: c }]} />
      <View style={[lvStyles.dot, { backgroundColor: c, borderColor: T.card }]}>
        <Text style={[lvStyles.ini, { color: T.onAccent }]}>{initials(user.name)}</Text>
      </View>
    </View>
  );
};

const lvStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  outerRing: {
    position: 'absolute', width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, opacity: 0.2,
  },
  innerRing: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, opacity: 0.4,
  },
  dot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  ini: { fontSize: rf(12), fontWeight: '800' },
});

// ─── Individual Tracking View ─────────────────────────────────────────────────
// Full-screen view: live location marker + route polyline + auto-refresh + day picker

interface IndividualTrackingProps {
  person: LiveLocationDto;         // initial live data
  onBack: () => void;
}

const IndividualTrackingView = ({ person, onBack }: IndividualTrackingProps) => {
  const T = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const days = useMemo(() => getLast7Days(), []);
  const today = days[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [liveData, setLiveData] = useState<LiveLocationDto>(person);
  const [routePoints, setRoutePoints] = useState<RoutePointDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const isToday = selectedDate === today;
  const personColor = roleTint(person.role, T);

  // ── Load route for selected date ──────────────────────────────────────────
  const loadRoute = useCallback(async (date: string) => {
    try {
      const res = await trackingApi.getRoute(person.userId, date);
      const data = res.data as any;
      const raw: RoutePointDto[] = data?.route ?? data?.points ?? (Array.isArray(data) ? data : []);
      const valid = raw.filter((p: RoutePointDto) => p.lat && p.lon && !p.isFiltered);
      setRoutePoints(valid);
      if (valid.length > 0) {
        const coords = valid.map((p: RoutePointDto) => ({ latitude: p.lat, longitude: p.lon }));
        // If viewing today, include the live marker in the fit
        if (date === today && liveData.latitude && liveData.longitude) {
          coords.push({ latitude: liveData.latitude, longitude: liveData.longitude });
        }
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 50, bottom: 160, left: 50 }, animated: true,
          });
        }, 400);
      } else if (date === today && liveData.latitude && liveData.longitude) {
        // No route yet but person is live — zoom to their location
        mapRef.current?.animateToRegion({
          latitude: liveData.latitude, longitude: liveData.longitude,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }, 600);
      }
    } catch {
      setRoutePoints([]);
    }
  }, [person.userId, today, liveData.latitude, liveData.longitude]);

  // ── Refresh live location (today only) ───────────────────────────────────
  const refreshLive = useCallback(async () => {
    try {
      const res = await trackingApi.getLiveLocations();
      const updated = (res.data as LiveLocationDto[]).find(u => u.userId === person.userId);
      if (updated) {
        setLiveData(updated);
        setLastRefreshed(new Date());
      }
    } catch {}
  }, [person.userId]);

  // ── Full refresh: live + route ────────────────────────────────────────────
  const fullRefresh = useCallback(async () => {
    await Promise.all([
      isToday ? refreshLive() : Promise.resolve(),
      loadRoute(selectedDate),
    ]);
  }, [isToday, refreshLive, loadRoute, selectedDate]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fullRefresh().finally(() => setLoading(false));
  }, [selectedDate]); // re-run when date changes

  // Auto-refresh every 30s (today only)
  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    if (isToday) {
      refreshRef.current = setInterval(fullRefresh, LIVE_REFRESH_MS);
    }
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [isToday, fullRefresh]);

  // ── Derived values ────────────────────────────────────────────────────────
  const routeCoords = routePoints.map(p => ({ latitude: p.lat, longitude: p.lon }));
  const totalKm = routeKm(routePoints);
  const startTime = routePoints.length ? fmtTime(routePoints[0].recordedAt) : '--';
  const endTime = routePoints.length > 1 ? fmtTime(routePoints[routePoints.length - 1].recordedAt) : '--';
  const hasLiveLocation = isToday && liveData.latitude && liveData.longitude;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['bottom']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[ivStyles.header, { backgroundColor: T.card, borderBottomColor: T.line }]}>
        <TouchableOpacity
          onPress={onBack}
          style={ivStyles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color={T.text} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>

        <View style={ivStyles.headerCenter}>
          <View style={[ivStyles.headerAvatar, { backgroundColor: personColor }]}>
            <Text style={[ivStyles.headerAvatarText, { color: T.onAccent }]}>{initials(person.name)}</Text>
          </View>
          <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
            <Text style={[ivStyles.headerName, { color: T.text }]} numberOfLines={1}>{person.name}</Text>
            <View style={ivStyles.headerMeta}>
              <RolePill role={person.role} />
              {person.zoneName && (
                <Text style={[ivStyles.headerZone, { color: T.dim }]} numberOfLines={1}>{person.zoneName}</Text>
              )}
              {person.regionName && !person.zoneName && (
                <Text style={[ivStyles.headerZone, { color: T.dim }]} numberOfLines={1}>{person.regionName}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Live indicator */}
        {liveData.status === 'active' && isToday ? (
          <View style={[ivStyles.liveChip, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
            <View style={[ivStyles.livePulse, { backgroundColor: T.success }]} />
            <Text style={[ivStyles.liveText, { color: T.success }]}>LIVE</Text>
          </View>
        ) : (
          <StatusBadge label="Ended" color={T.dim} />
        )}
      </View>

      {/* ── Date picker ────────────────────────────────────────────────── */}
      <View style={[ivStyles.dateBar, { backgroundColor: T.cardAlt, borderBottomColor: T.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ivStyles.dateScroll}>
          {days.map((d, i) => {
            const active = selectedDate === d;
            return (
              <TouchableOpacity
                key={d}
                style={[
                  ivStyles.dateChip,
                  { backgroundColor: active ? T.accentSoft : T.card, borderColor: active ? T.accent : T.line },
                ]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[ivStyles.dateChipText, { color: active ? T.accent : T.sub }]}>
                  {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isToday && (
          <View style={ivStyles.refreshBadge}>
            <Radio size={11} color={T.success} strokeWidth={ICON_STROKE} />
            <Text style={[ivStyles.refreshText, { color: T.success }]}>
              {fmtTime(lastRefreshed.toISOString())}
            </Text>
          </View>
        )}
      </View>

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={INDIA_REGION}>
          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={personColor}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}

          {/* Start pin */}
          {routeCoords.length > 0 && (
            <Marker
              coordinate={routeCoords[0]}
              pinColor={T.success}
              title="Start"
              description={startTime}
            />
          )}

          {/* End pin (only for past dates — for today the live marker is the end) */}
          {routeCoords.length > 1 && !isToday && (
            <Marker
              coordinate={routeCoords[routeCoords.length - 1]}
              pinColor={T.danger}
              title="End"
              description={endTime}
            />
          )}

          {/* Live position marker (today only) — pulsing ring */}
          {hasLiveLocation && (
            <Marker
              coordinate={{ latitude: liveData.latitude, longitude: liveData.longitude }}
              tracksViewChanges={false}
              title={liveData.name}
              description={`Speed: ${liveData.speedKmh?.toFixed(0) ?? '--'} km/h`}
            >
              <LiveUserMarker user={liveData} />
            </Marker>
          )}
        </MapView>

        {/* Loading overlay */}
        {loading && (
          <View style={[ivStyles.overlay, { backgroundColor: withAlpha(T.bg, 0.9) }]}>
            <LoadingSpinner color={T.accent} message="Loading tracking data..." />
          </View>
        )}

        {/* No data overlay */}
        {!loading && routePoints.length === 0 && !hasLiveLocation && (
          <View style={[ivStyles.overlay, { backgroundColor: withAlpha(T.bg, 0.9) }]}>
            <Empty
              icon={<Radio size={30} color={T.dim} strokeWidth={ICON_STROKE} />}
              title="No tracking data"
              subtitle={isToday ? "This person hasn't started tracking today." : `No data for ${formatDate(selectedDate)}`}
            />
          </View>
        )}

        {/* No route yet but person is live */}
        {!loading && routePoints.length === 0 && hasLiveLocation && (
          <View style={ivStyles.noRouteHint} pointerEvents="none">
            <Text
              style={[ivStyles.noRouteText, { backgroundColor: T.card, color: T.sub, borderColor: T.line }]}
            >
              Route building… location updated
            </Text>
          </View>
        )}

        {/* ── Stats Panel ──────────────────────────────────────────────── */}
        <View style={[ivStyles.statsPanel, { backgroundColor: T.card, borderTopColor: T.line }]}>
          {/* Top row: quick stats — equal-height cells, no dead space */}
          <View style={ivStyles.statsRow}>
            <View style={ivStyles.statBox}>
              <Navigation size={16} color={personColor} strokeWidth={ICON_STROKE} />
              <Text style={[ivStyles.statVal, { color: T.text }]} numberOfLines={1}>{totalKm.toFixed(1)} km</Text>
              <Text style={[ivStyles.statLbl, { color: T.dim }]}>Distance</Text>
            </View>
            <View style={[ivStyles.statDivider, { backgroundColor: T.line }]} />
            <View style={ivStyles.statBox}>
              <Activity size={16} color={personColor} strokeWidth={ICON_STROKE} />
              <Text style={[ivStyles.statVal, { color: T.text }]} numberOfLines={1}>{liveData.speedKmh?.toFixed(0) ?? '--'} km/h</Text>
              <Text style={[ivStyles.statLbl, { color: T.dim }]}>Speed</Text>
            </View>
            <View style={[ivStyles.statDivider, { backgroundColor: T.line }]} />
            <View style={ivStyles.statBox}>
              <MapPin size={16} color={personColor} strokeWidth={ICON_STROKE} />
              <Text style={[ivStyles.statVal, { color: T.text }]} numberOfLines={1}>{routePoints.length}</Text>
              <Text style={[ivStyles.statLbl, { color: T.dim }]}>Pings</Text>
            </View>
            <View style={[ivStyles.statDivider, { backgroundColor: T.line }]} />
            <View style={ivStyles.statBox}>
              <Clock size={16} color={personColor} strokeWidth={ICON_STROKE} />
              <Text style={[ivStyles.statVal, { color: T.text }]} numberOfLines={1}>{formatRelativeDate(liveData.lastSeen)}</Text>
              <Text style={[ivStyles.statLbl, { color: T.dim }]}>Last Seen</Text>
            </View>
          </View>

          {/* Bottom row: time + battery */}
          <View style={ivStyles.statsRowSecondary}>
            <View style={[ivStyles.statPill, { backgroundColor: T.cardAlt }]}>
              <Text style={[ivStyles.statPillLabel, { color: T.success }]}>▶ {startTime}</Text>
              <Text style={[ivStyles.statPillSub, { color: T.dim }]}>Start</Text>
            </View>
            {(isToday ? liveData.status === 'ended' : true) && routePoints.length > 1 && (
              <View style={[ivStyles.statPill, { backgroundColor: T.cardAlt }]}>
                <Text style={[ivStyles.statPillLabel, { color: T.danger }]}>■ {endTime}</Text>
                <Text style={[ivStyles.statPillSub, { color: T.dim }]}>End</Text>
              </View>
            )}
            {liveData.batteryLevel != null && (
              <View style={[ivStyles.statPill, { backgroundColor: T.cardAlt }]}>
                <Text style={[ivStyles.statPillLabel, { color: liveData.batteryLevel < 0.2 ? T.danger : T.sub }]}>
                  🔋 {Math.round(liveData.batteryLevel * 100)}%
                </Text>
                <Text style={[ivStyles.statPillSub, { color: T.dim }]}>Battery</Text>
              </View>
            )}
            {liveData.isSuspicious && (
              <View style={[ivStyles.statPill, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
                <Text style={[ivStyles.statPillLabel, { color: T.danger }]}>
                  ⚠ {liveData.fraudScore}
                </Text>
                <Text style={[ivStyles.statPillSub, { color: T.dim }]}>Fraud</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const ivStyles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, gap: 8, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerCenter: { flexShrink: 1, minWidth: 0, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: rf(13), fontWeight: '800' },
  headerName: { fontSize: rf(14), fontWeight: '700' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  headerZone: { fontSize: rf(11), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 22, borderRadius: 11,
  },
  liveText: { fontSize: rf(10), fontWeight: '800' },
  livePulse: { width: 7, height: 7, borderRadius: 3.5 },

  // Date bar
  dateBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  dateScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexGrow: 1 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1,
  },
  dateChipText: { fontSize: rf(12), fontWeight: '600' },
  refreshBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingRight: 14,
  },
  refreshText: { fontSize: rf(10), fontWeight: '600' },

  // Map overlays
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  noRouteHint: {
    position: 'absolute', top: 16, left: 0, right: 0,
    alignItems: 'center', zIndex: 5,
  },
  noRouteText: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1,
    fontSize: rf(12), fontWeight: '600', overflow: 'hidden',
  },

  // Stats panel
  statsPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, paddingTop: 14, paddingBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 12,
  },
  // alignItems:'stretch' so every cell is the full row height — no clipped tiles.
  statsRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 16, marginBottom: 10 },
  statBox: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4, minWidth: 0 },
  statDivider: { width: 1, marginVertical: 4 },
  statVal: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  statLbl: { fontSize: rf(10), fontWeight: '500', textAlign: 'center' },
  statsRowSecondary: {
    flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 12, gap: 8, flexWrap: 'wrap',
  },
  statPill: {
    borderRadius: 11, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
  },
  statPillLabel: { fontSize: rf(12), fontWeight: '700', textAlign: 'center' },
  statPillSub: { fontSize: rf(9), marginTop: 1, textAlign: 'center' },
});

// ─── Compact person row (used inside ZoneGroup / RegionGroup) ─────────────────

interface PersonRowProps {
  user: LiveLocationDto;
  indent?: boolean;
  onPress: (u: LiveLocationDto) => void;
}

const PersonRow = ({ user, indent = false, onPress }: PersonRowProps) => {
  const T = useAppTheme();
  const c = roleTint(user.role, T);
  const active = user.status === 'active';
  return (
    <TouchableOpacity
      style={[
        prStyles.row,
        { backgroundColor: indent ? T.cardAlt : T.card, borderBottomColor: T.line },
        indent && prStyles.indented,
      ]}
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      <View style={prStyles.avatarWrap}>
        {user.avatar && user.avatar.startsWith('http') ? (
          <Image source={{ uri: user.avatar }} style={prStyles.avatar} />
        ) : (
          <View style={[prStyles.avatar, { backgroundColor: c }]}>
            <Text style={[prStyles.avatarText, { color: T.onAccent }]}>{initials(user.name)}</Text>
          </View>
        )}
        <View
          style={[prStyles.dot, { backgroundColor: active ? T.success : T.dim, borderColor: T.card }]}
        />
      </View>

      <View style={prStyles.info}>
        <Text style={[prStyles.name, { color: T.text }]} numberOfLines={1}>{user.name}</Text>
        <View style={prStyles.meta}>
          <RolePill role={user.role} />
          {user.zoneName && !indent && (
            <Text style={[prStyles.sub, { color: T.dim }]} numberOfLines={1}>{user.zoneName}</Text>
          )}
          {user.regionName && !user.zoneName && (
            <Text style={[prStyles.sub, { color: T.dim }]} numberOfLines={1}>{user.regionName}</Text>
          )}
        </View>
      </View>

      <View style={prStyles.right}>
        <View style={prStyles.statsInline}>
          <Navigation size={11} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[prStyles.statText, { color: T.sub }]}>{user.totalDistanceKm.toFixed(1)}km</Text>
          <Clock size={11} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[prStyles.statText, { color: T.sub }]}>{formatRelativeDate(user.lastSeen)}</Text>
        </View>
        <StatusBadge label={active ? 'Active' : 'Ended'} color={active ? T.success : T.dim} />
      </View>

      <ChevronRight size={16} color={T.dim} strokeWidth={ICON_STROKE} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
};

const prStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  indented: { paddingLeft: 30 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: rf(12), fontWeight: '800' },
  dot: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2,
    position: 'absolute', bottom: 0, right: -1,
  },
  // flexShrink:1 + minWidth:0 — a long name would otherwise paint over the stats column.
  info: { flexShrink: 1, minWidth: 0, flexGrow: 1 },
  name: { fontSize: rf(13), fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  sub: { fontSize: rf(11), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  statsInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: rf(10), fontWeight: '500' },
});

// ─── Zone Group (collapsible) ─────────────────────────────────────────────────

interface ZoneGroupProps {
  group: ZoneGroup;
  onPersonPress: (u: LiveLocationDto) => void;
  defaultExpanded?: boolean;
}

const ZoneGroupSection = ({ group, onPersonPress, defaultExpanded = true }: ZoneGroupProps) => {
  const T = useAppTheme();
  const tint = roleTint('ZH', T);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const total = (group.zh ? 1 : 0) + group.fos.length;
  const active = [group.zh, ...group.fos].filter(u => u?.status === 'active').length;

  return (
    <View style={[zgStyles.container, { borderColor: T.line }]}>
      <TouchableOpacity
        style={[zgStyles.header, { backgroundColor: T.cardAlt }]}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={[zgStyles.iconWrap, { backgroundColor: withAlpha(tint, SOFT_TINT) }]}>
          <MapPin size={13} color={tint} strokeWidth={ICON_STROKE} />
        </View>
        <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
          <Text style={[zgStyles.title, { color: T.text }]} numberOfLines={1}>{group.zoneName}</Text>
          <Text style={[zgStyles.sub, { color: T.dim }]} numberOfLines={1}>
            {active > 0 ? `${active} active · ` : ''}{total} member{total !== 1 ? 's' : ''}
          </Text>
        </View>
        {active > 0 && <StatusBadge label={String(active)} color={tint} />}
        {expanded
          ? <ChevronDown size={15} color={T.dim} strokeWidth={ICON_STROKE} />
          : <ChevronRight size={15} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>

      {expanded && (
        <View>
          {group.zh && <PersonRow user={group.zh} onPress={onPersonPress} />}
          {group.fos.map(fo => (
            <PersonRow key={fo.userId} user={fo} indent onPress={onPersonPress} />
          ))}
          {total === 0 && (
            <Text style={[zgStyles.empty, { color: T.dim, backgroundColor: T.card }]}>
              No tracking data for this zone today.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const zgStyles = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 2 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: rf(13), fontWeight: '700' },
  sub: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  empty: { fontSize: rf(12), fontWeight: '500', textAlign: 'center', padding: 14 },
});

// ─── Region Group (collapsible) ───────────────────────────────────────────────

interface RegionGroupProps {
  group: RegionGroup;
  onPersonPress: (u: LiveLocationDto) => void;
}

const RegionGroupSection = ({ group, onPersonPress }: RegionGroupProps) => {
  const T = useAppTheme();
  const tint = roleTint('RH', T);
  const [expanded, setExpanded] = useState(true);
  const totalUsers = (group.rh ? 1 : 0) + group.zones.reduce((s, z) => s + (z.zh ? 1 : 0) + z.fos.length, 0);
  const activeUsers = [group.rh, ...group.zones.flatMap(z => [z.zh, ...z.fos])]
    .filter(u => u?.status === 'active').length;

  return (
    <View style={[rgStyles.container, { borderColor: T.lineStrong, backgroundColor: T.card }]}>
      <TouchableOpacity
        style={[rgStyles.header, { backgroundColor: T.cardAlt }]}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={[rgStyles.iconWrap, { backgroundColor: withAlpha(tint, SOFT_TINT) }]}>
          <Users size={13} color={tint} strokeWidth={ICON_STROKE} />
        </View>
        <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
          <Text style={[rgStyles.title, { color: T.text }]} numberOfLines={1}>{group.regionName}</Text>
          <Text style={[rgStyles.sub, { color: T.dim }]} numberOfLines={1}>
            {activeUsers > 0 ? `${activeUsers} active · ` : ''}
            {totalUsers} member{totalUsers !== 1 ? 's' : ''} · {group.zones.length} zone{group.zones.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {activeUsers > 0 && <StatusBadge label={String(activeUsers)} color={tint} />}
        {expanded
          ? <ChevronDown size={15} color={T.dim} strokeWidth={ICON_STROKE} />
          : <ChevronRight size={15} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>

      {expanded && (
        <View style={rgStyles.body}>
          {group.rh && <PersonRow user={group.rh} onPress={onPersonPress} />}
          {group.zones.map(z => (
            <ZoneGroupSection key={z.zoneName} group={z} onPersonPress={onPersonPress} defaultExpanded={false} />
          ))}
        </View>
      )}
    </View>
  );
};

const rgStyles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: rf(14), fontWeight: '800' },
  sub: { fontSize: rf(11), fontWeight: '500', marginTop: 2 },
  body: { gap: 8, padding: 10 },
});

// ─── Main LiveTrackingScreen ──────────────────────────────────────────────────

export const LiveTrackingScreen = () => {
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const T = useAppTheme();
  const isSCA = user?.role === 'SCA';
  // Web gates ManagerSection on the same set (LiveTracking.jsx:2261-2278).
  const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(user?.role ?? '');

  /**
   * `wide` = iPad held in landscape. It drives the two-pane tab bodies, the wider
   * gutters and the map's side panel.
   *
   * NOTE on sizing: the app keeps a permanent 240pt sidebar on screen, so `width`
   * here OVERSTATES the usable content width. Nothing below is sized as a fraction
   * of `width` — every wide layout is expressed with flex, `alignItems:'stretch'`
   * and maxWidth so it measures against the real parent instead.
   */
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad (either orientation) gets real tables; phones get stacked rows. */
  const table = isTabletDevice;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(isSCA ? 'map' : 'myDay');

  // ── My Day state ────────────────────────────────────────────────────────────
  const [daySession, setDaySession] = useState<TrackingSessionDto | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [startEnabled, setStartEnabled] = useState(false);
  const [endEnabled, setEndEnabled] = useState(false);
  const [dayActionLoading, setDayActionLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [showBgDisclosure, setShowBgDisclosure] = useState(false);
  const bgPermissionResolveRef = useRef<((accepted: boolean) => void) | null>(null);
  const iosPingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [historyDate, setHistoryDate] = useState(toISODate(new Date()));
  const [historySession, setHistorySession] = useState<TrackingSessionDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Start-Day vehicle picker (drives the allowance rate — see VEHICLE_OPTIONS)
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('TwoWheeler');

  // My Day: the FO's own assigned schools for today (route list + Report button)
  const [myAssignments, setMyAssignments] = useState<SchoolAssignment[]>([]);
  const [myAssignLoading, setMyAssignLoading] = useState(false);

  // My Day: distance-optimised stop order (web's AssignedSchoolsMap, LiveTracking.jsx:426-763)
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [optimizedStops, setOptimizedStops] = useState<SchoolAssignment[] | null>(null);
  const [routeOptLoading, setRouteOptLoading] = useState(false);
  const [routeOptFailure, setRouteOptFailure] = useState<RouteOptFailure | null>(null);
  /** Bumped by the "Retry" affordance on the failure notice to re-run the request. */
  const [routeOptAttempt, setRouteOptAttempt] = useState(0);

  // Individual tracking — when set, shows IndividualTrackingView full-screen
  const [trackingPerson, setTrackingPerson] = useState<LiveLocationDto | null>(null);

  // Assignments tab (manager only)
  const [assignFOs, setAssignFOs] = useState<UserDto[]>([]);
  const [assignFOId, setAssignFOId] = useState<number | null>(null);
  const [showFOPicker, setShowFOPicker] = useState(false);
  const [assignDate, setAssignDate] = useState(toISODate(new Date()));
  const [allSchools, setAllSchools] = useState<SchoolGeofence[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<number[]>([]);
  const [schoolPickerOpen, setSchoolPickerOpen] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [assignPage, setAssignPage] = useState(1);
  const [teamAssignments, setTeamAssignments] = useState<SchoolAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Map tab: map-type selector (web offers Default/Satellite/Terrain/Hybrid)
  const [mapKind, setMapKind] = useState<MapKind>('standard');

  // Map state
  const [liveUsers, setLiveUsers] = useState<LiveLocationDto[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LiveLocationDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const mapRef = useRef<MapView>(null);

  // Team tab: user picker + date filter
  const [teamPage, setTeamPage] = useState(1);
  const [selectedTeamUser, setSelectedTeamUser] = useState<LiveLocationDto | null>(null);
  const [teamDate, setTeamDate] = useState(toISODate(new Date()));
  const [showTeamUserPicker, setShowTeamUserPicker] = useState(false);
  const [teamUserSearch, setTeamUserSearch] = useState('');

  // SCA: SH-level filter — when an SH is selected, fetch their scoped team
  const [selectedSHId, setSelectedSHId] = useState<number | null>(null);
  const [shTeamUsers, setShTeamUsers] = useState<LiveLocationDto[]>([]);
  const [shTeamLoading, setShTeamLoading] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didFitMap = useRef(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchLive = useCallback(async () => {
    try {
      const res = await trackingApi.getLiveLocations();
      const data = res.data as LiveLocationDto[];
      setLiveUsers(data);
      if (!didFitMap.current && data.length > 0) {
        didFitMap.current = true;
        const coords = data.filter(u => u.latitude && u.longitude)
          .map(u => ({ latitude: u.latitude, longitude: u.longitude }));
        if (coords.length > 0) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 }, animated: true,
            });
          }, 700);
        }
      }
    } catch {
      setLiveUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchLive().finally(() => setLoading(false));
  }, [fetchLive]);

  useEffect(() => {
    autoRefreshRef.current = setInterval(fetchLive, LIVE_REFRESH_MS);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchLive]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLive().finally(() => setRefreshing(false));
  }, [fetchLive]);

  const handlePersonPress = useCallback((u: LiveLocationDto) => {
    setTrackingPerson(u);
  }, []);

  // SCA: fetch team for the selected SH.
  // NOTE: this used to pass `shId` to `getLiveLocations`, but the controller only
  // binds `[FromQuery] string? role` — there is no per-manager filter server-side,
  // so that argument was silently dropped and this always returned everyone.
  // Dropping it changes nothing at runtime; narrowing to one SH's team needs a new
  // backend param. The list is unfiltered either way — flagged, not silently "fixed".
  const fetchSHTeam = useCallback(async (_shId: number) => {
    setShTeamLoading(true);
    try {
      const res = await trackingApi.getLiveLocations();
      const data = res.data as LiveLocationDto[];
      setShTeamUsers(Array.isArray(data) ? data : []);
    } catch {
      setShTeamUsers([]);
    } finally {
      setShTeamLoading(false);
    }
  }, []);

  const handleSelectSH = useCallback((shId: number | null) => {
    setSelectedSHId(shId);
    setSearchQuery('');
    setRoleFilter('all');
    if (shId !== null) {
      fetchSHTeam(shId);
    }
  }, [fetchSHTeam]);

  // ── School assignments ────────────────────────────────────────────────────
  //
  //   SchoolAssignmentsController.cs:58  [HttpGet("team")]
  //   SchoolAssignmentsController.cs:59  GetTeamAssignments([FromQuery] string date)
  //   SchoolAssignmentsController.cs:62  return Ok(ApiResponse<List<SchoolAssignmentDto>>.Ok(result));
  //
  // `date` is a non-nullable bound parameter, so it must always be sent.
  const fetchTeamAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const res = await schoolAssignmentsApi.getTeamAssignments(assignDate);
      const data = res.data as SchoolAssignment[];
      setTeamAssignments(Array.isArray(data) ? data : []);
    } catch {
      setTeamAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  }, [assignDate]);

  const fetchSchoolsForAssign = useCallback(async () => {
    try {
      const res = await schoolAssignmentsApi.getSchoolsForMap();
      const data = res.data as SchoolGeofence[];
      setAllSchools(Array.isArray(data) ? data : []);
    } catch {
      setAllSchools([]);
    }
  }, []);

  //   LeadsController.cs:131  [HttpGet("assignable-fos")]
  //   LeadsController.cs:135  return Ok(ApiResponse<List<UserDto>>.Ok(fos));
  useEffect(() => {
    if (!isManager) return;
    leadsApi.getAssignableFOs()
      .then(res => setAssignFOs(Array.isArray(res.data) ? (res.data as UserDto[]) : []))
      .catch(() => setAssignFOs([]));
  }, [isManager]);

  useEffect(() => {
    if (activeTab !== 'assignments') return;
    fetchTeamAssignments();
    if (allSchools.length === 0) fetchSchoolsForAssign();
  }, [activeTab, fetchTeamAssignments, fetchSchoolsForAssign, allSchools.length]);

  const toggleSchoolSelection = useCallback((schoolId: number) => {
    setSelectedSchoolIds(prev =>
      prev.includes(schoolId) ? prev.filter(id => id !== schoolId) : [...prev, schoolId],
    );
  }, []);

  /**
   * MERGE BEFORE ASSIGNING.
   *
   * `SchoolAssignmentService.BulkAssignAsync` deletes every existing assignment for
   * (userId, date) before inserting — its own comment says "Wholesale-replace the
   * target user's plan for this date". Web posts only the newly-ticked schools
   * (LiveTracking.jsx:1483-1487), so assigning one extra school there silently wipes
   * the rest of that FO's day plan. We read the FO's current plan first and post the
   * union, existing schools first so their visit order is preserved.
   *
   *   SchoolAssignmentsController.cs:42  [HttpGet("user/{userId}")]
   *   SchoolAssignmentsController.cs:43  GetByUser(int userId, [FromQuery] string date)
   *   SchoolAssignmentsController.cs:19  [HttpPost("bulk")]
   *   SchoolAssignmentsController.cs:23  return Ok(ApiResponse<List<SchoolAssignmentDto>>.Ok(result));
   */
  const handleBulkAssign = useCallback(async () => {
    if (!assignFOId || selectedSchoolIds.length === 0) {
      Alert.alert('Validation', 'Select a Field Officer and at least one school.');
      return;
    }
    setAssignSaving(true);
    try {
      let existingIds: number[] = [];
      try {
        const cur = await schoolAssignmentsApi.getUserAssignments(assignFOId, assignDate);
        const curData = cur.data as SchoolAssignment[];
        const rows = (Array.isArray(curData) ? curData : [])
          .slice()
          .sort((a, b) => a.visitOrder - b.visitOrder);

        existingIds = rows
          .map(a => a.schoolId)
          .filter((id): id is number => typeof id === 'number');

        // Because the server replaces the whole plan, an id we failed to read is an
        // assignment we would DELETE. Dropping it silently is exactly how the day plan
        // got wiped before, so a short read aborts instead of posting a partial list.
        if (existingIds.length !== rows.length) {
          Alert.alert(
            'Error',
            'The current plan could not be read completely, so nothing was assigned. ' +
            'Assigning now would have removed the schools that failed to load. Please retry.',
          );
          setAssignSaving(false);
          return;
        }
      } catch {
        // If the read fails we cannot prove what the FO already has. Assigning now
        // would replace an unknown plan, so stop rather than risk wiping it.
        Alert.alert('Error', 'Could not read the current plan, so nothing was assigned. Try again.');
        setAssignSaving(false);
        return;
      }

      const merged = [...existingIds];
      for (const id of selectedSchoolIds) if (!merged.includes(id)) merged.push(id);

      await schoolAssignmentsApi.bulkAssign({
        userId: assignFOId,
        assignmentDate: assignDate,
        schoolIds: merged,
      });
      const added = merged.length - existingIds.length;
      Alert.alert('Assigned', `${added} school(s) added. ${merged.length} total for this date.`);
      setSelectedSchoolIds([]);
      fetchTeamAssignments();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign schools.');
    } finally {
      setAssignSaving(false);
    }
  }, [assignFOId, assignDate, selectedSchoolIds, fetchTeamAssignments]);

  //   SchoolAssignmentsController.cs:66  [HttpDelete("{id}")]
  //   SchoolAssignmentsController.cs:71  return Ok(ApiResponse<object>.Ok(null));
  const handleDeleteAssignment = useCallback(async (id: number) => {
    setPendingDeleteId(null);
    try {
      await schoolAssignmentsApi.deleteAssignment(id);
      fetchTeamAssignments();
    } catch {
      Alert.alert('Error', 'Failed to remove assignment.');
    }
  }, [fetchTeamAssignments]);

  //   SchoolAssignmentsController.cs:50  [HttpGet("my")]
  //   SchoolAssignmentsController.cs:54  return Ok(ApiResponse<List<SchoolAssignmentDto>>.Ok(result));
  const fetchMyAssignments = useCallback(async () => {
    if (isSCA) return;
    setMyAssignLoading(true);
    try {
      const res = await schoolAssignmentsApi.getMyAssignments(toISODate(new Date()));
      const data = res.data as SchoolAssignment[];
      setMyAssignments(
        (Array.isArray(data) ? data : []).slice().sort((a, b) => a.visitOrder - b.visitOrder),
      );
    } catch {
      setMyAssignments([]);
    } finally {
      setMyAssignLoading(false);
    }
  }, [isSCA]);

  useEffect(() => { fetchMyAssignments(); }, [fetchMyAssignments]);

  // ── My Day: distance-optimised route ────────────────────────────────────────

  /**
   * Origin for the optimised route. Best-effort only — if the fix fails we fall back
   * to "first assigned school is the origin", which is what web does when it has no
   * `userLocation` either.
   */
  useEffect(() => {
    if (isSCA) return;
    Geolocation.getCurrentPosition(
      pos => setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setMyLocation(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [isSCA]);

  /**
   * Web parity: AssignedSchoolsMap (LiveTracking.jsx:426-763) hands the day's stops to
   * Google with `optimizeWaypoints: true` — Google's TSP solver — then shows the total
   * distance / drive time and relabels the stops in the solved order.
   *
   * The JS Maps SDK isn't available in React Native, so this needs the Directions *web
   * service* — and Google's "restrict to my Android app" key setting does not cover web
   * services, only the Maps SDK. So the call goes through our own server, which holds an
   * IP-restricted key; the app ships no Google key for this at all. HomeLocationScreen,
   * SchoolsListScreen and AddSchoolScreen route their lookups the same way.
   *
   * Every non-OK path falls back to the server's `visitOrder` ordering and records the
   * literal `status` + `error_message` for the on-screen notice, so a key without the
   * Directions API enabled shows up as "REQUEST_DENIED" rather than as silence.
   */
  useEffect(() => {
    let cancelled = false;

    const stops = myAssignments.filter(a => a.schoolLatitude && a.schoolLongitude);

    // A re-run that takes an early-return path must clear the flag itself: the previous
    // request's `finally` is gated on `cancelled` and will not do it, which would leave
    // the card stuck on "Optimising route…" forever.
    setRouteOptLoading(false);

    // Nothing to solve: 0 or 1 stop has no ordering problem.
    if (stops.length < 2) {
      setOptimizedStops(null);
      setRouteStats(null);
      setRouteOptFailure(null);
      return;
    }

    const hasOrigin = !!myLocation;
    // With a live fix the phone is the origin and every school is a stop; otherwise the
    // first school anchors the route (web's no-userLocation branch). Google always needs
    // a fixed destination, so the last school stays last in both cases and only the
    // in-between stops get reordered.
    const middle = hasOrigin ? stops.slice(0, -1) : stops.slice(1, -1);

    // The Directions API rejects more than 25 waypoints; optimisation is also the part
    // that blows up combinatorially. Beyond that we keep the server order rather than
    // send a request we know will 400.
    if (middle.length > 23) {
      setOptimizedStops(null);
      setRouteStats(null);
      setRouteOptFailure({
        status: 'TOO_MANY_WAYPOINTS',
        detail: `${stops.length} stops exceeds the Directions API waypoint limit.`,
      });
      return;
    }

    const origin = hasOrigin
      ? `${myLocation!.latitude},${myLocation!.longitude}`
      : `${stops[0].schoolLatitude},${stops[0].schoolLongitude}`;
    const last = stops[stops.length - 1];
    const destination = `${last.schoolLatitude},${last.schoolLongitude}`;
    const waypoints = middle.length
      ? `optimize:true|${middle.map(s => `${s.schoolLatitude},${s.schoolLongitude}`).join('|')}`
      : undefined;

    setRouteOptLoading(true);

    (async () => {
      try {
        const { data: json } = await apiClient.get('/routes/directions', {
          params: { origin, destination, waypoints, mode: 'driving' },
        });
        if (cancelled) return;

        const status: string = json?.status ?? 'UNKNOWN_ERROR';
        const route = json?.routes?.[0];

        if (status !== 'OK' || !route) {
          // Surfaced two ways on purpose: the console line is for a developer with a
          // device attached, the state drives the in-app notice for everyone else.
          console.warn(
            '[LiveTracking] Directions optimisation failed',
            { status, error_message: json?.error_message, stops: stops.length },
          );
          setOptimizedStops(null);
          setRouteStats(null);
          setRouteOptFailure({ status, detail: json?.error_message });
          return;
        }

        const legs: any[] = Array.isArray(route.legs) ? route.legs : [];
        const totalMetres = legs.reduce((sum, l) => sum + (l?.distance?.value ?? 0), 0);
        const totalSeconds = legs.reduce((sum, l) => sum + (l?.duration?.value ?? 0), 0);

        const order: number[] = Array.isArray(route.waypoint_order) ? route.waypoint_order : [];
        // A returned index outside the waypoint array would silently drop a school from
        // the day plan, so an unusable order means we keep the server ordering.
        const usable =
          order.length === middle.length &&
          order.every(i => Number.isInteger(i) && i >= 0 && i < middle.length) &&
          new Set(order).size === order.length;

        if (!usable && middle.length > 0) {
          console.warn('[LiveTracking] Directions returned an unusable waypoint_order', order);
          setOptimizedStops(null);
          setRouteStats(null);
          setRouteOptFailure({ status: 'INVALID_WAYPOINT_ORDER', detail: 'Google returned a waypoint order that did not map to the sent stops.' });
          return;
        }

        const reordered = hasOrigin
          ? [...order.map(i => middle[i]), last]
          : [stops[0], ...order.map(i => middle[i]), last];

        setOptimizedStops(reordered);
        setRouteStats({
          distanceKm: (totalMetres / 1000).toFixed(1),
          durationMin: Math.round(totalSeconds / 60),
        });
        setRouteOptFailure(null);
      } catch (e: any) {
        if (cancelled) return;
        console.warn('[LiveTracking] Directions request errored', e?.message ?? e);
        setOptimizedStops(null);
        setRouteStats(null);
        setRouteOptFailure({ status: 'REQUEST_FAILED', detail: e?.message ? String(e.message) : 'Network request failed.' });
      } finally {
        if (!cancelled) setRouteOptLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [myAssignments, myLocation, routeOptAttempt]);

  /** Stops in the order we show them: optimised when we have it, server order otherwise. */
  const displayStops = optimizedStops ?? myAssignments;

  // ── My Day: permission + tracking engine ────────────────────────────────────

  const showPermissionDeniedAlert = () => {
    Alert.alert('Location Permission Required', 'Please enable location access in Settings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Platform.OS === 'android' ? Linking.openSettings() : Linking.openURL('app-settings:') },
    ]);
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fineOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!fineOk) {
          const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
            title: 'Location Permission', message: 'Needed for daily tracking.',
            buttonNeutral: 'Ask Later', buttonNegative: 'Cancel', buttonPositive: 'Allow',
          });
          if (result !== PermissionsAndroid.RESULTS.GRANTED) { setLocationGranted(false); showPermissionDeniedAlert(); return false; }
        }
        if (Platform.Version >= 29) {
          const bgOk = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
          if (!bgOk) {
            const accepted = await new Promise<boolean>(resolve => { bgPermissionResolveRef.current = resolve; setShowBgDisclosure(true); });
            if (accepted) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
          }
        }
        setLocationGranted(true); return true;
      } catch { setLocationGranted(false); return false; }
    } else {
      if (locationGranted) return true;
      const status = await requestIOSLocationPermission();
      if (status === 'granted' || status === 'whenInUse') { setLocationGranted(true); return true; }
      setLocationGranted(false); showPermissionDeniedAlert(); return false;
    }
  };

  const startDayTracking = useCallback(async () => {
    if (Platform.OS === 'android') {
      await startNativeTracking();
      try {
        BackgroundFetch.configure(
          { minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: true, requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY },
          async (taskId) => { await sendLocationPing(); BackgroundFetch.finish(taskId); },
          (taskId) => { BackgroundFetch.finish(taskId); },
        ).catch(() => {});
      } catch {}
    } else {
      if (!iosPingRef.current) {
        sendLocationPing();
        iosPingRef.current = setInterval(() => sendLocationPing(), PING_INTERVAL_MS);
      }
      startNativeTracking().catch(() => {});
      try {
        BackgroundFetch.configure(
          { minimumFetchInterval: 15, stopOnTerminate: false, startOnBoot: true, enableHeadless: false, requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY },
          async (taskId) => { await sendLocationPing(); BackgroundFetch.finish(taskId); },
          (taskId) => { BackgroundFetch.finish(taskId); },
        ).catch(() => {});
      } catch {}
    }
  }, []);

  const stopDayTracking = useCallback(async () => {
    if (Platform.OS === 'android') { await stopNativeTracking(); }
    else {
      if (iosPingRef.current) { clearInterval(iosPingRef.current); iosPingRef.current = null; }
      stopNativeTracking().catch(() => {});
    }
    try { BackgroundFetch.stop(); } catch {}
  }, []);

  // ── My Day: session fetch ───────────────────────────────────────────────────
  const fetchDaySession = useCallback(async () => {
    try {
      const res = await trackingApi.getTodaySession();
      const data = res.data as SessionResponseDto;
      const s = data?.session ?? null;
      setDaySession(s);
      const isActive = s?.status === 'active';
      setStartEnabled(!isActive);
      setEndEnabled(isActive);
    } catch {
      setDaySession(null); setStartEnabled(true); setEndEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!isSCA) { setDayLoading(true); fetchDaySession().finally(() => setDayLoading(false)); }
  }, [fetchDaySession, isSCA]);

  // Sync GPS engine with session state
  useEffect(() => {
    if (daySession?.status === 'active' && locationGranted) startDayTracking();
    else stopDayTracking();
  }, [daySession?.status, locationGranted, startDayTracking, stopDayTracking]);

  // Check permission on mount
  useEffect(() => {
    if (isSCA) return;
    const check = async () => {
      try {
        if (Platform.OS === 'android') {
          const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          setLocationGranted(ok); setLocationChecked(true);
        } else {
          const status = await checkIOSPermission();
          setLocationGranted(status === 'granted' || status === 'whenInUse'); setLocationChecked(true);
        }
      } catch { setLocationGranted(false); setLocationChecked(true); }
    };
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (Platform.OS === 'android') PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then(ok => setLocationGranted(ok)).catch(() => {});
        else checkIOSPermission().then(s => setLocationGranted(s === 'granted' || s === 'whenInUse')).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isSCA]);

  // ── My Day: actions ─────────────────────────────────────────────────────────
  const handleStartDay = async () => {
    if (dayActionLoading) return;
    setDayActionLoading(true);
    const hasPerm = await requestLocationPermission();
    if (!hasPerm) { setDayActionLoading(false); return; }
    const locOk = await new Promise<boolean>(resolve => {
      Geolocation.getCurrentPosition(() => resolve(true), err => { if (err.code === 2) { Alert.alert('Location Disabled', 'Please turn on Location Services.'); resolve(false); } else resolve(true); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 });
    });
    if (!locOk) { setDayActionLoading(false); return; }
    try {
      // The allowance rate is picked per vehicle, so the vehicle MUST go with the
      // request — this used to call startDay() with no argument, so the session was
      // created with VehicleType = null and fell back to the "applies to all vehicles"
      // allowance config. This screen is the ZH/RH/SH/SCA view (navConfig.ts:115), so
      // it was managers starting their OWN day who got the wrong rate; FOs go through
      // MyDayTrackingScreen, which already passed a vehicle.
      //   TrackingController.cs:19  [HttpPost("start-day")]
      //   TrackingController.cs:20  StartDay([FromBody] StartDayRequest? request = null)
      //   TrackingController.cs:26  return Ok(ApiResponse<SessionResponseDto>.Ok(result));
      // StartDayRequest is `{ public string? VehicleType { get; set; } }`.
      const res = await trackingApi.startDay(selectedVehicle);
      const data = res.data as SessionResponseDto;
      setShowVehiclePicker(false);
      setDaySession(data?.session ?? null); setStartEnabled(false); setEndEnabled(true);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? '';
      if (err?.response?.status === 400 && msg.toLowerCase().includes('already')) { setShowVehiclePicker(false); await fetchDaySession(); }
      else Alert.alert('Error', msg || 'Failed to start day.');
    } finally { setDayActionLoading(false); }
  };

  const last30Days = useMemo(
    () => Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return toISODate(d); }),
    [],
  );

  /**
   * Hands the whole ordered day plan to the Maps app as one multi-stop route.
   * Callers pass `displayStops`, so this deep link carries the Directions-optimised
   * order when the optimisation succeeded and the server `visitOrder` when it did not —
   * navigation works identically either way. No origin is set, so Maps starts from the
   * device's current position.
   */
  const openRouteNavigation = useCallback((stops: SchoolAssignment[]) => {
    const pts = stops.filter(s => s.schoolLatitude && s.schoolLongitude);
    if (pts.length === 0) { Alert.alert('No route', 'No assigned school has coordinates.'); return; }
    const dest = pts[pts.length - 1];
    const waypoints = pts.slice(0, -1).map(s => `${s.schoolLatitude},${s.schoolLongitude}`).join('|');
    const url =
      'https://www.google.com/maps/dir/?api=1' +
      `&destination=${dest.schoolLatitude},${dest.schoolLongitude}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
      '&travelmode=driving';
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Maps.'));
  }, []);

  const handleEndDay = () => {
    Alert.alert('End Day', 'This will stop tracking and calculate your allowance.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Day', style: 'destructive', onPress: async () => {
        setDayActionLoading(true);
        try {
          await stopDayTracking();
          const stored = await AsyncStorage.getItem(PING_QUEUE_KEY);
          if (stored) { try { const q = JSON.parse(stored); if (Array.isArray(q) && q.length > 0) await trackingApi.sendBatchPings(q); } catch {} await AsyncStorage.removeItem(PING_QUEUE_KEY); }
          const res = await trackingApi.endDay();
          const data = res.data as SessionResponseDto;
          setDaySession(data?.session ?? null); setStartEnabled(true); setEndEnabled(false);
          await AsyncStorage.removeItem(PING_QUEUE_KEY);
        } catch (err: any) { Alert.alert('Error', err?.response?.data?.message || 'Failed to end day.'); }
        finally { setDayActionLoading(false); }
      }},
    ]);
  };

  const handleHistoryDate = async (date: string) => {
    if (!user) return;
    setHistoryDate(date); setHistoryLoading(true);
    try {
      const res = await trackingApi.getRoute(user.id, date);
      const data = res.data as any;
      setHistorySession(data?.session ?? null);
    } catch { setHistorySession(null); }
    finally { setHistoryLoading(false); }
  };

  const getSessionDuration = (s: TrackingSessionDto): string => {
    if (!s.startedAt) return '--';
    const start = new Date(s.startedAt), end = s.endedAt ? new Date(s.endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
  };

  // Theme tokens are resolved here in the body — never in a default parameter, where `T`
  // is not in scope.
  const getStatusColor = (status?: string) =>
    status === 'active' ? T.success : status === 'ended' ? T.danger : T.dim;
  const getStatusLabel = (status?: string) => status === 'active' ? 'Active' : status === 'ended' ? 'Day Ended' : 'Not Started';

  // ── Derived ───────────────────────────────────────────────────────────────

  // Role-scoped users: the API already returns team members scoped to the logged-in user.
  // We only filter by role so each role sees the correct member types in Team/Map views.
  const scopedUsers = useMemo(() => {
    if (!user) return liveUsers;
    switch (user.role) {
      case 'ZH':
        // ZH sees only FOs (API already returns their zone's users)
        return liveUsers.filter(u => u.role === 'FO');
      case 'RH':
        // RH sees ZHs and FOs (API already returns their region's users)
        return liveUsers.filter(u => u.role === 'ZH' || u.role === 'FO');
      case 'SH':
        // SH sees all RHs, ZHs, FOs below them
        return liveUsers.filter(u => u.role === 'RH' || u.role === 'ZH' || u.role === 'FO');
      case 'SCA':
      default:
        return liveUsers;
    }
  }, [liveUsers, user]);

  const mapUsers = useMemo(() =>
    statusFilter === 'all' ? scopedUsers : scopedUsers.filter(u => u.status === statusFilter),
  [scopedUsers, statusFilter]);

  const activeCount = useMemo(() => scopedUsers.filter(u => u.status === 'active').length, [scopedUsers]);

  // SCA: the base pool is either all users or the selected SH's team
  const scaBaseUsers = useMemo(() => {
    if (user?.role !== 'SCA') return scopedUsers;
    return selectedSHId !== null ? shTeamUsers : scopedUsers;
  }, [user?.role, scopedUsers, selectedSHId, shTeamUsers]);

  // SCA: apply search + role filter on top of the base pool
  const scaFilteredUsers = useMemo(() => {
    if (user?.role !== 'SCA') return scopedUsers;
    return scaBaseUsers.filter(u => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchSearch = !searchQuery.trim() || u.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [scaBaseUsers, scopedUsers, user?.role, roleFilter, searchQuery]);

  // SH list available for the SCA SH-filter chips
  const shList = useMemo(() => liveUsers.filter(u => u.role === 'SH'), [liveUsers]);

  // ── Team Last Locations ───────────────────────────────────────────────────

  /**
   * Web parity: the "Team Last Locations" table (LiveTracking.jsx:1746-1823), columns
   * Name / Role / Status / Last Seen / Location / Distance / Actions with a per-row
   * "View Route" button. View Route drives the existing IndividualTrackingView via
   * handlePersonPress — the same route viewer the grouped lists already open.
   *
   * Web's "Last Known" state has no mobile equivalent: LiveLocationDto (types/index.ts)
   * carries no isLastKnownLocation / lastSessionDate, so the status cell shows only the
   * three states the DTO can actually express.
   */
  const teamStatusOf = (u: LiveLocationDto) =>
    u.status === 'active'
      ? { label: 'Active', color: T.success }
      : u.status === 'ended'
        ? { label: 'Ended', color: T.dim }
        : { label: 'Not Started', color: T.warning };

  const hasCoords = (u: LiveLocationDto) =>
    !!u.latitude && !!u.longitude && (u.latitude !== 0 || u.longitude !== 0);

  // ── Client-side paging (see PAGE_SIZE: neither endpoint binds page/limit) ──
  const teamPageCount = Math.max(1, Math.ceil(scopedUsers.length / PAGE_SIZE));
  const assignPageCount = Math.max(1, Math.ceil(teamAssignments.length / PAGE_SIZE));

  // The live poll reshapes `scopedUsers` every 30s and the date picker refetches the
  // assignments — without these the user can be stranded on a page that no longer exists.
  useEffect(() => {
    setTeamPage(p => Math.min(p, teamPageCount));
  }, [teamPageCount]);
  useEffect(() => {
    setAssignPage(p => Math.min(p, assignPageCount));
  }, [assignPageCount]);

  const renderTeamLastLocations = () => {
    const rows = scopedUsers.slice((teamPage - 1) * PAGE_SIZE, teamPage * PAGE_SIZE);
    const from = scopedUsers.length === 0 ? 0 : (teamPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(teamPage * PAGE_SIZE, scopedUsers.length);

    const pager = teamPageCount > 1 && (
      <View style={nStyles.pgRow}>
        <Text style={[nStyles.pgCount, { color: T.dim }]}>
          Showing {from}–{to} of {scopedUsers.length}
        </Text>
        <Pagination page={teamPage} pageCount={teamPageCount} onChange={setTeamPage} />
      </View>
    );

    const header = (
      <View style={[nStyles.cardHead, { marginBottom: 10 }]}>
        <View style={nStyles.cardHeadLeft}>
          <MapPin size={15} color={T.accent} />
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={[nStyles.cardTitle, { color: T.text }]}>Team Last Locations</Text>
            <Text style={[nStyles.tblSubtitle, { color: T.dim }]}>
              Last known position of all subordinates
            </Text>
          </View>
        </View>
      </View>
    );

    const viewRouteBtn = (u: LiveLocationDto) => (
      <TouchableOpacity
        onPress={() => handlePersonPress(u)}
        style={[nStyles.viewRouteBtn, { backgroundColor: T.accentSoft, borderColor: T.accent }]}
      >
        <Navigation size={12} color={T.accent} />
        <Text style={[nStyles.viewRouteTxt, { color: T.accent }]}>View Route</Text>
      </TouchableOpacity>
    );

    if (table) {
      return (
        <View style={[nStyles.card, { backgroundColor: T.card, borderColor: T.line }]}>
          {header}
          <View style={[nStyles.tbl, { borderColor: T.line }]}>
            <View style={[nStyles.tr, { backgroundColor: T.cardAlt }]}>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamName]}>Name</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamRole]}>Role</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamStatus]}>Status</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamSeen]}>Last Seen</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamLoc]}>Location</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamDist]}>Distance</Text>
              {/* header <Text> ignores alignItems — left-aligned so it sits over the button */}
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cTeamActions]}>Actions</Text>
            </View>

            {rows.map(u => {
              const st = teamStatusOf(u);
              return (
                <View key={u.userId} style={[nStyles.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
                  <View style={[nStyles.cTeamName, nStyles.teamNameCell]}>
                    <View style={[nStyles.teamAvatar, { backgroundColor: roleTint(u.role, T) }]}>
                      <Text style={[nStyles.teamAvatarTxt, { color: T.onAccent }]}>{initials(u.name)}</Text>
                    </View>
                    {/* the avatar is fixed-width, so the name is what must shrink */}
                    <Text
                      style={[nStyles.tdName, { color: T.text }, nStyles.cellText]}
                      numberOfLines={1}
                    >
                      {u.name || '—'}
                    </Text>
                  </View>
                  <View style={nStyles.cTeamRole}>
                    <StatusBadge label={u.role || 'FO'} color={T.info} />
                  </View>
                  <View style={nStyles.cTeamStatus}>
                    <StatusBadge label={st.label} color={st.color} />
                  </View>
                  <Text style={[nStyles.td, { color: T.sub }, nStyles.cTeamSeen]} numberOfLines={1}>
                    {u.lastSeen ? fmtTime(u.lastSeen) : '—'}
                  </Text>
                  <Text style={[nStyles.tdMono, { color: T.sub }, nStyles.cTeamLoc]} numberOfLines={1}>
                    {hasCoords(u)
                      ? `${Number(u.latitude).toFixed(5)}, ${Number(u.longitude).toFixed(5)}`
                      : '—'}
                  </Text>
                  <Text style={[nStyles.td, { color: T.text }, nStyles.cTeamDist]}>
                    {u.totalDistanceKm > 0 ? `${u.totalDistanceKm.toFixed(1)} km` : '—'}
                  </Text>
                  <View style={nStyles.cTeamActions}>
                    {hasCoords(u) ? viewRouteBtn(u) : <Text style={[nStyles.td, { color: T.dim }]}>—</Text>}
                  </View>
                </View>
              );
            })}
          </View>
          {pager}
        </View>
      );
    }

    // ── phone: one card per member, same fields as the table ──
    return (
      <View style={[nStyles.card, { backgroundColor: T.card, borderColor: T.line }]}>
        {header}
        <View style={{ gap: 8 }}>
          {rows.map(u => {
            const st = teamStatusOf(u);
            return (
              <View key={u.userId} style={[nStyles.teamCard, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <View style={nStyles.teamCardTop}>
                  <View style={[nStyles.teamAvatar, { backgroundColor: roleTint(u.role, T) }]}>
                    <Text style={[nStyles.teamAvatarTxt, { color: T.onAccent }]}>{initials(u.name)}</Text>
                  </View>
                  <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
                    <Text style={[nStyles.tdName, { color: T.text }]} numberOfLines={1}>{u.name || '—'}</Text>
                    <Text style={[nStyles.tdSub, { color: T.dim }]} numberOfLines={1}>{u.role || 'FO'}</Text>
                  </View>
                  <StatusBadge label={st.label} color={st.color} />
                </View>

                <View style={nStyles.teamCardMeta}>
                  <View style={nStyles.teamMetaItem}>
                    <Text style={[nStyles.teamMetaLbl, { color: T.dim }]}>Last Seen</Text>
                    <Text style={[nStyles.teamMetaVal, { color: T.text }]} numberOfLines={1}>
                      {u.lastSeen ? fmtTime(u.lastSeen) : '—'}
                    </Text>
                  </View>
                  <View style={nStyles.teamMetaItem}>
                    <Text style={[nStyles.teamMetaLbl, { color: T.dim }]}>Distance</Text>
                    <Text style={[nStyles.teamMetaVal, { color: T.text }]} numberOfLines={1}>
                      {u.totalDistanceKm > 0 ? `${u.totalDistanceKm.toFixed(1)} km` : '—'}
                    </Text>
                  </View>
                </View>

                <View style={nStyles.teamCardBottom}>
                  <Text style={[nStyles.tdMono, { color: T.sub, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
                    {hasCoords(u)
                      ? `${Number(u.latitude).toFixed(5)}, ${Number(u.longitude).toFixed(5)}`
                      : 'No location'}
                  </Text>
                  {hasCoords(u) && viewRouteBtn(u)}
                </View>
              </View>
            );
          })}
        </View>
        {pager}
      </View>
    );
  };

  /**
   * Team Assignments — the manager's record list for the selected date, so it follows
   * the house split: iPad renders a real table, the phone renders stacked rows.
   * Paged client-side (see PAGE_SIZE) because GET /school-assignments/team binds only
   * `date`.
   */
  const renderTeamAssignments = () => {
    const rows = teamAssignments.slice((assignPage - 1) * PAGE_SIZE, assignPage * PAGE_SIZE);
    const from = (assignPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(assignPage * PAGE_SIZE, teamAssignments.length);

    const pager = assignPageCount > 1 && (
      <View style={nStyles.pgRow}>
        <Text style={[nStyles.pgCount, { color: T.dim }]}>
          Showing {from}–{to} of {teamAssignments.length}
        </Text>
        <Pagination page={assignPage} pageCount={assignPageCount} onChange={setAssignPage} />
      </View>
    );

    const delBtn = (a: SchoolAssignment) => (
      <TouchableOpacity
        onPress={() => setPendingDeleteId(a.id)}
        hitSlop={8}
        style={[nStyles.reportBtn, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}
      >
        <Trash2 size={13} color={T.danger} />
      </TouchableOpacity>
    );

    if (table) {
      return (
        <>
          <View style={[nStyles.tbl, { borderColor: T.line }]}>
            <View style={[nStyles.tr, { backgroundColor: T.cardAlt }]}>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgOrder]}>#</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgSchool]}>School</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgFo]}>Field Officer</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgCity]}>City</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgTime]}>Time</Text>
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgStatus]}>Status</Text>
              {/* header <Text> ignores alignItems — left-aligned over the icon button */}
              <Text style={[nStyles.th, { color: T.dim }, nStyles.cAsgActions]}>Actions</Text>
            </View>

            {rows.map(a => (
              <View key={a.id} style={[nStyles.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}>
                <Text style={[nStyles.td, { color: T.sub }, nStyles.cAsgOrder]}>{a.visitOrder}</Text>
                <Text style={[nStyles.tdName, { color: T.text }, nStyles.cAsgSchool]} numberOfLines={1}>
                  {a.schoolName}
                </Text>
                <Text style={[nStyles.td, { color: T.sub }, nStyles.cAsgFo]} numberOfLines={1}>
                  {a.userName ?? '—'}
                </Text>
                <Text style={[nStyles.td, { color: T.sub }, nStyles.cAsgCity]} numberOfLines={1}>
                  {a.schoolCity || '—'}
                </Text>
                <Text style={[nStyles.td, { color: T.sub }, nStyles.cAsgTime]} numberOfLines={1}>
                  {a.timeSpentMinutes != null ? `${Math.round(a.timeSpentMinutes)}m` : '—'}
                </Text>
                <View style={nStyles.cAsgStatus}>
                  <StatusBadge
                    label={a.isVisited ? 'Visited' : 'Pending'}
                    color={a.isVisited ? T.success : T.warning}
                  />
                </View>
                <View style={nStyles.cAsgActions}>{delBtn(a)}</View>
              </View>
            ))}
          </View>
          {pager}
        </>
      );
    }

    // ── phone: one row per assignment, same fields as the table ──
    return (
      <>
        <View style={{ gap: 8 }}>
          {rows.map(a => (
            <View key={a.id} style={[nStyles.stopRow, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
              <View style={[nStyles.stopOrder, { backgroundColor: T.accentSoft }]}>
                <Text style={[nStyles.stopOrderTxt, { color: T.accent }]}>{a.visitOrder}</Text>
              </View>
              <View style={nStyles.stopBody}>
                <Text style={[nStyles.stopName, { color: T.text }]} numberOfLines={1}>
                  {a.schoolName}
                </Text>
                <Text style={[nStyles.stopCity, { color: T.dim }]} numberOfLines={1}>
                  {a.userName ?? '—'}
                  {a.schoolCity ? ` · ${a.schoolCity}` : ''}
                  {a.timeSpentMinutes != null ? ` · ${Math.round(a.timeSpentMinutes)}m` : ''}
                </Text>
              </View>
              <StatusBadge
                label={a.isVisited ? 'Visited' : 'Pending'}
                color={a.isVisited ? T.success : T.warning}
              />
              {delBtn(a)}
            </View>
          ))}
        </View>
        {pager}
      </>
    );
  };

  // ── Individual tracking guard ─────────────────────────────────────────────

  if (trackingPerson) {
    return (
      <IndividualTrackingView
        person={trackingPerson}
        onBack={() => setTrackingPerson(null)}
      />
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen color={T.accent} message="Loading tracking..." />;
  }

  const subtitle =
    user?.role === 'SCA' ? 'National · All Users' :
    user?.role === 'SH' ? 'National View' :
    user?.role === 'RH' ? (user?.region ?? 'Regional View') :
    (user?.zone ?? 'Zonal View');

  const tabs = [
    ...(!isSCA ? [{ key: 'myDay' as TabKey, label: 'My Day', badge: undefined }] : []),
    { key: 'map' as TabKey, label: 'Map', badge: activeCount },
    { key: 'team' as TabKey, label: 'Team', badge: liveUsers.length },
    // Web's ManagerSection tab bar (LiveTracking.jsx:1573-1577) carries School
    // Assignments for exactly these roles.
    ...(isManager ? [{ key: 'assignments' as TabKey, label: 'Assignments', badge: undefined }] : []),
  ];

  const selectedFO = assignFOs.find(f => f.id === assignFOId) ?? null;
  const filteredSchools = allSchools.filter(
    s => !schoolSearch.trim() || s.name.toLowerCase().includes(schoolSearch.trim().toLowerCase()),
  );
  // Role-grouped FO picker, matching web's <optgroup> grouping by zone/region.
  const foGroups = (() => {
    const g: Record<string, UserDto[]> = {};
    assignFOs.forEach(u => {
      const k = u.zone || u.region || 'Team';
      (g[k] ||= []).push(u);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const visitedCount = myAssignments.filter(a => a.isVisited).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['top']}>
      {/* ScreenHeader paints white text on `color`, so it takes the Sunstone gradient's
          deep start (T.accentFrom) rather than T.accent — in dark mode T.accent is the
          light gold and white-on-gold is unreadable. */}
      <ScreenHeader
        title="Live Tracking"
        subtitle={subtitle}
        color={T.accentFrom}
        onMenu={() => nav.dispatch(DrawerActions.toggleDrawer())}
      />

      {/* Tab bar — the kit's .seg idiom (cardAlt track, accent-tinted active cell),
          extended with the live counts web shows on each tab. */}
      <View style={[styles.tabBar, { backgroundColor: T.card, borderBottomColor: T.line }]}>
        <View style={[styles.tabTrack, { backgroundColor: T.cardAlt }]}>
          {tabs.map(t => {
            const on = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.85}
                style={[styles.tab, on && { backgroundColor: T.accentSoft }]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text
                  style={[styles.tabText, { color: on ? T.accent : T.sub }]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {t.badge != null && t.badge > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: on ? T.accent : T.dim }]}>
                    <Text style={[styles.tabBadgeText, { color: T.onAccent }]}>{t.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── MY DAY TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'myDay' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          {/*
            iPad landscape splits My Day into two equal-height rails: the session
            summary + history on the left, the day's route plan on the right. On the
            phone both wrappers are plain gap-12 columns, so the cards simply stack
            in the same order they always did.
          */}
          <View style={[styles.mdBody, wide && styles.paneRow]}>
          <View style={[styles.mdCol, wide && styles.pane]}>

          {/* Location permission banner */}
          {locationChecked && !locationGranted && (
            <TouchableOpacity
              style={[mdStyles.permBanner, { backgroundColor: withAlpha(T.danger, SOFT_TINT), borderColor: T.danger }]}
              onPress={requestLocationPermission}
              activeOpacity={0.7}
            >
              <MapPin size={16} color={T.danger} strokeWidth={ICON_STROKE} />
              <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
                <Text style={[mdStyles.permTitle, { color: T.danger }]}>Location Access Required</Text>
                <Text style={[mdStyles.permSub, { color: T.sub }]}>Tap to enable location for tracking</Text>
              </View>
              <Text style={[mdStyles.permAction, { color: T.danger, backgroundColor: withAlpha(T.danger, 0.12) }]}>
                Enable
              </Text>
            </TouchableOpacity>
          )}

          {/* My Day card */}
          <View style={[nStyles.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={mdStyles.cardHeader}>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text style={[nStyles.cardTitle, { color: T.text }]}>My Day</Text>
                <Text style={[mdStyles.cardDate, { color: T.dim }]}>
                  {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={mdStyles.btnRow}>
                <Btn
                  label={dayActionLoading && startEnabled ? 'Starting…' : 'Start My Day'}
                  variant="success"
                  small
                  onPress={() => setShowVehiclePicker(true)}
                  disabled={!startEnabled || dayActionLoading}
                  icon={<Navigation size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                />
                <Btn
                  label={dayActionLoading && endEnabled ? 'Ending…' : 'End Day'}
                  variant="danger"
                  small
                  onPress={handleEndDay}
                  disabled={!endEnabled || dayActionLoading}
                />
              </View>
            </View>

            {daySession?.status === 'ended' && (
              <View style={[mdStyles.banner, { backgroundColor: withAlpha(T.success, SOFT_TINT) }]}>
                <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
                <Text style={[mdStyles.bannerTxt, { color: T.success, flexShrink: 1, minWidth: 0 }]}>
                  Session ended. You can start again anytime.
                </Text>
              </View>
            )}
            {daySession?.isSuspicious && (
              <View style={[mdStyles.banner, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
                <AlertTriangle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                <Text style={[mdStyles.bannerTxt, { color: T.danger, flexShrink: 1, minWidth: 0 }]}>
                  Session flagged — fraud score: {daySession.fraudScore}
                </Text>
              </View>
            )}

            {/* Stats grid — three equal-height tiles, stretched so none is clipped */}
            <View style={mdStyles.statsGrid}>
              <View style={[mdStyles.statBox, { backgroundColor: T.accentSoft }]}>
                <Navigation size={16} color={T.accent} strokeWidth={ICON_STROKE} />
                <Text style={[mdStyles.statVal, { color: T.text }]} numberOfLines={1}>
                  {daySession?.totalDistanceKm?.toFixed(1) ?? '0.0'} km
                </Text>
                <Text style={[mdStyles.statLbl, { color: T.sub }]}>Today's Distance</Text>
              </View>
              <View style={[mdStyles.statBox, { backgroundColor: withAlpha(T.warning, SOFT_TINT) }]}>
                <DollarSign size={16} color={T.warning} strokeWidth={ICON_STROKE} />
                <Text style={[mdStyles.statVal, { color: T.text }]} numberOfLines={1}>
                  {formatCurrency(daySession?.allowanceAmount ?? 0)}
                </Text>
                <Text style={[mdStyles.statLbl, { color: T.sub }]}>Today's Allowance</Text>
              </View>
              <View style={[mdStyles.statBox, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
                <View style={[mdStyles.statusDot, { backgroundColor: getStatusColor(daySession?.status) }]} />
                <Text style={[mdStyles.statVal, { color: T.text, fontSize: rf(13) }]} numberOfLines={1}>
                  {getStatusLabel(daySession?.status)}
                </Text>
                <Text style={[mdStyles.statLbl, { color: T.sub }]}>Session Status</Text>
              </View>
            </View>

            {/* Distance breakdown — web shows this after the day ends
                (LiveTracking.jsx:1190-1208). The three numbers come straight off
                TrackingSessionDto: RawDistanceKm / FilteredDistanceKm / ReconstructedDistanceKm. */}
            {daySession?.status === 'ended' && (
              <View style={[nStyles.breakdown, { borderTopColor: T.line }]}>
                <Text style={[nStyles.breakdownTitle, { color: T.sub }]}>Distance Breakdown</Text>
                <View style={nStyles.breakdownRow}>
                  <View style={nStyles.breakdownItem}>
                    <Text style={[nStyles.breakdownVal, { color: T.text }]}>{(daySession.rawDistanceKm ?? 0).toFixed(2)} km</Text>
                    <Text style={[nStyles.breakdownLbl, { color: T.dim }]}>Raw GPS</Text>
                  </View>
                  <View style={nStyles.breakdownItem}>
                    <Text style={[nStyles.breakdownVal, { color: T.text }]}>{(daySession.filteredDistanceKm ?? 0).toFixed(2)} km</Text>
                    <Text style={[nStyles.breakdownLbl, { color: T.dim }]}>After Filtering</Text>
                  </View>
                  <View style={nStyles.breakdownItem}>
                    <Text style={[nStyles.breakdownVal, { color: T.accent }]}>{(daySession.reconstructedDistanceKm ?? 0).toFixed(2)} km</Text>
                    <Text style={[nStyles.breakdownLbl, { color: T.dim }]}>Reconstructed</Text>
                  </View>
                </View>
              </View>
            )}

            {dayLoading && <LoadingSpinner color={T.accent} />}
          </View>

          {/* Tracking History */}
          <View style={[nStyles.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={mdStyles.historyHeader}>
              <Text style={[nStyles.cardTitle, { color: T.text }]}>My Tracking History</Text>
              <View style={mdStyles.dateRow}>
                <Calendar size={14} color={T.dim} strokeWidth={ICON_STROKE} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {last30Days.map((d, i) => {
                    const on = historyDate === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          mdStyles.dateChip,
                          { backgroundColor: on ? T.accentSoft : T.cardAlt, borderColor: on ? T.accent : T.line },
                        ]}
                        onPress={() => handleHistoryDate(d)}
                      >
                        <Text style={[mdStyles.dateChipText, { color: on ? T.accent : T.sub }]}>
                          {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {historyLoading ? (
              <LoadingSpinner color={T.accent} message="Loading..." />
            ) : historySession ? (
              /* Six equal-height tiles — alignItems:'stretch' so a wrapped row never
                 leaves a short tile with dead space beside a tall one. On the iPad rail
                 they stay two-up (flexBasis 47%); the rail is too narrow for six across. */
              <View style={mdStyles.historyGrid}>
                {([
                  ['Distance', `${historySession.totalDistanceKm?.toFixed(1) ?? '0.0'} km`],
                  ['Allowance', formatCurrency(historySession.allowanceAmount)],
                  ['Start', formatTime(historySession.startedAt)],
                  ['End', historySession.endedAt ? formatTime(historySession.endedAt) : '--'],
                  ['Duration', getSessionDuration(historySession)],
                  ['Pings', String(historySession.pingCount ?? 0)],
                ] as [string, string][]).map(([lbl, val]) => (
                  <View key={lbl} style={[mdStyles.histItem, { backgroundColor: T.cardAlt }]}>
                    <Text style={[mdStyles.histLbl, { color: T.dim }]}>{lbl}</Text>
                    <Text style={[mdStyles.histVal, { color: T.text }]} numberOfLines={1}>{val}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={nStyles.empty}>
                <MapPin size={26} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No tracking data for this date</Text>
              </View>
            )}
          </View>

          </View>
          <View style={[styles.mdCol, wide && styles.pane]}>

          {/* ── Today's assigned schools: ordered plan + progress + navigation ── */}
          <View style={[nStyles.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={nStyles.cardHead}>
              <View style={nStyles.cardHeadLeft}>
                <RouteIcon size={15} color={T.accent} />
                <Text style={[nStyles.cardTitle, { color: T.text }]}>Today's Schools</Text>
              </View>
              <TouchableOpacity onPress={fetchMyAssignments} hitSlop={10} style={nStyles.refreshBtn}>
                <RefreshCw size={13} color={T.sub} />
                <Text style={[nStyles.refreshTxt, { color: T.sub }]}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {myAssignLoading ? (
              <LoadingSpinner color={T.accent} />
            ) : myAssignments.length === 0 ? (
              <View style={nStyles.empty}>
                <SchoolIcon size={26} color={T.dim} />
                <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No schools assigned for today</Text>
              </View>
            ) : (
              <>
                {/* Visited progress */}
                <View style={nStyles.progressWrap}>
                  <View style={nStyles.progressLabelRow}>
                    <Text style={[nStyles.progressLbl, { color: T.sub }]}>
                      {visitedCount} of {myAssignments.length} visited
                    </Text>
                    <Text style={[nStyles.progressPct, { color: T.accent }]}>
                      {Math.round((visitedCount / myAssignments.length) * 100)}%
                    </Text>
                  </View>
                  <View style={[nStyles.progressTrack, { backgroundColor: T.fieldBg }]}>
                    <View
                      style={[
                        nStyles.progressFill,
                        { backgroundColor: T.success, width: `${(visitedCount / myAssignments.length) * 100}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Route stats — total driving distance / time for the optimised plan */}
                <View style={nStyles.routeStatRow}>
                  {routeStats && (
                    <>
                      <View style={nStyles.routeStat}>
                        <Navigation size={13} color={T.accent} />
                        <Text style={[nStyles.routeStatVal, { color: T.text }]}>{routeStats.distanceKm} km</Text>
                        <Text style={[nStyles.routeStatLbl, { color: T.dim }]}>total</Text>
                      </View>
                      <View style={nStyles.routeStat}>
                        <Clock size={13} color={T.accent} />
                        <Text style={[nStyles.routeStatVal, { color: T.text }]}>{routeStats.durationMin} min</Text>
                        <Text style={[nStyles.routeStatLbl, { color: T.dim }]}>est. drive</Text>
                      </View>
                    </>
                  )}
                  <View style={nStyles.routeStat}>
                    <MapPin size={13} color={T.accent} />
                    <Text style={[nStyles.routeStatVal, { color: T.text }]}>{myAssignments.length}</Text>
                    <Text style={[nStyles.routeStatLbl, { color: T.dim }]}>schools</Text>
                  </View>
                </View>

                {/* Optimisation state — success badge, in-flight note, or failure notice */}
                {routeOptLoading ? (
                  <View style={[nStyles.routeNotice, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                    <Sparkles size={13} color={T.dim} />
                    <Text style={[nStyles.routeNoticeTxt, { color: T.sub }]}>Optimising route…</Text>
                  </View>
                ) : optimizedStops ? (
                  <View style={[nStyles.routeNotice, { backgroundColor: T.accentSoft, borderColor: T.accent }]}>
                    <Sparkles size={13} color={T.accent} />
                    <Text style={[nStyles.routeNoticeTxt, { color: T.accent }]}>
                      Optimised route — shortest driving path calculated
                    </Text>
                  </View>
                ) : routeOptFailure ? (
                  // Non-blocking: the list below is still the full, usable day plan in the
                  // server's visitOrder. The status/error_message are printed verbatim so a
                  // key without the Directions API enabled is diagnosable from the device.
                  <View style={[nStyles.routeNotice, { backgroundColor: T.cardAlt, borderColor: T.warning }]}>
                    <AlertTriangle size={13} color={T.warning} />
                    <View style={nStyles.routeNoticeBody}>
                      <Text style={[nStyles.routeNoticeTxt, { color: T.warning }]}>
                        Showing planned order — route could not be optimised ({routeOptFailure.status})
                      </Text>
                      {!!routeOptFailure.detail && (
                        <Text style={[nStyles.routeNoticeDetail, { color: T.dim }]}>{routeOptFailure.detail}</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setRouteOptAttempt(n => n + 1)} hitSlop={8}>
                      <Text style={[nStyles.routeNoticeRetry, { color: T.accent }]}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Route preview */}
                {/* The landscape right rail is much taller than a phone card, so the
                    preview grows with it instead of leaving the rail half empty. */}
                <View style={[nStyles.routeMapWrap, wide && nStyles.routeMapWrapWide, { borderColor: T.line }]}>
                  <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={{
                      latitude: displayStops[0]?.schoolLatitude || INDIA_REGION.latitude,
                      longitude: displayStops[0]?.schoolLongitude || INDIA_REGION.longitude,
                      latitudeDelta: 0.25,
                      longitudeDelta: 0.25,
                    }}
                    pointerEvents="none"
                  >
                    {displayStops
                      .filter(a => a.schoolLatitude && a.schoolLongitude)
                      .map(a => (
                        <Marker
                          key={a.id}
                          coordinate={{ latitude: a.schoolLatitude, longitude: a.schoolLongitude }}
                          title={a.schoolName}
                          pinColor={a.isVisited ? T.success : T.warning}
                        />
                      ))}
                    <Polyline
                      coordinates={displayStops
                        .filter(a => a.schoolLatitude && a.schoolLongitude)
                        .map(a => ({ latitude: a.schoolLatitude, longitude: a.schoolLongitude }))}
                      strokeColor={T.accent}
                      strokeWidth={3}
                    />
                  </MapView>
                </View>

                <Btn
                  label="Start Navigation"
                  onPress={() => openRouteNavigation(displayStops)}
                  icon={<Navigation size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  style={{ marginTop: 10 }}
                />

                {/* Ordered stop list — optimised order when we have one, else visitOrder */}
                <View style={{ marginTop: 12, gap: 8 }}>
                  {displayStops.map((a, idx) => (
                    <View key={a.id} style={[nStyles.stopRow, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                      <View style={[nStyles.stopOrder, { backgroundColor: a.isVisited ? T.success : T.accentSoft }]}>
                        <Text style={[nStyles.stopOrderTxt, { color: a.isVisited ? '#FFF' : T.accent }]}>
                          {optimizedStops ? idx + 1 : a.visitOrder}
                        </Text>
                      </View>
                      <View style={nStyles.stopBody}>
                        <Text style={[nStyles.stopName, { color: T.text }]} numberOfLines={1}>{a.schoolName}</Text>
                        {!!a.schoolCity && (
                          <Text style={[nStyles.stopCity, { color: T.dim }]} numberOfLines={1}>{a.schoolCity}</Text>
                        )}
                      </View>
                      <StatusBadge
                        label={a.isVisited ? 'Visited' : 'Pending'}
                        color={a.isVisited ? T.success : T.warning}
                      />
                      {/* Wires to the existing VisitReportScreen (registered as
                          "VisitReport" in AppNavigator.tsx:545). */}
                      <TouchableOpacity
                        onPress={() => nav.navigate('VisitReport', { schoolName: a.schoolName, schoolId: a.schoolId })}
                        hitSlop={8}
                        style={[nStyles.reportBtn, { backgroundColor: T.accentSoft }]}
                      >
                        <FileText size={13} color={T.accent} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── MAP TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'map' && (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={INDIA_REGION}
            showsUserLocation={false}
            mapType={mapKind}
          >
            {mapUsers.map(u => (
              <Marker
                key={u.userId}
                coordinate={{ latitude: u.latitude, longitude: u.longitude }}
                tracksViewChanges={selectedMarker?.userId === u.userId}
                onPress={() => setSelectedMarker(prev => prev?.userId === u.userId ? null : u)}
              >
                <AllUsersMarker user={u} />
              </Marker>
            ))}
          </MapView>

          {/* Status filter — the kit's Segmented control */}
          <View style={[styles.mapFilterRow, wide && styles.mapOverlayWide]}>
            <Segmented<StatusFilter>
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ backgroundColor: T.card, borderWidth: 1, borderColor: T.line }}
              options={[
                { label: 'All', value: 'all' },
                { label: '● Active', value: 'active' },
                { label: '○ Ended', value: 'ended' },
              ]}
            />
          </View>

          {/* Map-type selector — web offers Default/Satellite/Terrain/Hybrid */}
          <View style={[nStyles.mapKindBar, wide && styles.mapOverlayWide, { backgroundColor: T.card, borderColor: T.line }]}>
            <Layers size={13} color={T.sub} strokeWidth={ICON_STROKE} />
            {MAP_KINDS.map(m => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMapKind(m.key)}
                style={[
                  nStyles.mapKindChip,
                  mapKind === m.key && { backgroundColor: T.accentSoft },
                ]}
              >
                <Text
                  style={[
                    nStyles.mapKindTxt,
                    { color: mapKind === m.key ? T.accent : T.sub },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Count */}
          <View style={[styles.mapCountBadge, { backgroundColor: T.card, borderColor: T.line }]}>
            <Users size={12} color={T.sub} strokeWidth={ICON_STROKE} />
            <Text style={[styles.mapCountText, { color: T.sub }]}>
              {activeCount} active / {mapUsers.length} shown
            </Text>
          </View>

          {/* Empty hint */}
          {mapUsers.length === 0 && (
            <View style={styles.mapEmptyHint} pointerEvents="none">
              <View style={[styles.mapEmptyCard, { backgroundColor: T.card, borderColor: T.line }]}>
                <MapPin size={26} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[styles.mapEmptyTitle, { color: T.text }]}>No users match filter</Text>
                <Text style={[styles.mapEmptySubtitle, { color: T.dim }]}>Change the status filter above</Text>
              </View>
            </View>
          )}

          {/* Info sheet when marker tapped */}
          {selectedMarker && (
            <View
              style={[
                wide ? styles.infoSheetWide : styles.infoSheet,
                // one `borderColor` covers both: the sheet only draws a top border,
                // the landscape panel draws all four.
                { backgroundColor: T.card, borderColor: T.line },
              ]}
            >
              <View style={[styles.infoHandle, { backgroundColor: T.lineStrong }]} />
              <View style={styles.infoRow}>
                <View style={[styles.infoAvatar, { backgroundColor: roleTint(selectedMarker.role, T) }]}>
                  <Text style={[styles.infoAvatarText, { color: T.onAccent }]}>{initials(selectedMarker.name)}</Text>
                </View>
                <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
                  <Text style={[styles.infoName, { color: T.text }]} numberOfLines={1}>{selectedMarker.name}</Text>
                  <View style={styles.infoMeta}>
                    <RolePill role={selectedMarker.role} />
                    {selectedMarker.zoneName && (
                      <Text style={[styles.infoSub, { color: T.dim }]} numberOfLines={1}>{selectedMarker.zoneName}</Text>
                    )}
                    {selectedMarker.regionName && !selectedMarker.zoneName && (
                      <Text style={[styles.infoSub, { color: T.dim }]} numberOfLines={1}>{selectedMarker.regionName}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedMarker(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color={T.sub} strokeWidth={ICON_STROKE} />
                </TouchableOpacity>
              </View>

              {/* Equal-height stat tiles */}
              <View style={styles.infoStats}>
                <View style={[styles.infoStat, { backgroundColor: T.cardAlt }]}>
                  <Navigation size={13} color={T.accent} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.infoStatVal, { color: T.text }]} numberOfLines={1}>
                    {selectedMarker.totalDistanceKm.toFixed(1)} km
                  </Text>
                  <Text style={[styles.infoStatLbl, { color: T.dim }]}>Distance</Text>
                </View>
                <View style={[styles.infoStat, { backgroundColor: T.cardAlt }]}>
                  <Clock size={13} color={T.accent} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.infoStatVal, { color: T.text }]} numberOfLines={1}>
                    {formatRelativeDate(selectedMarker.lastSeen)}
                  </Text>
                  <Text style={[styles.infoStatLbl, { color: T.dim }]}>Last Seen</Text>
                </View>
                <View style={[styles.infoStat, { backgroundColor: T.cardAlt }]}>
                  <Activity size={13} color={T.accent} strokeWidth={ICON_STROKE} />
                  <Text style={[styles.infoStatVal, { color: T.text }]} numberOfLines={1}>
                    {selectedMarker.speedKmh?.toFixed(0) ?? '--'} km/h
                  </Text>
                  <Text style={[styles.infoStatLbl, { color: T.dim }]}>Speed</Text>
                </View>
              </View>

              <Btn
                label="Track This Person"
                small
                onPress={() => { setSelectedMarker(null); setTrackingPerson(selectedMarker); }}
                icon={<Navigation size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                style={styles.infoTrackBtn}
              />
            </View>
          )}
        </View>
      )}

      {/* ── TEAM TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[T.accent]} />}
        >
          {/* iPad landscape puts the filter bar and the selected-user card side by
              side as equal-height rails; on the phone they stack as before. */}
          <View style={[styles.mdBody, wide && styles.paneRow]}>
          {/* ── Filter bar: User picker + Date + Refresh ── */}
          <View style={[tfStyles.filterCard, wide && styles.pane, { backgroundColor: T.card, borderColor: T.line }]}>
            <TouchableOpacity
              style={[tfStyles.userSelector, { backgroundColor: T.fieldBg, borderColor: T.line }]}
              onPress={() => setShowTeamUserPicker(true)}
            >
              <Users size={15} color={T.sub} strokeWidth={ICON_STROKE} />
              <Text style={[tfStyles.userSelectorLabel, { color: T.sub }]}>User</Text>
              <Text
                style={[tfStyles.userSelectorValue, { color: selectedTeamUser ? T.text : T.dim }]}
                numberOfLines={1}
              >
                {selectedTeamUser
                  ? `${selectedTeamUser.name} - ${selectedTeamUser.status === 'active' ? 'Active' : 'Ended'}`
                  : '— Select a User —'}
              </Text>
              <ChevronDown size={14} color={T.dim} strokeWidth={ICON_STROKE} />
            </TouchableOpacity>
            <View style={tfStyles.dateRefreshRow}>
              <DateInput
                label=""
                value={teamDate}
                onChange={setTeamDate}
                accentColor={T.accent}
              />
              <Btn
                label="Refresh"
                variant="secondary"
                small
                onPress={() => { setRefreshing(true); fetchLive().finally(() => setRefreshing(false)); }}
                icon={<RefreshCw size={13} color={T.text} strokeWidth={ICON_STROKE} />}
              />
            </View>
          </View>

          {/* ── Selected user stats card ── */}
          {selectedTeamUser && (
            <View style={[tfStyles.statsCard, wide && styles.pane, { backgroundColor: T.card, borderColor: T.line }]}>
              <View style={tfStyles.statsCardTop}>
                {selectedTeamUser.avatar && selectedTeamUser.avatar.startsWith('http') ? (
                  <Image source={{ uri: selectedTeamUser.avatar }} style={tfStyles.statsAvatar} />
                ) : (
                  <View style={[tfStyles.statsAvatar, { backgroundColor: roleTint(selectedTeamUser.role, T), alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[tfStyles.statsAvatarText, { color: T.onAccent }]}>{initials(selectedTeamUser.name)}</Text>
                  </View>
                )}
                <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1, gap: 4 }}>
                  <Text style={[tfStyles.statsName, { color: T.text }]} numberOfLines={1}>{selectedTeamUser.name}</Text>
                  <StatusBadge
                    label={selectedTeamUser.status === 'active' ? 'Active' : 'Ended'}
                    color={selectedTeamUser.status === 'active' ? T.success : T.dim}
                  />
                </View>
                <TouchableOpacity onPress={() => setSelectedTeamUser(null)} hitSlop={10}>
                  <X size={16} color={T.sub} strokeWidth={ICON_STROKE} />
                </TouchableOpacity>
              </View>
              <View style={tfStyles.statsRow}>
                <View style={tfStyles.statItem}>
                  <Text style={[tfStyles.statLabel, { color: T.dim }]}>Last Seen</Text>
                  <Text style={[tfStyles.statValue, { color: T.text }]} numberOfLines={1}>{formatRelativeDate(selectedTeamUser.lastSeen)}</Text>
                </View>
                <View style={tfStyles.statItem}>
                  <Text style={[tfStyles.statLabel, { color: T.dim }]}>Distance Today</Text>
                  <Text style={[tfStyles.statValue, { color: T.text }]} numberOfLines={1}>{selectedTeamUser.totalDistanceKm.toFixed(1)} km</Text>
                </View>
                <View style={tfStyles.statItem}>
                  <Text style={[tfStyles.statLabel, { color: T.dim }]}>Allowance</Text>
                  <Text style={[tfStyles.statValue, { color: T.text }]} numberOfLines={1}>{formatCurrency(selectedTeamUser.allowanceAmount)}</Text>
                </View>
              </View>
              <View style={tfStyles.statsRowSecond}>
                <View style={tfStyles.statItem}>
                  <Text style={[tfStyles.statLabel, { color: T.dim }]}>Speed</Text>
                  <Text style={[tfStyles.statValue, { color: T.text }]} numberOfLines={1}>{selectedTeamUser.speedKmh?.toFixed(1) ?? '0.0'} km/h</Text>
                </View>
                {selectedTeamUser.batteryLevel != null && (
                  <View style={tfStyles.statItem}>
                    <Text style={[tfStyles.statLabel, { color: T.dim }]}>Battery</Text>
                    <Text
                      style={[tfStyles.statValue, { color: selectedTeamUser.batteryLevel < 0.2 ? T.danger : T.text }]}
                      numberOfLines={1}
                    >
                      🔋 {Math.round(selectedTeamUser.batteryLevel * 100)}%
                    </Text>
                  </View>
                )}
                <Btn
                  label="View Route"
                  small
                  onPress={() => handlePersonPress(selectedTeamUser)}
                  icon={<Navigation size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
                />
              </View>
            </View>
          )}
          </View>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <Users size={14} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[styles.summaryText, { color: T.sub, flexShrink: 1, minWidth: 0 }]}>
              {activeCount} active · {scopedUsers.length} tracked today
            </Text>
            <Text style={[styles.summaryHint, { color: T.dim }]}>Tap to track</Text>
          </View>

          {/* ── Team Last Locations (web's LiveTracking.jsx:1746-1823) ──────── */}
          {scopedUsers.length > 0 && renderTeamLastLocations()}

          {scopedUsers.length === 0 ? (
            <Empty
              icon={<Radio size={30} color={T.dim} strokeWidth={ICON_STROKE} />}
              title="No tracking data"
              subtitle="No team members have started tracking today."
            />
          ) : (
            <>
              {/* ZH: flat FO list (zone-scoped) */}
              {user?.role === 'ZH' && (
                <View style={[styles.listCard, { backgroundColor: T.card, borderColor: T.line }]}>
                  {scopedUsers.length === 0 ? (
                    <Text style={[styles.emptyListText, { color: T.dim }]}>
                      None of your FOs have started tracking today.
                    </Text>
                  ) : (
                    scopedUsers.map(fo => (
                      <PersonRow key={fo.userId} user={fo} onPress={handlePersonPress} />
                    ))
                  )}
                </View>
              )}

              {/* RH: search + grouped by zone (ZH + FOs) */}
              {user?.role === 'RH' && (
                <>
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name…"
                  />
                  {(() => {
                    const filtered = searchQuery.trim()
                      ? scopedUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      : scopedUsers;
                    const groups = buildZoneGroups(filtered);
                    return groups.length === 0
                      ? <Empty icon={<MapPin size={26} color={T.dim} strokeWidth={ICON_STROKE} />} title="No data" subtitle="No team members are tracking." />
                      : groups.map(g => (
                        <ZoneGroupSection key={g.zoneName} group={g} onPersonPress={handlePersonPress} defaultExpanded />
                      ));
                  })()}
                </>
              )}

              {/* SH: search + role filter + grouped by region → zone (RH + ZH + FOs) */}
              {user?.role === 'SH' && (
                <>
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name…"
                  />
                  <Segmented<string>
                    value={roleFilter}
                    onChange={setRoleFilter}
                    options={[
                      { label: 'All Roles', value: 'all' },
                      { label: 'RH', value: 'RH' },
                      { label: 'ZH', value: 'ZH' },
                      { label: 'FO', value: 'FO' },
                    ]}
                  />
                  {(() => {
                    const filtered = scopedUsers.filter(u => {
                      const matchRole = roleFilter === 'all' || u.role === roleFilter;
                      const matchSearch = !searchQuery.trim() || u.name.toLowerCase().includes(searchQuery.toLowerCase());
                      return matchRole && matchSearch;
                    });
                    const groups = buildRegionGroups(filtered);
                    return groups.length === 0
                      ? <Empty icon={<MapPin size={26} color={T.dim} strokeWidth={ICON_STROKE} />} title="No data" subtitle="No team members are tracking." />
                      : groups.map(g => (
                        <RegionGroupSection key={g.regionName} group={g} onPersonPress={handlePersonPress} />
                      ));
                  })()}
                </>
              )}

              {/* SCA: national view — SH filter + search + role filter + full hierarchy */}
              {user?.role === 'SCA' && (
                <>
                  {/* SH filter chips — "View as SH" selector */}
                  {shList.length > 0 && (
                    <View style={[styles.scaSHFilterBlock, { backgroundColor: T.card, borderColor: T.line }]}>
                      <Text style={[styles.scaSHFilterLabel, { color: T.dim }]}>Filter by Head</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaSHFilterRow}>
                        {/* All chip */}
                        <TouchableOpacity
                          style={[
                            styles.scaSHChip,
                            {
                              backgroundColor: selectedSHId === null ? T.accentSoft : T.cardAlt,
                              borderColor: selectedSHId === null ? T.accent : T.line,
                            },
                          ]}
                          onPress={() => handleSelectSH(null)}
                        >
                          <Text style={[styles.scaSHChipText, { color: selectedSHId === null ? T.accent : T.sub }]}>
                            All
                          </Text>
                        </TouchableOpacity>
                        {/* One chip per SH */}
                        {shList.map(sh => {
                          const on = selectedSHId === sh.userId;
                          const live = sh.status === 'active';
                          return (
                            <TouchableOpacity
                              key={sh.userId}
                              style={[
                                styles.scaSHChip,
                                {
                                  backgroundColor: on ? T.accentSoft : T.cardAlt,
                                  borderColor: on ? T.accent : live ? T.success : T.line,
                                },
                              ]}
                              onPress={() => handleSelectSH(sh.userId)}
                            >
                              <View style={[styles.scaSHChipDot, { backgroundColor: live ? T.success : T.dim }]} />
                              <Text
                                style={[styles.scaSHChipText, { color: on ? T.accent : T.sub }]}
                                numberOfLines={1}
                              >
                                {sh.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      {/* Selected SH summary */}
                      {selectedSHId !== null && (
                        <View style={[styles.scaSHSelectedBanner, { borderTopColor: T.line }]}>
                          {shTeamLoading ? (
                            <Text style={[styles.scaSHSelectedText, { color: T.sub }]}>Loading team…</Text>
                          ) : (
                            <Text style={[styles.scaSHSelectedText, { color: T.sub }]} numberOfLines={2}>
                              Showing team: {shList.find(s => s.userId === selectedSHId)?.name} · {scaBaseUsers.filter(u => u.role !== 'SH').length} members
                            </Text>
                          )}
                          <TouchableOpacity onPress={() => handleSelectSH(null)} hitSlop={8}>
                            <X size={14} color={T.sub} strokeWidth={ICON_STROKE} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Search bar */}
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name…"
                  />

                  {/* Role filter */}
                  <Segmented<string>
                    value={roleFilter}
                    onChange={setRoleFilter}
                    options={[
                      { label: 'All', value: 'all' },
                      { label: 'SH', value: 'SH' },
                      { label: 'RH', value: 'RH' },
                      { label: 'ZH', value: 'ZH' },
                      { label: 'FO', value: 'FO' },
                    ]}
                  />

                  {shTeamLoading ? (
                    <LoadingSpinner color={T.accent} message="Loading team..." />
                  ) : (
                    <>
                      {/* SH-level users (shown only in All view, not when filtering by specific SH) */}
                      {selectedSHId === null && scaFilteredUsers.filter(u => u.role === 'SH').length > 0 && (
                        <View style={[styles.scaSHSection, { borderColor: withAlpha(roleTint('SH', T), 0.35) }]}>
                          <Text
                            style={[
                              styles.scaSHLabel,
                              { color: roleTint('SH', T), backgroundColor: withAlpha(roleTint('SH', T), SOFT_TINT) },
                            ]}
                          >
                            National Heads (SH)
                          </Text>
                          {scaFilteredUsers.filter(u => u.role === 'SH').map(u => (
                            <PersonRow key={u.userId} user={u} onPress={handlePersonPress} />
                          ))}
                        </View>
                      )}

                      {/* Regional hierarchy */}
                      {buildRegionGroups(scaFilteredUsers.filter(u => u.role !== 'SH')).length === 0
                        ? <Empty icon={<Users size={26} color={T.dim} strokeWidth={ICON_STROKE} />} title="No users match" subtitle="Try adjusting the search or role filter." />
                        : buildRegionGroups(scaFilteredUsers.filter(u => u.role !== 'SH')).map(g => (
                          <RegionGroupSection key={g.regionName} group={g} onPersonPress={handlePersonPress} />
                        ))
                      }
                    </>
                  )}
                </>
              )}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── SCHOOL ASSIGNMENTS TAB ───────────────────────────────────────── */}
      {activeTab === 'assignments' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, wide && styles.contentWide]}
          showsVerticalScrollIndicator={false}
        >
          {/* iPad landscape: the assign form becomes a fixed 340pt rail on the left and
              the assignments table takes the rest of the width. Both rails stretch to
              the same height. On the phone they stack, unchanged. */}
          <View style={[styles.mdBody, wide && styles.paneRow]}>
          {/* Assign form */}
          <View style={[nStyles.card, wide && styles.paneForm, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[nStyles.cardTitle, { color: T.text, marginBottom: 12 }]}>
              Assign Schools to Field Officer
            </Text>

            {/* FO picker */}
            <Text style={[nStyles.label, { color: T.sub }]}>Field Officer</Text>
            <TouchableOpacity
              onPress={() => setShowFOPicker(true)}
              style={[nStyles.selectBox, { backgroundColor: T.fieldBg, borderColor: T.line }]}
            >
              <Text
                style={[nStyles.selectTxt, { color: selectedFO ? T.text : T.dim }]}
                numberOfLines={1}
              >
                {selectedFO
                  ? `${selectedFO.name} (${selectedFO.zone || selectedFO.region || 'FO'})`
                  : 'Select FO'}
              </Text>
              <ChevronDown size={15} color={T.dim} />
            </TouchableOpacity>

            {/* Date */}
            <View style={{ marginTop: 12 }}>
              <DateInput
                label="Assignment Date"
                value={assignDate}
                onChange={setAssignDate}
                accentColor={T.accent}
              />
            </View>

            {/* School multi-select */}
            <Text style={[nStyles.label, { color: T.sub, marginTop: 4 }]}>Select Schools</Text>
            <TouchableOpacity
              onPress={() => setSchoolPickerOpen(true)}
              style={[nStyles.selectBox, { backgroundColor: T.fieldBg, borderColor: T.line }]}
            >
              <Text
                style={[nStyles.selectTxt, { color: selectedSchoolIds.length ? T.text : T.dim }]}
                numberOfLines={1}
              >
                {selectedSchoolIds.length
                  ? `${selectedSchoolIds.length} school(s) selected`
                  : 'Tap to select schools…'}
              </Text>
              <ChevronRight size={15} color={T.dim} />
            </TouchableOpacity>

            {/* Selected pills with per-pill remove */}
            {selectedSchoolIds.length > 0 && (
              <View style={nStyles.pillWrap}>
                {selectedSchoolIds.map((sid, idx) => (
                  <FilterChip
                    key={sid}
                    label={`${idx + 1}. ${allSchools.find(s => s.id === sid)?.name ?? sid}`}
                    onRemove={() => toggleSchoolSelection(sid)}
                  />
                ))}
              </View>
            )}

            <Btn
              label={assignSaving ? 'Assigning…' : `Assign ${selectedSchoolIds.length} School(s)`}
              onPress={handleBulkAssign}
              loading={assignSaving}
              disabled={assignSaving || !assignFOId || selectedSchoolIds.length === 0}
              icon={<Check size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={{ marginTop: 14 }}
            />
            <Text style={[nStyles.hint, { color: T.dim }]}>
              Existing schools for this FO and date are kept — new picks are added to the plan.
            </Text>
          </View>

          {/* Team assignments table */}
          <View style={[nStyles.card, wide && styles.pane, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={nStyles.cardHead}>
              <Text style={[nStyles.cardTitle, { color: T.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
                Team Assignments — {assignDate === toISODate(new Date()) ? 'Today' : assignDate}
              </Text>
              <TouchableOpacity onPress={fetchTeamAssignments} hitSlop={10} style={nStyles.refreshBtn}>
                <RefreshCw size={13} color={T.sub} />
                <Text style={[nStyles.refreshTxt, { color: T.sub }]}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {assignLoading ? (
              <LoadingSpinner color={T.accent} />
            ) : teamAssignments.length === 0 ? (
              <View style={nStyles.empty}>
                <SchoolIcon size={26} color={T.dim} />
                <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No school assignments for this date</Text>
              </View>
            ) : (
              renderTeamAssignments()
            )}
          </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── Vehicle Picker Modal (drives the allowance rate) ── */}
      <FormModal
        visible={showVehiclePicker}
        title="Select Mode of Transport"
        onClose={() => setShowVehiclePicker(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setShowVehiclePicker(false)} style={{ flex: 1 }} />
            <Btn
              label={dayActionLoading ? 'Starting…' : 'Start My Day'}
              onPress={handleStartDay}
              loading={dayActionLoading}
              disabled={dayActionLoading}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Text style={[nStyles.hint, { color: T.sub, marginTop: 0, marginBottom: 12 }]}>
          Your allowance rate will be set based on the vehicle you select.
        </Text>
        <View style={{ gap: 8 }}>
          {VEHICLE_OPTIONS.map(v => {
            const on = selectedVehicle === v.value;
            return (
              <TouchableOpacity
                key={v.value}
                onPress={() => setSelectedVehicle(v.value)}
                style={[
                  nStyles.vehicleRow,
                  {
                    backgroundColor: on ? T.accentSoft : T.fieldBg,
                    borderColor: on ? T.accent : T.line,
                  },
                ]}
              >
                <Text style={nStyles.vehicleIcon}>{v.icon}</Text>
                <Text
                  style={[nStyles.vehicleLbl, { color: on ? T.accent : T.text }]}
                  numberOfLines={1}
                >
                  {v.label}
                </Text>
                {on && <Check size={15} color={T.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </FormModal>

      {/* ── FO Picker Modal (role-grouped) ── */}
      <FormModal visible={showFOPicker} title="Select Field Officer" onClose={() => setShowFOPicker(false)}>
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          {foGroups.length === 0 && (
            <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No assignable field officers</Text>
          )}
          {foGroups.map(([group, list]) => (
            <View key={group} style={{ marginBottom: 10 }}>
              <Text style={[nStyles.groupLbl, { color: T.dim }]}>{group.toUpperCase()}</Text>
              {list.map(u => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => { setAssignFOId(u.id); setShowFOPicker(false); }}
                  style={[
                    nStyles.pickRow,
                    { borderBottomColor: T.line },
                    assignFOId === u.id && { backgroundColor: T.accentSoft },
                  ]}
                >
                  <Text style={[nStyles.pickTxt, { color: T.text }]} numberOfLines={1}>{u.name}</Text>
                  {assignFOId === u.id && <Check size={15} color={T.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </FormModal>

      {/* ── School Multi-Select Modal ── */}
      <FormModal
        visible={schoolPickerOpen}
        title="Select Schools"
        onClose={() => { setSchoolPickerOpen(false); setSchoolSearch(''); }}
        footer={
          <Btn
            label="Done"
            onPress={() => { setSchoolPickerOpen(false); setSchoolSearch(''); }}
            style={{ flex: 1 }}
          />
        }
      >
        <SearchBar value={schoolSearch} onChangeText={setSchoolSearch} placeholder="Search schools…" />
        <ScrollView style={{ maxHeight: 340, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {filteredSchools.length === 0 ? (
            <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No schools match your search</Text>
          ) : (
            filteredSchools.map(s => (
              <View key={s.id} style={[nStyles.pickRow, { borderBottomColor: T.line }]}>
                <Checkbox
                  on={selectedSchoolIds.includes(s.id)}
                  onToggle={() => toggleSchoolSelection(s.id)}
                  label={s.name}
                />
              </View>
            ))
          )}
        </ScrollView>
      </FormModal>

      <ConfirmModal
        visible={pendingDeleteId !== null}
        title="Remove Assignment"
        message="This school will be removed from the field officer's plan for this date."
        icon={<Trash2 size={22} color={T.danger} />}
        confirmLabel="Remove"
        onConfirm={() => { if (pendingDeleteId !== null) handleDeleteAssignment(pendingDeleteId); }}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* ── Team User Picker Modal — one modal idiom for the whole screen ── */}
      <FormModal
        visible={showTeamUserPicker}
        title="Select User"
        onClose={() => { setShowTeamUserPicker(false); setTeamUserSearch(''); }}
      >
        <SearchBar value={teamUserSearch} onChangeText={setTeamUserSearch} placeholder="Search name…" />
        <ScrollView style={{ maxHeight: 340, marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {(() => {
            const rows = scopedUsers.filter(
              u => !teamUserSearch || u.name.toLowerCase().includes(teamUserSearch.toLowerCase()),
            );
            if (rows.length === 0) {
              return <Text style={[nStyles.emptyTxt, { color: T.dim }]}>No users found</Text>;
            }
            return rows.map(item => (
              <TouchableOpacity
                key={item.userId}
                style={[nStyles.pickRow, { borderBottomColor: T.line }]}
                onPress={() => { setSelectedTeamUser(item); setShowTeamUserPicker(false); setTeamUserSearch(''); }}
              >
                <View style={[tfStyles.pickerAvatar, { backgroundColor: roleTint(item.role, T) }]}>
                  <Text style={[tfStyles.pickerAvatarText, { color: T.onAccent }]}>{initials(item.name)}</Text>
                </View>
                <View style={{ flexShrink: 1, minWidth: 0, flexGrow: 1 }}>
                  <Text style={[nStyles.pickTxt, { color: T.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[nStyles.stopCity, { color: T.dim }]} numberOfLines={1}>
                    {item.role}{item.zoneName ? ` · ${item.zoneName}` : ''}
                  </Text>
                </View>
                <View
                  style={[tfStyles.statusDot2, { backgroundColor: item.status === 'active' ? T.success : T.dim }]}
                />
              </TouchableOpacity>
            ));
          })()}
        </ScrollView>
      </FormModal>

      <BackgroundLocationDisclosure
        visible={showBgDisclosure}
        onAccept={() => { setShowBgDisclosure(false); bgPermissionResolveRef.current?.(true); bgPermissionResolveRef.current = null; }}
        onDecline={() => { setShowBgDisclosure(false); bgPermissionResolveRef.current?.(false); bgPermissionResolveRef.current = null; }}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  /** iPad landscape gutters — matches SchoolsListScreen's `scrollWide`. */
  contentWide: { paddingHorizontal: 22 },

  /**
   * Two-pane row for iPad landscape.
   *
   * `alignItems:'stretch'` + `flex:1` on each pane makes both cards exactly as tall
   * as the taller one, so a short card never leaves dead space beside a long one
   * (FODashboard.tsx:777). `flexWrap:'nowrap'` keeps the pair on one line — on the
   * phone the same children render with no wrapper style at all and simply stack.
   */
  paneRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'stretch', gap: 12 },
  /**
   * Phone fallbacks for the pane wrappers. `content` sets gap:12 on the ScrollView's
   * direct children only, so once cards live one level deeper each wrapper has to
   * carry the same gap or the stacked phone layout loses all its spacing.
   */
  mdBody: { gap: 12 },
  mdCol: { gap: 12 },
  pane: { flex: 1, minWidth: 0 },
  /** The assign form is a fixed-width rail; the table takes whatever is left. */
  paneForm: { width: 340, flexGrow: 0, flexShrink: 0 },

  /**
   * Landscape map overlays. Both bars keep their left edge and are capped rather
   * than stretched across the full iPad width, which otherwise leaves a Segmented
   * control almost a metre wide.
   */
  mapOverlayWide: { maxWidth: 520 },

  // Tab bar — .seg geometry (track radius 12 / pad 4, cell h32 radius 9)
  tabBar: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tabTrack: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 32, borderRadius: 9, gap: 5, paddingHorizontal: 4, minWidth: 0,
  },
  tabText: { fontSize: rf(12), fontWeight: '700', flexShrink: 1, minWidth: 0, textAlign: 'center' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { fontSize: rf(10), fontWeight: '700' },

  // Map overlays
  mapFilterRow: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20 },
  mapCountBadge: {
    position: 'absolute', bottom: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
    zIndex: 10,
  },
  mapCountText: { fontSize: rf(12), fontWeight: '600' },
  mapEmptyHint: {
    position: 'absolute', top: '38%', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5, paddingHorizontal: 24,
  },
  mapEmptyCard: {
    alignItems: 'center', gap: 6, paddingVertical: 20, paddingHorizontal: 24,
    borderRadius: 16, borderWidth: 1,
  },
  mapEmptyTitle: { fontSize: rf(15), fontWeight: '700', textAlign: 'center' },
  mapEmptySubtitle: { fontSize: rf(12), fontWeight: '500', textAlign: 'center' },

  // Info sheet
  infoSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 14,
    paddingBottom: 14, zIndex: 15,
  },
  /**
   * iPad landscape: the marker detail becomes a floating right-hand panel instead of
   * a full-bleed bottom sheet — a 1000pt-wide sheet holding three small tiles is all
   * dead space, and it buries the map. Declared as a separate object (not an override
   * of `infoSheet`) so no `undefined` has to unset left/right.
   */
  infoSheetWide: {
    position: 'absolute', bottom: 16, right: 16, width: 360, maxWidth: '46%',
    borderRadius: 20, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 14,
    paddingBottom: 14, zIndex: 15,
  },
  infoHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  infoAvatar: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  infoAvatarText: { fontSize: rf(14), fontWeight: '800' },
  infoName: { fontSize: rf(15), fontWeight: '700' },
  infoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoSub: { fontSize: rf(12), fontWeight: '500', flexShrink: 1, minWidth: 0 },
  // alignItems:'stretch' so the three tiles are the same height whatever they hold.
  infoStats: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  infoStat: { flex: 1, minWidth: 0, borderRadius: 11, padding: 10, alignItems: 'center', gap: 3 },
  infoStatVal: { fontSize: rf(12), fontWeight: '700', textAlign: 'center' },
  infoStatLbl: { fontSize: rf(10), fontWeight: '500', textAlign: 'center' },
  infoTrackBtn: { marginHorizontal: 16 },

  // Team tab
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: rf(13), fontWeight: '500' },
  summaryHint: { fontSize: rf(11), fontWeight: '500', marginLeft: 'auto' },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  emptyListText: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', padding: 20 },

  // SCA-specific blocks
  scaSHSection: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  scaSHLabel: {
    fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4,
    paddingHorizontal: 14, paddingVertical: 8, textTransform: 'uppercase',
  },
  scaSHFilterBlock: { borderRadius: 16, borderWidth: 1, padding: 12 },
  scaSHFilterLabel: {
    fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4,
    marginBottom: 8, textTransform: 'uppercase',
  },
  scaSHFilterRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  scaSHChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, height: 28, borderRadius: 14, borderWidth: 1,
  },
  scaSHChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  scaSHChipText: { fontSize: rf(12), fontWeight: '600', maxWidth: 110, flexShrink: 1, minWidth: 0 },
  scaSHSelectedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1,
  },
  scaSHSelectedText: { fontSize: rf(11), fontWeight: '500', flexShrink: 1, minWidth: 0, flexGrow: 1 },
});

// ─── My Day styles ────────────────────────────────────────────────────────────
const mdStyles = StyleSheet.create({
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  permTitle: { fontSize: rf(13), fontWeight: '700' },
  permSub: { fontSize: rf(11), fontWeight: '500', marginTop: 2 },
  permAction: {
    fontSize: rf(12), fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 10, marginBottom: 14, flexWrap: 'wrap',
  },
  cardDate: { fontSize: rf(12), fontWeight: '500', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 11, padding: 10, marginBottom: 12,
  },
  bannerTxt: { fontSize: rf(12), fontWeight: '600' },
  // Equal-height tiles: stretch, and every cell fills the row height.
  statsGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  statBox: {
    flex: 1, minWidth: 0, borderRadius: 13, padding: 12,
    alignItems: 'center', justifyContent: 'flex-start', gap: 5,
  },
  statVal: { fontSize: rf(15), fontWeight: '800', textAlign: 'center' },
  statLbl: { fontSize: rf(10), fontWeight: '600', textAlign: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  historyHeader: { marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  dateChipText: { fontSize: rf(11), fontWeight: '600' },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 },
  histItem: { flexGrow: 1, flexBasis: '47%', minWidth: 0, borderRadius: 11, padding: 12 },
  histLbl: { fontSize: rf(11), fontWeight: '500', marginBottom: 4 },
  histVal: { fontSize: rf(14), fontWeight: '700' },
});

// ─── Team Filter styles ────────────────────────────────────────────────────────
const tfStyles = StyleSheet.create({
  // Filter bar
  filterCard: { borderRadius: 16, padding: 12, borderWidth: 1, gap: 10 },
  userSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 13, height: 46, paddingHorizontal: 14,
  },
  userSelectorLabel: { fontSize: rf(12.5), fontWeight: '600' },
  // flexShrink:1 + minWidth:0 — a long user name must ellipsise, not cover the chevron.
  userSelectorValue: { flexShrink: 1, minWidth: 0, flexGrow: 1, fontSize: rf(13), fontWeight: '500' },
  dateRefreshRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

  // Selected user stats card
  statsCard: { borderRadius: 16, padding: 12, borderWidth: 1, gap: 12 },
  statsCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsAvatar: { width: 44, height: 44, borderRadius: 13 },
  statsAvatarText: { fontSize: rf(14), fontWeight: '800' },
  statsName: { fontSize: rf(14), fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  statsRowSecond: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  statItem: { flexShrink: 1, minWidth: 0, flexGrow: 1, flexBasis: 0 },
  statLabel: { fontSize: rf(11), fontWeight: '500', marginBottom: 3 },
  statValue: { fontSize: rf(14), fontWeight: '700' },

  // Picker rows
  pickerAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { fontSize: rf(12), fontWeight: '800' },
  statusDot2: { width: 9, height: 9, borderRadius: 4.5 },
});

/**
 * Styles for the parity work added on top of the original screen. These are
 * theme-driven: every colour is applied inline from useAppTheme() tokens at the
 * call site, so nothing here hardcodes a hex.
 */
const nStyles = StyleSheet.create({
  // No marginBottom — every list that holds these cards sets its own `gap`.
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },

  stateCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  stateTitle: { fontSize: rf(15), fontWeight: '700', textAlign: 'center' },
  stateTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: 18 },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  cardTitle: { fontSize: rf(14), fontWeight: '700' },
  label: { fontSize: rf(12), fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: rf(11), fontWeight: '400', marginTop: 8, lineHeight: 16 },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  refreshTxt: { fontSize: rf(11), fontWeight: '600' },

  selectBox: {
    height: 46, borderWidth: 1.5, borderRadius: 13, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  // flexShrink:1 + minWidth:0 — without both, a long school/FO name paints straight
  // over the chevron instead of ellipsising.
  selectTxt: { fontSize: rf(14), fontWeight: '500', flexShrink: 1, minWidth: 0 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },

  empty: { alignItems: 'center', paddingVertical: 26, gap: 8 },
  emptyTxt: { fontSize: rf(13), fontWeight: '500', textAlign: 'center' },

  groupLbl: { fontSize: rf(10), fontWeight: '700', letterSpacing: 0.6, marginBottom: 4, marginTop: 4 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1,
  },
  pickTxt: { fontSize: rf(14), fontWeight: '500', flexShrink: 1, minWidth: 0 },

  vehicleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 13, borderWidth: 2,
  },
  vehicleIcon: { fontSize: rf(18) },
  vehicleLbl: { fontSize: rf(13), fontWeight: '600', flexShrink: 1, minWidth: 0 },

  breakdown: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  breakdownTitle: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  breakdownRow: { flexDirection: 'row', gap: 8 },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 2 },
  breakdownVal: { fontSize: rf(13), fontWeight: '700' },
  breakdownLbl: { fontSize: rf(10), fontWeight: '500', textAlign: 'center' },

  progressWrap: { marginBottom: 12 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  progressLbl: { fontSize: rf(12), fontWeight: '600' },
  progressPct: { fontSize: rf(12), fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  routeStatRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 10 },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeStatVal: { fontSize: rf(13), fontWeight: '700' },
  routeStatLbl: { fontSize: rf(11), fontWeight: '500' },

  routeNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  // flexShrink:1 + minWidth:0 so a long error_message wraps instead of pushing Retry off-screen
  routeNoticeBody: { flexShrink: 1, minWidth: 0, flexGrow: 1 },
  routeNoticeTxt: { fontSize: rf(11.5), fontWeight: '600', flexShrink: 1 },
  routeNoticeDetail: { fontSize: rf(10.5), fontWeight: '400', marginTop: 2, lineHeight: 14 },
  routeNoticeRetry: { fontSize: rf(11.5), fontWeight: '700' },

  routeMapWrap: { height: 180, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  routeMapWrapWide: { height: 300 },

  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9,
  },
  stopOrder: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stopOrderTxt: { fontSize: rf(12), fontWeight: '700' },
  stopBody: { flexShrink: 1, minWidth: 0, flexGrow: 1 },
  stopName: { fontSize: rf(13), fontWeight: '600' },
  stopCity: { fontSize: rf(11), fontWeight: '400', marginTop: 1 },
  reportBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // ── Team Last Locations ──
  tblSubtitle: { fontSize: rf(11), fontWeight: '400', marginTop: 1 },
  tbl: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12 },
  th: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(12.5), fontWeight: '500' },
  tdMono: { fontSize: rf(11.5), fontWeight: '500' },
  tdName: { fontSize: rf(13), fontWeight: '700' },
  tdSub: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  teamNameCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /** Any <Text> living inside a flex cell, so it ellipsises instead of pushing. */
  cellText: { flexShrink: 1, minWidth: 0 },

  /**
   * Column bases. Each constant is applied to BOTH the header <Text> and the body
   * cell, so the two can never drift apart.
   *
   * `flexShrink:1, minWidth:0` is mandatory on every flexible cell: flexShrink
   * defaults to 0 in RN, so a long value (a full name, a lat/lon pair) refuses to
   * shrink below its content width and shoves every column after it out of
   * alignment. The fixed-width action column deliberately keeps the RN default of
   * flexShrink:0 — it must stay exactly 118 wide so the buttons line up.
   */
  cTeamName: { flex: 2, flexShrink: 1, minWidth: 0 },
  cTeamRole: { flex: 0.9, flexShrink: 1, minWidth: 0 },
  cTeamStatus: { flex: 1.1, flexShrink: 1, minWidth: 0 },
  cTeamSeen: { flex: 1.1, flexShrink: 1, minWidth: 0 },
  cTeamLoc: { flex: 1.6, flexShrink: 1, minWidth: 0 },
  cTeamDist: { flex: 0.9, flexShrink: 1, minWidth: 0 },
  cTeamActions: { width: 118 },

  // ── Team Assignments table (iPad) ──
  cAsgOrder: { width: 40 },
  cAsgSchool: { flex: 2.2, flexShrink: 1, minWidth: 0 },
  cAsgFo: { flex: 1.4, flexShrink: 1, minWidth: 0 },
  cAsgCity: { flex: 1.2, flexShrink: 1, minWidth: 0 },
  cAsgTime: { flex: 0.8, flexShrink: 1, minWidth: 0 },
  cAsgStatus: { flex: 1, flexShrink: 1, minWidth: 0 },
  cAsgActions: { width: 44 },

  pgRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, flexWrap: 'wrap', marginTop: 12,
  },
  pgCount: { fontSize: rf(11.5), fontWeight: '500', flexShrink: 1, minWidth: 0 },

  teamAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  teamAvatarTxt: { fontSize: rf(11), fontWeight: '700' },

  viewRouteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, alignSelf: 'flex-start',
  },
  viewRouteTxt: { fontSize: rf(11), fontWeight: '700' },

  teamCard: { borderWidth: 1, borderRadius: 13, padding: 10, gap: 9 },
  teamCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  teamCardMeta: { flexDirection: 'row', gap: 10 },
  teamMetaItem: { flex: 1, minWidth: 0 },
  teamMetaLbl: { fontSize: rf(10), fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  teamMetaVal: { fontSize: rf(12.5), fontWeight: '600', marginTop: 1 },
  teamCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  mapKindBar: {
    position: 'absolute', top: 58, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5,
    zIndex: 20,
  },
  mapKindChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  mapKindTxt: { fontSize: rf(11), fontWeight: '600' },
});
