import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { schoolsApi } from '../../api/schools';
import { School } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const CATEGORIES = ['Government', 'Private', 'Trust', 'International', 'Other'];
const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'Other'];
const TYPES = ['Primary', 'Secondary', 'Higher Secondary', 'K-12', 'Pre-School'];

export const AddSchoolScreen = ({ navigation, route }: any) => {
  const existing: School | undefined = route.params?.school;
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [board, setBoard] = useState(existing?.board ?? '');
  const [type, setType] = useState(existing?.type ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [pincode, setPincode] = useState(existing?.pincode ?? '');
  const [fullAddress, setFullAddress] = useState(existing?.fullAddress ?? '');
  const [studentCount, setStudentCount] = useState(existing?.studentCount?.toString() ?? '');
  const [principalName, setPrincipalName] = useState(existing?.principalName ?? '');
  const [principalPhone, setPrincipalPhone] = useState(existing?.principalPhone ?? '');
  const [latitude, setLatitude] = useState(existing?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(existing?.longitude?.toString() ?? '');
  const [geofenceRadius, setGeofenceRadius] = useState(existing?.geofenceRadiusMeters?.toString() ?? '200');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'School name is required'); return; }
    if (!category) { Alert.alert('Validation', 'Category is required'); return; }
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (latitude && isNaN(lat)) { Alert.alert('Validation', 'Invalid latitude'); return; }
    if (longitude && isNaN(lon)) { Alert.alert('Validation', 'Invalid longitude'); return; }

    setSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        board: board || undefined,
        type: type || undefined,
        category,
        city: city || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
        fullAddress: fullAddress || undefined,
        studentCount: studentCount ? parseInt(studentCount) : undefined,
        principalName: principalName || undefined,
        principalPhone: principalPhone || undefined,
        latitude: lat || 0,
        longitude: lon || 0,
        geofenceRadiusMeters: parseInt(geofenceRadius) || 200,
      };
      if (isEdit) {
        await schoolsApi.update(existing!.id, data);
      } else {
        await schoolsApi.create(data);
      }
      Alert.alert('Success', isEdit ? 'School updated' : 'School added');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save school. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const PickerRow = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && { backgroundColor: COLOR.primary }]}
            onPress={() => onChange(value === opt ? '' : opt)}
          >
            <Text style={[styles.chipText, value === opt && { color: '#FFF' }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={isEdit ? 'Edit School' : 'Add School'}
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card label="Basic Information">
          <Field label="School Name *" value={name} onChange={setName} placeholder="Full school name" />
          <PickerRow label="Category *" options={CATEGORIES} value={category} onChange={setCategory} />
          <PickerRow label="Board" options={BOARDS} value={board} onChange={setBoard} />
          <PickerRow label="Type" options={TYPES} value={type} onChange={setType} />
        </Card>

        <Card label="Location">
          <Field label="Full Address" value={fullAddress} onChange={setFullAddress} placeholder="Street address" multiline />
          <Field label="City" value={city} onChange={setCity} placeholder="City" />
          <Field label="State" value={state} onChange={setState} placeholder="State" />
          <Field label="Pincode" value={pincode} onChange={setPincode} placeholder="Pincode" keyboardType="numeric" />
          <Field label="Latitude" value={latitude} onChange={setLatitude} placeholder="e.g. 19.0760" keyboardType="decimal-pad" />
          <Field label="Longitude" value={longitude} onChange={setLongitude} placeholder="e.g. 72.8777" keyboardType="decimal-pad" />
          <Field label="Geofence Radius (meters)" value={geofenceRadius} onChange={setGeofenceRadius} placeholder="200" keyboardType="numeric" />
        </Card>

        <Card label="Principal Details">
          <Field label="Principal Name" value={principalName} onChange={setPrincipalName} placeholder="Principal's name" />
          <Field label="Principal Phone" value={principalPhone} onChange={setPrincipalPhone} placeholder="Phone number" keyboardType="phone-pad" />
        </Card>

        <Card label="Other Details">
          <Field label="Student Count" value={studentCount} onChange={setStudentCount} placeholder="Number of students" keyboardType="numeric" />
        </Card>

        <Button
          title={submitting ? 'Saving...' : isEdit ? 'Update School' : 'Add School'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline, keyboardType }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

const Card = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: rf(13), fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
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
});
