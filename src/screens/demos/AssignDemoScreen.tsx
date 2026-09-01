import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, User, School, ArrowLeft } from 'lucide-react-native';
import { DateInput } from '../../components/common/DateInput';
import { KeyField } from '../../components/common/KeyField';
import { demosApi } from '../../api/demos';
import { schoolsApi } from '../../api/schools';
import { leadsApi } from '../../api/leads';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Btn, Trigger, Dropdown, SearchBar } from '../../components/crud';
import { Card, Chip } from '../../components/ui';
import { rf, isTabletDevice } from '../../utils/responsive';

import { useAppTheme } from '../../theme/useAppTheme';

const MODES = ['Offline', 'Online', 'Hybrid'];

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
    routeSchoolId ? { id: routeSchoolId, name: routeSchoolName || 'Selected school' } : null
  );
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [mode, setMode] = useState('Offline');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pickers — inline dropdowns (spec: panel opens below the trigger), never a
  // modal sheet. Each keeps its own filter text because both lists can be long.
  const [openDd, setOpenDd] = useState<'school' | 'user' | null>(null);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const schoolOptions = schools
    .filter(sc => {
      const q = schoolQuery.trim().toLowerCase();
      if (!q) return true;
      return `${sc.name ?? ''} ${sc.city ?? ''}`.toLowerCase().includes(q);
    })
    .map(sc => ({ label: sc.city ? `${sc.name} · ${sc.city}` : String(sc.name), value: String(sc.id) }));

  const userOptions = users
    .filter(u => {
      const q = userQuery.trim().toLowerCase();
      if (!q) return true;
      return `${u.name ?? ''} ${u.zone ?? ''} ${u.role ?? ''}`.toLowerCase().includes(q);
    })
    .map(u => ({ label: u.role ? `${u.name} · ${u.role}` : String(u.name), value: String(u.id) }));

  useEffect(() => {
    setLoadingSchools(true);
    // Web parity (AssignDemo.jsx): a school that is already Won / in implementation
    // must not be offered for a new demo. Web cross-references the pipeline and
    // strips those names; mobile offered every school.
    // NOTE: GET /schools returns `{ schools, total, page, limit }` — there is no
    // `items` key, so read `.schools` first.
    Promise.all([
      schoolsApi.getAll({ page: 1, limit: 500 }),
      leadsApi.getPipeline().catch(() => ({ data: [] as any })),
    ])
      .then(([schoolRes, pipeRes]) => {
        const d: any = schoolRes.data;
        const all: any[] = d?.schools ?? (Array.isArray(d) ? d : []);
        const pipe: any[] = Array.isArray(pipeRes.data) ? pipeRes.data : [];
        const wonNames = new Set(
          pipe
            .filter(l => l.stage === 'Won' || l.stage === 'ImplementationStarted')
            .map(l => (l.school || '').toLowerCase())
            .filter(Boolean),
        );
        setSchools(all.filter(sc => !wonNames.has((sc.name || '').toLowerCase())));
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
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.line }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: T.card, borderColor: T.line }]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.headerTitle, { color: T.text }]} numberOfLines={1}>Assign Demo</Text>
            <Text style={[styles.headerSub, { color: T.sub }]} numberOfLines={1}>Schedule a product demo</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }, tabletWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* Two-column form on a landscape tablet; one column everywhere else. */}
        <View style={tabletWide ? styles.grid : styles.stackCol}>
        <View style={styles.col}>

        {/* School */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>SCHOOL</Text>
          <Text style={[styles.fieldLabel, { color: T.sub }]}>School *</Text>
          <Trigger
            label={
              loadingSchools
                ? 'Loading schools…'
                : selectedSchool
                  ? `${selectedSchool.name}${selectedSchool.city ? ` · ${selectedSchool.city}` : ''}`
                  : 'Select school…'
            }
            open={openDd === 'school'}
            icon={<School size={16} color={selectedSchool ? T.accent : T.dim} />}
            onPress={() => !loadingSchools && setOpenDd(openDd === 'school' ? null : 'school')}
          />
          {openDd === 'school' && (
            <View style={styles.ddWrap}>
              <SearchBar value={schoolQuery} onChangeText={setSchoolQuery} placeholder="Search schools…" />
              <Dropdown
                style={styles.ddFull}
                maxHeight={240}
                value={selectedSchool ? String(selectedSchool.id) : undefined}
                options={schoolOptions}
                onSelect={v => {
                  setSelectedSchool(schools.find(sc => String(sc.id) === v) ?? null);
                  setOpenDd(null);
                  setSchoolQuery('');
                }}
              />
            </View>
          )}
        </Card>

        {/* Assign To */}
        <Card>
          <Text style={[styles.cardTitle, { color: T.dim }]}>ASSIGNMENT</Text>
          <Text style={[styles.fieldLabel, { color: T.sub }]}>Assign To (Demo Person) *</Text>
          <Trigger
            label={
              loadingUsers
                ? 'Loading people…'
                : selectedUser
                  ? `${selectedUser.name}${selectedUser.role ? ` · ${selectedUser.role}` : ''}`
                  : 'Select person…'
            }
            open={openDd === 'user'}
            icon={<User size={16} color={selectedUser ? T.accent : T.dim} />}
            onPress={() => !loadingUsers && setOpenDd(openDd === 'user' ? null : 'user')}
          />
          {openDd === 'user' && (
            <View style={styles.ddWrap}>
              <SearchBar value={userQuery} onChangeText={setUserQuery} placeholder="Search people…" />
              <Dropdown
                style={styles.ddFull}
                maxHeight={240}
                value={selectedUser ? String(selectedUser.id) : undefined}
                options={userOptions}
                onSelect={v => {
                  setSelectedUser(users.find(u => String(u.id) === v) ?? null);
                  setOpenDd(null);
                  setUserQuery('');
                }}
              />
            </View>
          )}
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
            <KeyField
              label="Start Time *"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="10:00"
              containerStyle={styles.colField}
              left={<Clock size={16} color={T.dim} />}
            />
            <KeyField
              label="End Time *"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="11:00"
              containerStyle={styles.colField}
              left={<Clock size={16} color={T.dim} />}
            />
          </View>
        </Card>

        </View>
        <View style={styles.col}>

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
            <KeyField
              label="Meeting Link"
              value={meetingLink}
              onChangeText={setMeetingLink}
              placeholder="https://meet.google.com/..."
              containerStyle={{ marginTop: 12 }}
            />
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

        {/* Cancel (secondary) then primary — the order used on every form. */}
        <View style={styles.actionRow}>
          <Btn label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={styles.actionBtn} />
          <Btn label="Assign Demo" onPress={handleSubmit} loading={submitting} disabled={submitting} style={styles.actionBtn} />
        </View>

        </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontWeight: '700', fontSize: rf(20), letterSpacing: -0.3 },
  headerSub: { fontWeight: '400', fontSize: rf(12.5), marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  contentWide: { maxWidth: 1040, width: '100%', alignSelf: 'center', padding: 24 },
  grid:     { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  stackCol: { gap: 14 },
  col:      { flex: 1, gap: 14 },
  ddWrap:   { gap: 8, marginTop: 8 },
  ddFull:   { width: '100%' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
  cardTitle: {
    fontWeight: '700', fontSize: rf(11),
    letterSpacing: 0.8, marginBottom: 14,
  },
  fieldLabel: { fontWeight: '600', fontSize: rf(13), marginBottom: 6 },
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  selectorText: { flex: 1, fontWeight: '600', fontSize: rf(14) },
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontWeight: '400', fontSize: rf(14),
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 12 },
  colField: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
