import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Platform, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import { AlertTriangle, ExternalLink, X, MapPin, Search, CheckCircle, Upload } from 'lucide-react-native';
import { pick, types } from '@react-native-documents/picker';
import { schoolsApi } from '../../api/schools';
import { leadsApi } from '../../api/leads';
import { schoolAssignmentsApi } from '../../api/schoolAssignments';
import { School, DuplicateMatch, UserDto, BulkSchoolRow } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { GradientButton } from '../../components/common/GradientButton';
import { rf } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';

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
  const T = useAppTheme();
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

  // ── Bulk upload (create mode only) ──
  const [bulkRows, setBulkRows] = useState<BulkSchoolRow[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const bulkMapRef = useRef<MapView>(null);

  const handleBulkPick = async () => {
    try {
      const [file] = await pick({ type: [types.xlsx, types.xls, types.csv] });
      if (!file?.uri) return;
      setBulkLoading(true);
      const res = await schoolsApi.bulkUpload({
        uri: file.uri,
        name: file.name || 'schools.xlsx',
        type: file.type || 'application/octet-stream',
      });
      const result = res.data; // unwrapped by apiClient interceptor
      const rows = result?.rows || [];
      if (rows.length === 0) {
        Alert.alert('Nothing found', 'No school rows were found. Make sure the first row has a "Name" column.');
        return;
      }
      setBulkRows(rows);
    } catch (err: any) {
      // Picker cancellation isn't an error we surface.
      if (err?.message?.toLowerCase?.().includes('cancel')) return;
      Alert.alert('Upload failed', err?.response?.data?.message || 'Could not read the file.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSave = async () => {
    // Located, non-duplicate schools only (duplicates are also skipped server-side).
    const ready = (bulkRows || []).filter(r => r.geocoded && r.name?.trim() && !r.duplicateExisting);
    if (ready.length === 0) {
      Alert.alert('Nothing to save', 'No new schools to add — they were either not located or already exist.');
      return;
    }
    setBulkSaving(true);
    try {
      // Field names match the backend CreateSchoolRequest exactly (address,
      // geofenceRadiusMetres) — not the mobile single-create's fullAddress/category.
      const schools = ready.map(r => ({
        name: r.name,
        address: r.address,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        board: r.board,
        type: r.type,
        phone: r.phone,
        email: r.email,
        principalName: r.principalName,
        principalPhone: r.principalPhone,
        studentCount: r.studentCount ?? null,
        staffCount: r.staffCount ?? null,
        latitude: r.latitude,
        longitude: r.longitude,
        geofenceRadiusMetres: 100,
      }));
      const res = await schoolsApi.bulkCreate(schools);
      const created = res.data?.created ?? ready.length;
      const skipped = res.data?.skipped ?? 0;
      const msg = skipped > 0
        ? `${created} school(s) created.\n${skipped} skipped (already existed).`
        : `${created} school(s) created.`;
      Alert.alert('Done', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Save failed', err?.response?.data?.message || 'Could not create the schools.');
    } finally {
      setBulkSaving(false);
    }
  };

  // FO assignment fields
  const [assignToSelf, setAssignToSelf] = useState(true);
  const [zoneFOs, setZoneFOs] = useState<UserDto[]>([]);
  const [selectedFO, setSelectedFO] = useState<UserDto | null>(null);
  const [showFOPicker, setShowFOPicker] = useState(false);

  // ── Load zone FOs for FO role ─────────────────────────────────────────────
  useEffect(() => {
    if (isFO && !isEdit) {
      leadsApi.getAssignableFOs()
        .then(res => {
          const d: any = res.data;
          const fos = Array.isArray(d) ? d : d?.items ?? d?.users ?? [];
          setZoneFOs(fos.filter((f: UserDto) => f.id !== user?.id));
        })
        .catch(() => {});
    }
  }, [isFO, isEdit]);

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
      // FO assignment — self or other FO in zone
      if (isFO && visitDate && schoolId) {
        try {
          const assignToUserId = assignToSelf ? user!.id : (selectedFO?.id ?? user!.id);
          await schoolAssignmentsApi.bulkAssign({
            userId: assignToUserId,
            schoolIds: [schoolId],
            assignmentDate: visitDate,
          });
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
    Definite: T.danger, Probable: T.warning, Possible: T.info,
  };

  const styles = makeStyles(T);

  // ── Bulk preview mode ──
  if (bulkRows) {
    const located = bulkRows.filter(r => r.geocoded);
    const savable = bulkRows.filter(r => r.geocoded && !r.duplicateExisting);
    const issues = bulkRows.filter(r => r.error);
    const dupes = bulkRows.filter(r => r.duplicateExisting);
    const fitCoords = located.map(r => ({ latitude: Number(r.latitude), longitude: Number(r.longitude) }));

    // Group the problem rows by reason for a clean message.
    const reasonGroups = Object.entries(
      issues.reduce((acc: Record<string, number>, r) => {
        const k = r.error || 'Could not be added';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    );
    const linkColumnMissing =
      bulkRows.length > 0 && located.length === 0 &&
      issues.every(r => r.error === 'Google Maps link is required');

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScreenHeader title="Bulk Upload" color={T.accent} onBack={() => setBulkRows(null)} />

        {/* Summary chips */}
        <View style={styles.bulkSummary}>
          <View style={[styles.bulkChip, { backgroundColor: T.success + '22' }]}>
            <CheckCircle size={13} color={T.success} />
            <Text style={[styles.bulkChipText, { color: T.success }]}>{savable.length} ready</Text>
          </View>
          {issues.length > 0 && (
            <View style={[styles.bulkChip, { backgroundColor: T.danger + '22' }]}>
              <AlertTriangle size={13} color={T.danger} />
              <Text style={[styles.bulkChipText, { color: T.danger }]}>{issues.length} need attention</Text>
            </View>
          )}
          {dupes.length > 0 && (
            <View style={[styles.bulkChip, { backgroundColor: T.warning + '22' }]}>
              <AlertTriangle size={13} color={T.warning} />
              <Text style={[styles.bulkChipText, { color: T.warning }]}>{dupes.length} already added</Text>
            </View>
          )}
        </View>

        {/* Issues — clear, grouped message */}
        {issues.length > 0 && (
          <View style={styles.bulkIssues}>
            <View style={styles.bulkIssuesHead}>
              <AlertTriangle size={14} color={T.danger} />
              <Text style={styles.bulkIssuesTitle}>
                {issues.length} school{issues.length > 1 ? 's' : ''} can’t be added yet
              </Text>
            </View>
            {linkColumnMissing && (
              <Text style={styles.bulkIssuesHint}>
                No location was found for any row. Make sure your file has a “Google Map Link” column with a real
                Google Maps link in each cell.
              </Text>
            )}
            {reasonGroups.map(([reason, count]) => (
              <Text key={reason} style={styles.bulkIssuesReason}>• {reason}  ({count})</Text>
            ))}
            <Text style={styles.bulkIssuesFoot}>
              Fix these rows and re-upload, or save the {located.length} valid one{located.length === 1 ? '' : 's'}.
            </Text>
          </View>
        )}

        {/* Map of located schools */}
        <View style={styles.bulkMapWrap}>
          <MapView
            ref={bulkMapRef}
            style={styles.map}
            initialRegion={fitCoords[0] ? { ...fitCoords[0], latitudeDelta: 0.5, longitudeDelta: 0.5 } : DEFAULT_REGION}
            onMapReady={() => {
              if (fitCoords.length > 0) {
                bulkMapRef.current?.fitToCoordinates(fitCoords, {
                  edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                  animated: false,
                });
              }
            }}
          >
            {located.map((r, i) => (
              <Marker
                key={i}
                coordinate={{ latitude: Number(r.latitude), longitude: Number(r.longitude) }}
                title={r.name}
                description={r.city || undefined}
                pinColor={r.duplicateExisting ? T.warning : T.accent}
                tracksViewChanges={false}
              />
            ))}
          </MapView>
        </View>

        {/* Reviewable list */}
        <FlatList
          data={bulkRows}
          keyExtractor={(_, i) => String(i)}
          style={styles.bulkList}
          renderItem={({ item }) => (
            <View style={styles.bulkRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bulkRowName} numberOfLines={1}>{item.name || '(no name)'}</Text>
                <Text style={styles.bulkRowSub} numberOfLines={1}>{item.city || item.address || '—'}</Text>
              </View>
              <Text
                style={[
                  styles.bulkRowStatus,
                  { color: item.geocoded ? (item.duplicateExisting ? T.warning : T.success) : T.danger },
                ]}
              >
                {item.geocoded
                  ? (item.duplicateExisting ? 'Already added' : (item.source === 'link' ? 'Pinned' : 'Located'))
                  : 'Not located'}
              </Text>
            </View>
          )}
        />

        {/* Actions */}
        <View style={styles.bulkActions}>
          <Text style={styles.bulkHint}>
            {savable.length} new school{savable.length === 1 ? '' : 's'} will be saved
            {dupes.length > 0 ? ` · ${dupes.length} already exist` : ''}.
          </Text>
          <GradientButton
            label={bulkSaving ? 'Saving…' : `Save All (${savable.length})`}
            onPress={handleBulkSave}
            loading={bulkSaving}
            disabled={bulkSaving || savable.length === 0}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title={isEdit ? 'Edit School' : 'Add School'}
        color={T.accent}
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
            <AlertTriangle size={15} color={T.warning} />
            <Text style={styles.dupBannerText}>
              {duplicates.length} possible duplicate{duplicates.length > 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        {/* ── Bulk upload (create mode only) ──────────────────────────── */}
        {!isEdit && (
          <TouchableOpacity
            style={[styles.bulkUploadBtn, { borderColor: T.accent }]}
            onPress={handleBulkPick}
            disabled={bulkLoading}
            activeOpacity={0.8}
          >
            {bulkLoading ? (
              <ActivityIndicator size="small" color={T.accent} />
            ) : (
              <Upload size={16} color={T.accent} />
            )}
            <Text style={[styles.bulkUploadText, { color: T.accent }]}>
              {bulkLoading ? 'Reading file…' : 'Bulk Upload (Excel / CSV)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── School Name & Location ────────────────────────────────── */}
        <SectionCard label="School Name & Location">
          <FormField label="School Name *" value={name} onChange={setName} placeholder="e.g. St Kabir School" />

          {/* Address search with autocomplete */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Search Address / Area</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Search size={14} color={T.dim} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={t => { setSearchText(t); setShowSuggestions(true); }}
                  placeholder="Type area or address…"
                  placeholderTextColor={T.dim}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {searchLoading && <ActivityIndicator size="small" color={T.accent} style={{ marginRight: 8 }} />}
              </View>
              <TouchableOpacity
                style={[styles.findBtn, { backgroundColor: T.accent }, (!name.trim() && !searchText.trim()) && styles.findBtnDisabled]}
                onPress={handleFindOnMap}
                disabled={findingOnMap || (!name.trim() && !searchText.trim())}
              >
                {findingOnMap
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <><MapPin size={13} color="#FFF" /><Text style={styles.findBtnText}>Find</Text></>}
              </TouchableOpacity>
            </View>
            <Text style={styles.searchHint}>
              Enter school name above + area here, then tap <Text style={{ fontFamily: Fonts.bold }}>Find</Text> to pin on map. Or tap the map directly.
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
                    <MapPin size={12} color={T.dim} />
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
                    strokeColor={T.accent}
                    strokeWidth={2}
                    fillColor={T.accent + '26'}
                  />
                  <Marker
                    coordinate={{ latitude, longitude }}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    tracksViewChanges={false}
                    pinColor={T.accent}
                    title={name || 'School'}
                  />
                </>
              )}
            </MapView>

            {/* Location status badge */}
            <View style={[styles.mapBadge, locationSet ? styles.mapBadgeSet : styles.mapBadgeUnset]}>
              {locationSet ? (
                <>
                  <CheckCircle size={12} color={T.success} />
                  <Text style={styles.mapBadgeSetText}>
                    Location set · {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                  </Text>
                </>
              ) : (
                <>
                  <MapPin size={12} color={T.warning} />
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
          <PickerRow label="Board" options={BOARDS} value={board} onChange={setBoard} color={T.accent} />
          <PickerRow label="Type"  options={TYPES}  value={type}  onChange={setType}  color={T.accent} />
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

        {/* ── FO Plan Visit & Assignment ─────────────────────────── */}
        {isFO && !isEdit && (
          <SectionCard label="Plan Visit & Assign (Optional)">
            <Text style={styles.visitHint}>
              Select a date to assign this school and auto-create a lead.
            </Text>

            {/* Assign toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Assign To</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, assignToSelf && { backgroundColor: T.accent, borderColor: T.accent }]}
                  onPress={() => { setAssignToSelf(true); setSelectedFO(null); }}
                >
                  <Text style={[styles.chipText, assignToSelf && { color: '#FFF' }]}>Myself</Text>
                </TouchableOpacity>
                {zoneFOs.length > 0 && (
                  <TouchableOpacity
                    style={[styles.chip, !assignToSelf && { backgroundColor: T.accent, borderColor: T.accent }]}
                    onPress={() => setAssignToSelf(false)}
                  >
                    <Text style={[styles.chipText, !assignToSelf && { color: '#FFF' }]}>Another FO</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* FO Picker */}
            {!assignToSelf && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Select FO *</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setShowFOPicker(true)}
                >
                  <Text style={{ fontFamily: Fonts.regular, fontSize: rf(14), color: selectedFO ? T.text : T.dim }}>
                    {selectedFO ? selectedFO.name : 'Tap to select FO…'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <FormField
              label="Visit Date"
              value={visitDate}
              onChange={setVisitDate}
              placeholder="YYYY-MM-DD"
            />
          </SectionCard>
        )}

        {/* FO Picker Modal */}
        {isFO && !isEdit && !assignToSelf && (
          <Modal visible={showFOPicker} transparent animationType="slide" onRequestClose={() => setShowFOPicker(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select FO in Zone</Text>
                  <TouchableOpacity onPress={() => setShowFOPicker(false)}>
                    <X size={20} color={T.sub} />
                  </TouchableOpacity>
                </View>
                {zoneFOs.map(fo => (
                  <TouchableOpacity
                    key={fo.id}
                    style={styles.dupCard}
                    onPress={() => { setSelectedFO(fo); setShowFOPicker(false); }}
                  >
                    <Text style={styles.dupName}>{fo.name}</Text>
                    {fo.zone && <Text style={styles.dupReason}>{fo.zone}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>
        )}

        <GradientButton
          label={submitting ? 'Saving…' : isEdit ? 'Update School' : 'Create School'}
          onPress={handleSubmit}
          loading={submitting}
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
                <AlertTriangle size={18} color={T.warning} />
                <Text style={styles.modalTitle}>Possible Duplicate</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDupModal(false)}>
                <X size={20} color={T.sub} />
              </TouchableOpacity>
            </View>
            {duplicates.map(d => (
              <View key={d.matchedEntityId} style={[styles.dupCard, { borderLeftColor: DUP_COLORS[d.matchType] || T.sub }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.dupName}>{d.matchedEntityName}</Text>
                  <View style={[styles.matchBadge, { backgroundColor: (DUP_COLORS[d.matchType] || T.sub) + '20' }]}>
                    <Text style={[styles.matchBadgeText, { color: DUP_COLORS[d.matchType] || T.sub }]}>{d.matchType}</Text>
                  </View>
                </View>
                <Text style={styles.dupReason}>{d.matchReason}</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
                  onPress={() => { setShowDupModal(false); navigation.navigate('SchoolDetail', { schoolId: d.matchedEntityId }); }}
                >
                  <ExternalLink size={12} color={T.accent} />
                  <Text style={[styles.viewExistingText, { color: T.accent }]}>View Existing</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.modalActions}>
              <Button title="Create Anyway" onPress={doSave} disabled={submitting} variant="secondary" color={T.accent} style={{ flex: 1 }} />
              <Button title="Cancel" onPress={() => setShowDupModal(false)} variant="primary" color={T.accent} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FormField = ({ label, value, onChange, placeholder, keyboardType, multiline, autoCapitalize }: any) => {
  const T = useAppTheme();
  const styles = makeStyles(T);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.dim}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
      />
    </View>
  );
};

const PickerRow = ({ label, options, value, onChange, color }: any) => {
  const T = useAppTheme();
  const styles = makeStyles(T);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && { backgroundColor: color, borderColor: color }]}
            onPress={() => onChange(value === opt ? '' : opt)}
          >
            <Text style={[styles.chipText, value === opt && { color: '#FFF' }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const T = useAppTheme();
  const styles = makeStyles(T);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      {children}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (T: AppTheme) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: T.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Bulk upload
  bulkUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.card, borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 14,
  },
  bulkUploadText: { fontFamily: Fonts.bold, fontSize: rf(14) },
  bulkSummary: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, flexWrap: 'wrap' },
  bulkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  bulkChipText: { fontFamily: Fonts.bold, fontSize: rf(12) },
  bulkMapWrap: { height: 240, margin: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: T.line },
  bulkList: { flex: 1, marginHorizontal: 16 },
  bulkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: T.line,
  },
  bulkRowName: { fontFamily: Fonts.medium, fontSize: rf(14), color: T.text },
  bulkRowSub: { fontFamily: Fonts.regular, fontSize: rf(12), color: T.sub, marginTop: 2 },
  bulkRowStatus: { fontFamily: Fonts.bold, fontSize: rf(12) },
  bulkIssues: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: T.danger + '1A',
    borderWidth: 1,
    borderColor: T.danger + '55',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  bulkIssuesHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  bulkIssuesTitle: { fontFamily: Fonts.bold, fontSize: rf(13), color: T.danger, flex: 1 },
  bulkIssuesHint: { fontFamily: Fonts.regular, fontSize: rf(12), color: T.danger, lineHeight: 17, marginBottom: 2 },
  bulkIssuesReason: { fontFamily: Fonts.medium, fontSize: rf(12), color: T.danger },
  bulkIssuesFoot: { fontFamily: Fonts.regular, fontSize: rf(11), color: T.danger, opacity: 0.75, marginTop: 3 },
  bulkActions: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.card },
  bulkHint: { fontFamily: Fonts.regular, fontSize: rf(12), color: T.sub, textAlign: 'center' },

  card: {
    backgroundColor: T.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: T.line,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 1 },
    }),
  },
  cardTitle: {
    fontFamily: Fonts.bold, fontSize: rf(12), color: T.sub,
    marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1,
  },

  fieldGroup:  { marginBottom: 14 },
  fieldLabel:  { fontFamily: Fonts.medium, fontSize: rf(13), color: T.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: T.line, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: Fonts.regular, fontSize: rf(14), color: T.text, backgroundColor: T.fieldBg,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: T.cardAlt, borderWidth: 1, borderColor: T.line,
  },
  chipText: { fontFamily: Fonts.medium, fontSize: rf(13), color: T.sub },

  dualRow:  { flexDirection: 'row', gap: 10 },
  triRow:   { flexDirection: 'row', gap: 8 },

  // Address search
  searchRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: T.line, borderRadius: 14,
    backgroundColor: T.fieldBg, paddingHorizontal: 10,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14), color: T.text, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  searchHint:  { fontFamily: Fonts.regular, fontSize: rf(11), color: T.dim, marginTop: 5 },

  findBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  findBtnDisabled: { opacity: 0.4 },
  findBtnText: { fontFamily: Fonts.medium, fontSize: rf(13), color: '#FFF' },

  suggestionsBox: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
    marginTop: 2,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.line,
  },
  suggestionText: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(13), color: T.text },

  // Map
  mapContainer: {
    height: 300, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: T.line, marginBottom: 14,
    position: 'relative',
  },
  map: { flex: 1 },
  mapBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  mapBadgeSet:      { backgroundColor: T.card, borderWidth: 1, borderColor: T.success + '66' },
  mapBadgeUnset:    { backgroundColor: T.card, borderWidth: 1, borderColor: T.warning + '66' },
  mapBadgeSetText:  { fontFamily: Fonts.medium, fontSize: rf(11), color: T.success },
  mapBadgeUnsetText:{ fontFamily: Fonts.medium, fontSize: rf(11), color: T.warning },
  geofenceLegend: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.card, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  geofenceDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: T.accent + '4D', borderWidth: 1.5, borderColor: T.accent,
  },
  geofenceLegendText: { fontFamily: Fonts.regular, fontSize: rf(11), color: T.text },

  visitHint: { fontFamily: Fonts.regular, fontSize: rf(13), color: T.sub, marginBottom: 10, lineHeight: 18 },

  // Duplicate warning
  dupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.warning + '22', borderRadius: 14, padding: 12,
  },
  dupBannerText: { flex: 1, fontFamily: Fonts.medium, fontSize: rf(13), color: T.warning },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: T.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:  { fontFamily: Fonts.bold, fontSize: rf(16), color: T.text },
  dupCard: {
    borderLeftWidth: 4, backgroundColor: T.cardAlt, borderRadius: 14,
    padding: 12, marginBottom: 10,
  },
  dupName:        { fontFamily: Fonts.bold, fontSize: rf(14), color: T.text, flex: 1 },
  matchBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  matchBadgeText: { fontFamily: Fonts.bold, fontSize: rf(11) },
  dupReason:      { fontFamily: Fonts.regular, fontSize: rf(12), color: T.sub },
  viewExistingText:{ fontFamily: Fonts.medium, fontSize: rf(13) },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: 16 },
});
