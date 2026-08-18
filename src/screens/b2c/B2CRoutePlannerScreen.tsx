import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Alert, Linking, TouchableOpacity, PermissionsAndroid, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import {
  Wand2, Navigation, MapPin, Check, SkipForward, ChevronLeft, ChevronRight, RotateCcw, LocateFixed,
  CalendarClock, CheckCircle2, ListChecks,
} from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { SearchBar, Checkbox, ListCard, Avatar, StatusBadge, Btn, ConfirmModal } from '../../components/crud';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadListDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha } from '../../theme';
import { rf } from '../../utils/responsive';
import { useToast } from '../../context/ToastContext';

/**
 * B2CRoutePlannerScreen — mobile mirror of the web B2CRoutePlanner page.
 * Pick students for a chosen day, optimise the visiting order from your current
 * location (greedy nearest-neighbour, same as the B2B/B2C web planner), hand off to
 * Google Maps for turn-by-turn navigation, and mark each planned visit Done/Skipped.
 *
 * Mobile adaptation: the web geocodes missing addresses through the Google Maps JS
 * SDK, which isn't available in RN — here we route the students that already carry
 * GPS coordinates (from a prior geo-verified visit). Everything else — the selectable
 * student list, the ordered route, the navigation hand-off, and the today's-plan
 * Done/Skip controls — mirrors the web 1:1.
 */

type PlannedVisit = {
  id: number;
  leadId: number;
  studentName?: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  sortOrder?: number | null;
};

type Coord = { lat: number; lng: number };
type Stop = Coord & { id: number; name?: string; area?: string };

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const shiftDay = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};
const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (iso === todayStr()) return 'Today';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

// Greedy nearest-neighbour TSP from the origin — mirrors the web route planner.
function haversineKm(a: Coord, b: Coord) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function nearestNeighbourOrder(origin: Coord, stops: Stop[]): Stop[] {
  const remaining = stops.slice(), ordered: Stop[] = [];
  let current = origin;
  while (remaining.length) {
    let bi = 0, bd = haversineKm(current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const dd = haversineKm(current, remaining[i]);
      if (dd < bd) { bd = dd; bi = i; }
    }
    const next = remaining.splice(bi, 1)[0];
    ordered.push(next); current = next;
  }
  return ordered;
}
function buildMapsUrl(ordered: Stop[], origin: Coord | null) {
  if (!ordered.length) return '';
  const o = origin ? `${origin.lat},${origin.lng}` : `${ordered[0].lat},${ordered[0].lng}`;
  const dest = `${ordered[ordered.length - 1].lat},${ordered[ordered.length - 1].lng}`;
  const middle = (origin ? ordered.slice(0, -1) : ordered.slice(1, -1)).map(s => `${s.lat},${s.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${dest}&travelmode=driving`;
  if (middle) url += `&waypoints=${encodeURIComponent(middle)}`;
  return url;
}

const areaOf = (x: { area?: string | null; city?: string | null; state?: string | null }) =>
  [x.area, x.city, x.state].filter(Boolean).join(', ');
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const statusColor = (status: string | undefined, T: any) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.dim : T.accent;

export const B2CRoutePlannerScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const kpiCols = width >= 720 ? 4 : 2;
  const kpiWidth = kpiCols === 4 ? '23.5%' : '48.5%';

  const [date, setDate] = useState(todayStr());
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [coords, setCoords] = useState<Record<number, Coord>>({});
  const [origin, setOrigin] = useState<Coord | null>(null);
  const [ordered, setOrdered] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ visit: PlannedVisit; status: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [vRes, lRes] = await Promise.all([
        b2cPlannerService.get(date, date).catch(() => ({ data: [] as PlannedVisit[] })),
        b2cLeadService.getLeads({ page: 1, pageSize: 200 }).catch(() => ({ data: { items: [] } as any })),
      ]);
      const v: PlannedVisit[] = (vRes.data as any) || [];
      const l: B2CLeadListDto[] = (lRes.data as any)?.items || (lRes.data as any) || [];
      setVisits(v);
      setLeads(l);
      // Pre-select the day's planned students (from the weekly plan / calendar).
      setSelected(new Set(v.map(x => x.leadId)));
      // Seed coords from any visit/lead that already carries GPS.
      const c: Record<number, Coord> = {};
      [
        ...v.map(x => ({ id: x.leadId, lat: x.latitude, lng: x.longitude })),
        ...l.map(x => ({ id: x.id, lat: (x as any).latitude, lng: (x as any).longitude })),
      ].forEach(x => {
        if (x.lat != null && x.lng != null && !(x.id in c)) c[x.id] = { lat: Number(x.lat), lng: Number(x.lng) };
      });
      setCoords(c);
      setOrdered([]);
      setNote('');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggle = (leadId: number) => setSelected(prev => {
    const n = new Set(prev);
    n.has(leadId) ? n.delete(leadId) : n.add(leadId);
    return n;
  });

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      l.studentName?.toLowerCase().includes(q) ||
      areaOf(l as any).toLowerCase().includes(q));
  }, [leads, search]);

  // Same pattern as B2CAgentVisitScreen — without this, Geolocation.getCurrentPosition
  // fails silently on Android if location permission was never granted, and the
  // optimiser falls back to the first stop with no explanation of why.
  const askLocationPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      if (await PermissionsAndroid.check(permission)) return true;
      const result = await PermissionsAndroid.request(permission, {
        title: 'Location Permission Required',
        message: 'The app needs your location to start the route from where you are.',
        buttonPositive: 'Allow', buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert('Location', 'Access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const getOrigin = async (): Promise<Coord | null> => {
    if (!(await askLocationPermission())) return null;
    return new Promise<Coord | null>((resolve) => {
      Geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
      );
    });
  };

  const optimize = async () => {
    if (selected.size === 0) return;
    setOptimizing(true); setNote('');
    try {
      const org = await getOrigin();
      setOrigin(org);

      const routable = leads.filter(l => selected.has(l.id));
      const located = routable.filter(l => coords[l.id]);
      const skipped = routable.length - located.length;

      const stops: Stop[] = located.map(l => ({
        id: l.id, name: l.studentName, area: areaOf(l as any), ...coords[l.id],
      }));

      if (stops.length === 0) {
        setOrdered([]);
        setNote('No selected students have GPS coordinates yet. Capture a geo-verified visit for a student to place them on the route.');
        return;
      }
      const start = org || stops[0];
      const ord = nearestNeighbourOrder(start, stops);
      setOrdered(ord);
      setNote(`Route optimised: ${ord.length} stop${ord.length > 1 ? 's' : ''}${org ? ' from your location' : ''}${skipped ? ` · ${skipped} skipped (no GPS)` : ''}.`);
    } catch {
      setNote('Could not build the route. Please try again.');
    } finally {
      setOptimizing(false);
    }
  };

  const startNavigation = () => {
    const url = buildMapsUrl(ordered, origin);
    if (url) Linking.openURL(url).catch(() => Alert.alert('Navigation', 'Could not open Google Maps.'));
  };

  const applyStatus = async () => {
    if (!pending) return;
    const { visit, status } = pending;
    setPending(null);
    try {
      await b2cPlannerService.update(visit.id, { status });
      toast.success(status === 'Done' ? 'Marked done' : 'Visit skipped');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update the visit.');
    }
  };

  const orderedIndex = (leadId: number) => ordered.findIndex(s => s.id === leadId);

  const doneCount = visits.filter(v => v.status === 'Done').length;
  const skippedCount = visits.filter(v => v.status === 'Skipped').length;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* Heading */}
      <Text style={[st.title, { color: T.text }]} numberOfLines={1}>Route Planner</Text>
      <Text style={[st.subtitle, { color: T.sub }]}>Pick students, get the shortest route from where you are</Text>

      {/* Day summary — responsive KPI grid */}
      <View style={[st.grid, { marginTop: 16 }]}>
        <StatTile style={{ width: kpiWidth }} label="Planned" value={visits.length} sub={prettyDate(date)} icon={<CalendarClock size={16} color={T.accent} />} />
        <StatTile style={{ width: kpiWidth }} label="Done" value={doneCount} sub="visited" tint={T.success} icon={<CheckCircle2 size={16} color={T.success} />} />
        <StatTile style={{ width: kpiWidth }} label="Skipped" value={skippedCount} sub="this day" tint={T.dim} icon={<SkipForward size={16} color={T.dim} />} />
        <StatTile style={{ width: kpiWidth }} label="Selected" value={selected.size} sub="for route" tint={T.info} icon={<ListChecks size={16} color={T.info} />} />
      </View>

      {/* Day selector + optimise */}
      <Card style={{ marginTop: 12 }}>
        <View style={st.dateRow}>
          <TouchableOpacity onPress={() => setDate(d => shiftDay(d, -1))} activeOpacity={0.7} style={[st.dateBtn, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <ChevronLeft size={18} color={T.text} />
          </TouchableOpacity>
          <View style={st.dateCenter}>
            <Text style={[st.dateTxt, { color: T.text }]}>{prettyDate(date)}</Text>
            {date !== todayStr() && (
              <TouchableOpacity onPress={() => setDate(todayStr())} hitSlop={8} style={st.todayBtn}>
                <RotateCcw size={11} color={T.accent} />
                <Text style={[st.todayTxt, { color: T.accent }]}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => setDate(d => shiftDay(d, 1))} activeOpacity={0.7} style={[st.dateBtn, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <ChevronRight size={18} color={T.text} />
          </TouchableOpacity>
        </View>
        <Btn
          label={optimizing ? 'Optimising…' : 'Optimise Route'}
          onPress={optimize}
          loading={optimizing}
          disabled={optimizing || selected.size === 0}
          icon={<Wand2 size={15} color="#FFF" />}
          style={{ marginTop: 12 }}
        />
      </Card>

      {!!note && (
        <View style={[st.note, { backgroundColor: withAlpha(T.info, 0.1), borderColor: withAlpha(T.info, 0.25) }]}>
          <Text style={[st.noteTxt, { color: T.info }]}>{note}</Text>
        </View>
      )}

      {/* Optimised route + navigation */}
      {ordered.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={st.rowHead}>
            <View style={st.rowHeadLeft}>
              <Navigation size={15} color={T.accent} />
              <SectionLabel style={{ marginBottom: 0, marginTop: 0 }}>
                Route · {ordered.length} stop{ordered.length > 1 ? 's' : ''}
              </SectionLabel>
            </View>
            <Btn label="Navigate" small onPress={startNavigation} icon={<LocateFixed size={13} color="#FFF" />} />
          </View>
          {ordered.map((s, i) => (
            <ListCard key={s.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: s.id })} style={{ marginBottom: 8 }}>
              <Avatar initials={String(i + 1)} />
              <View style={{ flex: 1 }}>
                <Text style={[st.name, { color: T.text }]} numberOfLines={1}>{s.name || `Lead #${s.id}`}</Text>
                {!!s.area && <Text style={[st.sub, { color: T.sub }]} numberOfLines={1}>{s.area}</Text>}
              </View>
              <ChevronRight size={16} color={T.sub} />
            </ListCard>
          ))}
        </View>
      )}

      {/* Today's plan — planned visits with quick Done / Skip */}
      {visits.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionLabel>{prettyDate(date)}'s Plan</SectionLabel>
          {visits.map((v, i) => (
            <ListCard key={v.id} style={[st.planCard, { marginBottom: 8 }]}>
              <View style={st.planTop}>
                <Avatar initials={String(i + 1)} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7}
                  onPress={() => nav.navigate('B2CLeadDetail', { leadId: v.leadId })}>
                  <Text style={[st.name, { color: T.text }]} numberOfLines={1}>{v.studentName || `Lead #${v.leadId}`}</Text>
                  {!!areaOf(v) && <Text style={[st.sub, { color: T.sub }]} numberOfLines={1}>{areaOf(v)}</Text>}
                </TouchableOpacity>
                <StatusBadge label={v.status || 'Planned'} color={statusColor(v.status, T)} />
              </View>
              <View style={st.planActions}>
                {v.status !== 'Done' && (
                  <Btn label="Done" small variant="success" onPress={() => setPending({ visit: v, status: 'Done' })}
                    icon={<Check size={13} color="#FFF" />} style={{ flex: 1 }} />
                )}
                {v.status !== 'Skipped' && (
                  <Btn label="Skip" small variant="secondary" onPress={() => setPending({ visit: v, status: 'Skipped' })}
                    icon={<SkipForward size={13} color={T.sub} />} style={{ flex: 1 }} />
                )}
              </View>
            </ListCard>
          ))}
        </View>
      )}

      {/* Selectable students */}
      <View style={{ marginTop: 18 }}>
        <View style={st.rowHead}>
          <SectionLabel style={{ marginBottom: 0, marginTop: 0 }}>Students</SectionLabel>
          <Text style={[st.sub, { color: T.dim }]}>
            {selected.size} selected{visits.length > 0 ? ` · ${visits.length} planned` : ''}
          </Text>
        </View>
        <View style={{ marginBottom: 10 }}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search students by name or area…" />
        </View>

        {loading ? (
          <Card><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <Text style={[st.emptyTitle, { color: T.text }]}>{search ? 'No matching students' : 'No students yet'}</Text>
            <Text style={[st.empty, { color: T.dim }]}>{search ? 'Try a different search.' : 'Students you own will appear here.'}</Text>
          </Card>
        ) : (
          filteredLeads.map(l => {
            const oi = orderedIndex(l.id);
            const planned = visits.find(v => v.leadId === l.id);
            const on = selected.has(l.id);
            const area = areaOf(l as any);
            return (
              <ListCard key={l.id} onPress={() => toggle(l.id)} style={{ marginBottom: 8 }}>
                <Checkbox on={on} onToggle={() => toggle(l.id)} />
                {oi >= 0 ? <Avatar initials={String(oi + 1)} /> : <Avatar initials={initialsOf(l.studentName)} color={T.sub} />}
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={st.rowTop}>
                    <Text style={[st.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{l.studentName}</Text>
                    {planned && <StatusBadge label={planned.status || 'Planned'} color={statusColor(planned.status, T)} />}
                  </View>
                  <View style={st.subRow}>
                    <MapPin size={10} color={T.dim} />
                    <Text style={[st.sub, { color: T.dim }]} numberOfLines={1}>{area || 'No address'}</Text>
                    {coords[l.id] && <Text style={[st.sub, { color: T.success }]}> · located</Text>}
                  </View>
                </View>
              </ListCard>
            );
          })
        )}
      </View>

      <ConfirmModal
        visible={!!pending}
        title={pending?.status === 'Done' ? 'Mark visit done' : 'Skip visit'}
        message={pending
          ? `${pending.status === 'Done' ? 'Mark' : 'Skip'} ${pending.visit.studentName || 'this student'}${pending.status === 'Done' ? ' as visited' : ' for this day'}?`
          : ''}
        icon={pending?.status === 'Done' ? <Check size={24} color={T.success} /> : <SkipForward size={24} color={T.accent} />}
        tone={pending?.status === 'Done' ? 'success' : 'accent'}
        confirmLabel={pending?.status === 'Done' ? 'Mark Done' : 'Skip'}
        onConfirm={applyStatus}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
};

const st = StyleSheet.create({
  title: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flex: 1, alignItems: 'center', gap: 2 },
  dateTxt: { fontSize: rf(15), fontWeight: '800', letterSpacing: -0.3 },
  todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayTxt: { fontSize: rf(11), fontWeight: '700' },

  note: { borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginTop: 12 },
  noteTxt: { fontSize: rf(12.5), fontWeight: '600', lineHeight: 18 },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  rowHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },

  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  planCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planActions: { flexDirection: 'row', gap: 8 },

  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 6 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center', marginBottom: 4 },
});
