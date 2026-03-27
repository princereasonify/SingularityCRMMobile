import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import { AlertTriangle, ExternalLink, X, MapPin, Search, CheckCircle } from 'lucide-react-native';
import { schoolsApi } from '../../api/schools';
import { School, DuplicateMatch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

// ─── Google Places API key (same key registered in AndroidManifest / Info.plist) ─
const GMAPS_KEY = 'AIzaSyA3RPOnKdaBqe-fL5Ou5zqstKwghO5BqL4';

// Match web app values exactly
const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'Other'];
const TYPES  = ['Private', 'Government', 'Franchise', 'Trust', 'Other'];

// Default map centre: Mumbai
const DEFAULT_REGION: Region = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

// ─── Google Places helpers ────────────────────────────────────────────────────
async function placesAutocomplete(input: string): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}` +
      `&types=establishment|geocode` +
      `&components=country:in` +
      `&key=${GMAPS_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.predictions ?? []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  } catch { return []; }
}

async function placeDetails(placeId: string): Promise<{
  lat: number; lng: number;
  address: string; city: string; state: string; pincode: string;
} | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=geometry,formatted_address,address_components` +
      `&key=${GMAPS_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const result = json.result;
    if (!result?.geometry) return null;

    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;
    const address = result.formatted_address ?? '';

    let city = '', state = '', pincode = '';
    for (const c of result.address_components ?? []) {
      if (c.types.includes('locality'))                    city    = c.long_name;
      if (c.types.includes('administrative_area_level_1')) state   = c.long_name;
      if (c.types.includes('postal_code'))                 pincode = c.long_name;
    }
    return { lat, lng, address, city, state, pincode };
  } catch { return null; }
}

async function textSearchSchool(name: string, address: string): Promise<{ lat: number; lng: number } | null> {
  const query = [name, address].filter(Boolean).join(' ');
  if (!query.trim()) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query)}` +
      `&type=school` +
      `&key=${GMAPS_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const first = json.results?.[0];
    if (!first?.geometry) return null;
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  } catch { return null; }
}

async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string; city: string; state: string; pincode: string;
}> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lng}` +
      `&key=${GMAPS_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const result = json.results?.[0];
    if (!result) return { address: '', city: '', state: '', pincode: '' };

    let city = '', state = '', pincode = '';
    for (const c of result.address_components ?? []) {
      if (c.types.includes('locality'))                    city    = c.long_name;
      if (c.types.includes('administrative_area_level_1')) state   = c.long_name;
      if (c.types.includes('postal_code'))                 pincode = c.long_name;
    }
    return { address: result.formatted_address ?? '', city, state, pincode };
  } catch { return { address: '', city: '', state: '', pincode: '' }; }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const AddSchoolScreen = ({ navigation, route }: any) => {
  const existing: School | undefined = route.params?.school;
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const isEdit = !!existing;
  const isFO = user?.role === 'FO';

  const mapRef = useRef<MapView>(null);

  // ── Form fields ──────────────────────────────────────────────────────────
  const [name, setName]               = useState(existing?.name ?? '');
  const [board, setBoard]             = useState(existing?.board ?? '');
  const [type, setType]               = useState(existing?.type ?? '');
  const [fullAddress, setFullAddress] = useState(existing?.fullAddress ?? '');
  const [city, setCity]               = useState(existing?.city ?? '');
  const [state, setState]             = useState(existing?.state ?? '');
  const [pincode, setPincode]         = useState(existing?.pincode ?? '');
  const [phone, setPhone]             = useState((existing as any)?.phone ?? '');
  const [email, setEmail]             = useState((existing as any)?.email ?? '');
  const [principalName, setPrincipalName] = useState(existing?.principalName ?? '');
  const [principalPhone, setPrincipalPhone] = useState(existing?.principalPhone ?? '');
  const [studentCount, setStudentCount]   = useState(existing?.studentCount?.toString() ?? '');
  const [staffCount, setStaffCount]       = useState((existing as any)?.staffCount?.toString() ?? '');
  const [visitDate, setVisitDate]         = useState('');

  // ── Map / location state ────────────────────────────────────────────────
  const [latitude, setLatitude]   = useState<number | null>(existing?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(existing?.longitude ?? null);
  const [locationSet, setLocationSet] = useState(!!(existing?.latitude));

  // ── Address search autocomplete ─────────────────────────────────────────
  const [searchText, setSearchText]           = useState('');
  const [suggestions, setSuggestions]         = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading]     = useState(false);
  const [findingOnMap, setFindingOnMap]       = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Duplicate detection ─────────────────────────────────────────────────
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDupModal, setShowDupModal] = useState(false);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // ── Debounced autocomplete ───────────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchText.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await placesAutocomplete(searchText);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearchLoading(false);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);

  // ── Debounced duplicate check ────────────────────────────────────────────
  useEffect(() => {
    if (isEdit || !name.trim()) { setDuplicates([]); return; }
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      try {
        const res = await schoolsApi.checkDuplicates(name.trim(), city || undefined);
        setDuplicates((res.data as any) ?? []);
      } catch { setDuplicates([]); }
    }, 600);
    return () => { if (dupTimer.current) clearTimeout(dupTimer.current); };
  }, [name, city, isEdit]);

  // ── Place a marker on the map ────────────────────────────────────────────
  const placeMarker = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationSet(true);
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500,
    );
  }, []);

  // ── Tap suggestion → fetch details → place marker ───────────────────────
  const handleSuggestionSelect = async (sug: PlaceSuggestion) => {
    setShowSuggestions(false);
    setSearchText(sug.description);
    const details = await placeDetails(sug.placeId);
    if (!details) return;
    setFullAddress(details.address);
    if (details.city)    setCity(details.city);
    if (details.state)   setState(details.state);
    if (details.pincode) setPincode(details.pincode);
    placeMarker(details.lat, details.lng);
  };

  // ── "Find on Map" button (name + address text search) ───────────────────
  const handleFindOnMap = async () => {
    if (!name.trim() && !searchText.trim()) return;
    setFindingOnMap(true);
    const coords = await textSearchSchool(name, searchText);
    if (coords) {
      placeMarker(coords.lat, coords.lng);
      // Reverse-geocode to fill address fields
      const geo = await reverseGeocode(coords.lat, coords.lng);
      if (!fullAddress && geo.address) setFullAddress(geo.address);
      if (!city    && geo.city)    setCity(geo.city);
      if (!state   && geo.state)   setState(geo.state);
      if (!pincode && geo.pincode) setPincode(geo.pincode);
    }
    setFindingOnMap(false);
  };

  // ── Map tap to set location ──────────────────────────────────────────────
  const handleMapPress = async (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    placeMarker(lat, lng);
    const geo = await reverseGeocode(lat, lng);
    if (geo.address) setFullAddress(geo.address);
    if (geo.city)    setCity(geo.city);
    if (geo.state)   setState(geo.state);
    if (geo.pincode) setPincode(geo.pincode);
  };

  // ── Marker drag end ──────────────────────────────────────────────────────
  const handleMarkerDragEnd = async (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLatitude(lat);
    setLongitude(lng);
    const geo = await reverseGeocode(lat, lng);
    if (geo.address) setFullAddress(geo.address);
    if (geo.city)    setCity(geo.city);
    if (geo.state)   setState(geo.state);
    if (geo.pincode) setPincode(geo.pincode);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const doSave = async () => {
    setSubmitting(true);
    try {
      const data: any = {
        name: name.trim(),
        board: board || undefined,
        type: type || undefined,
        city: city || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
        fullAddress: fullAddress || undefined,
        phone: phone || undefined,
        email: email || undefined,
        studentCount: studentCount ? parseInt(studentCount) : undefined,
        staffCount: staffCount ? parseInt(staffCount) : undefined,
        principalName: principalName || undefined,
        principalPhone: principalPhone || undefined,
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
        geofenceRadiusMeters: 100,
        // required by type
        category: type || 'Other',
      };
      let schoolId: number | undefined;
      if (isEdit) {
        await schoolsApi.update(existing!.id, data);
        schoolId = existing!.id;
      } else {
        const res = await schoolsApi.create(data);
        schoolId = (res.data as School).id;
      }
      // FO self-assign
      if (isFO && visitDate && schoolId && user?.id) {
        try {
          await schoolsApi.bulkAssign({ userId: user.id, schoolIds: [schoolId], assignmentDate: visitDate });
        } catch {}
      }
      navigation.goBack();
    } catch {}
    finally { setSubmitting(false); setShowDupModal(false); }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!locationSet) return;
    if (!isEdit && duplicates.length > 0) { setShowDupModal(true); return; }
    await doSave();
  };

  const DUP_COLORS: Record<string, string> = {
    Definite: '#DC2626', Probable: '#F59E0B', Possible: '#2563EB',
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={isEdit ? 'Edit School' : 'Add School'}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* ── Duplicate warning ──────────────────────────────────────── */}
        {!isEdit && duplicates.length > 0 && (
          <View style={styles.dupBanner}>
            <AlertTriangle size={15} color="#92400E" />
            <Text style={styles.dupBannerText}>
              {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        {/* ── School Name & Location ────────────────────────────────── */}
        <SectionCard label="School Name & Location">
          <FormField label="School Name *" value={name} onChange={setName} placeholder="e.g. St Kabir School" />

          {/* Address search with autocomplete */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Search Address / Area</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={14} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={t => { setSearchText(t); setShowSuggestions(true); }}
                  placeholder="Type area or address…"
                  placeholderTextColor="#9CA3AF"
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {searchLoading && <ActivityIndicator size="small" color={COLOR.primary} style={{ marginRight: 8 }} />}
              </View>
              <TouchableOpacity
                style={[styles.findBtn, { backgroundColor: COLOR.primary }, (!name.trim() && !searchText.trim()) && styles.findBtnDisabled]}
                onPress={handleFindOnMap}
                disabled={findingOnMap || (!name.trim() && !searchText.trim())}
              >
                {findingOnMap
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <><MapPin size={13} color="#FFF" /><Text style={styles.findBtnText}>Find</Text></>}
              </TouchableOpacity>
            </View>
            <Text style={styles.searchHint}>
              Enter school name above + area here, then tap <Text style={{ fontWeight: '700' }}>Find</Text> to pin on map. Or tap the map directly.
            </Text>

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map(s => (
                  <TouchableOpacity
                    key={s.placeId}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(s)}
                  >
                    <MapPin size={12} color="#9CA3AF" />
                    <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={
                latitude && longitude
                  ? { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
                  : DEFAULT_REGION
              }
              onPress={handleMapPress}
              showsCompass={false}
            >
              {latitude != null && longitude != null && (
                <>
                  <Circle
                    center={{ latitude, longitude }}
                    radius={100}
                    strokeColor="#0D9488"
                    strokeWidth={2}
                    fillColor="rgba(13,148,136,0.15)"
                  />
                  <Marker
                    coordinate={{ latitude, longitude }}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    tracksViewChanges={false}
                    pinColor="#0D9488"
                    title={name || 'School'}
                  />
                </>
              )}
            </MapView>

            {/* Location status badge */}
            <View style={[styles.mapBadge, locationSet ? styles.mapBadgeSet : styles.mapBadgeUnset]}>
              {locationSet ? (
                <>
                  <CheckCircle size={12} color="#16A34A" />
                  <Text style={styles.mapBadgeSetText}>
                    Location set · {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                  </Text>
                </>
              ) : (
                <>
                  <MapPin size={12} color="#D97706" />
                  <Text style={styles.mapBadgeUnsetText}>Tap map or search to set location</Text>
                </>
              )}
            </View>

            {/* Geofence legend */}
            {locationSet && (
              <View style={styles.geofenceLegend}>
                <View style={styles.geofenceDot} />
                <Text style={styles.geofenceLegendText}>100m geofence</Text>
              </View>
            )}
          </View>

          {/* City / State / Pincode — auto-filled from search */}
          <View style={styles.triRow}>
            <View style={{ flex: 1 }}>
              <FormField label="City" value={city} onChange={setCity} placeholder="Auto-filled" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="State" value={state} onChange={setState} placeholder="Auto-filled" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Pincode" value={pincode} onChange={setPincode} placeholder="Auto-filled" keyboardType="numeric" />
            </View>
          </View>
        </SectionCard>

        {/* ── School Details ────────────────────────────────────────── */}
        <SectionCard label="School Details">
          <PickerRow label="Board" options={BOARDS} value={board} onChange={setBoard} color={COLOR.primary} />
          <PickerRow label="Type"  options={TYPES}  value={type}  onChange={setType}  color={COLOR.primary} />
          <View style={styles.dualRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Student Count" value={studentCount} onChange={setStudentCount} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Staff Count" value={staffCount} onChange={setStaffCount} placeholder="0" keyboardType="numeric" />
            </View>
          </View>
        </SectionCard>

        {/* ── Contact Information ───────────────────────────────────── */}
        <SectionCard label="Contact Information">
          <View style={styles.dualRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Phone" value={phone} onChange={setPhone} placeholder="School phone" keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Email" value={email} onChange={setEmail} placeholder="School email" keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <View style={styles.dualRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Principal Name" value={principalName} onChange={setPrincipalName} placeholder="Name" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Principal Phone" value={principalPhone} onChange={setPrincipalPhone} placeholder="Phone" keyboardType="phone-pad" />
            </View>
          </View>
        </SectionCard>

        {/* ── FO Plan Visit ─────────────────────────────────────────── */}
        {isFO && !isEdit && (
          <SectionCard label="Plan Visit (Optional)">
            <Text style={styles.visitHint}>
              Select a date to add this school to your assigned schools for that day.
            </Text>
            <FormField
              label="Visit Date"
              value={visitDate}
              onChange={setVisitDate}
              placeholder="YYYY-MM-DD"
            />
          </SectionCard>
        )}

        <Button
          title={submitting ? 'Saving…' : isEdit ? 'Update School' : 'Create School'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting || !locationSet || !name.trim()}
          style={{ marginTop: 8 }}
        />
      </ScrollView>

      {/* ── Duplicate warning modal ────────────────────────────────── */}
      <Modal visible={showDupModal} transparent animationType="slide" onRequestClose={() => setShowDupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#F59E0B" />
                <Text style={styles.modalTitle}>Possible Duplicate</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDupModal(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {duplicates.map(d => (
              <View key={d.matchedEntityId} style={[styles.dupCard, { borderLeftColor: DUP_COLORS[d.matchType] || '#6B7280' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.dupName}>{d.matchedEntityName}</Text>
                  <View style={[styles.matchBadge, { backgroundColor: (DUP_COLORS[d.matchType] || '#6B7280') + '20' }]}>
                    <Text style={[styles.matchBadgeText, { color: DUP_COLORS[d.matchType] || '#6B7280' }]}>{d.matchType}</Text>
                  </View>
                </View>
                <Text style={styles.dupReason}>{d.matchReason}</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
                  onPress={() => { setShowDupModal(false); navigation.navigate('SchoolDetail', { schoolId: d.matchedEntityId }); }}
                >
                  <ExternalLink size={12} color={COLOR.primary} />
                  <Text style={[styles.viewExistingText, { color: COLOR.primary }]}>View Existing</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.modalActions}>
              <Button title="Create Anyway" onPress={doSave} disabled={submitting} variant="secondary" style={{ flex: 1 }} />
              <Button title="Cancel" onPress={() => setShowDupModal(false)} variant="primary" style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FormField = ({ label, value, onChange, placeholder, keyboardType, multiline, autoCapitalize }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
    />
  </View>
);

const PickerRow = ({ label, options, value, onChange, color }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.chipRow}>
      {options.map((opt: string) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && { backgroundColor: color }]}
          onPress={() => onChange(value === opt ? '' : opt)}
        >
          <Text style={[styles.chipText, value === opt && { color: '#FFF' }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{label}</Text>
    {children}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F9FAFB' },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: {
    fontSize: rf(13), fontWeight: '700', color: '#6B7280',
    marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  fieldGroup:  { marginBottom: 14 },
  fieldLabel:  { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '500' },

  dualRow:  { flexDirection: 'row', gap: 10 },
  triRow:   { flexDirection: 'row', gap: 8 },

  // Address search
  searchRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#FAFAFA', paddingHorizontal: 10,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827', paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  searchHint:  { fontSize: rf(11), color: '#9CA3AF', marginTop: 5 },

  findBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  findBtnDisabled: { opacity: 0.4 },
  findBtnText: { fontSize: rf(13), color: '#FFF', fontWeight: '600' },

  suggestionsBox: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
    marginTop: 2,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  suggestionText: { flex: 1, fontSize: rf(13), color: '#374151' },

  // Map
  mapContainer: {
    height: 300, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14,
    position: 'relative',
  },
  map: { flex: 1 },
  mapBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  mapBadgeSet:      { backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#BBF7D0' },
  mapBadgeUnset:    { backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: '#FDE68A' },
  mapBadgeSetText:  { fontSize: rf(11), fontWeight: '600', color: '#16A34A' },
  mapBadgeUnsetText:{ fontSize: rf(11), fontWeight: '600', color: '#D97706' },
  geofenceLegend: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  geofenceDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(13,148,136,0.3)', borderWidth: 1.5, borderColor: '#0D9488',
  },
  geofenceLegendText: { fontSize: rf(11), color: '#374151' },

  visitHint: { fontSize: rf(13), color: '#6B7280', marginBottom: 10, lineHeight: 18 },

  // Duplicate warning
  dupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12,
  },
  dupBannerText: { flex: 1, fontSize: rf(13), color: '#92400E', fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  dupCard: {
    borderLeftWidth: 4, backgroundColor: '#FAFAFA', borderRadius: 10,
    padding: 12, marginBottom: 10,
  },
  dupName:        { fontSize: rf(14), fontWeight: '700', color: '#111827', flex: 1 },
  matchBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  matchBadgeText: { fontSize: rf(11), fontWeight: '700' },
  dupReason:      { fontSize: rf(12), color: '#6B7280' },
  viewExistingText:{ fontSize: rf(13), fontWeight: '600' },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: 16 },
});
