import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform,
  PermissionsAndroid, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, MapPin, Home, CheckCircle, Save, WifiOff, TriangleAlert } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';

import { authApi } from '../../api/auth';
import { apiClient } from '../../api/client';
import { useOffline } from '../../context/OfflineContext';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Input, Dropdown, Segmented } from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Home Location — 1:1 with web/src/pages/common/HomeLocation.jsx.
 *
 * API shapes verified against SalesCRM.API/Controllers/AuthController.cs:
 *   [HttpGet  "home-location"] → Ok(ApiResponse<Core.DTOs.UserDto>.Ok(user))
 *   [HttpPost "home-location"] → Ok(ApiResponse<Core.DTOs.UserDto>.Ok(user, "Home location saved successfully"))
 * UserDto exposes HomeLatitude / HomeLongitude / HomeAddress → camelCased over the wire.
 * The old screen read `d?.address`, which UserDto never sends, so a saved address never
 * came back. It also called `authApi.setHomeLocation(lat, lng)` — which omits `address`
 * entirely — while SetHomeLocationRequest binds { Latitude, Longitude, Address } and web
 * sends all three. The address was being silently dropped on every save.
 */

// Same key the Places/Geocode calls in AddSchoolScreen use — from .env via @env,

// Safe import — react-native-maps may not be configured on all setups.
// Preserved verbatim: the provider/permission wiring is native-configured.
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = undefined;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
} catch {}

const DEFAULT_REGION = { latitude: 22.3072, longitude: 73.1812, latitudeDelta: 20, longitudeDelta: 20 };
const ZOOM_REGION = (lat: number, lng: number) => ({
  latitude: lat, longitude: lng, latitudeDelta: 0.003, longitudeDelta: 0.003,
});

/** Web parity: the geofence the tracker checks against is 50 metres. */
const GEOFENCE_RADIUS_M = 50;

type MapKind = 'standard' | 'satellite' | 'terrain' | 'hybrid';
/** Web's MAP_TYPES — 'roadmap' is Google-JS for react-native-maps' 'standard'. */
const MAP_TYPES: { label: string; value: MapKind }[] = [
  { label: 'Default', value: 'standard' },
  { label: 'Satellite', value: 'satellite' },
  { label: 'Terrain', value: 'terrain' },
  { label: 'Hybrid', value: 'hybrid' },
];

// ─── Google Places / Geocode (REST — same endpoints AddSchoolScreen uses) ─────
/**
 * Place/address lookups go through OUR SERVER, not straight to Google.
 *
 * These are Google *web service* APIs, and Google's "restrict this key to my Android app"
 * setting does not cover them — only the Maps SDK. So a key used here from the device could
 * never be locked down, and shipping one inside the APK means anyone can extract and spend it.
 * The server holds an IP-restricted key instead, and caches repeat lookups.
 *
 * The response is Google's own JSON, unchanged, so the parsing below is exactly as it was.
 */
async function placesAutocomplete(input: string): Promise<{ label: string; value: string }[]> {
  if (!input.trim()) return [];
  try {
    const { data: json } = await apiClient.get('/routes/places/autocomplete', { params: { input } });
    return (json.predictions ?? []).map((p: any) => ({ label: p.description, value: p.place_id }));
  } catch { return []; }
}

async function placeDetails(placeId: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const { data: json } = await apiClient.get('/routes/places/details', {
      params: { placeId, fields: 'geometry,formatted_address' },
    });
    const r = json.result;
    if (!r?.geometry) return null;
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address ?? '' };
  } catch { return null; }
}

/** Web's "Find on Map" is a PlacesService.textSearch on the raw query. */
async function textSearch(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  if (!query.trim()) return null;
  try {
    const { data: json } = await apiClient.get('/routes/places/textsearch', { params: { query } });
    const first = json.results?.[0];
    if (!first?.geometry) return null;
    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      address: first.formatted_address ?? query,
    };
  } catch { return null; }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const { data: json } = await apiClient.get('/routes/geocode/reverse', {
      params: { latlng: `${lat},${lng}` },
    });
    return json.results?.[0]?.formatted_address ?? '';
  } catch { return ''; }
}

export const HomeLocationScreen = () => {
  const T = useAppTheme();
  const { isOnline } = useOffline();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const mapRef = useRef<any>(null);

  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationSet, setLocationSet] = useState(false);

  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [mapType, setMapType] = useState<MapKind>('standard');

  const [suggestions, setSuggestions] = useState<{ label: string; value: string }[]>([]);
  const [showSug, setShowSug] = useState(false);
  /** Suppresses the autocomplete round-trip when *we* wrote the field (pick/GPS/search). */
  const silentRef = useRef(false);

  const loadSaved = useCallback(async () => {
    try {
      const res = await authApi.getHomeLocation();
      const d = res.data as any;
      const lat = d?.homeLatitude;
      const lon = d?.homeLongitude;
      if (lat != null && lon != null) {
        const pLat = parseFloat(String(lat));
        const pLon = parseFloat(String(lon));
        if (Number.isFinite(pLat) && Number.isFinite(pLon)) {
          setLatitude(pLat);
          setLongitude(pLon);
          setLocationSet(true);
          // UserDto.HomeAddress — not `address`, which is what the old screen looked for.
          if (d?.homeAddress) { silentRef.current = true; setAddress(String(d.homeAddress)); }
          setTimeout(() => mapRef.current?.animateToRegion(ZOOM_REGION(pLat, pLon), 500), 600);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  // Places autocomplete, debounced — web attaches maps.places.Autocomplete to the input.
  useEffect(() => {
    if (silentRef.current) { silentRef.current = false; return; }
    if (address.trim().length < 3) { setSuggestions([]); setShowSug(false); return; }
    const t = setTimeout(async () => {
      const list = await placesAutocomplete(address);
      setSuggestions(list);
      setShowSug(list.length > 0);
    }, 400);
    return () => clearTimeout(t);
  }, [address]);

  /**
   * Preserved verbatim — the Android runtime prompt and the community Geolocation call
   * are wired against the manifest / Info.plist. Do not swap the lib or the flow.
   */
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location to detect your home address.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  /**
   * The suggestion panel is dismissed by scrolling, tapping the map, picking a row, or
   * running a search — never by a full-screen touch catcher, which would sit between the
   * MapView and the responder system and fight its pan gesture.
   */
  const dismissSuggestions = useCallback(() => setShowSug(false), []);

  const setLocation = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationSet(true);
    mapRef.current?.animateToRegion(ZOOM_REGION(lat, lng), 400);
  };

  const pickSuggestion = async (placeId: string) => {
    setShowSug(false);
    const d = await placeDetails(placeId);
    if (!d) { Alert.alert('Not found', 'Could not resolve that address.'); return; }
    setLocation(d.lat, d.lng);
    silentRef.current = true;
    setAddress(d.address);
  };

  const findOnMap = async () => {
    const q = address.trim();
    if (!q) { Alert.alert('Error', 'Enter an address to search'); return; }
    setSearching(true);
    setShowSug(false);
    const r = await textSearch(q);
    setSearching(false);
    if (!r) { Alert.alert('Not found', 'Address not found.'); return; }
    setLocation(r.lat, r.lng);
    silentRef.current = true;
    setAddress(r.address);
  };

  const detectLocation = async () => {
    const ok = await requestLocationPermission();
    if (!ok) { setPermDenied(true); return; }
    setPermDenied(false);
    setDetecting(true);
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        setLocation(lat, lng);
        setDetecting(false);
        const formatted = await reverseGeocode(lat, lng);
        if (formatted) { silentRef.current = true; setAddress(formatted); }
        Alert.alert(
          'Location detected',
          accuracy && accuracy > 100
            ? 'Location detected (low accuracy — refine by searching or tapping the map).'
            : 'Current location detected.',
        );
      },
      (error) => {
        setDetecting(false);
        if (error?.code === 1) setPermDenied(true);
        else Alert.alert('Error', error?.message || 'Location access denied.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleMapPress = async (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLocation(lat, lng);
    setShowSug(false);
    const formatted = await reverseGeocode(lat, lng);
    if (formatted) { silentRef.current = true; setAddress(formatted); }
  };

  const handleSave = async () => {
    if (latitude == null || longitude == null) {
      Alert.alert('Error', 'Select a location first');
      return;
    }
    setSaving(true);
    try {
      // SetHomeLocationRequest binds { Latitude, Longitude, Address }; web sends all three.
      await authApi.setHomeLocation(latitude, longitude, address);
      Alert.alert('Saved', 'Home location saved successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Form pane ───────────────────────────────────────────────────────────────
  const renderForm = () => (
    <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={s.cardHead}>
        <View style={[s.iconTile, { backgroundColor: T.accentSoft }]}>
          <Home size={20} color={T.accent} strokeWidth={ICON_STROKE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: T.text }]}>Set Home Location</Text>
          <Text style={[s.cardSub, { color: T.dim }]}>Search your address, use GPS, or tap on the map</Text>
        </View>
      </View>

      {!isOnline && (
        <View style={[s.notice, { backgroundColor: withAlpha(T.warning, SOFT_TINT) }]}>
          <WifiOff size={14} color={T.warning} strokeWidth={ICON_STROKE} />
          <Text style={[s.noticeTxt, { color: T.warning }]}>
            You're offline. Address search and saving need a connection.
          </Text>
        </View>
      )}

      {permDenied && (
        <View style={[s.notice, { backgroundColor: withAlpha(T.danger, SOFT_TINT) }]}>
          <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />
          <Text style={[s.noticeTxt, { color: T.danger }]}>
            Location permission denied. Enable GPS, or search the address instead.
          </Text>
        </View>
      )}

      {/* Search — the suggestion panel hangs off the input inline (8px below, per spec).
          Never a Modal. */}
      <View>
        <View style={s.searchRow}>
          <Input
            label="Search Home Address *"
            value={address}
            onChangeText={setAddress}
            placeholder="Type your home address, area, or landmark"
            onSubmitEditing={findOnMap}
            returnKeyType="search"
            containerStyle={{ flex: 1 }}
          />
          <Btn
            label={searching ? 'Searching…' : 'Find on Map'}
            onPress={findOnMap}
            loading={searching}
            style={s.findBtn}
            icon={<MapPin size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>
        {showSug && (
          <Dropdown
            style={{ width: '100%' }}
            maxHeight={220}
            options={suggestions}
            onSelect={pickSuggestion}
          />
        )}
        <Text style={[s.hint, { color: T.dim }]}>
          Type your address and pick a suggestion, or tap Find on Map.
        </Text>
      </View>

      <Btn
        label={detecting ? 'Detecting…' : 'Use My Current Location'}
        variant="soft"
        onPress={detectLocation}
        loading={detecting}
        icon={<Navigation size={16} color={T.accent} strokeWidth={ICON_STROKE} />}
      />
    </View>
  );

  // ── Map pane ────────────────────────────────────────────────────────────────
  const renderMap = (fill: boolean) => {
    if (!MapView) {
      return (
        <View style={[s.card, s.fallback, { backgroundColor: T.card, borderColor: T.line }, fill && { flex: 1 }]}>
          {locationSet && latitude != null && longitude != null ? (
            <>
              <CheckCircle size={32} color={T.success} strokeWidth={ICON_STROKE} />
              <Text style={[s.cardTitle, { color: T.text }]}>Location Set</Text>
              <Text style={[s.cardSub, { color: T.dim }]}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
              <Text style={[s.cardSub, { color: T.accent }]}>{GEOFENCE_RADIUS_M}m geofence active</Text>
            </>
          ) : (
            <>
              <MapPin size={32} color={T.warning} strokeWidth={ICON_STROKE} />
              <Text style={[s.cardTitle, { color: T.text }]}>Map unavailable</Text>
              <Text style={[s.cardSub, { color: T.dim }]}>Use the GPS button to set your location</Text>
            </>
          )}
        </View>
      );
    }

    return (
      <View style={[s.mapCard, { backgroundColor: T.card, borderColor: T.line }, fill && { flex: 1 }]}>
        <View style={fill ? { flex: 1 } : { height: 320 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={latitude && longitude ? ZOOM_REGION(latitude, longitude) : DEFAULT_REGION}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            mapType={mapType}
          >
            {locationSet && latitude != null && longitude != null && Circle && (
              <Circle
                center={{ latitude, longitude }}
                radius={GEOFENCE_RADIUS_M}
                fillColor={withAlpha(T.accent, SOFT_TINT)}
                strokeColor={T.accent}
                strokeWidth={2}
              />
            )}
            {locationSet && latitude != null && longitude != null && Marker && (
              <Marker
                coordinate={{ latitude, longitude }}
                title="Home Location"
                description={`${GEOFENCE_RADIUS_M}m geofence`}
                pinColor={T.accent}
              />
            )}
          </MapView>

          {/* Status badge */}
          {locationSet && latitude != null && longitude != null ? (
            <View style={[s.badge, { backgroundColor: T.card, borderColor: withAlpha(T.success, 0.4) }]}>
              <CheckCircle size={13} color={T.success} strokeWidth={ICON_STROKE} />
              <Text style={[s.badgeTxt, { color: T.success }]}>Location set</Text>
              <Text style={[s.badgeCoords, { color: T.dim }]}>
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <View style={[s.badge, { backgroundColor: T.card, borderColor: withAlpha(T.warning, 0.4) }]}>
              <MapPin size={13} color={T.warning} strokeWidth={ICON_STROKE} />
              <Text style={[s.badgeTxt, { color: T.warning }]}>Search an address or tap the map</Text>
            </View>
          )}

          {/* Geofence legend */}
          {locationSet && (
            <View style={[s.legend, { backgroundColor: T.card }]}>
              <View style={[s.legendDot, { backgroundColor: withAlpha(T.accent, SOFT_TINT), borderColor: T.accent }]} />
              <Text style={[s.legendTxt, { color: T.sub }]}>{GEOFENCE_RADIUS_M}m geofence</Text>
            </View>
          )}
        </View>

        {/* Map type — web floats these over the map's bottom-right. Docked under the map
            instead so it can never collide with the legend on a narrow phone. */}
        <View style={[s.mapFoot, { borderTopColor: T.line }]}>
          <Segmented<MapKind> value={mapType} onChange={setMapType} options={MAP_TYPES} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <View style={s.pad}>
          {/* No in-page title — the topbar (native drawer header for RH/SH/SCA)
              already names the screen; the form card carries its own "Set Home
              Location" heading. */}
          <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 44 }]} />
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 46 }]} />
            <View style={[s.skel, { backgroundColor: T.cardAlt, height: 44 }]} />
            <ActivityIndicator color={T.accent} style={{ marginTop: 8 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const saveBtn = (
    <Btn
      label={saving ? 'Saving…' : 'Save Home Location'}
      onPress={handleSave}
      loading={saving}
      disabled={!locationSet}
      icon={<Save size={16} color="#FFF" strokeWidth={ICON_STROKE} />}
    />
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      {wide ? (
        /* iPad landscape: form + map side by side. Both panes are flex children of a
           flex:1 row, so they fill the real content box exactly — no window maths (the
           permanent sidebar + topbar make the window the wrong ruler), no dead space. */
        <View style={s.wideRoot}>
          <View style={s.panes}>
            <ScrollView
              style={s.leftPane}
              contentContainerStyle={s.paneContent}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={dismissSuggestions}
              showsVerticalScrollIndicator={false}
            >
              {renderForm()}
              {saveBtn}
            </ScrollView>
            <View style={s.rightPane}>{renderMap(true)}</View>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissSuggestions}
          showsVerticalScrollIndicator={false}
        >
          {renderForm()}
          {renderMap(false)}
          {saveBtn}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from the theme, inline) ─────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  pad: { padding: 14, gap: 12 },
  scroll: { padding: 14, gap: 12 },

  wideRoot: { flex: 1 },
  widePad: { paddingHorizontal: 22, paddingTop: 14 },
  panes: { flex: 1, flexDirection: 'row', gap: 12, padding: 14, paddingTop: 12 },
  leftPane: { flex: 1 },
  paneContent: { gap: 12, paddingBottom: 4 },
  rightPane: { flex: 1.15 },

  titleBlock: { gap: 2 },
  h1: { fontSize: rf(19), fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontSize: rf(12.5), fontWeight: '500' },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: rf(14), fontWeight: '700' },
  cardSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2, textAlign: 'center' },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11,
  },
  noticeTxt: { flex: 1, fontSize: rf(12), fontWeight: '600' },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  findBtn: { marginBottom: 0 },
  hint: { fontSize: rf(11), fontWeight: '500', marginTop: 6 },

  mapCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mapFoot: { borderTopWidth: 1, padding: 10 },
  fallback: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 6 },

  badge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 11, borderWidth: 1,
  },
  badgeTxt: { fontSize: rf(11), fontWeight: '700' },
  badgeCoords: { fontSize: rf(11), fontWeight: '500' },

  legend: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11,
  },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendTxt: { fontSize: rf(11), fontWeight: '500' },

  skel: { borderRadius: 13 },
});
