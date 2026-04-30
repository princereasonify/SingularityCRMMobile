import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  AppState,
  Platform,
  PermissionsAndroid,
  Linking,
  Image,
  Modal,
  FlatList,
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
  Wifi,
  WifiOff,
  DollarSign,
  Calendar,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import BackgroundFetch from 'react-native-background-fetch';
import { sendLocationPing } from '../../services/locationPingService';
import { startNativeTracking, stopNativeTracking, requestIOSLocationPermission, checkIOSPermission } from '../../services/nativeLocationTracking';
import { BackgroundLocationDisclosure } from '../../components/common/BackgroundLocationDisclosure';
import { DateInput } from '../../components/common/DateInput';
import { trackingApi } from '../../api/tracking';
import { LiveLocationDto, RoutePointDto, SessionResponseDto, TrackingSessionDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ROLE_COLORS } from '../../utils/constants';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  formatTime,
  toISODate,
} from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const PING_QUEUE_KEY = 'tracking_ping_queue';
const PING_INTERVAL_MS = 30000;

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'myDay' | 'map' | 'team';
type StatusFilter = 'all' | 'active' | 'ended';

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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const roleColor = (role: string): string =>
  ({ FO: ROLE_COLORS.FO.primary, ZH: ROLE_COLORS.ZH.primary, RH: ROLE_COLORS.RH.primary, SH: ROLE_COLORS.SH.primary } as Record<string, string>)[role] ?? '#6B7280';

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

// ─── Map marker components ────────────────────────────────────────────────────

const AllUsersMarker = React.memo(({ user }: { user: LiveLocationDto }) => {
  const c = roleColor(user.role);
  const active = user.status === 'active';
  return (
    <View style={amStyles.wrap}>
      {active && <View style={[amStyles.pulse, { borderColor: c }]} />}
      <View style={[amStyles.bubble, { backgroundColor: c, opacity: active ? 1 : 0.6 }]}>
        <Text style={amStyles.ini}>{initials(user.name)}</Text>
        <Text style={amStyles.role}>{user.role}</Text>
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
    alignItems: 'center', borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, elevation: 6,
  },
  ini: { fontSize: rf(11), fontWeight: '800', color: '#FFF' },
  role: { fontSize: rf(7), fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  pin: {
    width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1,
  },
});

// Live marker — larger, pulsing ring for individual tracking
const LiveUserMarker = ({ user }: { user: LiveLocationDto }) => {
  const c = roleColor(user.role);
  return (
    <View style={lvStyles.wrap}>
      <View style={[lvStyles.outerRing, { borderColor: c }]} />
      <View style={[lvStyles.innerRing, { borderColor: c }]} />
      <View style={[lvStyles.dot, { backgroundColor: c }]}>
        <Text style={lvStyles.ini}>{initials(user.name)}</Text>
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
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  ini: { fontSize: rf(12), fontWeight: '800', color: '#FFF' },
});

// ─── Individual Tracking View ─────────────────────────────────────────────────
// Full-screen view: live location marker + route polyline + auto-refresh + day picker

interface IndividualTrackingProps {
  person: LiveLocationDto;         // initial live data
  managerRoleColor: { primary: string; light: string };
  onBack: () => void;
}

const IndividualTrackingView = ({ person, onBack }: IndividualTrackingProps) => {
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
  const personColor = roleColor(person.role);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }} edges={['bottom']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={ivStyles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={ivStyles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={ivStyles.headerCenter}>
          <View style={[ivStyles.headerAvatar, { backgroundColor: personColor }]}>
            <Text style={ivStyles.headerAvatarText}>{initials(person.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ivStyles.headerName} numberOfLines={1}>{person.name}</Text>
            <View style={ivStyles.headerMeta}>
              <RoleBadge role={person.role} />
              {person.zoneName && <Text style={ivStyles.headerZone}>{person.zoneName}</Text>}
              {person.regionName && !person.zoneName && (
                <Text style={ivStyles.headerZone}>{person.regionName}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Live indicator */}
        {liveData.status === 'active' && isToday ? (
          <View style={ivStyles.liveChip}>
            <View style={ivStyles.livePulse} />
            <Text style={ivStyles.liveText}>LIVE</Text>
          </View>
        ) : (
          <View style={ivStyles.endedChip}>
            <Text style={ivStyles.endedText}>Ended</Text>
          </View>
        )}
      </View>

      {/* ── Date picker ────────────────────────────────────────────────── */}
      <View style={ivStyles.dateBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ivStyles.dateScroll}>
          {days.map((d, i) => {
            const active = selectedDate === d;
            return (
              <TouchableOpacity
                key={d}
                style={[ivStyles.dateChip, active && { backgroundColor: personColor }]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[ivStyles.dateChipText, active && { color: '#FFF' }]}>
                  {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isToday && (
          <View style={ivStyles.refreshBadge}>
            <Radio size={11} color="#22C55E" />
            <Text style={ivStyles.refreshText}>
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
              pinColor="#16A34A"
              title="Start"
              description={startTime}
            />
          )}

          {/* End pin (only for past dates — for today the live marker is the end) */}
          {routeCoords.length > 1 && !isToday && (
            <Marker
              coordinate={routeCoords[routeCoords.length - 1]}
              pinColor="#DC2626"
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
          <View style={ivStyles.overlay}>
            <LoadingSpinner color={personColor} message="Loading tracking data..." />
          </View>
        )}

        {/* No data overlay */}
        {!loading && routePoints.length === 0 && !hasLiveLocation && (
          <View style={ivStyles.overlay}>
            <EmptyState
              title="No tracking data"
              subtitle={isToday ? "This person hasn't started tracking today." : `No data for ${formatDate(selectedDate)}`}
              icon={isToday ? '📡' : '🗺️'}
            />
          </View>
        )}

        {/* No route yet but person is live */}
        {!loading && routePoints.length === 0 && hasLiveLocation && (
          <View style={ivStyles.noRouteHint} pointerEvents="none">
            <Text style={ivStyles.noRouteText}>Route building… location updated</Text>
          </View>
        )}

        {/* ── Stats Panel ──────────────────────────────────────────────── */}
        <View style={ivStyles.statsPanel}>
          {/* Top row: quick stats */}
          <View style={ivStyles.statsRow}>
            <View style={ivStyles.statBox}>
              <Navigation size={16} color={personColor} />
              <Text style={ivStyles.statVal}>{totalKm.toFixed(1)} km</Text>
              <Text style={ivStyles.statLbl}>Distance</Text>
            </View>
            <View style={ivStyles.statDivider} />
            <View style={ivStyles.statBox}>
              <Activity size={16} color={personColor} />
              <Text style={ivStyles.statVal}>{liveData.speedKmh?.toFixed(0) ?? '--'} km/h</Text>
              <Text style={ivStyles.statLbl}>Speed</Text>
            </View>
            <View style={ivStyles.statDivider} />
            <View style={ivStyles.statBox}>
              <MapPin size={16} color={personColor} />
              <Text style={ivStyles.statVal}>{routePoints.length}</Text>
              <Text style={ivStyles.statLbl}>Pings</Text>
            </View>
            <View style={ivStyles.statDivider} />
            <View style={ivStyles.statBox}>
              <Clock size={16} color={personColor} />
              <Text style={ivStyles.statVal}>{formatRelativeDate(liveData.lastSeen)}</Text>
              <Text style={ivStyles.statLbl}>Last Seen</Text>
            </View>
          </View>

          {/* Bottom row: time + battery */}
          <View style={ivStyles.statsRowSecondary}>
            <View style={ivStyles.statPill}>
              <Text style={[ivStyles.statPillLabel, { color: '#16A34A' }]}>▶ {startTime}</Text>
              <Text style={ivStyles.statPillSub}>Start</Text>
            </View>
            {(isToday ? liveData.status === 'ended' : true) && routePoints.length > 1 && (
              <View style={ivStyles.statPill}>
                <Text style={[ivStyles.statPillLabel, { color: '#DC2626' }]}>■ {endTime}</Text>
                <Text style={ivStyles.statPillSub}>End</Text>
              </View>
            )}
            {liveData.batteryLevel != null && (
              <View style={ivStyles.statPill}>
                <Text style={[ivStyles.statPillLabel, { color: liveData.batteryLevel < 0.2 ? '#DC2626' : '#6B7280' }]}>
                  🔋 {Math.round(liveData.batteryLevel * 100)}%
                </Text>
                <Text style={ivStyles.statPillSub}>Battery</Text>
              </View>
            )}
            {liveData.isSuspicious && (
              <View style={[ivStyles.statPill, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[ivStyles.statPillLabel, { color: '#DC2626' }]}>
                  ⚠ {liveData.fraudScore}
                </Text>
                <Text style={ivStyles.statPillSub}>Fraud</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const ivStyles = StyleSheet.create({
  // Header (dark bg)
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: '#111827', gap: 8,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerAvatarText: { fontSize: rf(13), fontWeight: '800', color: '#FFF' },
  headerName: { fontSize: rf(14), fontWeight: '700', color: '#FFF' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerZone: { fontSize: rf(11), color: 'rgba(255,255,255,0.6)' },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#14532D', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  livePulse: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' },
  liveText: { fontSize: rf(10), fontWeight: '800', color: '#22C55E' },
  endedChip: {
    backgroundColor: '#1F2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  endedText: { fontSize: rf(10), fontWeight: '700', color: '#9CA3AF' },

  // Date bar
  dateBar: {
    backgroundColor: '#1F2937',
    flexDirection: 'row', alignItems: 'center',
  },
  dateScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flex: 1 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18,
    backgroundColor: '#374151',
  },
  dateChipText: { fontSize: rf(12), fontWeight: '600', color: '#D1D5DB' },
  refreshBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingRight: 14,
  },
  refreshText: { fontSize: rf(10), color: '#22C55E', fontWeight: '600' },

  // Map overlays
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(249,250,251,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  noRouteHint: {
    position: 'absolute', top: 16, left: 0, right: 0,
    alignItems: 'center', zIndex: 5,
  },
  noRouteText: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    fontSize: rf(12), fontWeight: '600',
  },

  // Stats panel
  statsPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingTop: 14, paddingBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 12,
  },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  statVal: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  statLbl: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '500' },
  statsRowSecondary: {
    flexDirection: 'row', paddingHorizontal: 12, gap: 8, flexWrap: 'wrap',
  },
  statPill: {
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  statPillLabel: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  statPillSub: { fontSize: rf(9), color: '#9CA3AF', marginTop: 1 },
});

// ─── Compact person row (used inside ZoneGroup / RegionGroup) ─────────────────

interface PersonRowProps {
  user: LiveLocationDto;
  indent?: boolean;
  onPress: (u: LiveLocationDto) => void;
}

const PersonRow = ({ user, indent = false, onPress }: PersonRowProps) => {
  const c = roleColor(user.role);
  const active = user.status === 'active';
  return (
    <TouchableOpacity
      style={[prStyles.row, indent && prStyles.indented]}
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      <View style={prStyles.avatarWrap}>
        {user.avatar && user.avatar.startsWith('http') ? (
          <Image source={{ uri: user.avatar }} style={prStyles.avatar} />
        ) : (
          <View style={[prStyles.avatar, { backgroundColor: c }]}>
            <Text style={prStyles.avatarText}>{initials(user.name)}</Text>
          </View>
        )}
        <View style={[prStyles.dot, { backgroundColor: active ? '#22C55E' : '#9CA3AF' }]} />
      </View>

      <View style={prStyles.info}>
        <Text style={prStyles.name}>{user.name}</Text>
        <View style={prStyles.meta}>
          <RoleBadge role={user.role} />
          {user.zoneName && !indent && <Text style={prStyles.sub}>{user.zoneName}</Text>}
          {user.regionName && !user.zoneName && <Text style={prStyles.sub}>{user.regionName}</Text>}
        </View>
      </View>

      <View style={prStyles.right}>
        <View style={prStyles.statsInline}>
          <Navigation size={11} color="#9CA3AF" />
          <Text style={prStyles.statText}>{user.totalDistanceKm.toFixed(1)}km</Text>
          <Clock size={11} color="#9CA3AF" />
          <Text style={prStyles.statText}>{formatRelativeDate(user.lastSeen)}</Text>
        </View>
        <View style={[prStyles.statusBadge, { backgroundColor: active ? '#DCFCE7' : '#F3F4F6' }]}>
          <Text style={[prStyles.statusText, { color: active ? '#16A34A' : '#9CA3AF' }]}>
            {active ? 'Active' : 'Ended'}
          </Text>
        </View>
      </View>

      <ChevronRight size={16} color="#D1D5DB" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
};

const prStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  indented: { paddingLeft: 30, backgroundColor: '#FAFAFA' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: rf(12), fontWeight: '800', color: '#FFF' },
  dot: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFF',
    position: 'absolute', bottom: 0, right: -1,
  },
  info: { flex: 1 },
  name: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sub: { fontSize: rf(11), color: '#9CA3AF' },
  right: { alignItems: 'flex-end', gap: 4 },
  statsInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: rf(10), color: '#6B7280', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: rf(10), fontWeight: '700' },
});

// ─── Zone Group (collapsible) ─────────────────────────────────────────────────

interface ZoneGroupProps {
  group: ZoneGroup;
  onPersonPress: (u: LiveLocationDto) => void;
  defaultExpanded?: boolean;
}

const ZoneGroupSection = ({ group, onPersonPress, defaultExpanded = true }: ZoneGroupProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const total = (group.zh ? 1 : 0) + group.fos.length;
  const active = [group.zh, ...group.fos].filter(u => u?.status === 'active').length;

  return (
    <View style={zgStyles.container}>
      <TouchableOpacity style={zgStyles.header} onPress={() => setExpanded(e => !e)}>
        <View style={zgStyles.iconWrap}>
          <MapPin size={13} color={ROLE_COLORS.ZH.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={zgStyles.title}>{group.zoneName}</Text>
          <Text style={zgStyles.sub}>
            {active > 0 ? `${active} active · ` : ''}{total} member{total !== 1 ? 's' : ''}
          </Text>
        </View>
        {active > 0 && (
          <View style={[zgStyles.badge, { backgroundColor: ROLE_COLORS.ZH.primary }]}>
            <Text style={zgStyles.badgeText}>{active}</Text>
          </View>
        )}
        {expanded ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
      </TouchableOpacity>

      {expanded && (
        <View>
          {group.zh && <PersonRow user={group.zh} onPress={onPersonPress} />}
          {group.fos.map(fo => (
            <PersonRow key={fo.userId} user={fo} indent onPress={onPersonPress} />
          ))}
          {total === 0 && (
            <Text style={zgStyles.empty}>No tracking data for this zone today.</Text>
          )}
        </View>
      )}
    </View>
  );
};

const zgStyles = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 2 },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
    backgroundColor: '#F8FAFF',
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ROLE_COLORS.ZH.primary + '22',
  },
  title: { fontSize: rf(13), fontWeight: '700', color: '#1E293B' },
  sub: { fontSize: rf(11), color: '#9CA3AF', marginTop: 1 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { fontSize: rf(10), fontWeight: '700', color: '#FFF' },
  empty: { fontSize: rf(12), color: '#9CA3AF', textAlign: 'center', padding: 14 },
});

// ─── Region Group (collapsible) ───────────────────────────────────────────────

interface RegionGroupProps {
  group: RegionGroup;
  onPersonPress: (u: LiveLocationDto) => void;
}

const RegionGroupSection = ({ group, onPersonPress }: RegionGroupProps) => {
  const [expanded, setExpanded] = useState(true);
  const totalUsers = (group.rh ? 1 : 0) + group.zones.reduce((s, z) => s + (z.zh ? 1 : 0) + z.fos.length, 0);
  const activeUsers = [group.rh, ...group.zones.flatMap(z => [z.zh, ...z.fos])]
    .filter(u => u?.status === 'active').length;

  return (
    <View style={rgStyles.container}>
      <TouchableOpacity style={rgStyles.header} onPress={() => setExpanded(e => !e)}>
        <View style={rgStyles.iconWrap}>
          <Users size={13} color={ROLE_COLORS.RH.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rgStyles.title}>{group.regionName}</Text>
          <Text style={rgStyles.sub}>
            {activeUsers > 0 ? `${activeUsers} active · ` : ''}
            {totalUsers} member{totalUsers !== 1 ? 's' : ''} · {group.zones.length} zone{group.zones.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {activeUsers > 0 && (
          <View style={[rgStyles.badge, { backgroundColor: ROLE_COLORS.RH.primary }]}>
            <Text style={rgStyles.badgeText}>{activeUsers}</Text>
          </View>
        )}
        {expanded ? <ChevronDown size={15} color="#9CA3AF" /> : <ChevronRight size={15} color="#9CA3AF" />}
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
  container: { borderRadius: 14, borderWidth: 1, borderColor: '#D1D5DB', overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    backgroundColor: '#FFF5F0',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ROLE_COLORS.RH.primary + '22',
  },
  title: { fontSize: rf(14), fontWeight: '800', color: '#1E293B' },
  sub: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  badgeText: { fontSize: rf(10), fontWeight: '700', color: '#FFF' },
  body: { gap: 8, padding: 10 },
});

// ─── Main LiveTrackingScreen ──────────────────────────────────────────────────

export const LiveTrackingScreen = () => {
  const nav = useNavigation();
  const { user } = useAuth();
  const rc = user?.role ? ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] : ROLE_COLORS.ZH;
  const isSCA = user?.role === 'SCA';

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

  // Individual tracking — when set, shows IndividualTrackingView full-screen
  const [trackingPerson, setTrackingPerson] = useState<LiveLocationDto | null>(null);

  // Map state
  const [liveUsers, setLiveUsers] = useState<LiveLocationDto[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LiveLocationDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const mapRef = useRef<MapView>(null);

  // Team tab: user picker + date filter
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

  // SCA: fetch team for the selected SH (passes managerId to backend for future support)
  const fetchSHTeam = useCallback(async (shId: number) => {
    setShTeamLoading(true);
    try {
      const res = await trackingApi.getLiveLocations(shId);
      const data = res.data as LiveLocationDto[];
      // Backend may not yet filter by managerId — fall back to client-side filter
      // by removing the SH themselves and any users from other SHs (future: backend handles this)
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
      const res = await trackingApi.startDay();
      const data = res.data as SessionResponseDto;
      setDaySession(data?.session ?? null); setStartEnabled(false); setEndEnabled(true);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? '';
      if (err?.response?.status === 400 && msg.toLowerCase().includes('already')) { await fetchDaySession(); }
      else Alert.alert('Error', msg || 'Failed to start day.');
    } finally { setDayActionLoading(false); }
  };

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

  const getStatusColor = (status?: string) => status === 'active' ? '#22C55E' : status === 'ended' ? '#EF4444' : '#9CA3AF';
  const getStatusLabel = (status?: string) => status === 'active' ? 'Active' : status === 'ended' ? 'Day Ended' : 'Not Started';

  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return toISODate(d); }), []);

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

  // ── Individual tracking guard ─────────────────────────────────────────────

  if (trackingPerson) {
    return (
      <IndividualTrackingView
        person={trackingPerson}
        managerRoleColor={rc}
        onBack={() => setTrackingPerson(null)}
      />
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen color={rc.primary} message="Loading tracking..." />;
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
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Live Tracking" subtitle={subtitle} color={rc.primary} onMenu={() => nav.dispatch(DrawerActions.toggleDrawer())} />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && { borderBottomColor: rc.primary }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && { color: rc.primary }]}>{t.label}</Text>
            {t.badge != null && t.badge > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: rc.primary }]}>
                <Text style={styles.tabBadgeText}>{t.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── MY DAY TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'myDay' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Location permission banner */}
          {locationChecked && !locationGranted && (
            <TouchableOpacity style={mdStyles.permBanner} onPress={requestLocationPermission} activeOpacity={0.7}>
              <MapPin size={16} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={mdStyles.permTitle}>Location Access Required</Text>
                <Text style={mdStyles.permSub}>Tap to enable location for tracking</Text>
              </View>
              <Text style={mdStyles.permAction}>Enable</Text>
            </TouchableOpacity>
          )}

          {/* My Day card */}
          <View style={mdStyles.card}>
            <View style={mdStyles.cardHeader}>
              <View>
                <Text style={mdStyles.cardTitle}>My Day</Text>
                <Text style={mdStyles.cardDate}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={mdStyles.btnRow}>
                <TouchableOpacity
                  style={[mdStyles.actionBtn, { backgroundColor: startEnabled ? '#16A34A' : '#9CA3AF' }]}
                  onPress={handleStartDay}
                  disabled={!startEnabled || dayActionLoading}
                >
                  <Navigation size={14} color="#FFF" />
                  <Text style={mdStyles.actionBtnText}>{dayActionLoading && startEnabled ? 'Starting…' : 'Start My Day'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mdStyles.actionBtn, { backgroundColor: endEnabled ? '#DC2626' : '#9CA3AF' }]}
                  onPress={handleEndDay}
                  disabled={!endEnabled || dayActionLoading}
                >
                  <Text style={mdStyles.actionBtnText}>{dayActionLoading && endEnabled ? 'Ending…' : 'End Day'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {daySession?.status === 'ended' && (
              <View style={mdStyles.endedBanner}>
                <Check size={14} color="#22C55E" />
                <Text style={mdStyles.endedText}>Session ended. You can start again anytime.</Text>
              </View>
            )}
            {daySession?.isSuspicious && (
              <View style={mdStyles.fraudBanner}>
                <AlertTriangle size={14} color="#DC2626" />
                <Text style={mdStyles.fraudText}>Session flagged — fraud score: {daySession.fraudScore}</Text>
              </View>
            )}

            {/* Stats grid */}
            <View style={mdStyles.statsGrid}>
              <View style={mdStyles.statBox}>
                <Navigation size={16} color="#0D9488" />
                <Text style={mdStyles.statVal}>{daySession?.totalDistanceKm?.toFixed(1) ?? '0.0'} km</Text>
                <Text style={mdStyles.statLbl}>Today's Distance</Text>
              </View>
              <View style={[mdStyles.statBox, { backgroundColor: '#FFFBEB' }]}>
                <DollarSign size={16} color="#D97706" />
                <Text style={[mdStyles.statVal, { color: '#92400E' }]}>{formatCurrency(daySession?.allowanceAmount ?? 0)}</Text>
                <Text style={[mdStyles.statLbl, { color: '#D97706' }]}>Today's Allowance</Text>
              </View>
              <View style={[mdStyles.statBox, { backgroundColor: '#EFF6FF' }]}>
                <View style={[mdStyles.statusDot, { backgroundColor: getStatusColor(daySession?.status) }]} />
                <Text style={[mdStyles.statVal, { color: '#1D4ED8', fontSize: rf(13) }]}>{getStatusLabel(daySession?.status)}</Text>
                <Text style={[mdStyles.statLbl, { color: '#3B82F6' }]}>Session Status</Text>
              </View>
            </View>

            {dayLoading && <LoadingSpinner color={rc.primary} />}
          </View>

          {/* Tracking History */}
          <View style={mdStyles.card}>
            <View style={mdStyles.historyHeader}>
              <Text style={mdStyles.cardTitle}>My Tracking History</Text>
              <View style={mdStyles.dateRow}>
                <Calendar size={14} color="#9CA3AF" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {last7Days.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      style={[mdStyles.dateChip, historyDate === d && { backgroundColor: rc.primary }]}
                      onPress={() => handleHistoryDate(d)}
                    >
                      <Text style={[mdStyles.dateChipText, historyDate === d && { color: '#FFF' }]}>
                        {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatDate(d)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {historyLoading ? (
              <LoadingSpinner color={rc.primary} message="Loading..." />
            ) : historySession ? (
              <View style={mdStyles.historyGrid}>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>Distance</Text><Text style={mdStyles.histVal}>{historySession.totalDistanceKm?.toFixed(1)} km</Text></View>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>Allowance</Text><Text style={mdStyles.histVal}>{formatCurrency(historySession.allowanceAmount)}</Text></View>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>Start</Text><Text style={mdStyles.histVal}>{formatTime(historySession.startedAt)}</Text></View>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>End</Text><Text style={mdStyles.histVal}>{historySession.endedAt ? formatTime(historySession.endedAt) : '--'}</Text></View>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>Duration</Text><Text style={mdStyles.histVal}>{getSessionDuration(historySession)}</Text></View>
                <View style={mdStyles.histItem}><Text style={mdStyles.histLbl}>Pings</Text><Text style={mdStyles.histVal}>{historySession.pingCount ?? 0}</Text></View>
              </View>
            ) : (
              <View style={mdStyles.emptyHist}>
                <MapPin size={28} color="#D1D5DB" />
                <Text style={mdStyles.emptyHistText}>No tracking data for this date</Text>
              </View>
            )}
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

          {/* Status filter chips */}
          <View style={styles.mapFilterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['all', 'active', 'ended'] as StatusFilter[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.mapChip, statusFilter === s && { backgroundColor: rc.primary }]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.mapChipText, statusFilter === s && { color: '#FFF' }]}>
                    {s === 'all' ? 'All' : s === 'active' ? '● Active' : '○ Ended'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Count */}
          <View style={styles.mapCountBadge}>
            <Users size={12} color="#6B7280" />
            <Text style={styles.mapCountText}>{activeCount} active / {mapUsers.length} shown</Text>
          </View>

          {/* Empty hint */}
          {mapUsers.length === 0 && (
            <View style={styles.mapEmptyHint} pointerEvents="none">
              <Text style={styles.mapEmptyIcon}>📍</Text>
              <Text style={styles.mapEmptyTitle}>No users match filter</Text>
              <Text style={styles.mapEmptySubtitle}>Change the status filter above</Text>
            </View>
          )}

          {/* Info sheet when marker tapped */}
          {selectedMarker && (
            <View style={styles.infoSheet}>
              <View style={styles.infoHandle} />
              <View style={styles.infoRow}>
                <View style={[styles.infoAvatar, { backgroundColor: roleColor(selectedMarker.role) }]}>
                  <Text style={styles.infoAvatarText}>{initials(selectedMarker.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoName}>{selectedMarker.name}</Text>
                  <View style={styles.infoMeta}>
                    <RoleBadge role={selectedMarker.role} />
                    {selectedMarker.zoneName && <Text style={styles.infoSub}>{selectedMarker.zoneName}</Text>}
                    {selectedMarker.regionName && !selectedMarker.zoneName && (
                      <Text style={styles.infoSub}>{selectedMarker.regionName}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedMarker(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={styles.infoStats}>
                <View style={styles.infoStat}>
                  <Navigation size={13} color={rc.primary} />
                  <Text style={styles.infoStatVal}>{selectedMarker.totalDistanceKm.toFixed(1)} km</Text>
                  <Text style={styles.infoStatLbl}>Distance</Text>
                </View>
                <View style={styles.infoStat}>
                  <Clock size={13} color={rc.primary} />
                  <Text style={styles.infoStatVal}>{formatRelativeDate(selectedMarker.lastSeen)}</Text>
                  <Text style={styles.infoStatLbl}>Last Seen</Text>
                </View>
                <View style={styles.infoStat}>
                  <Activity size={13} color={rc.primary} />
                  <Text style={styles.infoStatVal}>{selectedMarker.speedKmh?.toFixed(0) ?? '--'} km/h</Text>
                  <Text style={styles.infoStatLbl}>Speed</Text>
                </View>
              </View>

              <Button
                title="Track This Person →"
                onPress={() => { setSelectedMarker(null); setTrackingPerson(selectedMarker); }}
                color={rc.primary}
                size="sm"
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rc.primary]} />}
        >
          {/* ── Filter bar: User picker + Date + Refresh ── */}
          <View style={tfStyles.filterCard}>
            <TouchableOpacity style={tfStyles.userSelector} onPress={() => setShowTeamUserPicker(true)}>
              <Users size={15} color="#6B7280" />
              <Text style={tfStyles.userSelectorLabel}>User</Text>
              <Text style={[tfStyles.userSelectorValue, !selectedTeamUser && { color: '#9CA3AF' }]} numberOfLines={1}>
                {selectedTeamUser
                  ? `${selectedTeamUser.name} - ${selectedTeamUser.status === 'active' ? 'Active' : 'Ended'}`
                  : '— Select a User —'}
              </Text>
              <ChevronDown size={14} color="#9CA3AF" />
            </TouchableOpacity>
            <View style={tfStyles.dateRefreshRow}>
              <DateInput
                label=""
                value={teamDate}
                onChange={setTeamDate}
                accentColor={rc.primary}
              />
              <TouchableOpacity style={[tfStyles.refreshBtn, { borderColor: rc.primary }]} onPress={() => { setRefreshing(true); fetchLive().finally(() => setRefreshing(false)); }}>
                <Text style={[tfStyles.refreshText, { color: rc.primary }]}>↻ Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Selected user stats card ── */}
          {selectedTeamUser && (
            <View style={tfStyles.statsCard}>
              <View style={tfStyles.statsCardTop}>
                {selectedTeamUser.avatar && selectedTeamUser.avatar.startsWith('http') ? (
                  <Image source={{ uri: selectedTeamUser.avatar }} style={tfStyles.statsAvatar} />
                ) : (
                  <View style={[tfStyles.statsAvatar, { backgroundColor: roleColor(selectedTeamUser.role), alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={tfStyles.statsAvatarText}>{initials(selectedTeamUser.name)}</Text>
                  </View>
                )}
                <View>
                  <Text style={tfStyles.statsName}>{selectedTeamUser.name}</Text>
                  <View style={[tfStyles.statusChip, { backgroundColor: selectedTeamUser.status === 'active' ? '#D1FAE5' : '#F3F4F6' }]}>
                    <Text style={[tfStyles.statusChipText, { color: selectedTeamUser.status === 'active' ? '#059669' : '#9CA3AF' }]}>
                      {selectedTeamUser.status === 'active' ? 'Active' : 'Ended'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedTeamUser(null)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={tfStyles.statsRow}>
                <View style={tfStyles.statItem}>
                  <Text style={tfStyles.statLabel}>Last Seen</Text>
                  <Text style={tfStyles.statValue}>{formatRelativeDate(selectedTeamUser.lastSeen)}</Text>
                </View>
                <View style={tfStyles.statItem}>
                  <Text style={tfStyles.statLabel}>Distance Today</Text>
                  <Text style={tfStyles.statValue}>{selectedTeamUser.totalDistanceKm.toFixed(1)} km</Text>
                </View>
                <View style={tfStyles.statItem}>
                  <Text style={tfStyles.statLabel}>Allowance</Text>
                  <Text style={tfStyles.statValue}>{formatCurrency(selectedTeamUser.allowanceAmount)}</Text>
                </View>
              </View>
              <View style={tfStyles.statsRowSecond}>
                <View style={tfStyles.statItem}>
                  <Text style={tfStyles.statLabel}>Speed</Text>
                  <Text style={tfStyles.statValue}>{selectedTeamUser.speedKmh?.toFixed(1) ?? '0.0'} km/h</Text>
                </View>
                {selectedTeamUser.batteryLevel != null && (
                  <View style={tfStyles.statItem}>
                    <Text style={tfStyles.statLabel}>Battery</Text>
                    <Text style={[tfStyles.statValue, selectedTeamUser.batteryLevel < 0.2 ? { color: '#DC2626' } : {}]}>
                      🔋 {Math.round(selectedTeamUser.batteryLevel * 100)}%
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[tfStyles.viewRouteBtn, { backgroundColor: rc.primary }]}
                  onPress={() => handlePersonPress(selectedTeamUser)}
                >
                  <Navigation size={13} color="#FFF" />
                  <Text style={tfStyles.viewRouteBtnText}>View Route</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryRow}>
            <Users size={14} color={rc.primary} />
            <Text style={styles.summaryText}>{activeCount} active · {scopedUsers.length} tracked today</Text>
            <Text style={styles.summaryHint}>Tap to track</Text>
          </View>

          {scopedUsers.length === 0 ? (
            <EmptyState
              title="No tracking data"
              subtitle="No team members have started tracking today."
              icon="📡"
            />
          ) : (
            <>
              {/* ZH: flat FO list (zone-scoped) */}
              {user?.role === 'ZH' && (
                <View style={styles.listCard}>
                  {scopedUsers.length === 0 ? (
                    <Text style={styles.emptyListText}>None of your FOs have started tracking today.</Text>
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
                  <View style={styles.scaSearchBar}>
                    <TextInput
                      style={styles.scaSearchInput}
                      placeholder="Search by name..."
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  {(() => {
                    const filtered = searchQuery.trim()
                      ? scopedUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      : scopedUsers;
                    const groups = buildZoneGroups(filtered);
                    return groups.length === 0
                      ? <EmptyState title="No data" subtitle="No team members are tracking." icon="📍" />
                      : groups.map(g => (
                        <ZoneGroupSection key={g.zoneName} group={g} onPersonPress={handlePersonPress} defaultExpanded />
                      ));
                  })()}
                </>
              )}

              {/* SH: search + role filter + grouped by region → zone (RH + ZH + FOs) */}
              {user?.role === 'SH' && (
                <>
                  <View style={styles.scaSearchBar}>
                    <TextInput
                      style={styles.scaSearchInput}
                      placeholder="Search by name..."
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaRoleRow}>
                    {(['all', 'RH', 'ZH', 'FO'] as const).map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.scaRoleChip, roleFilter === r && { backgroundColor: rc.primary }]}
                        onPress={() => setRoleFilter(r)}
                      >
                        <Text style={[styles.scaRoleText, roleFilter === r && { color: '#FFF' }]}>
                          {r === 'all' ? 'All Roles' : r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {(() => {
                    const filtered = scopedUsers.filter(u => {
                      const matchRole = roleFilter === 'all' || u.role === roleFilter;
                      const matchSearch = !searchQuery.trim() || u.name.toLowerCase().includes(searchQuery.toLowerCase());
                      return matchRole && matchSearch;
                    });
                    const groups = buildRegionGroups(filtered);
                    return groups.length === 0
                      ? <EmptyState title="No data" subtitle="No team members are tracking." icon="📍" />
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
                    <View style={styles.scaSHFilterBlock}>
                      <Text style={styles.scaSHFilterLabel}>Filter by Head</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaSHFilterRow}>
                        {/* All chip */}
                        <TouchableOpacity
                          style={[styles.scaSHChip, selectedSHId === null && { backgroundColor: rc.primary }]}
                          onPress={() => handleSelectSH(null)}
                        >
                          <Text style={[styles.scaSHChipText, selectedSHId === null && { color: '#FFF' }]}>All</Text>
                        </TouchableOpacity>
                        {/* One chip per SH */}
                        {shList.map(sh => (
                          <TouchableOpacity
                            key={sh.userId}
                            style={[
                              styles.scaSHChip,
                              selectedSHId === sh.userId && { backgroundColor: rc.primary },
                              sh.status === 'active' && selectedSHId !== sh.userId && { borderColor: '#22C55E', borderWidth: 1.5 },
                            ]}
                            onPress={() => handleSelectSH(sh.userId)}
                          >
                            <View style={[styles.scaSHChipDot, { backgroundColor: sh.status === 'active' ? '#22C55E' : '#9CA3AF' }]} />
                            <Text style={[styles.scaSHChipText, selectedSHId === sh.userId && { color: '#FFF' }]} numberOfLines={1}>
                              {sh.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {/* Selected SH summary */}
                      {selectedSHId !== null && (
                        <View style={styles.scaSHSelectedBanner}>
                          {shTeamLoading ? (
                            <Text style={styles.scaSHSelectedText}>Loading team...</Text>
                          ) : (
                            <Text style={styles.scaSHSelectedText}>
                              Showing team: {shList.find(s => s.userId === selectedSHId)?.name} · {scaBaseUsers.filter(u => u.role !== 'SH').length} members
                            </Text>
                          )}
                          <TouchableOpacity onPress={() => handleSelectSH(null)} hitSlop={8}>
                            <X size={14} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Search bar */}
                  <View style={styles.scaSearchBar}>
                    <TextInput
                      style={styles.scaSearchInput}
                      placeholder="Search by name..."
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {/* Role filter chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scaRoleRow}>
                    {(['all', 'SH', 'RH', 'ZH', 'FO'] as const).map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.scaRoleChip, roleFilter === r && { backgroundColor: rc.primary }]}
                        onPress={() => setRoleFilter(r)}
                      >
                        <Text style={[styles.scaRoleText, roleFilter === r && { color: '#FFF' }]}>
                          {r === 'all' ? 'All Roles' : r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {shTeamLoading ? (
                    <LoadingSpinner color={rc.primary} message="Loading team..." />
                  ) : (
                    <>
                      {/* SH-level users (shown only in All view, not when filtering by specific SH) */}
                      {selectedSHId === null && scaFilteredUsers.filter(u => u.role === 'SH').length > 0 && (
                        <View style={styles.scaSHSection}>
                          <Text style={styles.scaSHLabel}>National Heads (SH)</Text>
                          {scaFilteredUsers.filter(u => u.role === 'SH').map(u => (
                            <PersonRow key={u.userId} user={u} onPress={handlePersonPress} />
                          ))}
                        </View>
                      )}

                      {/* Regional hierarchy */}
                      {buildRegionGroups(scaFilteredUsers.filter(u => u.role !== 'SH')).length === 0
                        ? <EmptyState title="No users match" subtitle="Try adjusting the search or role filter." icon="🔍" />
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

      {/* ── Team User Picker Modal ── */}
      <Modal visible={showTeamUserPicker} transparent animationType="slide" onRequestClose={() => setShowTeamUserPicker(false)}>
        <View style={tfStyles.pickerOverlay}>
          <View style={tfStyles.pickerSheet}>
            <View style={tfStyles.pickerHeader}>
              <Text style={tfStyles.pickerTitle}>Select User</Text>
              <TouchableOpacity onPress={() => { setShowTeamUserPicker(false); setTeamUserSearch(''); }} hitSlop={10}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={tfStyles.pickerSearch}>
              <TextInput
                style={tfStyles.pickerSearchInput}
                placeholder="Search name..."
                placeholderTextColor="#9CA3AF"
                value={teamUserSearch}
                onChangeText={setTeamUserSearch}
              />
              {teamUserSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTeamUserSearch('')}>
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={scopedUsers.filter(u => !teamUserSearch || u.name.toLowerCase().includes(teamUserSearch.toLowerCase()))}
              keyExtractor={item => String(item.userId)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={tfStyles.pickerItem}
                  onPress={() => { setSelectedTeamUser(item); setShowTeamUserPicker(false); setTeamUserSearch(''); }}
                >
                  <View style={[tfStyles.pickerAvatar, { backgroundColor: roleColor(item.role) }]}>
                    <Text style={tfStyles.pickerAvatarText}>{initials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={tfStyles.pickerItemName}>{item.name}</Text>
                    <Text style={tfStyles.pickerItemSub}>{item.role}{item.zoneName ? ` · ${item.zoneName}` : ''}</Text>
                  </View>
                  <View style={[tfStyles.statusDot2, { backgroundColor: item.status === 'active' ? '#22C55E' : '#9CA3AF' }]} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={tfStyles.pickerEmpty}>No users found</Text>}
            />
          </View>
        </View>
      </Modal>

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
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827', marginBottom: 12 },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 5,
  },
  tabText: { fontSize: rf(13), fontWeight: '600', color: '#9CA3AF' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { fontSize: rf(10), fontWeight: '700', color: '#FFF' },

  // Map overlay
  mapFilterRow: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20 },
  mapChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
  },
  mapChipText: { fontSize: rf(12), fontWeight: '700', color: '#374151' },
  mapCountBadge: {
    position: 'absolute', bottom: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
    zIndex: 10,
  },
  mapCountText: { fontSize: rf(12), fontWeight: '600', color: '#6B7280' },
  mapEmptyHint: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  mapEmptyIcon: { fontSize: 36, marginBottom: 8 },
  mapEmptyTitle: { fontSize: rf(15), fontWeight: '700', color: '#374151', marginBottom: 4 },
  mapEmptySubtitle: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '500' },

  // Info sheet
  infoSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 14,
    paddingBottom: 14, zIndex: 15,
  },
  infoHandle: {
    width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
  infoAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  infoAvatarText: { fontSize: rf(14), fontWeight: '800', color: '#FFF' },
  infoName: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  infoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoSub: { fontSize: rf(12), color: '#9CA3AF' },
  infoStats: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  infoStat: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, alignItems: 'center', gap: 3 },
  infoStatVal: { fontSize: rf(12), fontWeight: '700', color: '#111827' },
  infoStatLbl: { fontSize: rf(10), color: '#9CA3AF', fontWeight: '500' },
  infoStatCurr: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
  infoTrackBtn: { marginHorizontal: 16 },

  // Team tab
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: rf(13), color: '#6B7280', fontWeight: '500' },
  summaryHint: { fontSize: rf(11), color: '#D1D5DB', fontWeight: '500', marginLeft: 'auto' },
  listCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  emptyListText: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center', padding: 20 },

  // Allowances
  // SCA-specific styles
  scaSearchBar: { paddingHorizontal: 12, paddingVertical: 8 },
  scaSearchInput: {
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', borderWidth: 1, borderColor: '#E5E7EB',
  },
  scaRoleRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  scaRoleChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#E5E7EB',
  },
  scaRoleText: { fontSize: rf(12), fontWeight: '700', color: '#374151' },
  scaSHSection: {
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#E11D4844', overflow: 'hidden',
  },
  scaSHLabel: {
    fontSize: rf(12), fontWeight: '700', color: '#E11D48',
    backgroundColor: '#FFF1F2', paddingHorizontal: 14, paddingVertical: 8,
  },
  // SH filter chips (SCA view)
  scaSHFilterBlock: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#F8FAFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E0E7FF', padding: 10,
  },
  scaSHFilterLabel: { fontSize: rf(11), fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  scaSHFilterRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  scaSHChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  scaSHChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  scaSHChipText: { fontSize: rf(12), fontWeight: '600', color: '#374151', maxWidth: 100 },
  scaSHSelectedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E7FF',
  },
  scaSHSelectedText: { fontSize: rf(11), color: '#4B5563', fontWeight: '500', flex: 1 },
});

// ─── My Day styles ────────────────────────────────────────────────────────────
const mdStyles = StyleSheet.create({
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 4,
  },
  permTitle: { fontSize: rf(13), fontWeight: '700', color: '#DC2626' },
  permSub: { fontSize: rf(11), color: '#991B1B', marginTop: 2 },
  permAction: { fontSize: rf(12), fontWeight: '700', color: '#DC2626', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  cardDate: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { fontSize: rf(12), fontWeight: '700', color: '#FFF' },
  endedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 12 },
  endedText: { fontSize: rf(12), fontWeight: '600', color: '#22C55E' },
  fraudBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 12 },
  fraudText: { fontSize: rf(12), fontWeight: '600', color: '#DC2626' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: '#F0FDF9', borderRadius: 12, padding: 12, alignItems: 'center', gap: 5 },
  statVal: { fontSize: rf(15), fontWeight: '800', color: '#134E4A' },
  statLbl: { fontSize: rf(10), color: '#0D9488', fontWeight: '600', textAlign: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  historyHeader: { marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F3F4F6' },
  dateChipText: { fontSize: rf(11), fontWeight: '600', color: '#374151' },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  histItem: { width: '47%', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 },
  histLbl: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  histVal: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  emptyHist: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyHistText: { fontSize: rf(13), color: '#9CA3AF' },
});

// ─── Team Filter styles ────────────────────────────────────────────────────────
const tfStyles = StyleSheet.create({
  // Filter bar
  filterCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  userSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB',
  },
  userSelectorLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151' },
  userSelectorValue: { flex: 1, fontSize: rf(13), color: '#111827', fontWeight: '500' },
  dateRefreshRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  refreshText: { fontSize: rf(12), fontWeight: '700' },

  // Selected user stats card
  statsCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 12 },
  statsCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsAvatar: { width: 44, height: 44, borderRadius: 22 },
  statsAvatarText: { fontSize: rf(14), fontWeight: '800', color: '#FFF' },
  statsName: { fontSize: rf(14), fontWeight: '700', color: '#111827', marginBottom: 4 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, alignSelf: 'flex-start' },
  statusChipText: { fontSize: rf(11), fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statsRowSecond: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flex: 1 },
  statLabel: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500', marginBottom: 3 },
  statValue: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  viewRouteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  viewRouteBtnText: { fontSize: rf(12), fontWeight: '700', color: '#FFF' },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerTitle: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  pickerSearchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  pickerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { fontSize: rf(12), fontWeight: '800', color: '#FFF' },
  pickerItemName: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  pickerItemSub: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  statusDot2: { width: 9, height: 9, borderRadius: 4.5 },
  pickerEmpty: { textAlign: 'center', padding: 32, fontSize: rf(14), color: '#9CA3AF' },
});
