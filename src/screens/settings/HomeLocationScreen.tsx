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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, MapPin, Home, Search, CheckCircle } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
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

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title="Home Location"
        color={COLOR.primary}
        onMenu={() => navigation.toggleDrawer()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} nestedScrollEnabled>
        <Card style={styles.section}>
          {/* Header */}
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconWrap, { backgroundColor: COLOR.light || '#F0FDF4' }]}>
              <Home size={22} color={COLOR.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Set Home Location</Text>
              <Text style={styles.infoSub}>Use GPS, tap the map, or search your address</Text>
            </View>
          </View>

          {/* Address Field */}
          <View>
            <Text style={styles.fieldLabel}>Home Address</Text>
            <View style={styles.searchBar}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Type your home address or area"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* GPS Button */}
          <TouchableOpacity
            style={[styles.gpsBtn, { borderColor: COLOR.primary + '30', backgroundColor: COLOR.light || '#F0FDF4' }]}
            onPress={detectLocation}
            disabled={detecting}
            activeOpacity={0.7}
          >
            {detecting ? (
              <ActivityIndicator size="small" color={COLOR.primary} />
            ) : (
              <Navigation size={18} color={COLOR.primary} />
            )}
            <Text style={[styles.gpsBtnText, { color: COLOR.primary }]}>
              {detecting ? 'Detecting...' : 'Use My Current Location'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Map */}
        {MapView ? (
          <Card style={styles.mapCard}>
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
                    fillColor="rgba(13,148,136,0.15)"
                    strokeColor="rgba(13,148,136,0.6)"
                    strokeWidth={2}
                  />
                )}
                {locationSet && latitude != null && longitude != null && Marker && (
                  <Marker
                    coordinate={{ latitude, longitude }}
                    title="Home Location"
                    description="50m geofence"
                    pinColor="#0d9488"
                  />
                )}
              </MapView>

              {/* Status Overlay */}
              {locationSet && latitude != null && longitude != null ? (
                <View style={styles.mapBadgeSet}>
                  <CheckCircle size={14} color="#16A34A" />
                  <Text style={styles.mapBadgeSetText}>Location set</Text>
                  <Text style={styles.mapBadgeCoords}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
                </View>
              ) : (
                <View style={styles.mapBadgeNotSet}>
                  <MapPin size={14} color="#D97706" />
                  <Text style={styles.mapBadgeNotSetText}>Tap on map or use GPS to set location</Text>
                </View>
              )}

              {/* Geofence Legend */}
              {locationSet && (
                <View style={styles.geofenceLegend}>
                  <View style={styles.geofenceDot} />
                  <Text style={styles.geofenceLegendText}>50m geofence</Text>
                </View>
              )}
            </View>
          </Card>
        ) : (
          <Card style={styles.mapFallback}>
            {locationSet && latitude != null && longitude != null ? (
              <>
                <CheckCircle size={32} color="#16A34A" />
                <Text style={[styles.infoTitle, { marginTop: 8 }]}>Location Set</Text>
                <Text style={styles.infoSub}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
                <Text style={[styles.infoSub, { color: '#0D9488', fontWeight: '600' }]}>50m geofence active</Text>
              </>
            ) : (
              <>
                <MapPin size={32} color="#D97706" />
                <Text style={[styles.infoTitle, { marginTop: 8 }]}>Map unavailable</Text>
                <Text style={styles.infoSub}>Use GPS button above to set your location</Text>
              </>
            )}
          </Card>
        )}

        {/* Save */}
        <Button
          title={saving ? 'Saving...' : 'Save Home Location'}
          onPress={handleSave}
          loading={saving}
          disabled={!locationSet}
          color={COLOR.primary}
          size="lg"
        />

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  section: { padding: 16, gap: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoTitle: { fontSize: rf(15), fontWeight: '700', color: '#111827' },
  infoSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827', padding: 0 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  gpsBtnText: { fontSize: rf(14), fontWeight: '600' },

  // Map
  mapCard: { padding: 0, overflow: 'hidden' },
  mapContainer: { position: 'relative' },
  map: { width: '100%', height: 350, borderRadius: 16 },

  // Map overlays
  mapBadgeSet: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  mapBadgeSetText: { fontSize: rf(11), fontWeight: '700', color: '#16A34A' },
  mapBadgeCoords: { fontSize: rf(11), color: '#6B7280', marginLeft: 4 },
  mapBadgeNotSet: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A',
  },
  mapBadgeNotSetText: { fontSize: rf(11), fontWeight: '700', color: '#92400E' },
  geofenceLegend: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  geofenceDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(13,148,136,0.3)',
    borderWidth: 1.5, borderColor: '#0D9488',
  },
  geofenceLegendText: { fontSize: rf(11), color: '#6B7280' },
  mapFallback: {
    padding: 16, alignItems: 'center' as const, paddingVertical: 32,
  },
});
