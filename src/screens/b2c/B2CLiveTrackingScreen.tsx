import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region as MapRegion } from 'react-native-maps';
import { MapPin, RefreshCw, Users, Route as RouteIcon, Clock, ChevronLeft, ChevronRight, Navigation } from 'lucide-react-native';
import { Btn, IconBtn, SearchBar, ListCard, Avatar, StatusBadge, Segmented } from '../../components/crud';
import { StatTile, SectionLabel } from '../../components/ui';
import { b2cTrackingService } from '../../api/b2c/b2cTrackingService';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { isTabletDevice, rf } from '../../utils/responsive';

const REFRESH_MS = 15000;
const INDIA_REGION: MapRegion = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 };

// ─── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => localDateStr(new Date());

const fmtTime = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
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
const prettyDate = (iso: string) => {
  const [y, mo, dd] = iso.split('-').map(Number);
  const d = new Date(y, (mo || 1) - 1, dd || 1);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const hasCoords = (u: LiveUser) => u.latitude != null && u.longitude != null && (u.latitude !== 0 || u.longitude !== 0);

// ─── Types ──────────────────────────────────────────────────────────────────
interface LiveUser {
  id: number;
  name?: string;
  role?: string;
  latitude?: number;
  longitude?: number;
  lastSeen?: string;
  distance: number;
  startedAt?: string;
}
interface RoutePoint { latitude?: number; longitude?: number; recordedAt?: string; }
interface RouteData {
  route?: RoutePoint[];
  totalDistanceKm?: number;
  durationMinutes?: number;
  startedAt?: string;
}

// Normalize the /live payload (nested latestPing) into a flat shape for the UI.
const normalize = (raw: any): LiveUser[] =>
  (Array.isArray(raw) ? raw : []).map((u: any) => ({
    id: u.b2CUserId ?? u.userId ?? u.id,
    name: u.name,
    role: u.role,
    latitude: u.latestPing?.latitude,
    longitude: u.latestPing?.longitude,
    lastSeen: u.latestPing?.recordedAt,
    distance: u.totalDistanceKm ?? 0,
    startedAt: u.startedAt,
  }));

type RoleFilter = '' | 'Agent' | 'Counselor';

// ─── Route drill-down for a selected user ─────────────────────────────────────
const RouteDrilldown = ({ user, onBack }: { user: LiveUser; onBack: () => void }) => {
  const T = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const roleColor = user.role === 'Counselor' ? T.warning : T.accent;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    b2cTrackingService.getRoute(user.id, date)
      .then(res => { if (!cancelled) setData(res.data || null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.id, date]);

  const points = useMemo(
    () => (data?.route || []).filter(p => p.latitude != null && p.longitude != null)
      .map(p => ({ latitude: Number(p.latitude), longitude: Number(p.longitude), recordedAt: p.recordedAt })),
    [data],
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

  const canGoNext = date < todayStr();
  const stepDay = (delta: number) => {
    const [y, mo, dd] = date.split('-').map(Number);
    const d = new Date(y, (mo || 1) - 1, (dd || 1) + delta);
    const next = localDateStr(d);
    if (next > todayStr()) return;
    setDate(next);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* Header row: back + who */}
      <View style={s.dHeader}>
        <Btn label="Back" variant="secondary" small onPress={onBack} icon={<ChevronLeft size={16} color={T.text} strokeWidth={2.2} />} />
        <Avatar initials={initialsOf(user.name)} color={roleColor} />
        <View style={{ flex: 1 }}>
          <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{user.name || 'Unknown'}</Text>
          <StatusBadge label={user.role || '—'} color={roleColor} />
        </View>
      </View>

      {/* Date stepper */}
      <View style={[s.dateBar, { backgroundColor: T.card, borderColor: T.line }]}>
        <IconBtn kind="view" label="Previous day" onPress={() => stepDay(-1)}>
          <ChevronLeft size={16} color={T.accent} strokeWidth={2.2} />
        </IconBtn>
        <Text style={[s.dateTxt, { color: T.text }]}>{prettyDate(date)}</Text>
        <IconBtn kind="view" label="Next day" onPress={() => canGoNext && stepDay(1)}>
          <ChevronRight size={16} color={canGoNext ? T.accent : T.dim} strokeWidth={2.2} />
        </IconBtn>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <StatTile style={{ flex: 1 }} label="Distance" value={`${Number(data?.totalDistanceKm ?? 0).toFixed(1)} km`} icon={<RouteIcon size={15} color={T.accent} />} />
        <StatTile style={{ flex: 1 }} label="Duration" value={fmtDuration(data?.durationMinutes)} icon={<Clock size={15} color={T.accent} />} />
        <StatTile style={{ flex: 1 }} label="Started" value={fmtTime(data?.startedAt) || '—'} icon={<MapPin size={15} color={T.accent} />} />
      </View>

      {/* Route map */}
      <SectionLabel style={{ marginTop: 4 }}>Route</SectionLabel>
      {loading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
      ) : points.length === 0 ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <MapPin size={30} color={T.dim} />
          <Text style={[s.emptyTitle, { color: T.text }]}>No route recorded</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Nothing was tracked for this day.</Text>
        </View>
      ) : (
        <>
          <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }, isTabletDevice && s.mapWrapWide]}>
            <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={INDIA_REGION}>
              {points.length > 1 && (
                <Polyline coordinates={points} strokeColor={T.accent} strokeWidth={4} />
              )}
              <Marker coordinate={points[0]} pinColor={T.success} title="Start" description={fmtTime(points[0].recordedAt)} />
              {points.length > 1 && (
                <Marker
                  coordinate={points[points.length - 1]}
                  pinColor={T.danger}
                  title="Latest"
                  description={fmtTime(points[points.length - 1].recordedAt)}
                />
              )}
            </MapView>
          </View>
          <Text style={[s.pointsNote, { color: T.dim }]}>{points.length} GPS point{points.length === 1 ? '' : 's'} recorded</Text>
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export const B2CLiveTrackingScreen = () => {
  const T = useAppTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'B2CAdmin';
  const mapRef = useRef<MapView>(null);

  const [users, setUsers] = useState<LiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LiveUser | null>(null);

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    b2cTrackingService.getLive()
      .then(res => setUsers(normalize(res.data)))
      .catch(() => setUsers([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u =>
      (!roleFilter || u.role === roleFilter) &&
      (!q || (u.name || '').toLowerCase().includes(q)),
    );
  }, [users, roleFilter, query]);

  const mapped = useMemo(() => filtered.filter(hasCoords), [filtered]);

  useEffect(() => {
    if (selected || mapped.length === 0) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        mapped.map(u => ({ latitude: Number(u.latitude), longitude: Number(u.longitude) })),
        { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true },
      );
    }, 350);
    return () => clearTimeout(t);
  }, [mapped, selected]);

  if (selected) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <RouteDrilldown user={selected} onBack={() => setSelected(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={T.accent} colors={[T.accent]} />}
      >
        {/* Status line */}
        <View style={s.statusRow}>
          <Text style={[s.count, { color: T.dim }]}>{filtered.length} active in the field</Text>
          <View style={s.refresh}>
            <RefreshCw size={12} color={T.dim} strokeWidth={2} />
            <Text style={[s.refreshTxt, { color: T.dim }]}>Auto-refresh · 15s</Text>
          </View>
        </View>

        {/* Filters */}
        {isAdmin && (
          <Segmented<RoleFilter>
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ value: '', label: 'Everyone' }, { value: 'Agent', label: 'Agents' }, { value: 'Counselor', label: 'Counselors' }]}
          />
        )}
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name…" />

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <MapPin size={32} color={T.dim} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No one is active right now</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Agents and counselors appear here once they start their day. Tap anyone to see their route.</Text>
          </View>
        ) : (
          <>
            {/* Live overview map */}
            {mapped.length > 0 && (
              <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }, isTabletDevice && s.mapWrapWide]}>
                <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={INDIA_REGION}>
                  {mapped.map(u => (
                    <Marker
                      key={u.id}
                      coordinate={{ latitude: Number(u.latitude), longitude: Number(u.longitude) }}
                      pinColor={u.role === 'Counselor' ? T.warning : T.accent}
                      title={u.name || 'Unknown'}
                      description={`${Number(u.distance).toFixed(1)} km${u.lastSeen ? ` · seen ${fmtTime(u.lastSeen)}` : ''}`}
                      onCalloutPress={() => setSelected(u)}
                    />
                  ))}
                </MapView>
              </View>
            )}

            {/* Active-now list */}
            <View style={s.listHead}>
              <Users size={15} color={T.accent} strokeWidth={2} />
              <SectionLabel style={{ marginBottom: 0 }}>Active now</SectionLabel>
            </View>
            <View style={{ gap: 8 }}>
              {filtered.map(u => {
                const roleColor = u.role === 'Counselor' ? T.warning : T.accent;
                return (
                  <ListCard key={u.id} onPress={() => setSelected(u)}>
                    <Avatar initials={initialsOf(u.name)} color={roleColor} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{u.name || 'Unknown'}</Text>
                        <StatusBadge label={u.role || '—'} color={roleColor} />
                      </View>
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                        {Number(u.distance).toFixed(1)} km today · {u.lastSeen ? `seen ${fmtTime(u.lastSeen)}` : 'active'}
                      </Text>
                    </View>
                    <Navigation size={16} color={T.dim} strokeWidth={2} />
                  </ListCard>
                );
              })}
            </View>
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: rf(12), fontWeight: '700' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  refreshTxt: { fontSize: rf(11), fontWeight: '600' },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },

  mapWrap: { height: 260, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mapWrapWide: { height: 420 },
  pointsNote: { fontSize: rf(11), fontWeight: '600', textAlign: 'center' },

  dHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  dateTxt: { fontSize: rf(13.5), fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: 18 },
});
