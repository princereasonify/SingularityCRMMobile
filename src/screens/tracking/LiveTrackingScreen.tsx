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
  TextInput,
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
} from 'lucide-react-native';
import { trackingApi } from '../../api/tracking';
import { LiveLocationDto, AllowanceDto, RoutePointDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge, RoleBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ROLE_COLORS } from '../../utils/constants';
import {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  toISODate,
} from '../../utils/formatting';
import { rf } from '../../utils/responsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'map' | 'team' | 'allowances';
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

          {/* Bottom row: time + allowance + battery */}
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
            <View style={ivStyles.statPill}>
              <Text style={ivStyles.statPillLabel}>{formatCurrency(liveData.allowanceAmount)}</Text>
              <Text style={ivStyles.statPillSub}>Allowance</Text>
            </View>
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
        <View style={[prStyles.avatar, { backgroundColor: c }]}>
          <Text style={prStyles.avatarText}>{initials(user.name)}</Text>
        </View>
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('map');

  // Individual tracking — when set, shows IndividualTrackingView full-screen
  const [trackingPerson, setTrackingPerson] = useState<LiveLocationDto | null>(null);

  // Map state
  const [liveUsers, setLiveUsers] = useState<LiveLocationDto[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<LiveLocationDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const mapRef = useRef<MapView>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didFitMap = useRef(false);

  // Allowances state
  const [allowances, setAllowances] = useState<AllowanceDto[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toISODate(new Date()));
  const [approveLoading, setApproveLoading] = useState<number | null>(null);

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

  const fetchAllowances = useCallback(async () => {
    setAllowancesLoading(true);
    try {
      const res = await trackingApi.getAllowances(dateFrom, dateTo);
      const inner = res.data as { allowances: AllowanceDto[] };
      setAllowances(inner.allowances || []);
    } catch {
      setAllowances([]);
    } finally {
      setAllowancesLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    Promise.all([fetchLive(), fetchAllowances()]).finally(() => setLoading(false));
  }, [fetchLive, fetchAllowances]);

  useEffect(() => {
    autoRefreshRef.current = setInterval(fetchLive, LIVE_REFRESH_MS);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchLive]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchLive(), fetchAllowances()]).finally(() => setRefreshing(false));
  }, [fetchLive, fetchAllowances]);

  const handlePersonPress = useCallback((u: LiveLocationDto) => {
    setTrackingPerson(u);
  }, []);

  const handleApprove = (id: number, approved: boolean) => {
    Alert.alert(
      `${approved ? 'Approve' : 'Reject'} Allowance`,
      `Are you sure you want to ${approved ? 'approve' : 'reject'} this allowance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setApproveLoading(id);
            try {
              await trackingApi.approveAllowance(id, { approved });
              await fetchAllowances();
            } catch {
              Alert.alert('Error', `Failed to ${approved ? 'approve' : 'reject'} allowance.`);
            } finally {
              setApproveLoading(null);
            }
          },
        },
      ],
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const mapUsers = useMemo(() =>
    statusFilter === 'all' ? liveUsers : liveUsers.filter(u => u.status === statusFilter),
  [liveUsers, statusFilter]);

  const activeCount = useMemo(() => liveUsers.filter(u => u.status === 'active').length, [liveUsers]);
  const zoneGroups = useMemo(() => buildZoneGroups(liveUsers), [liveUsers]);
  const regionGroups = useMemo(() => buildRegionGroups(liveUsers), [liveUsers]);

  // SCA: filter by search + role across all users
  const scaFilteredUsers = useMemo(() => {
    if (user?.role !== 'SCA') return liveUsers;
    return liveUsers.filter(u => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchSearch = !searchQuery.trim() || u.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [liveUsers, user?.role, roleFilter, searchQuery]);
  const totalAllowance = useMemo(() => allowances.reduce((s, a) => s + a.grossAmount, 0), [allowances]);

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
    { key: 'map' as TabKey, label: 'Map', badge: activeCount },
    { key: 'team' as TabKey, label: 'Team', badge: liveUsers.length },
    { key: 'allowances' as TabKey, label: 'Allowances', badge: null },
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
                <View style={styles.infoStat}>
                  <Text style={styles.infoStatCurr}>{formatCurrency(selectedMarker.allowanceAmount)}</Text>
                  <Text style={styles.infoStatLbl}>Allowance</Text>
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
          {/* Summary row */}
          <View style={styles.summaryRow}>
            <Users size={14} color={rc.primary} />
            <Text style={styles.summaryText}>
              {activeCount} active · {liveUsers.length} tracked today
            </Text>
            <Text style={styles.summaryHint}>Tap any person to track them</Text>
          </View>

          {liveUsers.length === 0 ? (
            <EmptyState
              title="No tracking data"
              subtitle="No team members have started tracking today."
              icon="📡"
            />
          ) : (
            <>
              {/* ZH: flat FO list */}
              {user?.role === 'ZH' && (
                <View style={styles.listCard}>
                  {liveUsers.filter(u => u.role === 'FO').length === 0 ? (
                    <Text style={styles.emptyListText}>None of your FOs have started tracking today.</Text>
                  ) : (
                    liveUsers.filter(u => u.role === 'FO').map(fo => (
                      <PersonRow key={fo.userId} user={fo} onPress={handlePersonPress} />
                    ))
                  )}
                </View>
              )}

              {/* RH: grouped by zone */}
              {user?.role === 'RH' && (
                zoneGroups.length === 0
                  ? <EmptyState title="No data" subtitle="No team members are tracking." icon="📍" />
                  : zoneGroups.map(g => (
                    <ZoneGroupSection key={g.zoneName} group={g} onPersonPress={handlePersonPress} defaultExpanded />
                  ))
              )}

              {/* SH: grouped by region → zone */}
              {user?.role === 'SH' && (
                regionGroups.length === 0
                  ? <EmptyState title="No data" subtitle="No team members are tracking." icon="📍" />
                  : regionGroups.map(g => (
                    <RegionGroupSection key={g.regionName} group={g} onPersonPress={handlePersonPress} />
                  ))
              )}

              {/* SCA: national view — search + role filter + full hierarchy */}
              {user?.role === 'SCA' && (
                <>
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
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scaRoleRow}
                  >
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
                  {/* SH-level users (national heads) */}
                  {scaFilteredUsers.filter(u => u.role === 'SH').length > 0 && (
                    <View style={styles.scaSHSection}>
                      <Text style={styles.scaSHLabel}>🏢 National Heads</Text>
                      {scaFilteredUsers.filter(u => u.role === 'SH').map(u => (
                        <PersonRow key={u.userId} user={u} onPress={handlePersonPress} />
                      ))}
                    </View>
                  )}
                  {/* Regional hierarchy */}
                  {buildRegionGroups(scaFilteredUsers).length === 0
                    ? <EmptyState title="No users match" subtitle="Try adjusting the search or role filter." icon="🔍" />
                    : buildRegionGroups(scaFilteredUsers).map(g => (
                      <RegionGroupSection key={g.regionName} group={g} onPersonPress={handlePersonPress} />
                    ))
                  }
                </>
              )}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── ALLOWANCES TAB ───────────────────────────────────────────────── */}
      {activeTab === 'allowances' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rc.primary]} />}
        >
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.dateRangeRow}>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel}>From</Text>
                <TextInput
                  style={styles.dateInput} value={dateFrom} onChangeText={setDateFrom}
                  placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel}>To</Text>
                <TextInput
                  style={styles.dateInput} value={dateTo} onChangeText={setDateTo}
                  placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF"
                />
              </View>
              <Button title="Go" onPress={fetchAllowances} color={rc.primary} size="sm" style={styles.goBtn} />
            </View>
          </Card>

          {allowancesLoading ? (
            <LoadingSpinner color={rc.primary} message="Loading allowances..." />
          ) : allowances.length === 0 ? (
            <EmptyState title="No allowances" subtitle="No records for the selected period." icon="💰" />
          ) : (
            <>
              {allowances.map(a => (
                <Card key={a.id} style={styles.allowanceCard}>
                  <View style={styles.allowanceHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.allowanceName}>{a.userName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <RoleBadge role={a.role} />
                        <Text style={styles.allowanceDateTxt}>{formatDate(a.allowanceDate)}</Text>
                      </View>
                    </View>
                    <Badge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? '#22C55E' : '#F59E0B'} />
                  </View>
                  <View style={styles.allowanceDetails}>
                    <View style={styles.allowanceItem}>
                      <Text style={styles.allowanceItemLbl}>Distance</Text>
                      <Text style={styles.allowanceItemVal}>{a.distanceKm.toFixed(1)} km</Text>
                    </View>
                    <View style={styles.allowanceItem}>
                      <Text style={styles.allowanceItemLbl}>Rate</Text>
                      <Text style={styles.allowanceItemVal}>{formatCurrency(a.ratePerKm)}/km</Text>
                    </View>
                    <View style={styles.allowanceItem}>
                      <Text style={styles.allowanceItemLbl}>Amount</Text>
                      <Text style={[styles.allowanceItemVal, { fontWeight: '700' }]}>{formatCurrency(a.grossAmount)}</Text>
                    </View>
                  </View>
                  {a.isSuspicious && (
                    <View style={styles.fraudWarn}>
                      <Text style={styles.fraudWarnText}>⚠ Fraud score: {a.fraudScore}/100</Text>
                    </View>
                  )}
                  {a.approvedByName && (
                    <Text style={styles.approvedBy}>
                      Approved by {a.approvedByName}{a.approvedAt ? ` on ${formatDate(a.approvedAt)}` : ''}
                    </Text>
                  )}
                  {a.remarks && <Text style={styles.remarks}>Remarks: {a.remarks}</Text>}
                  {!a.approved && (
                    <View style={styles.approvalActions}>
                      <Button title="Approve" onPress={() => handleApprove(a.id, true)} color="#22C55E" size="sm"
                        loading={approveLoading === a.id} disabled={approveLoading !== null} style={{ flex: 1 }} />
                      <Button title="Reject" onPress={() => handleApprove(a.id, false)} variant="danger" size="sm"
                        loading={approveLoading === a.id} disabled={approveLoading !== null} style={{ flex: 1 }} />
                    </View>
                  )}
                </Card>
              ))}
              <Card style={styles.totalFooter}>
                <Text style={styles.totalLabel}>Total Allowance</Text>
                <Text style={styles.totalValue}>{formatCurrency(totalAllowance)}</Text>
              </Card>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
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
  dateRangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { fontSize: rf(12), fontWeight: '500', color: '#6B7280', marginBottom: 4 },
  dateInput: {
    backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1,
    borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(13), color: '#111827',
  },
  goBtn: { marginBottom: 2 },
  allowanceCard: { padding: 16 },
  allowanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  allowanceName: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  allowanceDateTxt: { fontSize: rf(12), color: '#9CA3AF' },
  allowanceDetails: { flexDirection: 'row', marginTop: 12, gap: 12, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  allowanceItem: { flex: 1, alignItems: 'center' },
  allowanceItemLbl: { fontSize: rf(11), color: '#9CA3AF', fontWeight: '500' },
  allowanceItemVal: { fontSize: rf(13), fontWeight: '600', color: '#111827', marginTop: 2 },
  fraudWarn: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, marginTop: 10 },
  fraudWarnText: { fontSize: rf(12), fontWeight: '600', color: '#DC2626' },
  approvedBy: { fontSize: rf(12), color: '#6B7280', marginTop: 8 },
  remarks: { fontSize: rf(12), color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  approvalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  totalFooter: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: rf(18), fontWeight: '700', color: '#111827' },

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
});
