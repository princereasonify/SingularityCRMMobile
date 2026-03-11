import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, ScrollView, Alert, RefreshControl, useWindowDimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { activitiesApi } from '../../api/activities';
import { leadsApi } from '../../api/leads';
import { ActivityDto, LeadListDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner, EmptyState } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS, ACTIVITY_COLORS, OUTCOME_COLORS, ACTIVITY_TYPES, ACTIVITY_OUTCOMES, INTEREST_LEVELS, DEMO_MODES } from '../../utils/constants';
import { formatRelativeDate, formatDateTime } from '../../utils/formatting';
import { rf } from '../../utils/responsive';
import { API_BASE_URL } from '../../utils/constants';

export const ActivityLogScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const COLOR = ROLE_COLORS[role];
  const { width } = useWindowDimensions();
  const tablet = width >= 768;

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
      let items = res.data.items;
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
    leadsApi.getPipeline().then((r) => setLeads(r.data)).catch(() => {});
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
      <Card style={styles.actCard}>
        <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : item.id)}>
          <View style={styles.actHeader}>
            <View style={[styles.actTypeIcon, { backgroundColor: ACTIVITY_COLORS[item.type] + '22' }]}>
              <Text style={[styles.actTypeChar, { color: ACTIVITY_COLORS[item.type] }]}>
                {item.type.charAt(0)}
              </Text>
            </View>
            <View style={styles.actInfo}>
              <View style={styles.actTopRow}>
                <Badge label={item.type} color={ACTIVITY_COLORS[item.type]} size="sm" />
                <Badge label={item.outcome} color={OUTCOME_COLORS[item.outcome]} size="sm" />
              </View>
              <Text style={styles.actSchool} numberOfLines={1}>{item.school || `Lead #${item.leadId}`}</Text>
              <Text style={styles.actDate}>{formatDateTime(item.date)}</Text>
            </View>
            <View style={styles.actChevron}>
              {isExpanded ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
            </View>
          </View>
          {item.notes && !isExpanded && (
            <Text style={styles.actNotePreview} numberOfLines={1}>{item.notes}</Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.actExpanded}>
            {item.notes && (
              <View style={styles.expandRow}>
                <Text style={styles.expandLabel}>Notes</Text>
                <Text style={styles.expandValue}>{item.notes}</Text>
              </View>
            )}
            {item.personMet && (
              <>
                <View style={styles.expandRow}>
                  <Text style={styles.expandLabel}>Person Met</Text>
                  <Text style={styles.expandValue}>{item.personMet} ({item.personDesignation})</Text>
                </View>
                {item.interestLevel && (
                  <View style={styles.expandRow}>
                    <Text style={styles.expandLabel}>Interest Level</Text>
                    <Badge label={item.interestLevel} color={item.interestLevel === 'High' ? '#22C55E' : item.interestLevel === 'Medium' ? '#F59E0B' : '#EF4444'} />
                  </View>
                )}
                {item.nextAction && (
                  <View style={styles.expandRow}>
                    <Text style={styles.expandLabel}>Next Action</Text>
                    <Text style={styles.expandValue}>{item.nextAction}</Text>
                  </View>
                )}
              </>
            )}
            {item.demoMode && (
              <>
                <View style={styles.expandRow}>
                  <Text style={styles.expandLabel}>Demo Mode</Text>
                  <Text style={styles.expandValue}>{item.demoMode}</Text>
                </View>
                {item.attendees && (
                  <View style={styles.expandRow}>
                    <Text style={styles.expandLabel}>Attendees</Text>
                    <Text style={styles.expandValue}>{item.attendees}</Text>
                  </View>
                )}
                {item.feedback && (
                  <View style={styles.expandRow}>
                    <Text style={styles.expandLabel}>Feedback</Text>
                    <Text style={styles.expandValue}>{item.feedback}</Text>
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { backgroundColor: COLOR.primary }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Activity Log</Text>
          {role === 'FO' && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowModal(true)}>
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['All', ...ACTIVITY_TYPES].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterChip, typeFilter === t && { backgroundColor: '#FFF' }]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.filterText, typeFilter === t && { color: COLOR.primary }]}>{t}</Text>
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
              <Text style={[styles.outcomeText, outcomeFilter === o && { color: '#FFF' }]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen color={COLOR.primary} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, activities.length === 0 && styles.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActivities(); }} colors={[COLOR.primary]} />}
          ListEmptyComponent={<EmptyState title="No activities found" subtitle="Log your first activity using the + button" icon="📋" />}
        />
      )}

      {/* Log Activity Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={[styles.modalSheet, tablet && styles.modalTablet]} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Activity</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SelectPicker label="Activity Type *" options={ACTIVITY_TYPES.map((t) => ({ label: t, value: t }))} value={form.type} onChange={(v) => set('type', String(v))} accentColor={COLOR.primary} />
              <SelectPicker label="Linked Lead *" options={leads.map((l) => ({ label: `${l.school} — ${l.city}`, value: l.id }))} value={form.leadId} onChange={(v) => set('leadId', v)} accentColor={COLOR.primary} />
              <SelectPicker label="Outcome *" options={ACTIVITY_OUTCOMES.map((o) => ({ label: o, value: o }))} value={form.outcome} onChange={(v) => set('outcome', String(v))} accentColor={COLOR.primary} />
              <Input label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline numberOfLines={3} placeholder="What happened?" accentColor={COLOR.primary} style={{ textAlignVertical: 'top', minHeight: 70 }} />

              {isVisit && (
                <>
                  <Text style={styles.formSection}>Visit Details</Text>
                  <View style={styles.row}>
                    <Input label="Time In" value={form.timeIn} onChangeText={(v) => set('timeIn', v)} placeholder="HH:MM" accentColor={COLOR.primary} containerStyle={styles.half} />
                    <Input label="Time Out" value={form.timeOut} onChangeText={(v) => set('timeOut', v)} placeholder="HH:MM" accentColor={COLOR.primary} containerStyle={styles.half} />
                  </View>
                  <Input label="Person Met" value={form.personMet} onChangeText={(v) => set('personMet', v)} placeholder="Name of person met" accentColor={COLOR.primary} />
                  <Input label="Designation" value={form.personDesignation} onChangeText={(v) => set('personDesignation', v)} placeholder="Their role" accentColor={COLOR.primary} />
                  <SelectPicker label="Interest Level" options={INTEREST_LEVELS.map((l) => ({ label: l, value: l }))} value={form.interestLevel} onChange={(v) => set('interestLevel', String(v))} accentColor={COLOR.primary} />
                  <Input label="Next Action" value={form.nextAction} onChangeText={(v) => set('nextAction', v)} placeholder="e.g. Schedule demo" accentColor={COLOR.primary} />
                  <Input label="Follow-up Date" value={form.nextFollowUpDate} onChangeText={(v) => set('nextFollowUpDate', v)} placeholder="YYYY-MM-DD" accentColor={COLOR.primary} />
                </>
              )}

              {isDemo && (
                <>
                  <Text style={styles.formSection}>Demo Details</Text>
                  <SelectPicker label="Demo Mode" options={DEMO_MODES.map((m) => ({ label: m, value: m }))} value={form.demoMode} onChange={(v) => set('demoMode', String(v))} accentColor={COLOR.primary} />
                  <Input label="Conducted By" value={form.conductedBy} onChangeText={(v) => set('conductedBy', v)} placeholder="Team member / presenter" accentColor={COLOR.primary} />
                  <Input label="No. of Attendees" value={form.attendees} onChangeText={(v) => set('attendees', v)} keyboardType="numeric" placeholder="e.g. 15" accentColor={COLOR.primary} />
                  <Input label="Feedback" value={form.feedback} onChangeText={(v) => set('feedback', v)} multiline numberOfLines={2} placeholder="Overall demo feedback" accentColor={COLOR.primary} style={{ textAlignVertical: 'top', minHeight: 60 }} />
                </>
              )}

              <Button title="Log Activity" onPress={handleSubmit} loading={formLoading} color={COLOR.primary} size="lg" style={{ marginTop: 8, marginBottom: 32 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: rf(22), fontWeight: '700', color: '#FFF' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  filterScroll: { marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 6,
  },
  filterText: { fontSize: rf(12), color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  outcomeChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 6,
  },
  outcomeText: { fontSize: rf(11), color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  list: { padding: 12, gap: 8 },
  listEmpty: { flex: 1 },
  actCard: { padding: 14 },
  actHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actTypeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actTypeChar: { fontSize: rf(14), fontWeight: '700' },
  actInfo: { flex: 1 },
  actTopRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  actSchool: { fontSize: rf(14), fontWeight: '600', color: '#111827' },
  actDate: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },
  actChevron: { paddingTop: 2 },
  actNotePreview: { fontSize: rf(12), color: '#6B7280', marginTop: 6, paddingLeft: 46 },
  actExpanded: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 10,
  },
  expandRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  expandLabel: { fontSize: rf(12), color: '#9CA3AF', fontWeight: '600', width: 100 },
  expandValue: { fontSize: rf(13), color: '#374151', flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 24, marginBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827' },
  formSection: { fontSize: rf(14), fontWeight: '700', color: '#374151', marginBottom: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
