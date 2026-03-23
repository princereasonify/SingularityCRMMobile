import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { demosApi } from '../../api/demos';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const MODES = ['Online', 'Offline', 'Hybrid'];

export const AssignDemoScreen = ({ navigation, route }: any) => {
  const { leadId, schoolName: schoolNameParam } = route.params ?? {};
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mode, setMode] = useState('Online');
  const [meetingLink, setMeetingLink] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!scheduledDate || !startTime || !endTime) {
      Alert.alert('Validation', 'Date and time are required');
      return;
    }
    if (!schoolId && !leadId) {
      Alert.alert('Validation', 'School or Lead is required');
      return;
    }
    setSubmitting(true);
    try {
      await demosApi.create({
        leadId: parseInt(leadId) || 0,
        schoolId: parseInt(schoolId) || 0,
        assignedToId: parseInt(assignedToId) || 0,
        scheduledDate,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        demoMode: mode,
        meetingLink: (mode !== 'Offline' && meetingLink) ? meetingLink : undefined,
        notes: notes || undefined,
      });
      Alert.alert('Success', 'Demo assigned successfully');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to assign demo. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Assign Demo" color={COLOR.primary} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {schoolNameParam && (
          <View style={[styles.schoolBanner, { backgroundColor: COLOR.light }]}>
            <Text style={[styles.schoolBannerText, { color: COLOR.primary }]}>🏫 {schoolNameParam}</Text>
          </View>
        )}
        {!schoolNameParam && (
          <SectionCard label="School & Lead">
            <Field label="Lead ID" value={leadId?.toString() ?? ''} onChange={() => {}} placeholder="Lead ID" keyboardType="numeric" editable={false} />
            <Field label="School ID" value={schoolId} onChange={setSchoolId} placeholder="School ID (numeric)" keyboardType="numeric" />
          </SectionCard>
        )}

        <SectionCard label="Schedule">
          <Field label="Date (YYYY-MM-DD) *" value={scheduledDate} onChange={setScheduledDate} placeholder="2024-12-25" />
          <Field label="Start Time (HH:MM) *" value={startTime} onChange={setStartTime} placeholder="10:00" />
          <Field label="End Time (HH:MM) *" value={endTime} onChange={setEndTime} placeholder="11:00" />
        </SectionCard>

        <SectionCard label="Demo Mode">
          <View style={styles.chipRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mode === m && { backgroundColor: COLOR.primary }]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.chipText, mode === m && { color: '#FFF' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode !== 'Offline' && (
            <Field label="Meeting Link" value={meetingLink} onChange={setMeetingLink} placeholder="https://..." keyboardType="url" />
          )}
        </SectionCard>

        <SectionCard label="Assignment">
          <Field label="Assign To (User ID)" value={assignedToId} onChange={setAssignedToId} placeholder="User ID" keyboardType="numeric" />
          <Field label="Notes" value={notes} onChange={setNotes} placeholder="Additional notes..." multiline />
        </SectionCard>

        <Button
          title={submitting ? 'Assigning...' : 'Assign Demo'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline, keyboardType, editable = true }: any) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputMulti, !editable && styles.inputDisabled]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      keyboardType={keyboardType || 'default'}
      editable={editable}
    />
  </View>
);

const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  schoolBanner: { borderRadius: 12, padding: 12 },
  schoolBannerText: { fontSize: rf(14), fontWeight: '600' },
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
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '600' },
});
