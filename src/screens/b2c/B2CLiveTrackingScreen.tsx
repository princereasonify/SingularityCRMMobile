import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region as MapRegion } from 'react-native-maps';
import { MapPin, RefreshCw, Users, Route as RouteIcon, Clock, ChevronLeft, ChevronRight, Navigation } from 'lucide-react-native';
import { Btn, SearchBar, ListCard, Avatar, StatusBadge, Segmented } from '../../components/crud';
import { StatTile, SectionLabel } from '../../components/ui';
import { b2cTrackingService } from '../../api/b2c/b2cTrackingService';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuth } from '../../context/AuthContext';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { isoDate, todayStr, timeOnly } from '../../utils/dates';

const REFRESH_MS = 15000;
const INDIA_REGION: MapRegion = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtTime = (v?: string | null) => (v ? timeOnly(v) : '');
const fmtDuration = (mins?: number | null) => {
  const m = Math.max(0, Number(mins) || 0);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};
const prettyDate = (dateStr: string) => {
  const [y, mo, dd] = dateStr.split('-').map(Number);
  const d = new Date(y, (mo || 1) - 1, dd || 1);
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
  const r = useResponsive();
  const mapRef = useRef<MapView>(null);
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const roleColor = user.role === 'Counselor' ? T.warning : T.accent;
  const s = useMemo(() => makeStyles(r), [r]);
  // Three tiles fit one row on a tablet; on a phone the third would be ~90pt wide and clip.
  const statW = r.isTablet ? '32%' : '48.5%';

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
    const next = isoDate(new Date(y, (mo || 1) - 1, (dd || 1) + delta));
    if (next > todayStr()) return;
    setDate(next);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {/* Header row: back + who */}
      <View style={s.dHeader}>
        <Btn label="Back" variant="secondary" small onPress={onBack} icon={<ChevronLeft size={16} color={T.text} strokeWidth={2.2} />} />
        <Avatar initials={initialsOf(user.name)} color={roleColor} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{user.name || 'Unknown'}</Text>
          <View style={s.badgeRow}><StatusBadge label={user.role || '—'} color={roleColor} /></View>
        </View>
      </View>

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
        <Text style={[s.dateTxt, { color: T.text }]} numberOfLines={1}>{prettyDate(date)}</Text>
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

      {/* Stats */}
      <View style={s.statsRow}>
        <StatTile style={{ width: statW }} label="Distance" value={`${Number(data?.totalDistanceKm ?? 0).toFixed(1)} km`} icon={<RouteIcon size={15} color={T.accent} />} />
        <StatTile style={{ width: statW }} label="Duration" value={fmtDuration(data?.durationMinutes)} tint={T.info} icon={<Clock size={15} color={T.info} />} />
        <StatTile style={{ width: statW }} label="Started" value={fmtTime(data?.startedAt) || '—'} tint={T.success} icon={<MapPin size={15} color={T.success} />} />
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
          <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
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
  const r = useResponsive();
  const { user } = useAuth();
  const isAdmin = user?.role === 'B2CAdmin';
  const mapRef = useRef<MapView>(null);

  const [users, setUsers] = useState<LiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LiveUser | null>(null);

  const s = useMemo(() => makeStyles(r), [r]);

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

  const liveMap = mapped.length > 0 ? (
    <View style={[s.mapWrap, { borderColor: T.line, backgroundColor: T.cardAlt }]}>
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
  ) : null;

  const activeList = (
    <View style={{ width: '100%' }}>
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
    </View>
  );

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
          // The map beside the roster on a wide tablet; stacked on a phone.
          <View style={s.panes}>
            <View style={s.mapPane}>{liveMap}</View>
            <View style={s.listPane}>{activeList}</View>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (r: ReturnType<typeof useResponsive>) =>
  StyleSheet.create({
    safe: { flex: 1 },
    scroll: {
      padding: r.gutter, gap: 12,
      // Centred and capped only on a wide tablet; on a phone maxContentWidth is the window
      // width, so this is a no-op and the phone layout is unchanged.
      ...(r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' as const } : null),
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    count: { fontSize: r.rf(12), fontWeight: '700' },
    refresh: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    refreshTxt: { fontSize: r.rf(11), fontWeight: '600' },

    panes: {
      flexDirection: r.isWide ? 'row' : 'column',
      alignItems: 'flex-start',
      gap: r.gap + 4,
    },
    mapPane: { flex: r.isWide ? 1.35 : undefined, width: r.isWide ? undefined : '100%' },
    listPane: { flex: r.isWide ? 1 : undefined, width: r.isWide ? undefined : '100%' },

    listHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgeRow: { flexDirection: 'row' },
    name: { fontSize: r.rf(13.5), fontWeight: '700' },
    sub: { fontSize: r.rf(11.5), fontWeight: '500' },

    // A map has to be a map in both orientations — a squashed strip on a landscape iPad tells
    // you nothing, so the height tracks the window rather than a baked-in constant.
    mapWrap: {
      height: Math.round(Math.min(Math.max(r.height * (r.isLandscape ? 0.55 : 0.34), 240), 560)),
      borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    },
    pointsNote: { fontSize: r.rf(11), fontWeight: '600', textAlign: 'center' },

    dHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7,
    },
    dateTxt: { flex: 1, textAlign: 'center', fontSize: r.rf(13.5), fontWeight: '700' },
    /** Every touchable is at least the HIG minimum in both dimensions. */
    tapBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },

    empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
    emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: r.rf(18) },
  });

export default B2CLiveTrackingScreen;
