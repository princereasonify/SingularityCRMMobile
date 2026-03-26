import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Linking, Alert, ActivityIndicator, Platform, PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { ArrowLeft, Navigation, CheckCircle, ExternalLink } from 'lucide-react-native';
import { schoolAssignmentsApi } from '../../api/schoolAssignments';
import { SchoolAssignment } from '../../types';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

// ─── Pin colors per visit index (for unvisited schools) ──────────────────────
// Index 0 = first school to visit today, gets a unique accent color so FO
// can visually distinguish the order at a glance.
const PIN_COLORS = ['#2563EB', '#7C3AED', '#EA580C', '#0D9488', '#D97706', '#BE185D'];

const pinColor = (index: number, isVisited: boolean): string =>
  isVisited ? '#16A34A' : (PIN_COLORS[index % PIN_COLORS.length]);

// ─── Android-safe rgba fill ───────────────────────────────────────────────────
// Android does NOT parse 8-digit hex colors (#RRGGBBAA).
// Convert the pin hex color to rgba() so Circle fillColor works on both platforms.
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Build Google Maps multi-stop URL ────────────────────────────────────────
// Google Maps expects: origin → waypoints (pipe-separated) → destination.
// We sort by visitOrder so the FO navigates in the planned sequence.
const buildGoogleMapsUrl = (
  userLat: number,
  userLng: number,
  schools: SchoolAssignment[],
): string => {
  const sorted = [...schools].sort((a, b) => a.visitOrder - b.visitOrder);
  if (sorted.length === 0) return '';

  const destination = sorted[sorted.length - 1];
  const waypoints = sorted.slice(0, -1)
    .map(s => `${s.schoolLatitude},${s.schoolLongitude}`)
    .join('|');

  // Linking.openURL() will hand this off to the native Google Maps app if
  // installed, or open maps.google.com in the browser as a fallback.
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${userLat},${userLng}` +
    `&destination=${destination.schoolLatitude},${destination.schoolLongitude}` +
    (waypoints ? `&waypoints=${waypoints}` : '') +
    `&travelmode=driving`
  );
};

// ─── Today's date as YYYY-MM-DD ───────────────────────────────────────────────
// Used as the `date` query param so the API returns today's assignments only.
const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AssignedSchoolsScreen = ({ navigation }: any) => {
  const COLOR = ROLE_COLORS.FO;
  const mapRef = useRef<MapView>(null);

  const [assignments, setAssignments] = useState<SchoolAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  // userLocation holds the FO's live GPS coords — starts null until the OS grants permission
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  // selectedSchool is the row the FO tapped — the map pans to it
  const [selectedSchool, setSelectedSchool] = useState<SchoolAssignment | null>(null);

  // ── Fetch today's assigned schools from the API ───────────────────────────
  const fetchAssignments = useCallback(async () => {
    try {
      const res = await schoolAssignmentsApi.getMyAssignments(todayISO());
      // Sort by visitOrder so the Polyline connects them in the planned route sequence
      const sorted = (res.data as SchoolAssignment[]).sort((a, b) => a.visitOrder - b.visitOrder);
      setAssignments(sorted);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // ── Request GPS and stream the FO's live position ────────────────────────
  // iOS uses Geolocation.requestAuthorization(). Android requires PermissionsAndroid
  // because requestAuthorization() is a no-op on Android — without this the
  // watchPosition callback never fires and userLocation stays null.
  useEffect(() => {
    let watchId: number;
    const startWatch = () => {
      watchId = Geolocation.watchPosition(
        pos => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, distanceFilter: 10 },
      );
    };

    if (Platform.OS === 'android') {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        .then(result => {
          if (result === PermissionsAndroid.RESULTS.GRANTED) startWatch();
        });
    } else {
      Geolocation.requestAuthorization();
      startWatch();
    }

    return () => { if (watchId != null) Geolocation.clearWatch(watchId); };
  }, []);

  // ── Auto-fit the map once schools + GPS are both available ───────────────
  // fitToCoordinates tells the MapView camera to zoom to show every pin.
  useEffect(() => {
    if (assignments.length === 0) return;
    const coords = assignments
      .filter(a => a.schoolLatitude && a.schoolLongitude)
      .map(a => ({ latitude: a.schoolLatitude, longitude: a.schoolLongitude }));
    if (userLocation) coords.push(userLocation); // include the FO's own position in the frame
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    }, 600); // small delay lets the map finish its initial render before animating
  }, [assignments, userLocation]);

  // ── Pan map when a list row is tapped ────────────────────────────────────
  const handleSchoolRowPress = (school: SchoolAssignment) => {
    setSelectedSchool(school);
    mapRef.current?.animateToRegion(
      {
        latitude: school.schoolLatitude,
        longitude: school.schoolLongitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400, // animation duration in ms
    );
  };

  // ── Open all schools as a driving route in Google Maps ───────────────────
  const openGoogleMaps = () => {
    if (!userLocation) {
      Alert.alert('Location Unavailable', 'Waiting for your GPS location. Please try again in a moment.');
      return;
    }
    if (assignments.length === 0) {
      Alert.alert('No Schools', 'No assigned schools to navigate to.');
      return;
    }
    const url = buildGoogleMapsUrl(userLocation.latitude, userLocation.longitude, assignments);
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Google Maps.'),
    );
  };

  // ── Derived counts for the summary bar ───────────────────────────────────
  const visitedCount = assignments.filter(a => a.isVisited).length;
  const total = assignments.length;

  // Polyline coordinates in visitOrder — the blue line connecting schools
  const routeCoords = assignments.map(a => ({
    latitude: a.schoolLatitude,
    longitude: a.schoolLongitude,
  }));

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Today's Schools</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLOR.primary} />
          <Text style={styles.loadingText}>Loading your schools…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Today's Schools</Text>
          {/* summary bar — shows how many schools have been visited today */}
          <Text style={styles.headerSub}>
            {visitedCount} of {total} visited
          </Text>
        </View>
        <View style={styles.progressPill}>
          {/* Compact visited/total badge in the header corner */}
          <Text style={styles.progressText}>{visitedCount}/{total}</Text>
        </View>
      </View>

      {/* ── Map (takes ~55% of the screen height) ───────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          showsCompass
          showsScale
        >
          {/* ── Planned route line ──────────────────────────────────────── */}
          {/* Polyline draws a blue dashed line connecting schools in order */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={COLOR.primary}
              strokeWidth={3}
              lineDashPattern={[6, 4]}  // dashes show it's a plan, not a tracked path
            />
          )}

          {/* ── School markers ──────────────────────────────────────────── */}
          {assignments.map((school, index) => {
            const color = pinColor(index, school.isVisited);
            const isSelected = selectedSchool?.id === school.id;
            return (
              <React.Fragment key={school.id}>
                {/* ── Geofence circle ─────────────────────────────────── */}
                {/* Semi-transparent circle shows the check-in zone radius */}
                <Circle
                  center={{ latitude: school.schoolLatitude, longitude: school.schoolLongitude }}
                  radius={school.geofenceRadiusMetres}   // metres — from API response
                  strokeColor={color}
                  strokeWidth={1.5}
                  fillColor={hexToRgba(color, 0.13)}     // rgba() — Android doesn't parse 8-digit hex
                />

                {/* ── Numbered school pin ─────────────────────────────── */}
                {/* Native title/description props = works on both iOS & Android.
                    A custom <View> + <Callout> in the same Marker causes Android
                    to silently drop the custom view — so we use the native callout. */}
                <Marker
                  coordinate={{ latitude: school.schoolLatitude, longitude: school.schoolLongitude }}
                  tracksViewChanges={false}
                  title={`${school.visitOrder}. ${school.schoolName}`}
                  description={`${school.schoolCity}${school.isVisited ? ` • Visited${school.timeSpentMinutes != null ? ` (${school.timeSpentMinutes} min)` : ''}` : ' • Pending'}`}
                  onPress={() => setSelectedSchool(prev => prev?.id === school.id ? null : school)}
                >
                  <View style={[styles.pin, { backgroundColor: color, borderColor: isSelected ? '#FFF' : color }]}>
                    <Text style={styles.pinNumber}>{school.visitOrder}</Text>
                    {school.isVisited && (
                      <View style={styles.pinCheck}>
                        <CheckCircle size={10} color="#FFF" fill="#16A34A" />
                      </View>
                    )}
                  </View>
                </Marker>
              </React.Fragment>
            );
          })}

          {/* ── FO's current GPS location ────────────────────────────────── */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}   // center the custom view on the coordinate
            >
              {/* Blue "You" pill — clearly different from school pins */}
              <View style={styles.youPin}>
                <Navigation size={12} color="#FFF" />
                <Text style={styles.youText}>You</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {/* ── Empty overlay when no schools assigned ───────────────────── */}
        {assignments.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Text style={styles.emptyIcon}>🏫</Text>
            <Text style={styles.emptyTitle}>No Schools Assigned</Text>
            <Text style={styles.emptySub}>Your manager hasn't assigned any schools for today.</Text>
          </View>
        )}
      </View>

      {/* ── Bottom panel ────────────────────────────────────────────────── */}
      <View style={styles.bottomPanel}>
        {/* Google Maps button — opens native navigation with all schools as stops */}
        <TouchableOpacity
          style={[styles.gmapsBtn, { backgroundColor: COLOR.primary }]}
          onPress={openGoogleMaps}
          activeOpacity={0.85}
        >
          <ExternalLink size={16} color="#FFF" />
          <Text style={styles.gmapsBtnText}>Open Route in Google Maps</Text>
        </TouchableOpacity>

        {/* Scrollable school list — tap a row to pan the map */}
        <ScrollView
          style={styles.listScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {assignments.map((school, index) => {
            const color = pinColor(index, school.isVisited);
            const isSelected = selectedSchool?.id === school.id;
            return (
              <TouchableOpacity
                key={school.id}
                style={[styles.listRow, isSelected && { backgroundColor: color + '14' }]}
                onPress={() => handleSchoolRowPress(school)}
                activeOpacity={0.7}
              >
                {/* Numbered color badge — same color logic as the map pin */}
                <View style={[styles.listBadge, { backgroundColor: color }]}>
                  <Text style={styles.listBadgeText}>{school.visitOrder}</Text>
                </View>

                {/* School name + city */}
                <View style={styles.listInfo}>
                  <Text style={styles.listName} numberOfLines={1}>{school.schoolName}</Text>
                  <Text style={styles.listCity}>{school.schoolCity}</Text>
                </View>

                {/* Visited / Pending status badge */}
                <View style={[styles.listStatus, { backgroundColor: school.isVisited ? '#DCFCE7' : '#F3F4F6' }]}>
                  <Text style={[styles.listStatusText, { color: school.isVisited ? '#16A34A' : '#9CA3AF' }]}>
                    {school.isVisited ? 'Visited' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: rf(14), color: '#6B7280' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: rf(17), fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: rf(12), color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  progressText: { fontSize: rf(13), fontWeight: '700', color: '#FFF' },

  // Map
  mapContainer: { flex: 1 },   // takes all space above the bottom panel
  emptyOverlay: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(249,250,251,0.88)',
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: rf(16), fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: rf(13), color: '#9CA3AF', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  // Custom map pins
  pin: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  pinNumber: { fontSize: rf(12), fontWeight: '800', color: '#FFF' },
  pinCheck: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#FFF', borderRadius: 8, padding: 1,
  },

  // "You" GPS pin
  youPin: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1D4ED8', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 8,
  },
  youText: { fontSize: rf(11), fontWeight: '800', color: '#FFF' },

  // Callout bubble
  callout: { width: 190, padding: 10 },
  calloutName: { fontSize: rf(13), fontWeight: '700', color: '#111827', marginBottom: 2 },
  calloutCity: { fontSize: rf(11), color: '#6B7280', marginBottom: 2 },
  calloutAddr: { fontSize: rf(11), color: '#9CA3AF', marginBottom: 6 },
  calloutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  calloutBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  calloutBadgeText: { fontSize: rf(11), fontWeight: '700' },
  calloutTime: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calloutTimeText: { fontSize: rf(11), color: '#6B7280' },

  // Bottom panel
  bottomPanel: {
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    // fixed height so the map always gets its fair share of the screen
    maxHeight: 280,
  },
  gmapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    paddingVertical: 12, borderRadius: 14,
  },
  gmapsBtnText: { fontSize: rf(14), fontWeight: '700', color: '#FFF' },

  // School list
  listScroll: { flex: 1 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  listBadge: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  listBadgeText: { fontSize: rf(12), fontWeight: '800', color: '#FFF' },
  listInfo: { flex: 1 },
  listName: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
  listCity: { fontSize: rf(11), color: '#9CA3AF', marginTop: 1 },
  listStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  listStatusText: { fontSize: rf(11), fontWeight: '700' },
});
