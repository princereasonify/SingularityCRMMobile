import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation, MapPin, Home, Search, CheckCircle } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { AppHeader, Card } from '../../components/ui';
import { GradientButton } from '../../components/common/GradientButton';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

// Safe import — react-native-maps may not be configured on all setups
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

export const HomeLocationScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const mapRef = useRef<any>(null);

  // All hooks declared unconditionally at the top
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationSet, setLocationSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(async () => {
    try {
      const res = await authApi.getHomeLocation();
      const d = res.data as any;
      const lat = d?.homeLatitude ?? d?.latitude;
      const lon = d?.homeLongitude ?? d?.longitude;
      if (lat && lon) {
        const parsedLat = parseFloat(lat);
        const parsedLon = parseFloat(lon);
        setLatitude(parsedLat);
        setLongitude(parsedLon);
        setLocationSet(true);
        if (d?.address) setAddress(d.address);
        setTimeout(() => {
          mapRef.current?.animateToRegion(ZOOM_REGION(parsedLat, parsedLon), 500);
        }, 600);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

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

  const setLocation = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationSet(true);
    mapRef.current?.animateToRegion(ZOOM_REGION(lat, lng), 400);
  };

  const detectLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required.');
      return;
    }
    setDetecting(true);
    Geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude);
        setDetecting(false);
        const acc = position.coords.accuracy;
        Alert.alert(
          'Location Detected',
          acc && acc > 100
            ? 'Location detected (low accuracy). Tap on the map to refine.'
            : 'Your current location has been set. Tap Save to confirm.',
        );
      },
      (error) => {
        setDetecting(false);
        Alert.alert('Error', error.message || 'Failed to detect location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleMapPress = (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLocation(lat, lng);
  };

  const handleSave = async () => {
    if (latitude == null || longitude == null) {
      Alert.alert('Error', 'Please set your location first.');
      return;
    }
    setSaving(true);
    try {
      await authApi.setHomeLocation(latitude, longitude);
      Alert.alert('Saved', 'Home location saved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save home location.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen color={T.accent} />;

  return (
    <View style={[styles.safe, { backgroundColor: T.bg, paddingTop: insets.top }]}>
      <AppHeader
        title="Home Location"
        subtitle="Set your geofenced base"
        onMenu={() => navigation.toggleDrawer()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.inner, wide && styles.innerWide]}>
          <Card style={styles.section}>
            {/* Header */}
            <View style={styles.infoHeader}>
              <View style={[styles.infoIconWrap, { backgroundColor: T.accentSoft }]}>
                <Home size={22} color={T.accent} />
              </View>
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: T.text }]}>Set Home Location</Text>
                <Text style={[styles.infoSub, { color: T.sub }]}>Use GPS, tap the map, or search your address</Text>
              </View>
            </View>

            {/* Address Field */}
            <View>
              <Text style={[styles.fieldLabel, { color: T.sub }]}>Home Address</Text>
              <View style={[styles.searchBar, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
                <Search size={16} color={T.dim} />
                <TextInput
                  style={[styles.searchInput, { color: T.text }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Type your home address or area"
                  placeholderTextColor={T.dim}
                />
              </View>
            </View>

            {/* GPS Button */}
            <TouchableOpacity
              style={[styles.gpsBtn, { borderColor: T.accent + '30', backgroundColor: T.accentSoft }]}
              onPress={detectLocation}
              disabled={detecting}
              activeOpacity={0.7}
            >
              {detecting ? (
                <ActivityIndicator size="small" color={T.accent} />
              ) : (
                <Navigation size={18} color={T.accent} />
              )}
              <Text style={[styles.gpsBtnText, { color: T.accent }]}>
                {detecting ? 'Detecting...' : 'Use My Current Location'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Map */}
          {MapView ? (
            <Card padded={false} style={styles.mapCard}>
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={
                    latitude && longitude
                      ? ZOOM_REGION(latitude, longitude)
                      : DEFAULT_REGION
                  }
                  onPress={handleMapPress}
                  showsUserLocation
                  showsMyLocationButton={false}
                  mapType="standard"
                >
                  {locationSet && latitude != null && longitude != null && Circle && (
                    <Circle
                      center={{ latitude, longitude }}
                      radius={50}
                      fillColor={T.accentSoft}
                      strokeColor={T.accent}
                      strokeWidth={2}
                    />
                  )}
                  {locationSet && latitude != null && longitude != null && Marker && (
                    <Marker
                      coordinate={{ latitude, longitude }}
                      title="Home Location"
                      description="50m geofence"
                      pinColor={T.accent}
                    />
                  )}
                </MapView>

                {/* Status Overlay */}
                {locationSet && latitude != null && longitude != null ? (
                  <View style={[styles.mapBadge, { backgroundColor: T.card, borderColor: T.line }]}>
                    <CheckCircle size={14} color={T.success} />
                    <Text style={[styles.mapBadgeSetText, { color: T.success }]}>Location set</Text>
                    <Text style={[styles.mapBadgeCoords, { color: T.sub }]}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
                  </View>
                ) : (
                  <View style={[styles.mapBadge, { backgroundColor: T.card, borderColor: T.line }]}>
                    <MapPin size={14} color={T.warning} />
                    <Text style={[styles.mapBadgeNotSetText, { color: T.warning }]}>Tap on map or use GPS to set location</Text>
                  </View>
                )}

                {/* Geofence Legend */}
                {locationSet && (
                  <View style={[styles.geofenceLegend, { backgroundColor: T.card }]}>
                    <View style={[styles.geofenceDot, { backgroundColor: T.accentSoft, borderColor: T.accent }]} />
                    <Text style={[styles.geofenceLegendText, { color: T.sub }]}>50m geofence</Text>
                  </View>
                )}
              </View>
            </Card>
          ) : (
            <Card style={styles.mapFallback}>
              {locationSet && latitude != null && longitude != null ? (
                <>
                  <CheckCircle size={32} color={T.success} />
                  <Text style={[styles.infoTitle, { color: T.text, marginTop: 8 }]}>Location Set</Text>
                  <Text style={[styles.infoSub, { color: T.sub }]}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
                  <Text style={[styles.infoSub, { color: T.accent }]}>50m geofence active</Text>
                </>
              ) : (
                <>
                  <MapPin size={32} color={T.warning} />
                  <Text style={[styles.infoTitle, { color: T.text, marginTop: 8 }]}>Map unavailable</Text>
                  <Text style={[styles.infoSub, { color: T.sub }]}>Use GPS button above to set your location</Text>
                </>
              )}
            </Card>
          )}

          {/* Save */}
          <GradientButton
            label={saving ? 'Saving...' : 'Save Home Location'}
            onPress={handleSave}
            loading={saving}
            disabled={!locationSet}
          />

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  inner: { gap: 14 },
  innerWide: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  section: { padding: 16, gap: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoTitle: { fontFamily: Fonts.bold, fontSize: rf(15) },
  infoSub: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14), padding: 0 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  gpsBtnText: { fontFamily: Fonts.bold, fontSize: rf(14) },

  // Map
  mapCard: { overflow: 'hidden' },
  mapContainer: { position: 'relative' },
  map: { width: '100%', height: 350, borderRadius: 18 },

  // Map overlays
  mapBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  mapBadgeSetText: { fontFamily: Fonts.bold, fontSize: rf(11) },
  mapBadgeCoords: { fontFamily: Fonts.regular, fontSize: rf(11), marginLeft: 4 },
  mapBadgeNotSetText: { fontFamily: Fonts.bold, fontSize: rf(11) },
  geofenceLegend: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10,
  },
  geofenceDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1.5,
  },
  geofenceLegendText: { fontFamily: Fonts.regular, fontSize: rf(11) },
  mapFallback: {
    padding: 16, alignItems: 'center' as const, paddingVertical: 32,
  },
});
