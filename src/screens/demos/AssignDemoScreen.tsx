import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, FlatList, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ChevronDown, X, Clock, User, School, ArrowLeft } from 'lucide-react-native';
import { DateInput } from '../../components/common/DateInput';
import { demosApi } from '../../api/demos';
import { schoolsApi } from '../../api/schools';
import { leadsApi } from '../../api/leads';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Card, Chip } from '../../components/ui';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

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
  const T = useAppTheme();
  const [search, setSearch] = useState('');

  const safeItems = Array.isArray(items) ? items : [];
  const filtered = safeItems.filter(i =>
    String(i[labelKey] || '').toLowerCase().includes(search.toLowerCase()) ||
    (sublabelKey && String(i[sublabelKey] || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={[pickerStyles.sheet, { backgroundColor: T.card }]}>
          <View style={[pickerStyles.header, { borderBottomColor: T.line }]}>
            <Text style={[pickerStyles.title, { color: T.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={T.sub} />
            </TouchableOpacity>
          </View>
          <View style={[pickerStyles.searchBar, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
            <Search size={16} color={T.dim} />
            <TextInput
              style={[pickerStyles.searchInput, { color: T.text }]}
              placeholder={`Search ${title.toLowerCase()}...`}
              placeholderTextColor={T.dim}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={14} color={T.dim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            style={{ flexShrink: 1 }}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pickerStyles.item, { borderBottomColor: T.line }]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={[pickerStyles.itemLabel, { color: T.text }]} numberOfLines={1}>{item[labelKey]}</Text>
                {sublabelKey && item[sublabelKey] ? (
                  <Text style={[pickerStyles.itemSub, { color: T.sub }]} numberOfLines={1}>{item[sublabelKey]}</Text>
                ) : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={pickerStyles.empty}>
                <Text style={[pickerStyles.emptyText, { color: T.dim }]}>No results found</Text>
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
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  title: { fontFamily: Fonts.bold, fontSize: rf(16) },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14) },
  item: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemLabel: { fontFamily: Fonts.medium, fontSize: rf(14) },
  itemSub: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontFamily: Fonts.regular, fontSize: rf(14) },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const AssignDemoScreen = ({ navigation, route }: any) => {
  const { leadId: routeLeadId, schoolId: routeSchoolId, schoolName: routeSchoolName } = route.params ?? {};
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabletWide = isTabletDevice && width > height;

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
    const userFetch = user?.role === 'SCA' ? authApi.getUsers() : leadsApi.getAssignableFOs();
    userFetch
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
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Assign Demo</Text>
            <Text style={styles.headerSub}>Schedule a product demo</Text>
          </View>
        </View>
      </GradientBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }, tabletWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* School */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>SCHOOL</Text>
          <Text style={[styles.fieldLabel, { color: T.sub }]}>School *</Text>
          <TouchableOpacity
            style={[styles.selector, { backgroundColor: T.fieldBg, borderColor: T.line }]}
            onPress={() => setShowSchoolPicker(true)}
            disabled={loadingSchools}
          >
            {loadingSchools ? (
              <ActivityIndicator size="small" color={T.accent} />
            ) : (
              <School size={16} color={selectedSchool ? T.accent : T.dim} />
            )}
            <Text style={[styles.selectorText, { color: selectedSchool ? T.text : T.dim }]} numberOfLines={1}>
              {selectedSchool
                ? `${selectedSchool.name}${selectedSchool.city ? ` (${selectedSchool.city})` : ''}`
                : 'Select school…'}
            </Text>
            <ChevronDown size={16} color={T.dim} />
          </TouchableOpacity>
        </Card>

        {/* Assign To */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>ASSIGNMENT</Text>
          <Text style={[styles.fieldLabel, { color: T.sub }]}>Assign To (Demo Person) *</Text>
          <TouchableOpacity
            style={[styles.selector, { backgroundColor: T.fieldBg, borderColor: T.line }]}
            onPress={() => setShowUserPicker(true)}
            disabled={loadingUsers}
          >
            {loadingUsers ? (
              <ActivityIndicator size="small" color={T.accent} />
            ) : (
              <User size={16} color={selectedUser ? T.accent : T.dim} />
            )}
            <Text style={[styles.selectorText, { color: selectedUser ? T.text : T.dim }]} numberOfLines={1}>
              {selectedUser
                ? `${selectedUser.name}${selectedUser.role ? ` (${selectedUser.role})` : ''}`
                : 'Select person…'}
            </Text>
            <ChevronDown size={16} color={T.dim} />
          </TouchableOpacity>
        </Card>

        {/* Schedule */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>SCHEDULE</Text>

          <DateInput
            label="Date * (Today or future only)"
            value={scheduledDate}
            onChange={setScheduledDate}
            placeholder="Select date"
            accentColor={T.accent}
          />

          <View style={styles.twoCol}>
            <View style={styles.colField}>
              <Text style={[styles.fieldLabel, { color: T.sub }]}>Start Time *</Text>
              <View style={[styles.inputRow, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
                <Clock size={16} color={T.dim} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputWithIcon, { color: T.text }]}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="10:00"
                  placeholderTextColor={T.dim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <View style={styles.colField}>
              <Text style={[styles.fieldLabel, { color: T.sub }]}>End Time *</Text>
              <View style={[styles.inputRow, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
                <Clock size={16} color={T.dim} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputWithIcon, { color: T.text }]}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="11:00"
                  placeholderTextColor={T.dim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Demo Mode */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>DEMO MODE</Text>
          <View style={styles.chipRow}>
            {MODES.map(m => (
              <Chip
                key={m}
                label={m}
                active={mode === m}
                color={T.accent}
                onPress={() => setMode(m)}
              />
            ))}
          </View>

          {mode !== 'Offline' && (
            <>
              <Text style={[styles.fieldLabel, { color: T.sub, marginTop: 12 }]}>Meeting Link</Text>
              <TextInput
                style={[styles.input, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
                value={meetingLink}
                onChangeText={setMeetingLink}
                placeholder="https://meet.google.com/..."
                placeholderTextColor={T.dim}
                keyboardType="url"
                autoCapitalize="none"
              />
            </>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special instructions or preparation notes..."
            placeholderTextColor={T.dim}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>

        <GradientButton
          label={submitting ? 'Assigning...' : 'Assign Demo'}
          onPress={handleSubmit}
          loading={submitting}
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(20), color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontFamily: Fonts.regular, fontSize: rf(12.5), color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  contentWide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  cardTitle: {
    fontFamily: Fonts.bold, fontSize: rf(11),
    letterSpacing: 0.8, marginBottom: 14,
  },
  fieldLabel: { fontFamily: Fonts.medium, fontSize: rf(13), marginBottom: 6 },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  selectorText: { flex: 1, fontFamily: Fonts.medium, fontSize: rf(14) },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12,
  },
  inputIcon: {},
  inputWithIcon: { flex: 1, fontFamily: Fonts.regular, fontSize: rf(14) },
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: Fonts.regular, fontSize: rf(14),
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 12 },
  colField: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
