import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronDown, X, Calendar, Clock, User, School } from 'lucide-react-native';
import { demosApi } from '../../api/demos';
import { schoolsApi } from '../../api/schools';
import { leadsApi } from '../../api/leads';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { Button } from '../../components/common/Button';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

const MODES = ['Offline', 'Online', 'Hybrid'];

// ─── Picker Modal ──────────────────────────────────────────────────────────────
const PickerModal = ({
  visible, title, items, labelKey, sublabelKey, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  items: any[];
  labelKey: string;
  sublabelKey?: string;
  onSelect: (item: any) => void;
  onClose: () => void;
}) => {
  const [search, setSearch] = useState('');

  const safeItems = Array.isArray(items) ? items : [];
  const filtered = safeItems.filter(i =>
    String(i[labelKey] || '').toLowerCase().includes(search.toLowerCase()) ||
    (sublabelKey && String(i[sublabelKey] || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={pickerStyles.searchBar}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              style={pickerStyles.searchInput}
              placeholder={`Search ${title.toLowerCase()}...`}
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={14} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            style={{ flexShrink: 1 }}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={pickerStyles.item}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={pickerStyles.itemLabel} numberOfLines={1}>{item[labelKey]}</Text>
                {sublabelKey && item[sublabelKey] ? (
                  <Text style={pickerStyles.itemSub} numberOfLines={1}>{item[sublabelKey]}</Text>
                ) : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={pickerStyles.empty}>
                <Text style={pickerStyles.emptyText}>No results found</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
};

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
  item: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  itemLabel: { fontSize: rf(14), color: '#111827', fontWeight: '500' },
  itemSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: rf(14), color: '#9CA3AF' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const AssignDemoScreen = ({ navigation, route }: any) => {
  const { leadId: routeLeadId, schoolId: routeSchoolId, schoolName: routeSchoolName } = route.params ?? {};
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];

  // Data
  const [schools, setSchools] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form
  const [selectedSchool, setSelectedSchool] = useState<any>(
    routeSchoolId ? { id: routeSchoolId, name: routeSchoolName || `School #${routeSchoolId}` } : null
  );
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [mode, setMode] = useState('Offline');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pickers
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  useEffect(() => {
    setLoadingSchools(true);
    schoolsApi.getAll({ limit: 500 } as any)
      .then(res => {
        const data: any = res.data;
        setSchools(data?.items ?? data?.schools ?? data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingSchools(false));

    setLoadingUsers(true);
    leadsApi.getAssignableFOs()
      .then(res => {
        const d: any = res.data;
        setUsers(Array.isArray(d) ? d : d?.items ?? d?.users ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedSchool) { Alert.alert('Validation', 'Please select a school'); return; }
    if (!selectedUser) { Alert.alert('Validation', 'Please select a demo person to assign'); return; }
    if (!scheduledDate) { Alert.alert('Validation', 'Please enter the scheduled date (YYYY-MM-DD)'); return; }
    const today = new Date().toISOString().split('T')[0];
    if (scheduledDate < today) { Alert.alert('Validation', 'Demo date must be today or a future date.'); return; }
    if (!startTime || !endTime) { Alert.alert('Validation', 'Please enter start and end time'); return; }

    setSubmitting(true);
    try {
      await demosApi.create({
        leadId: parseInt(routeLeadId) || 0,
        schoolId: selectedSchool.id,
        assignedToId: selectedUser.id,
        scheduledDate,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        demoMode: mode,
        meetingLink: mode !== 'Offline' && meetingLink ? meetingLink : undefined,
        notes: notes || undefined,
      });
      Alert.alert('Success', 'Demo assigned successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign demo. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Assign Demo" subtitle="Schedule a product demo" color={COLOR.primary} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* School */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SCHOOL</Text>
          <Text style={styles.fieldLabel}>School *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowSchoolPicker(true)}
            disabled={loadingSchools}
          >
            {loadingSchools ? (
              <ActivityIndicator size="small" color={COLOR.primary} />
            ) : (
              <School size={16} color={selectedSchool ? COLOR.primary : '#9CA3AF'} />
            )}
            <Text style={[styles.selectorText, !selectedSchool && styles.placeholder]} numberOfLines={1}>
              {selectedSchool
                ? `${selectedSchool.name}${selectedSchool.city ? ` (${selectedSchool.city})` : ''}`
                : 'Select school…'}
            </Text>
            <ChevronDown size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Assign To */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ASSIGNMENT</Text>
          <Text style={styles.fieldLabel}>Assign To (Demo Person) *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowUserPicker(true)}
            disabled={loadingUsers}
          >
            {loadingUsers ? (
              <ActivityIndicator size="small" color={COLOR.primary} />
            ) : (
              <User size={16} color={selectedUser ? COLOR.primary : '#9CA3AF'} />
            )}
            <Text style={[styles.selectorText, !selectedUser && styles.placeholder]} numberOfLines={1}>
              {selectedUser
                ? `${selectedUser.name}${selectedUser.role ? ` (${selectedUser.role})` : ''}`
                : 'Select person…'}
            </Text>
            <ChevronDown size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SCHEDULE</Text>

          <Text style={styles.fieldLabel}>Date * (YYYY-MM-DD) — Today or future only</Text>
          <View style={styles.inputRow}>
            <Calendar size={16} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.inputWithIcon}
              value={scheduledDate}
              onChangeText={setScheduledDate}
              placeholder={new Date().toISOString().split('T')[0]}
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.twoCol}>
            <View style={styles.colField}>
              <Text style={styles.fieldLabel}>Start Time *</Text>
              <View style={styles.inputRow}>
                <Clock size={16} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputWithIcon}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="10:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <View style={styles.colField}>
              <Text style={styles.fieldLabel}>End Time *</Text>
              <View style={styles.inputRow}>
                <Clock size={16} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputWithIcon}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="11:00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Demo Mode */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DEMO MODE</Text>
          <View style={styles.chipRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mode === m && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.chipText, mode === m && { color: '#FFF' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode !== 'Offline' && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Meeting Link</Text>
              <TextInput
                style={styles.input}
                value={meetingLink}
                onChangeText={setMeetingLink}
                placeholder="https://meet.google.com/..."
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
                autoCapitalize="none"
              />
            </>
          )}
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special instructions or preparation notes..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button
          title={submitting ? 'Assigning...' : 'Assign Demo'}
          onPress={handleSubmit}
          variant="primary"
          disabled={submitting}
          style={{ marginTop: 4, marginBottom: 16 }}
        />
      </ScrollView>

      {/* School Picker */}
      <PickerModal
        visible={showSchoolPicker}
        title="Select School"
        items={schools}
        labelKey="name"
        sublabelKey="city"
        onSelect={item => setSelectedSchool(item)}
        onClose={() => setShowSchoolPicker(false)}
      />

      {/* User Picker */}
      <PickerModal
        visible={showUserPicker}
        title="Select Demo Person"
        items={users}
        labelKey="name"
        sublabelKey="zone"
        onSelect={item => setSelectedUser(item)}
        onClose={() => setShowUserPicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTitle: {
    fontSize: rf(11), fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, marginBottom: 14,
  },
  fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA',
  },
  selectorText: { flex: 1, fontSize: rf(14), color: '#111827', fontWeight: '500' },
  placeholder: { color: '#9CA3AF', fontWeight: '400' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  inputIcon: {},
  inputWithIcon: { flex: 1, fontSize: rf(14), color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: rf(14), color: '#111827', backgroundColor: '#FAFAFA',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 12 },
  colField: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipText: { fontSize: rf(13), color: '#374151', fontWeight: '600' },
});
