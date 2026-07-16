import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, RefreshControl, useWindowDimensions, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { DrawerMenuButton } from '../../components/common/DrawerMenuButton';
import { activitiesApi } from '../../api/activities';
import { leadsApi } from '../../api/leads';
import { ActivityDto, LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ACTIVITY_COLORS, OUTCOME_COLORS, ACTIVITY_TYPES, ACTIVITY_OUTCOMES, INTEREST_LEVELS, DEMO_MODES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

export const ActivityLogScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tablet = width >= 768;
  const tabletWide = isTabletDevice && width > height;

  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [leads, setLeads] = useState<LeadListDto[]>([]);

  const [form, setForm] = useState({
    type: 'Visit', leadId: '' as any, outcome: 'Positive', notes: '',
    timeIn: '', timeOut: '', personMet: '', personDesignation: '', personPhone: '',
    interestLevel: 'High', nextAction: '', nextFollowUpDate: '',
    demoMode: 'Online', conductedBy: '', attendees: '', feedback: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      const type = typeFilter !== 'All' ? typeFilter : undefined;
      const res = await activitiesApi.getActivities({ pageSize: 50, type });
      let items = res.data?.items ?? [];
      if (outcomeFilter !== 'All') items = items.filter((a) => a.outcome === outcomeFilter);
      setActivities(items);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, outcomeFilter]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  useEffect(() => {
    leadsApi.getPipeline().then((r) => setLeads(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
    if (route?.params?.leadId) setForm((f) => ({ ...f, leadId: route.params.leadId }));
    if (route?.params?.openModal) setShowModal(true);
  }, [route?.params]);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.leadId) { Alert.alert('Error', 'Please select a lead'); return; }
    setFormLoading(true);
    try {
      await activitiesApi.createActivity({
        type: form.type as any,
        leadId: Number(form.leadId),
        outcome: form.outcome as any,
        notes: form.notes || undefined,
        date: new Date().toISOString(),
        gpsVerified: false,
        timeIn: form.timeIn || undefined,
        timeOut: form.timeOut || undefined,
        personMet: form.personMet || undefined,
        personDesignation: form.personDesignation || undefined,
        personPhone: form.personPhone || undefined,
        interestLevel: form.interestLevel || undefined,
        nextAction: form.nextAction || undefined,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
        demoMode: ['Demo'].includes(form.type) ? form.demoMode : undefined,
        conductedBy: form.conductedBy || undefined,
        attendees: form.attendees ? parseInt(form.attendees, 10) : undefined,
        feedback: form.feedback || undefined,
      });
      setShowModal(false);
      fetchActivities();
      setForm({
        type: 'Visit', leadId: '', outcome: 'Positive', notes: '',
        timeIn: '', timeOut: '', personMet: '', personDesignation: '', personPhone: '',
        interestLevel: 'High', nextAction: '', nextFollowUpDate: '',
        demoMode: 'Online', conductedBy: '', attendees: '', feedback: '',
      });
      Alert.alert('Success', 'Activity logged successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to log activity');
    } finally {
      setFormLoading(false);
    }
  };

  const isVisit = ['Visit', 'FollowUp'].includes(form.type);
  const isDemo = form.type === 'Demo';

  const renderItem = ({ item }: { item: ActivityDto }) => {
    const isExpanded = expanded === item.id;
    return (
      <Card padded={false} style={styles.actCard}>
        <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : item.id)}>
          <View style={styles.actHeader}>
            <View style={[styles.actTypeIcon, { backgroundColor: (ACTIVITY_COLORS[item.type] || T.accent) + '22' }]}>
              <Text style={[styles.actTypeChar, { color: ACTIVITY_COLORS[item.type] || T.accent }]}>
                {item.type.charAt(0)}
              </Text>
            </View>
            <View style={styles.actInfo}>
              <View style={styles.actTopRow}>
                <Badge label={item.type} color={ACTIVITY_COLORS[item.type]} />
                <Badge label={item.outcome} color={OUTCOME_COLORS[item.outcome]} />
              </View>
              <Text style={[styles.actSchool, { color: T.text }]} numberOfLines={1}>{item.school || `Lead #${item.leadId}`}</Text>
              <Text style={[styles.actDate, { color: T.dim }]}>{formatDateTime(item.date)}</Text>
            </View>
            <View style={styles.actChevron}>
              {isExpanded ? <ChevronUp size={16} color={T.sub} /> : <ChevronDown size={16} color={T.sub} />}
            </View>
          </View>
          {item.notes && !isExpanded && (
            <Text style={[styles.actNotePreview, { color: T.sub }]} numberOfLines={1}>{item.notes}</Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.actExpanded, { borderTopColor: T.line }]}>
            {item.notes && (
              <View style={styles.expandRow}>
                <Text style={[styles.expandLabel, { color: T.dim }]}>Notes</Text>
                <Text style={[styles.expandValue, { color: T.text }]}>{item.notes}</Text>
              </View>
            )}
            {item.personMet && (
              <>
                <View style={styles.expandRow}>
                  <Text style={[styles.expandLabel, { color: T.dim }]}>Person Met</Text>
                  <Text style={[styles.expandValue, { color: T.text }]}>{item.personMet} ({item.personDesignation})</Text>
                </View>
                {item.interestLevel && (
                  <View style={styles.expandRow}>
                    <Text style={[styles.expandLabel, { color: T.dim }]}>Interest Level</Text>
                    <Badge label={item.interestLevel} color={item.interestLevel === 'High' ? T.success : item.interestLevel === 'Medium' ? T.warning : T.danger} />
                  </View>
                )}
                {item.nextAction && (
                  <View style={styles.expandRow}>
                    <Text style={[styles.expandLabel, { color: T.dim }]}>Next Action</Text>
                    <Text style={[styles.expandValue, { color: T.text }]}>{item.nextAction}</Text>
                  </View>
                )}
              </>
            )}
            {item.demoMode && (
              <>
                <View style={styles.expandRow}>
                  <Text style={[styles.expandLabel, { color: T.dim }]}>Demo Mode</Text>
                  <Text style={[styles.expandValue, { color: T.text }]}>{item.demoMode}</Text>
                </View>
                {item.attendees && (
                  <View style={styles.expandRow}>
                    <Text style={[styles.expandLabel, { color: T.dim }]}>Attendees</Text>
                    <Text style={[styles.expandValue, { color: T.text }]}>{item.attendees}</Text>
                  </View>
                )}
                {item.feedback && (
                  <View style={styles.expandRow}>
                    <Text style={[styles.expandLabel, { color: T.dim }]}>Feedback</Text>
                    <Text style={[styles.expandValue, { color: T.text }]}>{item.feedback}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <DrawerMenuButton />
          <Text style={styles.headerTitle}>Activity Log</Text>
          {role === 'FO' ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowModal(true)}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Type Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['All', ...ACTIVITY_TYPES].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterText, typeFilter === t && styles.filterTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Outcome Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['All', ...ACTIVITY_OUTCOMES].map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.outcomeChip, outcomeFilter === o && { backgroundColor: OUTCOME_COLORS[o] || '#FFF' }]}
              onPress={() => setOutcomeFilter(o)}
            >
              <Text style={[styles.outcomeText, outcomeFilter === o && styles.outcomeTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </GradientBackground>

      {loading ? (
        <LoadingSpinner fullScreen color={T.accent} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
            tabletWide && styles.listWide,
            activities.length === 0 && styles.listEmpty,
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivities(); }} colors={[T.accent]} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState title="No activities found" subtitle="Log your first activity using the + button" icon="📋" />}
        />
      )}

      {/* Log Activity Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: T.card }, tablet && styles.modalTablet]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: T.line }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Log Activity</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={22} color={T.sub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SelectPicker label="Activity Type *" options={ACTIVITY_TYPES.map((t) => ({ label: t, value: t }))} value={form.type} onChange={(v) => set('type', String(v))} accentColor={T.accent} />
              <SelectPicker label="Linked Lead *" options={leads.map((l) => ({ label: `${l.school} — ${l.city}`, value: l.id }))} value={form.leadId} onChange={(v) => set('leadId', v)} accentColor={T.accent} />
              <SelectPicker label="Outcome *" options={ACTIVITY_OUTCOMES.map((o) => ({ label: o, value: o }))} value={form.outcome} onChange={(v) => set('outcome', String(v))} accentColor={T.accent} />
              <Input label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline numberOfLines={3} placeholder="What happened?" accentColor={T.accent} style={{ textAlignVertical: 'top', minHeight: 70 }} />

              {isVisit && (
                <>
                  <Text style={[styles.formSection, { color: T.text }]}>Visit Details</Text>
                  <View style={styles.row}>
                    <Input label="Time In" value={form.timeIn} onChangeText={(v) => set('timeIn', v)} placeholder="HH:MM" accentColor={T.accent} containerStyle={styles.half} />
                    <Input label="Time Out" value={form.timeOut} onChangeText={(v) => set('timeOut', v)} placeholder="HH:MM" accentColor={T.accent} containerStyle={styles.half} />
                  </View>
                  <Input label="Person Met" value={form.personMet} onChangeText={(v) => set('personMet', v)} placeholder="Name of person met" accentColor={T.accent} />
                  <Input label="Designation" value={form.personDesignation} onChangeText={(v) => set('personDesignation', v)} placeholder="Their role" accentColor={T.accent} />
                  <SelectPicker label="Interest Level" options={INTEREST_LEVELS.map((l) => ({ label: l, value: l }))} value={form.interestLevel} onChange={(v) => set('interestLevel', String(v))} accentColor={T.accent} />
                  <Input label="Next Action" value={form.nextAction} onChangeText={(v) => set('nextAction', v)} placeholder="e.g. Schedule demo" accentColor={T.accent} />
                  <Input label="Follow-up Date" value={form.nextFollowUpDate} onChangeText={(v) => set('nextFollowUpDate', v)} placeholder="YYYY-MM-DD" accentColor={T.accent} />
                </>
              )}

              {isDemo && (
                <>
                  <Text style={[styles.formSection, { color: T.text }]}>Demo Details</Text>
                  <SelectPicker label="Demo Mode" options={DEMO_MODES.map((m) => ({ label: m, value: m }))} value={form.demoMode} onChange={(v) => set('demoMode', String(v))} accentColor={T.accent} />
                  <Input label="Conducted By" value={form.conductedBy} onChangeText={(v) => set('conductedBy', v)} placeholder="Team member / presenter" accentColor={T.accent} />
                  <Input label="No. of Attendees" value={form.attendees} onChangeText={(v) => set('attendees', v)} keyboardType="numeric" placeholder="e.g. 15" accentColor={T.accent} />
                  <Input label="Feedback" value={form.feedback} onChangeText={(v) => set('feedback', v)} multiline numberOfLines={2} placeholder="Overall demo feedback" accentColor={T.accent} style={{ textAlignVertical: 'top', minHeight: 60 }} />
                </>
              )}

              <GradientButton label="Log Activity" onPress={handleSubmit} loading={formLoading} style={{ marginTop: 8, marginBottom: 32 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontFamily: Fonts.bold, fontSize: rf(22), color: '#FFF', letterSpacing: -0.3 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  filterScroll: { marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 6,
  },
  filterChipActive: { backgroundColor: '#FFF' },
  filterText: { fontFamily: Fonts.medium, fontSize: rf(12), color: 'rgba(255,255,255,0.9)' },
  filterTextActive: { color: '#8C5A2E', fontFamily: Fonts.bold },
  outcomeChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 6,
  },
  outcomeText: { fontFamily: Fonts.medium, fontSize: rf(11), color: 'rgba(255,255,255,0.85)' },
  outcomeTextActive: { color: '#FFF' },
  list: { padding: 12, gap: 8 },
  listWide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  listEmpty: { flex: 1 },
  actCard: { padding: 14 },
  actHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actTypeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actTypeChar: { fontFamily: Fonts.bold, fontSize: rf(14) },
  actInfo: { flex: 1 },
  actTopRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  actSchool: { fontFamily: Fonts.medium, fontSize: rf(14) },
  actDate: { fontFamily: Fonts.regular, fontSize: rf(11), marginTop: 2 },
  actChevron: { paddingTop: 2 },
  actNotePreview: { fontFamily: Fonts.regular, fontSize: rf(12), marginTop: 6, paddingLeft: 46 },
  actExpanded: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  expandRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  expandLabel: { fontFamily: Fonts.bold, fontSize: rf(12), width: 100 },
  expandValue: { fontFamily: Fonts.regular, fontSize: rf(13), flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 24, marginBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: rf(18) },
  formSection: { fontFamily: Fonts.bold, fontSize: rf(14), marginBottom: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
