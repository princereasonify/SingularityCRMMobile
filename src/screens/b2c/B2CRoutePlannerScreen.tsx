import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Alert, Linking, TouchableOpacity, PermissionsAndroid, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region as MapRegion } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {
  Wand2, Navigation, MapPin, Check, SkipForward, ChevronLeft, ChevronRight, RotateCcw, LocateFixed, CalendarClock, CheckCircle2, ListChecks, AlertTriangle, Pencil, Save,
} from 'lucide-react-native';
import { Screen, Card, StatTile, SectionLabel } from '../../components/ui';
import { SearchBar, Checkbox, ListCard, Avatar, StatusBadge, Btn, ConfirmModal, FormModal, Field, Input, Trigger, Dropdown } from '../../components/crud';
import { DateInput } from '../../components/common/DateInput';
import { b2cPlannerService } from '../../api/b2c/b2cPlannerService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cRouteService } from '../../api/b2c/b2cRouteService';
import { RoutePlanDto } from '../../types/b2c';
import { optimizeRoute } from '../../utils/routeOptimizationEngine';
import { B2CLeadListDto } from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha } from '../../theme';
import { useResponsive, MIN_TAP } from '../../hooks/useResponsive';
import { useToast } from '../../context/ToastContext';
import {
  todayStr, isSameLocalDay, isoDate, dayOffset, timeOnly, timeOnDay, splitLocal, joinLocal,
} from '../../utils/dates';

/**
 * B2CRoutePlannerScreen — mobile mirror of the web B2CRoutePlanner page.
 *
 * Distance alone gets the day wrong in the way that actually costs one: a student four
 * kilometres away expecting you at 4pm is NOT the first stop just because they are closest —
 * the one twelve kilometres out at 9am is, because that time was promised. So the order is
 * built around the appointments, exactly as the web builds it, and every stop carries the ETA
 * it was placed at.
 *
 * Mobile adaptation: the web geocodes missing addresses through the Google Maps JS SDK, which
 * has no RN equivalent here, so only students already carrying GPS (from a geo-verified visit)
 * enter the route and the rest are reported as skipped.
 */

// ── The day's physics ───────────────────────────────────────────────────────────────
// Rough, and deliberately so: the point is to decide an ORDER, and an order only changes when
// two estimates cross. City driving averages far below the speed limit once lights and turns
// are counted, and a family visit is never the five minutes optimism suggests.
const AVG_SPEED_KMH = 25;
const DWELL_MINUTES = 30;   // time spent with one family
const BUFFER_MINUTES = 10;  // never cut an appointment finer than this
const DAY_START_HOUR = 9;
const MIN = 60_000;

const INDIA_REGION: MapRegion = { latitude: 22.9734, longitude: 78.6569, latitudeDelta: 10, longitudeDelta: 10 };

type Coord = { lat: number; lng: number };
type Stop = Coord & { id: number; name?: string; city?: string | null; area?: string; appointmentAt: Date | null };
type PlannedStop = Stop & { eta: Date; departure?: Date; late: boolean };

interface PlannedVisit {
  id: number;
  leadId: number;
  studentName?: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  appointmentAt?: string | null;
  sortOrder?: number | null;
}

function haversineKm(a: Coord, b: Coord) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const travelMs = (a: Coord, b: Coord) => (haversineKm(a, b) / AVG_SPEED_KMH) * 60 * MIN;

/** Picks the nearest stop to `from`, returning its index. */
function nearestIndex(from: Coord, stops: Stop[]) {
  let bi = 0, bd = haversineKm(from, stops[0]);
  for (let i = 1; i < stops.length; i++) {
    const d = haversineKm(from, stops[i]);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/**
 * Orders one day's stops around the appointments that cannot move.
 *
 * Booked appointments are fixed points taken in time order; the flexible stops are slotted
 * into the gaps between them, nearest-first, but only where the arithmetic says you would
 * still reach the next appointment on time. An appointment we would reach after the promised
 * time comes back marked `late` rather than quietly reordered — the fix for that is dropping a
 * stop or calling the family, and both are the agent's call, not the planner's.
 */
function planDay(origin: Coord | null, stops: Stop[], dayStart: Date, earliest: Date): PlannedStop[] {
  const timed = stops.filter(s => s.appointmentAt)
    .sort((a, b) => (a.appointmentAt as Date).getTime() - (b.appointmentAt as Date).getTime());
  const free = stops.filter(s => !s.appointmentAt);

  const route: PlannedStop[] = [];
  let cur: Coord | undefined = origin || timed[0] || free[0];
  let clockAt = dayStart.getTime();
  if (!cur) return route;

  // Set off early enough to make the first promised time. Anchoring the day rigidly at 9am
  // would mark a 9am appointment twelve kilometres out as unreachable when the real answer is
  // "leave at half past eight" — but never earlier than `earliest`, which is the present moment
  // when the day being planned is today. You cannot depart in the past.
  if (timed.length && origin) {
    const leaveBy = (timed[0].appointmentAt as Date).getTime() - travelMs(origin, timed[0]) - BUFFER_MINUTES * MIN;
    clockAt = Math.max(earliest.getTime(), Math.min(clockAt, leaveBy));
  }

  const push = (stop: Stop, etaMs: number, late = false) => {
    route.push({ ...stop, eta: new Date(etaMs), late });
    cur = stop;
    clockAt = etaMs + DWELL_MINUTES * MIN;
  };

  for (const anchor of timed) {
    // Fill the gap before this appointment with whatever fits, nearest first.
    while (free.length) {
      const i = nearestIndex(cur as Coord, free);
      const cand = free[i];
      const arriveCand = clockAt + travelMs(cur as Coord, cand);
      const arriveAnchor = arriveCand + DWELL_MINUTES * MIN + travelMs(cand, anchor);
      // Would this detour make us late for a time we promised? Then it waits.
      if (arriveAnchor + BUFFER_MINUTES * MIN > (anchor.appointmentAt as Date).getTime()) break;
      free.splice(i, 1);
      push(cand, arriveCand);
    }

    const arrive = clockAt + travelMs(cur as Coord, anchor);
    const promised = (anchor.appointmentAt as Date).getTime();
    // Arriving early means waiting, which is fine and worth showing as the promised time.
    push(anchor, Math.max(arrive, promised), arrive > promised);
  }

  // Anything left over: nearest-neighbour from wherever the last appointment left us.
  while (free.length) {
    const i = nearestIndex(cur as Coord, free);
    const next = free.splice(i, 1)[0];
    push(next, clockAt + travelMs(cur as Coord, next));
  }

  return route;
}

/**
 * When the plan says to set off — the ETA of the first stop, less the drive to it. Clamped to
 * `earliest`, because planDay already refuses to depart before it and a minute of float drift
 * rendered as "11:59 pm -1d" is pure confusion.
 */
function departureTime(origin: Coord | null, route: PlannedStop[], fallback: Date, earliest: Date): Date {
  if (!route.length) return fallback;
  const first = route[0];
  const eta = first.eta.getTime();
  const leave = origin ? eta - travelMs(origin, first) : eta;
  return new Date(Math.max(leave, earliest.getTime()));
}

function buildMapsUrl(ordered: PlannedStop[], origin: Coord | null) {
  if (!ordered.length) return '';
  const o = origin ? `${origin.lat},${origin.lng}` : `${ordered[0].lat},${ordered[0].lng}`;
  const dest = `${ordered[ordered.length - 1].lat},${ordered[ordered.length - 1].lng}`;
  const middle = (origin ? ordered.slice(0, -1) : ordered.slice(1, -1)).map(s => `${s.lat},${s.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${dest}&travelmode=driving`;
  if (middle) url += `&waypoints=${encodeURIComponent(middle)}`;
  return url;
}

// ─── Small local helpers ──────────────────────────────────────────────────────
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseDayLocal = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const prettyDate = (dateStr: string) => {
  if (dateStr === todayStr()) return 'Today';
  const d = parseDayLocal(dateStr);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};
const shiftDay = (dateStr: string, days: number) => {
  const d = parseDayLocal(dateStr);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

const areaOf = (x: { area?: string | null; city?: string | null; state?: string | null }) =>
  [x.area, x.city, x.state].filter(Boolean).join(', ');
const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const statusColor = (status: string | undefined, T: AppTheme) =>
  status === 'Done' ? T.success : status === 'Skipped' ? T.dim : T.accent;

/** 15-minute slots — a phone has no datetime picker, and a free-text time is a validation trap. */
const TIME_SLOTS = Array.from({ length: 64 }, (_, i) => {
  const mins = 6 * 60 + i * 15;                       // 06:00 → 21:45
  const h = Math.floor(mins / 60), m = mins % 60;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap = h >= 12 ? 'pm' : 'am';
  return { value, label: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}` };
});

export const B2CRoutePlannerScreen = () => {
  const T = useAppTheme();
  const toast = useToast();
  const nav = useNavigation<any>();
  const r = useResponsive();
  const mapRef = useRef<MapView>(null);

  const kpiWidth = r.isWide ? '23.5%' : r.isTablet ? '23.5%' : '48.5%';

  const [date, setDate] = useState(todayStr());
  const [visits, setVisits] = useState<PlannedVisit[]>([]);
  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [coords, setCoords] = useState<Record<number, Coord>>({});
  const [origin, setOrigin] = useState<Coord | null>(null);
  const [ordered, setOrdered] = useState<PlannedStop[]>([]);
  // What the optimiser reported about the order on screen, and what has been committed.
  const [planMeta, setPlanMeta] = useState<{ method: string; km: number; min: number } | null>(null);
  const [savedPlan, setSavedPlan] = useState<RoutePlanDto | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ visit: PlannedVisit; status: string } | null>(null);

  // Rescheduling lives here because this is the screen where you discover the day does not fit.
  const [apptLead, setApptLead] = useState<B2CLeadListDto | null>(null);
  const [apptForm, setApptForm] = useState({ date: '', time: '10:00', notes: '' });
  const [apptTimeOpen, setApptTimeOpen] = useState(false);
  const [savingAppt, setSavingAppt] = useState(false);

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
      // Pre-select the day's planned students AND anyone with an appointment booked for it —
      // a promised visit is not something you should have to remember to tick.
      const appointed = l.filter(x => isSameLocalDay(x.appointmentAt, date)).map(x => x.id);
      setSelected(new Set([...v.map(x => x.leadId), ...appointed]));
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
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggle = (leadId: number) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(leadId)) n.delete(leadId); else n.add(leadId);
    return n;
  });

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      l.studentName?.toLowerCase().includes(q) || areaOf(l).toLowerCase().includes(q));
  }, [leads, search]);

  /**
   * The appointment a student has ON THIS DAY. One booked for another date is not a fixed
   * point in this day's route and must not anchor it.
   */
  const appointmentFor = useCallback(
    (lead: B2CLeadListDto) => (isSameLocalDay(lead.appointmentAt, date) ? new Date(lead.appointmentAt as string) : null),
    [date],
  );

  const appointmentCount = useMemo(
    () => leads.filter(l => selected.has(l.id) && isSameLocalDay(l.appointmentAt, date)).length,
    [leads, selected, date],
  );

  /**
   * Two different clocks. `dayStart` is when you would normally set off; `earliest` is the hard
   * floor you cannot depart before — the present moment when the day is today, and the start of
   * the day itself when it is a future one you are planning ahead.
   */
  const { dayStart, earliest } = useMemo(() => {
    const base = parseDayLocal(date);
    const nine = new Date(base.getFullYear(), base.getMonth(), base.getDate(), DAY_START_HOUR, 0, 0, 0);
    const now = new Date();
    const isToday = date === todayStr();
    return {
      dayStart: isToday && now > nine ? now : nine,
      earliest: isToday ? now : base,
    };
  }, [date]);

  // Same pattern as B2CAgentVisitScreen — without this, getCurrentPosition fails silently on
  // Android when permission was never granted and the plan starts from the wrong place.
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

      // Resolve coordinates server-side for anything we do not already have. A B2C lead only
      // gains coordinates from a geo-verified VISIT, so an unvisited student had none and this
      // screen used to refuse to plan at all — selecting two students and pressing Optimise did
      // nothing. Geocoding also has to live on the server: it is billable and its key is
      // IP-restricted, so it can never run from the app.
      const resolved: Record<number, Coord> = { ...coords };
      const needing = routable.filter(l => !resolved[l.id]).map(l => l.id);
      if (needing.length) {
        try {
          const res = await b2cLeadService.resolveCoordinates(needing);
          for (const c of res.data || []) {
            if (c.latitude != null && c.longitude != null) {
              resolved[c.leadId] = { lat: Number(c.latitude), lng: Number(c.longitude) };
            }
          }
          setCoords(resolved);
        } catch {
          // Whatever is already known can still be routed; the rest is reported as skipped.
        }
      }

      const located = routable.filter(l => resolved[l.id]);
      const skipped = routable.length - located.length;

      const stops: Stop[] = located.map(l => ({
        id: l.id,
        name: l.studentName,
        city: l.city,
        area: areaOf(l),
        appointmentAt: appointmentFor(l),
        ...resolved[l.id],
      }));

      if (stops.length === 0) {
        setOrdered([]);
        setNote('None of the selected students could be placed on a map. Add an area or pincode to their lead and try again.');
        return;
      }

      // Real driving times. Straight lines are the wrong input for a schedule — two homes
      // 800 m apart across a railway line can be a fifteen-minute drive. The engine falls back
      // to Haversine (and says so) if the matrix is unavailable.
      let matrix = null;
      try {
        const pts = [org ?? { lat: stops[0].lat, lng: stops[0].lng }, ...stops]
          .map(pt => ({ latitude: pt.lat, longitude: pt.lng }));
        const res = await b2cRouteService.getMatrix(pts);
        if (res.data?.durations?.length) matrix = res.data;
      } catch { /* fall through to the engine's Haversine fallback */ }

      // VRPTW: appointments are fixed anchors in time order, flexible stops are inserted into
      // the gaps only where the next promise stays reachable, then 2-opt untangles crossings.
      const plan = optimizeRoute(
        stops.map(x => ({
          id: x.id, name: x.name ?? 'Student', latitude: x.lat, longitude: x.lng,
          leadType: 'b2c_student' as const, appointmentAt: x.appointmentAt,
        })),
        { origin: org ? { latitude: org.lat, longitude: org.lng } : null, dateStr: date, earliest, matrix },
      );

      // The map and list still speak {lat,lng,eta,late}; adapt rather than rewrite both.
      const ord: PlannedStop[] = plan.stops.map(st => {
        const src = stops.find(x => x.id === st.id)!;
        return { ...src, eta: st.eta, departure: st.departure, late: st.isLate };
      });
      setOrdered(ord);
      setPlanMeta({
        method: plan.optimizationMethod,
        km: Number((plan.totalTravelMetres / 1000).toFixed(2)),
        min: Math.round(plan.totalTravelSeconds / 60),
      });
      setSavedPlan(null);   // the new order no longer matches whatever was last committed

      const fixed = ord.filter(s => s.appointmentAt).length;
      const late = ord.filter(s => s.late).length;
      // Stops the arithmetic pushes past midnight. The list is the agent's, so this reports
      // rather than silently trimming it — but a day that does not fit has to say so.
      const overflow = ord.filter(s => dayOffset(date, s.eta) > 0).length;
      const viaRoads = plan.optimizationMethod === 'VRPTW_2OPT_ROAD_MATRIX';
      setNote(
        `${ord.length} stop${ord.length > 1 ? 's' : ''}, leave by ${timeOnDay(date, plan.departBy)}`
        + (fixed ? ` around ${fixed} booked appointment${fixed > 1 ? 's' : ''}` : '')
        + ` · ${(plan.totalTravelMetres / 1000).toFixed(1)} km, ${Math.round(plan.totalTravelSeconds / 60)} min driving`
        + (viaRoads ? ' (real road times)' : ' (estimated)')
        + (org ? ', from your location' : '')
        + (skipped ? ` · ${skipped} skipped (no address)` : '')
        + (plan.unscheduled.length ? ` · ${plan.unscheduled.length} could not fit without missing a promised time` : '')
        + (late ? ` · ${late} appointment${late > 1 ? 's' : ''} cannot be reached in time — reschedule or drop a stop` : '')
        + (overflow ? ` · ${overflow} stop${overflow > 1 ? 's run' : ' runs'} past midnight — too far to fit in one day` : '')
        + '.',
      );
    } catch {
      setNote('Could not build the route. Please try again.');
    } finally {
      setOptimizing(false);
    }
  };

  // Frame the whole route once it exists, origin included.
  useEffect(() => {
    if (ordered.length === 0) return;
    const pts = [
      ...(origin ? [{ latitude: origin.lat, longitude: origin.lng }] : []),
      ...ordered.map(s => ({ latitude: s.lat, longitude: s.lng })),
    ];
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [ordered, origin]);

  /**
   * Commits the order on screen. Until this runs the optimisation dies with the screen — saving
   * is what lets the tracker confirm arrivals against it and close the day.
   */
  const savePlan = async () => {
    if (!ordered.length || savingPlan) return;
    setSavingPlan(true);
    try {
      const res = await b2cRouteService.savePlan({
        planDate: date,
        totalEstimatedDistanceKm: planMeta?.km ?? 0,
        totalEstimatedDurationMinutes: planMeta?.min ?? 0,
        optimizationMethod: planMeta?.method ?? 'VRPTW_2OPT_HAVERSINE',
        stops: ordered.map((st, i) => ({
          leadId: st.id,
          stopOrderIndex: i,
          isFixedAppointment: !!st.appointmentAt,
          scheduledArrivalTime: st.eta.toISOString(),
          estimatedDepartureTime: (st.departure ?? st.eta).toISOString(),
          latitude: st.lat,
          longitude: st.lng,
        })),
      });
      setSavedPlan(res.data ?? null);
      toast.success(`Route saved — ${ordered.length} stop${ordered.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not save the route');
    } finally {
      setSavingPlan(false);
    }
  };

  /** What the tracker has confirmed so far, without re-optimising. */
  const refreshSaved = useCallback(async () => {
    try { setSavedPlan((await b2cRouteService.getPlan(date)).data ?? null); }
    catch { setSavedPlan(null); }
  }, [date]);

  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  /**
   * Confirmed stops keyed by lead. Read from the SAVED plan, not the one on screen: a
   * re-optimised order is a proposal, and only a committed stop can have actuals.
   */
  const confirmedByLead = useMemo(() => {
    const m = new Map<number, RoutePlanDto['stops'][number]>();
    (savedPlan?.stops ?? []).forEach(st => { if (st.visited) m.set(st.leadId, st); });
    return m;
  }, [savedPlan]);

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

  const openAppointment = (lead: B2CLeadListDto) => {
    const split = splitLocal(lead.appointmentAt);
    setApptForm({
      date: split.date || date,
      time: split.time || '10:00',
      notes: lead.appointmentNotes || '',
    });
    setApptTimeOpen(false);
    setApptLead(lead);
  };

  const saveAppointment = async () => {
    if (!apptLead) return;
    const at = joinLocal(apptForm.date, apptForm.time);
    if (!at) return;
    setSavingAppt(true);
    try {
      await b2cLeadService.rescheduleAppointment(apptLead.id, at, apptForm.notes || undefined);
      toast.success('Appointment updated');
      setApptLead(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update the appointment.');
    } finally {
      setSavingAppt(false);
    }
  };

  const orderedIndex = (leadId: number) => ordered.findIndex(s => s.id === leadId);
  const doneCount = visits.filter(v => v.status === 'Done').length;
  const skippedCount = visits.filter(v => v.status === 'Skipped').length;
  const troubled = ordered.some(s => s.late || dayOffset(date, s.eta) > 0);
  const noteTint = troubled ? T.warning : T.info;

  const s = useMemo(() => makeStyles(r), [r]);

  const routeMap = (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={[s.cardHead, { borderBottomColor: T.line }]}>
        <Navigation size={15} color={T.accent} strokeWidth={2.2} />
        <Text style={[s.cardHeadTxt, { color: T.text }]}>Route</Text>
        <View style={{ flex: 1 }} />
        {ordered.length > 0 && (
          /* Save before Navigate: committing the order is what the rest of the day hangs off,
             and it must not be the button you have to hunt for after the map fills the screen. */
          <View style={s.headActions}>
            <Btn
              label={savingPlan ? 'Saving…' : savedPlan ? 'Saved' : 'Save'}
              small
              variant="secondary"
              onPress={savePlan}
              loading={savingPlan}
              disabled={savingPlan}
              icon={<Save size={13} color={T.accent} />}
            />
            <Btn label="Navigate" small onPress={startNavigation} icon={<LocateFixed size={13} color="#FFF" />} />
          </View>
        )}
      </View>
      <View style={s.mapWrap}>
        <MapView ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={INDIA_REGION}>
          {origin && (
            <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} title="You" pinColor={T.info} />
          )}
          {ordered.map((stop, i) => (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stop.name}
              description={stop.appointmentAt
                ? `Booked ${timeOnDay(date, stop.appointmentAt)} · arrive ${timeOnDay(date, stop.eta)}`
                : `Arrive ~${timeOnDay(date, stop.eta)}`}
              onCalloutPress={() => nav.navigate('B2CLeadDetail', { leadId: stop.id })}
            >
              <View style={[s.pin, { backgroundColor: stop.late ? T.danger : T.accent, borderColor: T.card }]}>
                <Text style={s.pinTxt}>{i + 1}</Text>
              </View>
            </Marker>
          ))}
          {/* Straight legs between stops: the order is what this screen decides, and drawing a
              real driving polyline would need a Directions call the app does not make. */}
          {ordered.length > 1 && (
            <Polyline
              coordinates={[
                ...(origin ? [{ latitude: origin.lat, longitude: origin.lng }] : []),
                ...ordered.map(stop => ({ latitude: stop.lat, longitude: stop.lng })),
              ]}
              strokeColor={T.accent}
              strokeWidth={3}
            />
          )}
        </MapView>
        {ordered.length === 0 && (
          <View style={[s.mapVeil, { backgroundColor: withAlpha(T.card, 0.86) }]} pointerEvents="none">
            <MapPin size={26} color={T.dim} />
            <Text style={[s.mapVeilTxt, { color: T.dim }]}>Optimise the route to plot the day.</Text>
          </View>
        )}
      </View>
    </Card>
  );

  const studentList = (
    <View style={{ gap: 10 }}>
      <View style={s.rowHead}>
        <SectionLabel style={{ marginBottom: 0, marginTop: 0 }}>Students</SectionLabel>
        <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
          {selected.size} selected
          {appointmentCount > 0 ? ` · ${appointmentCount} booked` : ''}
          {visits.length > 0 ? ` · ${visits.length} planned` : ''}
        </Text>
      </View>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search students by name or area…" />

      {loading ? (
        <Card><Text style={[s.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <Text style={[s.emptyTitle, { color: T.text }]}>{search ? 'No matching students' : 'No students yet'}</Text>
          <Text style={[s.empty, { color: T.dim }]}>{search ? 'Try a different search.' : 'Students you own will appear here.'}</Text>
        </Card>
      ) : filteredLeads.map(l => {
        const oi = orderedIndex(l.id);
        const stop = oi >= 0 ? ordered[oi] : null;
        const planned = visits.find(v => v.leadId === l.id);
        const on = selected.has(l.id);
        const appt = appointmentFor(l);
        const area = areaOf(l);
        return (
          <ListCard key={l.id} style={{ alignItems: 'flex-start' }}>
            <View style={s.checkTap}>
              <Checkbox on={on} onToggle={() => toggle(l.id)} />
            </View>
            {/* The numbered avatar carries the route position and always earns its 36pt. The
                initials one is decoration, and on a phone row it costs the name 48pt it needs. */}
            {oi >= 0 ? (
              <Avatar initials={String(oi + 1)} color={stop?.late ? T.danger : T.accent} />
            ) : r.isTablet ? (
              <Avatar initials={initialsOf(l.studentName)} color={T.sub} />
            ) : null}
            <TouchableOpacity
              activeOpacity={0.7}
              style={s.leadTap}
              onPress={() => nav.navigate('B2CLeadDetail', { leadId: l.id })}
            >
              <View style={s.rowTop}>
                <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{l.studentName}</Text>
                {planned && <StatusBadge label={planned.status || 'Planned'} color={statusColor(planned.status, T)} />}
              </View>
              <View style={s.subRow}>
                <MapPin size={10} color={T.dim} />
                <Text style={[s.sub, { color: T.dim, flex: 1 }]} numberOfLines={1}>
                  {area || 'No address'}{coords[l.id] ? ' · located ✓' : ''}
                </Text>
              </View>
              {/* The promised time, and what the plan says you would actually arrive. */}
              {(appt || stop) && (
                <View style={s.subRow}>
                  {stop?.late
                    ? <AlertTriangle size={11} color={T.danger} strokeWidth={2.2} />
                    : <CalendarClock size={11} color={T.accent} strokeWidth={2.2} />}
                  <Text
                    style={[s.etaTxt, { color: stop?.late ? T.danger : T.accent, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {appt ? `Booked ${timeOnly(appt)}` : 'Flexible'}
                    {stop ? ` · arrive ${timeOnDay(date, stop.eta)}` : ''}
                    {stop?.late ? ' — too late' : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Students move their slots. Fixing it here, where the clash becomes obvious,
                beats opening the lead to do it. */}
            <TouchableOpacity
              onPress={() => openAppointment(l)}
              activeOpacity={0.8}
              accessibilityLabel={appt ? 'Reschedule appointment' : 'Book an appointment'}
              style={[s.tapBtn, { backgroundColor: T.accentSoft }]}
            >
              {appt
                ? <Pencil size={16} color={T.accent} strokeWidth={2.2} />
                : <CalendarClock size={16} color={T.accent} strokeWidth={2.2} />}
            </TouchableOpacity>
          </ListCard>
        );
      })}
    </View>
  );

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      contentStyle={r.isWide ? { maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' } : undefined}
    >
      <Text style={[s.title, { color: T.text }]} numberOfLines={1}>Route Planner</Text>
      <Text style={[s.subtitle, { color: T.sub }]}>Booked appointments first, everything else fitted around them</Text>

      {/* Day summary — responsive KPI grid */}
      <View style={[s.grid, { marginTop: 16 }]}>
        <StatTile style={{ width: kpiWidth }} label="Planned" value={visits.length} sub={prettyDate(date)} icon={<CalendarClock size={16} color={T.accent} />} />
        <StatTile style={{ width: kpiWidth }} label="Done" value={doneCount} sub="visited" tint={T.success} icon={<CheckCircle2 size={16} color={T.success} />} />
        <StatTile style={{ width: kpiWidth }} label="Skipped" value={skippedCount} sub="this day" tint={T.dim} icon={<SkipForward size={16} color={T.dim} />} />
        <StatTile style={{ width: kpiWidth }} label="Selected" value={selected.size} sub={appointmentCount ? `${appointmentCount} booked` : 'for route'} tint={T.info} icon={<ListChecks size={16} color={T.info} />} />
      </View>

      {/* Day selector + optimise */}
      <Card style={{ marginTop: 12 }}>
        <View style={s.dateRow}>
          <TouchableOpacity
            onPress={() => setDate(d => shiftDay(d, -1))}
            activeOpacity={0.7}
            accessibilityLabel="Previous day"
            style={[s.tapBtn, { backgroundColor: T.cardAlt, borderColor: T.line, borderWidth: 1 }]}
          >
            <ChevronLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={s.dateCenter}>
            <Text style={[s.dateTxt, { color: T.text }]} numberOfLines={1}>{prettyDate(date)}</Text>
            {date !== todayStr() && (
              <TouchableOpacity onPress={() => setDate(todayStr())} hitSlop={12} style={s.todayBtn}>
                <RotateCcw size={11} color={T.accent} />
                <Text style={[s.todayTxt, { color: T.accent }]}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setDate(d => shiftDay(d, 1))}
            activeOpacity={0.7}
            accessibilityLabel="Next day"
            style={[s.tapBtn, { backgroundColor: T.cardAlt, borderColor: T.line, borderWidth: 1 }]}
          >
            <ChevronRight size={20} color={T.text} />
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
        <Text style={[s.physics, { color: T.dim }]}>
          Est. {DWELL_MINUTES} min per visit at {AVG_SPEED_KMH} km/h
        </Text>
      </Card>

      {!!note && (
        <View style={[s.note, { backgroundColor: withAlpha(noteTint, 0.1), borderColor: withAlpha(noteTint, 0.25) }]}>
          <Text style={[s.noteTxt, { color: noteTint }]}>{note}</Text>
        </View>
      )}

      {/* Students beside the map on a wide tablet; stacked on a phone. */}
      <View style={s.panes}>
        <View style={s.pane}>{studentList}</View>
        <View style={s.pane}>{routeMap}</View>
      </View>

      {/* The ordered day, with the arithmetic behind it visible */}
      {ordered.length > 0 && (
        <View style={{ marginTop: 18, gap: 8 }}>
          <SectionLabel>Order for {prettyDate(date)}</SectionLabel>
          {ordered.map((stop, i) => (
            <ListCard key={stop.id} onPress={() => nav.navigate('B2CLeadDetail', { leadId: stop.id })}>
              <Avatar initials={String(i + 1)} color={stop.late ? T.danger : T.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{stop.name || `Lead #${stop.id}`}</Text>
                {!!stop.area && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{stop.area}</Text>}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {stop.appointmentAt ? (
                  <Text style={[s.etaTxt, { color: stop.late ? T.danger : T.accent }]}>
                    Booked {timeOnDay(date, stop.appointmentAt)}
                  </Text>
                ) : (
                  <Text style={[s.sub, { color: T.dim }]}>Flexible</Text>
                )}
                {confirmedByLead.has(stop.id) ? (
                  /* Confirmed from the GPS trail, not self-reported — it replaces the estimate
                     rather than sitting beside it, so the row reads as fact once it is one. */
                  <View style={s.confirmedRow}>
                    <Check size={11} color={T.success} strokeWidth={2.6} />
                    <Text style={[s.etaTxt, { color: T.success }]}>
                      Arrived {timeOnDay(date, new Date(confirmedByLead.get(stop.id)!.actualArrivedAt!))}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.sub, { color: dayOffset(date, stop.eta) > 0 ? T.warning : T.dim }]}>
                    Arrive ~{timeOnDay(date, stop.eta)}
                  </Text>
                )}
              </View>
            </ListCard>
          ))}
        </View>
      )}

      {/* The day's planned visits with quick Done / Skip */}
      {visits.length > 0 && (
        <View style={{ marginTop: 18, gap: 8 }}>
          <SectionLabel>{prettyDate(date)}'s Plan</SectionLabel>
          {visits.map((v, i) => (
            <ListCard key={v.id} style={s.planCard}>
              <View style={s.planTop}>
                <Avatar initials={String(i + 1)} />
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7}
                  onPress={() => nav.navigate('B2CLeadDetail', { leadId: v.leadId })}>
                  <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{v.studentName || `Lead #${v.leadId}`}</Text>
                  {!!areaOf(v) && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{areaOf(v)}</Text>}
                </TouchableOpacity>
                {isSameLocalDay(v.appointmentAt, date) && (
                  <Text style={[s.etaTxt, { color: T.accent }]}>{timeOnly(v.appointmentAt as string)}</Text>
                )}
                <StatusBadge label={v.status || 'Planned'} color={statusColor(v.status, T)} />
              </View>
              <View style={s.planActions}>
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

      {/* Book / move an appointment without leaving the planner */}
      <FormModal
        visible={!!apptLead}
        title={apptLead?.appointmentAt ? `Reschedule — ${apptLead.studentName}` : `Book visit — ${apptLead?.studentName || ''}`}
        onClose={() => setApptLead(null)}
        wide={r.isTablet}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setApptLead(null)} disabled={savingAppt} style={{ flex: 1 }} />
          <Btn label={savingAppt ? 'Saving…' : 'Save'} onPress={saveAppointment} loading={savingAppt} disabled={savingAppt || !apptForm.date} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <DateInput
            label="Appointment date"
            value={apptForm.date}
            onChange={v => setApptForm(f => ({ ...f, date: v }))}
          />
          <Field label="Time">
            <Trigger
              label={TIME_SLOTS.find(t => t.value === apptForm.time)?.label || apptForm.time}
              open={apptTimeOpen}
              onPress={() => setApptTimeOpen(v => !v)}
              icon={<CalendarClock size={14} color={T.sub} strokeWidth={2} />}
            />
            {apptTimeOpen && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={240}
                value={apptForm.time}
                onSelect={v => { setApptForm(f => ({ ...f, time: v })); setApptTimeOpen(false); }}
                options={TIME_SLOTS}
              />
            )}
          </Field>
          <Input
            label="Notes"
            value={apptForm.notes}
            onChangeText={v => setApptForm(f => ({ ...f, notes: v }))}
            placeholder="What was agreed — who will be home, what to bring"
            multiline
          />
          {!!apptLead?.appointmentAt && (
            <Text style={[s.sub, { color: T.dim }]}>
              Moving it to another day takes this student out of this day's route.
            </Text>
          )}
        </View>
      </FormModal>
    </Screen>
  );
};

const makeStyles = (r: ReturnType<typeof useResponsive>) =>
  StyleSheet.create({
    title: { fontSize: r.rf(22), fontWeight: '800', letterSpacing: -0.4 },
    subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginTop: 3, lineHeight: r.rf(18) },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },

    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateCenter: { flex: 1, alignItems: 'center', gap: 3 },
    dateTxt: { fontSize: r.rf(15), fontWeight: '800', letterSpacing: -0.3 },
    todayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    todayTxt: { fontSize: r.rf(11), fontWeight: '700' },
    physics: { fontSize: r.rf(10.5), fontWeight: '600', textAlign: 'center', marginTop: 8 },

    /** Every touchable is at least the HIG minimum in both dimensions. */
    tapBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    // The Checkbox glyph is 20pt; this pads its row to a thumb-sized target.
    checkTap: { minWidth: MIN_TAP, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
    leadTap: { flex: 1, gap: 3, minHeight: MIN_TAP, justifyContent: 'center' },

    note: { borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginTop: 12 },
    noteTxt: { fontSize: r.rf(12.5), fontWeight: '600', lineHeight: r.rf(18) },

    panes: {
      flexDirection: r.isWide ? 'row' : 'column',
      alignItems: 'flex-start',
      gap: r.gap + 4,
      marginTop: 18,
    },
    pane: { flex: r.isWide ? 1 : undefined, width: r.isWide ? undefined : '100%' },

    confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardHead: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cardHeadTxt: { fontSize: r.rf(13), fontWeight: '800' },
    // A map has to be a map in both orientations — a squashed strip on a landscape iPad tells
    // you nothing, so the height tracks the window rather than a baked-in constant.
    mapWrap: { height: Math.round(Math.min(Math.max(r.height * (r.isLandscape ? 0.5 : 0.34), 240), 520)) },
    mapVeil: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
    mapVeilTxt: { fontSize: r.rf(12.5), fontWeight: '600', textAlign: 'center' },
    pin: { minWidth: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    pinTxt: { color: '#FFF', fontSize: 12, fontWeight: '900' },

    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    name: { fontSize: r.rf(13.5), fontWeight: '700' },
    sub: { fontSize: r.rf(11.5), fontWeight: '500' },
    etaTxt: { fontSize: r.rf(11.5), fontWeight: '700' },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    planCard: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
    planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planActions: { flexDirection: 'row', gap: 8 },

    empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 6 },
    emptyTitle: { fontSize: r.rf(14), fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  });

export default B2CRoutePlannerScreen;
