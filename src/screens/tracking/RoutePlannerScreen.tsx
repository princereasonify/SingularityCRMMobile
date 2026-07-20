import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  Linking, Alert, Platform, PermissionsAndroid, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {
  ChevronUp, ChevronDown, X, Plus, Navigation, Save, MapPin,
  Zap, ExternalLink, LocateFixed, WifiOff, TriangleAlert,
} from 'lucide-react-native';

import { routePlanApi } from '../../api/routePlan';
import { schoolsApi } from '../../api/schools';
import { School } from '../../types';
import { useOffline } from '../../context/OfflineContext';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, IconBtn, Field, Trigger, Dropdown, ListCard, ConfirmModal } from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Route Planner — 1:1 with web/src/pages/common/RoutePlanner.jsx.
 *
 * API shapes verified against SalesCRM.API/Controllers/RoutePlanController.cs:
 *   [HttpGet  "plan/today"] → Ok(ApiResponse<RoutePlanDto?>.Ok(plan))
 *   [HttpPost "plan"]       → Ok(ApiResponse<RoutePlanDto>.Ok(plan))
 *   [HttpPut  "plan/{id}"]  → Ok(ApiResponse<RoutePlanDto>.Ok(plan))
 * RoutePlanDto.Stops is a **string** (JSON blob), NOT RouteStop[] — `types/index.ts`
 * declares `DailyRoutePlan.stops: RouteStop[]`, which is a lie. The old screen fed that
 * string straight into `.map()`. We parse it here and never trust the TS type.
 *
 * The blob's field names are set by whichever client wrote it; web writes
 * `{order, schoolId, schoolName, lat, lon, visited}` — so we write that exact shape and
 * read `latitude/longitude` as a fallback for rows an older mobile build wrote.
 *
 * Schools list: SchoolsController.GetSchools →
 *   return Ok(ApiResponse<object>.Ok(new { schools, total, page, limit }));
 * so the param is `limit` (not `pageSize`) and the payload key is `schools` (not `items`).
 */

/** Web parity: `schoolService.getSchools({ limit: 500 })`. */
const SCHOOL_FETCH_LIMIT = 500;

const today = () => new Date().toISOString().split('T')[0];

type Stop = {
  order: number;
  schoolId: number;
  schoolName: string;
  lat: number | null;
  lon: number | null;
  visited: boolean;
};

type Origin = { lat: number; lon: number };

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/** Haversine — distance between two lat/lon points in kilometres. Ported from web. */
function haversineKm(a: Origin, b: Origin) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Greedy nearest-neighbour — fast TSP approximation. Starts at origin, repeatedly picks
 * the closest unvisited stop until all are ordered. Ported verbatim from web so both
 * clients order an identical stop set identically.
 */
function nearestNeighborOrder(origin: Origin, stops: Stop[]): Stop[] {
  const remaining = stops.slice();
  const ordered: Stop[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = haversineKm(current, { lat: remaining[0].lat!, lon: remaining[0].lon! });
    for (let i = 1; i < remaining.length; i++) {
      const d = haversineKm(current, { lat: remaining[i].lat!, lon: remaining[i].lon! });
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = { lat: next.lat!, lon: next.lon! };
  }
  return ordered;
}

/** Ported from web — same origin/waypoints/destination construction. */
function buildGoogleMapsUrl(stops: Stop[], origin: Origin | null) {
  if (stops.length === 0) return '';
  const originStr = origin ? `${origin.lat},${origin.lon}` : `${stops[0].lat},${stops[0].lon}`;
  const dest = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lon}`;
  const middle = origin
    ? stops.slice(0, -1).map(s => `${s.lat},${s.lon}`)
    : stops.slice(1, -1).map(s => `${s.lat},${s.lon}`);
  const waypoints = middle.join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${dest}&travelmode=driving`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

/** RoutePlanDto.Stops is a JSON string. Never assume the declared RouteStop[]. */
function parseStops(raw: any): Stop[] {
  let arr: any = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((s: any, i: number) => ({
    order: i + 1,
    schoolId: Number(s?.schoolId),
    schoolName: String(s?.schoolName ?? ''),
    lat: num(s?.lat ?? s?.latitude),
    lon: num(s?.lon ?? s?.longitude),
    visited: !!s?.visited,
  }));
}

const reorder = (list: Stop[]) => list.map((s, i) => ({ ...s, order: i + 1 }));

export const RoutePlannerScreen = () => {
  const T = useAppTheme();
  const { isOnline } = useOffline();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const mapRef = useRef<MapView | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [existingPlanId, setExistingPlanId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Current GPS — captured once the user opts in (Optimize). Cached so we don't re-prompt.
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);

  /**
   * Measured content box. The permanent iPad sidebar (240 / 76 rail) and the topbar mean
   * `useWindowDimensions()` is NOT the content area — deriving panel heights from it is
   * what clipped Pipeline's 5th column. Everything bounded here comes off this measure.
   */
  const [canvasH, setCanvasH] = useState(0);
  const onCanvasLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    setCanvasH(prev => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      // `limit` — SchoolsController never binds `pageSize`; it is silently dropped.
      const sres = await schoolsApi.getAll({ page: 1, limit: SCHOOL_FETCH_LIMIT });
      setSchools(((sres.data as any)?.schools ?? []) as School[]);
    } catch {
      setSchools([]);
    }

    try {
      const res = await routePlanApi.getToday();
      const plan: any = res.data;
      if (plan && plan.stops) {
        const parsed = parseStops(plan.stops);
        setStops(parsed);
        if (parsed.length > 0) setShowMap(true);
        setExistingPlanId(Number(plan.id) || null);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addedIds = useMemo(() => new Set(stops.map(s => s.schoolId)), [stops]);

  /** Web parity: the select only lists schools not already on the route. */
  const options = useMemo(
    () => schools
      .filter(s => !addedIds.has(s.id))
      .map(s => ({ label: s.city ? `${s.name} — ${s.city}` : s.name, value: String(s.id) })),
    [schools, addedIds],
  );

  const addStop = () => {
    if (!selectedSchool) return;
    const school = schools.find(s => String(s.id) === selectedSchool);
    if (!school) return;
    if (stops.some(s => s.schoolId === school.id)) {
      Alert.alert('Already added', 'That school is already on the route.');
      return;
    }
    setStops(prev => [...prev, {
      order: prev.length + 1,
      schoolId: school.id,
      schoolName: school.name,
      lat: num(school.latitude),
      lon: num(school.longitude),
      visited: false,
    }]);
    setSelectedSchool('');
  };

  const removeStop = (idx: number) => {
    setStops(prev => {
      const next = reorder(prev.filter((_, i) => i !== idx));
      if (next.length === 0) setShowMap(false);
      return next;
    });
  };

  const moveStop = (idx: number, dir: -1 | 1) => {
    setStops(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return reorder(arr);
    });
  };

  /**
   * Preserved verbatim from the previous screen — the Android runtime prompt plus the
   * community Geolocation call are deliberately configured against the manifest and the
   * iOS Info.plist. Do not swap the lib or "modernise" the permission flow.
   */
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location to optimize your route.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const getCurrentLocation = (): Promise<Origin> =>
    new Promise((resolve, reject) => {
      if (origin) { resolve(origin); return; }
      Geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setOrigin(loc);
          resolve(loc);
        },
        err => reject(err),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });

  const optimizeFromMyLocation = async () => {
    if (stops.length < 2) {
      Alert.alert('Add more stops', 'Add at least 2 schools first.');
      return;
    }
    setOptimizing(true);
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        setPermDenied(true);
        setOptimizing(false);
        return;
      }
      const here = await getCurrentLocation();
      setPermDenied(false);
      const valid = stops.filter(s => s.lat != null && s.lon != null);
      setStops(reorder(nearestNeighborOrder(here, valid)));
      setShowMap(true);
      Alert.alert('Route optimized', 'Stops reordered from your location — nearest first.');
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (/denied|permission/i.test(msg) || err?.code === 1) {
        setPermDenied(true);
      } else {
        Alert.alert('Location unavailable', 'Could not get your current location.');
      }
    } finally {
      setOptimizing(false);
    }
  };

  const savePlan = async () => {
    if (stops.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one stop.');
      return;
    }
    setSaving(true);
    try {
      // CreateRoutePlanRequest.Stops / UpdateRoutePlanRequest.Stops are `string` on the
      // controller — posting an array (what the old screen did, and what
      // `types.CreateRoutePlanRequest` still declares) never binds.
      const blob = JSON.stringify(stops);
      if (existingPlanId) {
        // RoutePlanService.CreatePlanAsync inserts unconditionally — it does NOT
        // upsert by date, so re-saving through POST would leak a duplicate row per
        // save. Web calls PUT here.
        await routePlanApi.update(existingPlanId, { stops: blob });
      } else {
        const res = await routePlanApi.create({
          planDate: today(),
          stops: blob,
          optimizationMethod: origin ? 'NearestNeighbor' : 'Manual',
        });
        setExistingPlanId(Number(res.data?.id) || null);
      }
      setShowMap(true);
      Alert.alert('Saved', 'Route plan saved.');
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const validStops = useMemo(() => stops.filter(s => s.lat != null && s.lon != null), [stops]);
  const mapsUrl = buildGoogleMapsUrl(validStops, origin);
  const openInMaps = () => { if (mapsUrl) Linking.openURL(mapsUrl); };

  /** react-native-maps' equivalent of the web renderer's `fitBounds`. */
  useEffect(() => {
    if (!showMap || validStops.length === 0 || !mapRef.current) return;
    const coords = [
      ...(origin ? [{ latitude: origin.lat, longitude: origin.lon }] : []),
      ...validStops.map(s => ({ latitude: s.lat!, longitude: s.lon! })),
    ];
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [showMap, validStops, origin]);

  // ── Planner card ────────────────────────────────────────────────────────────
  const renderPlanner = () => (
    <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
      {/* Add-a-school row */}
      <View style={s.addRow}>
        <Field style={{ flex: 1 }}>
          <Trigger
            label={
              selectedSchool
                ? (options.find(o => o.value === selectedSchool)?.label ?? 'Select school to add…')
                : 'Select school to add…'
            }
            open={pickerOpen}
            onPress={() => setPickerOpen(v => !v)}
          />
          {pickerOpen && (
            <Dropdown
              style={{ width: '100%' }}
              value={selectedSchool}
              maxHeight={Math.max(180, Math.min(300, canvasH * 0.42))}
              onSelect={v => { setSelectedSchool(v); setPickerOpen(false); }}
              options={options.length > 0 ? options : [{ label: 'No schools available', value: '' }]}
            />
          )}
        </Field>
        <Btn
          label="Add"
          onPress={addStop}
          disabled={!selectedSchool}
          icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
        />
      </View>

      {/* Permission-denied state — critical here; the whole Optimize path needs GPS. */}
      {permDenied && (
        <View style={[s.notice, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
          <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />
          <Text style={[s.noticeTxt, { color: T.danger }]}>
            Location permission denied. Enable GPS to optimize.
          </Text>
        </View>
      )}

      {/* Stops */}
      {stops.length === 0 ? (
        <View style={s.empty}>
          <Navigation size={32} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.emptyTxt, { color: T.dim }]}>No stops added yet</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {stops.map((stop, i) => (
            <ListCard key={`${stop.schoolId}-${i}`} style={{ backgroundColor: T.cardAlt }}>
              <View style={[s.orderDot, { backgroundColor: T.accent }]}>
                <Text style={s.orderTxt}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.stopName, { color: T.text }]} numberOfLines={1}>{stop.schoolName}</Text>
                <Text style={[s.stopMeta, { color: T.dim }]} numberOfLines={1}>
                  {stop.lat != null && stop.lon != null
                    ? `${stop.lat.toFixed(4)}, ${stop.lon.toFixed(4)}`
                    : 'No coordinates'}
                </Text>
              </View>
              <View style={s.rowActions}>
                <IconBtn kind="view" label="Move up" onPress={() => moveStop(i, -1)}>
                  <ChevronUp size={14} color={i === 0 ? T.dim : T.accent} strokeWidth={ICON_STROKE} />
                </IconBtn>
                <IconBtn kind="view" label="Move down" onPress={() => moveStop(i, 1)}>
                  <ChevronDown size={14} color={i === stops.length - 1 ? T.dim : T.accent} strokeWidth={ICON_STROKE} />
                </IconBtn>
                <IconBtn kind="del" label="Remove stop" onPress={() => setRemoveTarget(i)}>
                  <X size={14} color={T.danger} strokeWidth={ICON_STROKE} />
                </IconBtn>
              </View>
            </ListCard>
          ))}
        </View>
      )}

      {/* Footer — count + optimized chip + actions */}
      {stops.length > 0 && (
        <View style={[s.foot, { borderTopColor: T.line }]}>
          <View style={s.footMeta}>
            <Text style={[s.count, { color: T.sub }]}>
              {stops.length} stop{stops.length > 1 ? 's' : ''}
            </Text>
            {!!origin && (
              <View style={[s.optChip, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
                <LocateFixed size={11} color={T.info} strokeWidth={ICON_STROKE} />
                <Text style={[s.optChipTxt, { color: T.info }]}>Optimized from current location</Text>
              </View>
            )}
          </View>

          <View style={s.footBtns}>
            {validStops.length >= 2 && (
              <Btn
                label={optimizing ? 'Optimizing…' : 'Optimize from my location'}
                variant="soft"
                small
                loading={optimizing}
                onPress={optimizeFromMyLocation}
                icon={<Zap size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
              />
            )}
            {validStops.length >= 1 && (
              <Btn
                label="Open in Google Maps"
                variant="secondary"
                small
                onPress={openInMaps}
                icon={<ExternalLink size={14} color={T.text} strokeWidth={ICON_STROKE} />}
              />
            )}
            <Btn
              label={saving ? 'Saving…' : 'Save Plan'}
              small
              loading={saving}
              onPress={savePlan}
              icon={<Save size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </View>
        </View>
      )}
    </View>
  );

  // ── Map card ────────────────────────────────────────────────────────────────
  const renderMap = (fill: boolean) => {
    if (!showMap || validStops.length === 0) return null;
    return (
      <View style={[s.mapCard, { backgroundColor: T.card, borderColor: T.line }, fill && { flex: 1 }]}>
        <View style={[s.mapHead, { borderBottomColor: T.line }]}>
          <MapPin size={15} color={T.accent} strokeWidth={ICON_STROKE} />
          <View style={{ flex: 1 }}>
            <Text style={[s.mapTitle, { color: T.text }]}>Route Map</Text>
            <Text style={[s.mapHint, { color: T.dim }]} numberOfLines={1}>
              Schools are numbered in the order you'll visit them
            </Text>
          </View>
          <TouchableOpacity style={s.navLink} onPress={openInMaps} activeOpacity={0.7}>
            <ExternalLink size={13} color={T.info} strokeWidth={ICON_STROKE} />
            <Text style={[s.navLinkTxt, { color: T.info }]}>Navigate</Text>
          </TouchableOpacity>
        </View>

        <View style={fill ? { flex: 1 } : { height: 320 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: validStops[0].lat!,
              longitude: validStops[0].lon!,
              latitudeDelta: 0.3,
              longitudeDelta: 0.3,
            }}
          >
            {/* Driving order — the web renderer draws Google's polyline; we draw the
                same ordered path natively (no Directions round-trip on device). */}
            <Polyline
              coordinates={[
                ...(origin ? [{ latitude: origin.lat, longitude: origin.lon }] : []),
                ...validStops.map(st => ({ latitude: st.lat!, longitude: st.lon! })),
              ]}
              strokeColor={T.accent}
              strokeWidth={4}
            />

            {!!origin && (
              <Marker coordinate={{ latitude: origin.lat, longitude: origin.lon }} title="You are here">
                <View style={[s.meDot, { backgroundColor: T.info }]} />
              </Marker>
            )}

            {validStops.map((st, i) => (
              <Marker
                key={`${st.schoolId}-${i}`}
                coordinate={{ latitude: st.lat!, longitude: st.lon! }}
                title={`${i + 1}. ${st.schoolName}`}
              >
                <View style={[s.pin, { backgroundColor: T.accent }]}>
                  <Text style={s.pinTxt}>{i + 1}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      </View>
    );
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <View style={[s.pad, wide && s.padWide]}>
          <View style={s.titleBlock}>
            <Text style={[s.h1, { color: T.text }]}>Route Planner</Text>
            <Text style={[s.h2, { color: T.sub }]}>Plan your school visits for today</Text>
          </View>
          {/* Skeleton — same card geometry the loaded state lands in, so nothing jumps. */}
          <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 46 }]} />
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 62 }]} />
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 62 }]} />
            <ActivityIndicator color={T.accent} style={{ marginTop: 8 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <View style={s.canvas} onLayout={onCanvasLayout}>
        <View style={[s.head, wide && s.padWide]}>
          <View style={s.titleBlock}>
            <Text style={[s.h1, { color: T.text }]}>Route Planner</Text>
            <Text style={[s.h2, { color: T.sub }]}>Plan your school visits for today</Text>
          </View>

          {!isOnline && (
            <View style={[s.notice, { backgroundColor: withAlpha(T.warning, SOFT_TINT) }]}>
              <WifiOff size={14} color={T.warning} strokeWidth={ICON_STROKE} />
              <Text style={[s.noticeTxt, { color: T.warning }]}>
                You're offline. Changes can't be saved until you reconnect.
              </Text>
            </View>
          )}

          {loadError && (
            <View style={[s.notice, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
              <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />
              <Text style={[s.noticeTxt, { color: T.danger }]}>
                Couldn't load today's plan. Pull the plan again after reconnecting.
              </Text>
            </View>
          )}
        </View>

        {wide ? (
          /* iPad landscape: planner + map side by side. Both panes are flex children of a
             flex:1 row, so they consume exactly the measured canvas — no window maths, no
             dead space, and each pane scrolls inside its own bounds. */
          <View style={s.panes}>
            <ScrollView
              style={s.leftPane}
              contentContainerStyle={s.paneContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderPlanner()}
            </ScrollView>
            <View style={s.rightPane}>
              {showMap && validStops.length > 0 ? (
                renderMap(true)
              ) : (
                <View style={[s.mapCard, s.mapPlaceholder, { backgroundColor: T.card, borderColor: T.line }]}>
                  <MapPin size={34} color={T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[s.emptyTxt, { color: T.dim }]}>
                    Add a school with coordinates to see the route map
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderPlanner()}
            {renderMap(false)}
          </ScrollView>
        )}
      </View>

      <ConfirmModal
        visible={removeTarget !== null}
        tone="danger"
        title="Remove Stop?"
        message={
          removeTarget !== null && stops[removeTarget]
            ? `${stops[removeTarget].schoolName} will be taken off today's route.`
            : 'This school will be taken off today’s route.'
        }
        icon={<X size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Remove"
        onConfirm={() => { if (removeTarget !== null) removeStop(removeTarget); setRemoveTarget(null); }}
        onCancel={() => setRemoveTarget(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from the theme, inline) ─────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  canvas: { flex: 1 },

  pad: { padding: 14, gap: 12 },
  padWide: { paddingHorizontal: 22 },
  head: { paddingHorizontal: 14, paddingTop: 14, gap: 10 },
  titleBlock: { gap: 2 },
  h1: { fontSize: rf(19), fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontSize: rf(12.5), fontWeight: '500' },

  scroll: { padding: 14, gap: 12 },
  panes: { flex: 1, flexDirection: 'row', gap: 12, padding: 14, paddingTop: 12 },
  leftPane: { flex: 1.05 },
  paneContent: { gap: 12, paddingBottom: 4 },
  rightPane: { flex: 1.25 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11,
  },
  noticeTxt: { flex: 1, fontSize: rf(12), fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 44, gap: 8 },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  orderDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderTxt: { color: '#FFF', fontSize: rf(11.5), fontWeight: '800' },
  stopName: { fontSize: rf(13.5), fontWeight: '700' },
  stopMeta: { fontSize: rf(11), fontWeight: '500', marginTop: 1 },
  rowActions: { flexDirection: 'row', gap: 6 },

  foot: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  footMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(12), fontWeight: '600' },
  optChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 11, paddingHorizontal: 8, paddingVertical: 3,
  },
  optChipTxt: { fontSize: rf(10.5), fontWeight: '700' },
  footBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  mapCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  mapHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  mapTitle: { fontSize: rf(13), fontWeight: '700' },
  mapHint: { fontSize: rf(10.5), fontWeight: '500', marginTop: 1 },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navLinkTxt: { fontSize: rf(11.5), fontWeight: '700' },

  pin: {
    minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  pinTxt: { color: '#FFF', fontSize: rf(11), fontWeight: '800' },
  meDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#FFF' },

  skel: { borderRadius: 13 },
});
