import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, MapPin, Save, Home } from 'lucide-react-native';
import Geolocation from '@react-native-community/geolocation';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

export const HomeLocationScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [savedLat, setSavedLat] = useState<string | null>(null);
  const [savedLon, setSavedLon] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(async () => {
    try {
      const res = await authApi.getHomeLocation();
      const d = res.data as any;
      if (d?.homeLatitude && d?.homeLongitude) {
        setSavedLat(String(d.homeLatitude));
        setSavedLon(String(d.homeLongitude));
        setLatitude(String(d.homeLatitude));
        setLongitude(String(d.homeLongitude));
      } else if (d?.latitude && d?.longitude) {
        setSavedLat(String(d.latitude));
        setSavedLon(String(d.longitude));
        setLatitude(String(d.latitude));
        setLongitude(String(d.longitude));
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

  const detectLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required to detect your location.');
      return;
    }
    setDetecting(true);
    Geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setDetecting(false);
        Alert.alert('Location Detected', 'Your current location has been set. Tap Save to confirm.');
      },
      (error) => {
        setDetecting(false);
        Alert.alert('Error', error.message || 'Failed to detect location. Please try again or enter manually.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Error', 'Please enter valid latitude and longitude values.');
      return;
    }
    if (lat < -90 || lat > 90) {
      Alert.alert('Error', 'Latitude must be between -90 and 90.');
      return;
    }
    if (lon < -180 || lon > 180) {
      Alert.alert('Error', 'Longitude must be between -180 and 180.');
      return;
    }
    setSaving(true);
    try {
      await authApi.setHomeLocation(lat, lon);
      setSavedLat(latitude);
      setSavedLon(longitude);
      Alert.alert('Saved', 'Home location saved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save home location.');
    } finally {
      setSaving(false);
    }
  };

  const hasCoords = latitude.trim() !== '' && longitude.trim() !== '';

  if (loading) return <LoadingSpinner fullScreen color={COLOR.primary} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Home Location"
        color={COLOR.primary}
        onMenu={() => navigation.toggleDrawer()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Info Card */}
        <Card style={styles.section}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconWrap, { backgroundColor: COLOR.light || '#F0FDF4' }]}>
              <Home size={22} color={COLOR.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Set Home Location</Text>
              <Text style={styles.infoSub}>Search on map, use GPS, or enter manually</Text>
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

          {/* Manual Input */}
          <View style={styles.coordRow}>
            <Input
              label="Latitude"
              value={latitude}
              onChangeText={setLatitude}
              placeholder="e.g. 19.0760"
              keyboardType="numeric"
              accentColor={COLOR.primary}
              containerStyle={styles.coordInput}
            />
            <Input
              label="Longitude"
              value={longitude}
              onChangeText={setLongitude}
              placeholder="e.g. 72.8777"
              keyboardType="numeric"
              accentColor={COLOR.primary}
              containerStyle={styles.coordInput}
            />
          </View>

          {/* Save Button */}
          <Button
            title={saving ? 'Saving...' : 'Save Home Location'}
            onPress={handleSave}
            loading={saving}
            disabled={!hasCoords}
            color={COLOR.primary}
            size="lg"
            style={styles.saveBtn}
          />
        </Card>

        {/* Saved Location Info */}
        {savedLat && savedLon && (
          <Card style={styles.savedCard}>
            <View style={styles.savedRow}>
              <MapPin size={16} color="#16A34A" />
              <Text style={styles.savedText}>
                Saved: {Number(savedLat).toFixed(6)}, {Number(savedLon).toFixed(6)}
              </Text>
            </View>
            <Text style={styles.savedHint}>Geofence radius: 50 meters</Text>
          </Card>
        )}
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
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1,
  },
  gpsBtnText: { fontSize: rf(14), fontWeight: '600' },
  coordRow: { flexDirection: 'row', gap: 12 },
  coordInput: { flex: 1 },
  saveBtn: { marginTop: 4 },
  savedCard: {
    padding: 14, backgroundColor: '#F0FDF4',
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { fontSize: rf(13), fontWeight: '600', color: '#16A34A' },
  savedHint: { fontSize: rf(11), color: '#16A34A', marginTop: 4, marginLeft: 24 },
});
