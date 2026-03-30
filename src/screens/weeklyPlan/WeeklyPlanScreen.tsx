  import React, { useState, useEffect, useCallback } from 'react';
  import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
    Modal, FlatList, Alert, RefreshControl, ActivityIndicator,
  } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import {
    ChevronLeft, ChevronRight, Plus, Trash2, Search, X, ChevronDown, ChevronUp,
    Check, Pencil, CircleX,
  } from 'lucide-react-native';
  import { weeklyPlanApi } from '../../api/weeklyPlan';
  import { schoolsApi } from '../../api/schools';
  import { leadsApi } from '../../api/leads';
  import { useAuth } from '../../context/AuthContext';
  import { ROLE_COLORS } from '../../utils/constants';
  import { rf } from '../../utils/responsive';
  import { WeeklyPlan, DayPlan, WeeklyActivity } from '../../types';

  // ─── Constants ────────────────────────────────────────────────────────────────
  const ACTIVITY_TYPES = ['Visit', 'Demo', 'Call', 'Meeting', 'FollowUp'] as const;
  const ACTIVITY_COLORS: Record<string, string> = {
    Visit: '#16A34A', Demo: '#2563EB', Call: '#6B7280',
    Meeting: '#7C3AED', FollowUp: '#F59E0B',
  };
  const STATUS_COLORS: Record<string, string> = {
    Draft: '#6B7280', Submitted: '#F59E0B', Approved: '#16A34A',
    EditedByManager: '#7C3AED', Rejected: '#DC2626',
  };
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function getMonday(d: Date): Date {
    const day = new Date(d);
    const dow = day.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
  }

  function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function toYMD(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  function buildEmptyWeek(monday: Date): DayPlan[] {
    return DAY_NAMES.map((dayOfWeek, i) => ({
      date: toYMD(addDays(monday, i)),
      dayOfWeek,
      activities: [],
    }));
  }

  // Backend (web) stores planData as a JSON string — handle both string and array
  function parsePlanData(raw: any): DayPlan[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch {}
    }
    return [];
  }

  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function fmtWeekRange(monday: Date): string {
    const sunday = addDays(monday, 6);
    const start = `${monday.getDate()} ${SHORT_MONTHS[monday.getMonth()]}`;
    const end = `${sunday.getDate()} ${SHORT_MONTHS[sunday.getMonth()]} ${sunday.getFullYear()}`;
    return `${start} – ${end}`;
  }

  function initials(name: string): string {
    return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ─── School Picker Modal ───────────────────────────────────────────────────────
  const SchoolPickerModal = ({
    visible, schools, onSelect, onClose,
  }: {
    visible: boolean;
    schools: any[];
    onSelect: (s: any) => void;
    onClose: () => void;
  }) => {
    const [q, setQ] = useState('');
    const filtered = (Array.isArray(schools) ? schools : []).filter(s =>
      (s.name || '').toLowerCase().includes(q.toLowerCase()) ||
      (s.city || '').toLowerCase().includes(q.toLowerCase())
    );
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={pm.overlay}>
          <View style={pm.sheet}>
            <View style={pm.header}>
              <Text style={pm.title}>Select School</Text>
              <TouchableOpacity onPress={onClose}><X size={20} color="#6B7280" /></TouchableOpacity>
            </View>
            <View style={pm.search}>
              <Search size={15} color="#9CA3AF" />
              <TextInput
                style={pm.searchInput}
                value={q} onChangeText={setQ}
                placeholder="Search school..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              {q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><X size={13} color="#9CA3AF" /></TouchableOpacity>}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={i => String(i.id)}
              style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={pm.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                  <Text style={pm.itemName} numberOfLines={1}>{item.name}</Text>
                  {item.city ? <Text style={pm.itemCity}>{item.city}</Text> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={pm.empty}>No schools found</Text>}
            />
          </View>
        </View>
      </Modal>
    );
  };
  const pm = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    title: { fontSize: rf(16), fontWeight: '700', color: '#111827' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    searchInput: { flex: 1, fontSize: rf(14), color: '#111827' },
    item: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    itemName: { fontSize: rf(14), color: '#111827', fontWeight: '500' },
    itemCity: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },
    empty: { textAlign: 'center', padding: 28, color: '#9CA3AF', fontSize: rf(13) },
  });

  // ─── Get allowed activity types based on lead stage ─────────────────────────
  function getAllowedActivityTypes(schoolName: string | undefined, leads: any[]): string[] {
    const allTypes = [...ACTIVITY_TYPES] as string[];
    if (!schoolName) return allTypes;
    const lead = leads.find((l: any) => (l.school || l.schoolName) === schoolName);
    if (!lead) return allTypes;
    const stage = lead.stage || '';
    // After DemoDone or later: hide Visit AND Demo
    if (['DemoDone', 'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted'].includes(stage))
      return allTypes.filter(t => t !== 'Visit' && t !== 'Demo');
    // After DemoStage: hide Visit
    if (['DemoStage'].includes(stage))
      return allTypes.filter(t => t !== 'Visit');
    return allTypes;
  }

  // ─── Activity Row ──────────────────────────────────────────────────────────────
  const ActivityRow = ({
    activity, schools, leads, onChange, onRemove,
  }: {
    activity: WeeklyActivity;
    schools: any[];
    leads: any[];
    onChange: (a: WeeklyActivity) => void;
    onRemove: () => void;
  }) => {
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);
    const allowedTypes = getAllowedActivityTypes(activity.schoolName, leads);
    return (
      <View style={ar.container}>
        {/* Activity type row */}
        <View style={ar.typeRow}>
          {allowedTypes.map(t => (
            <TouchableOpacity
              key={t}
              style={[ar.typeChip, activity.type === t && { backgroundColor: ACTIVITY_COLORS[t] }]}
              onPress={() => onChange({ ...activity, type: t as WeeklyActivity['type'] })}
            >
              <Text style={[ar.typeText, activity.type === t && { color: '#FFF' }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* School + notes */}
        <View style={ar.row}>
          <TouchableOpacity style={ar.schoolBtn} onPress={() => setShowSchoolPicker(true)}>
            <Text style={[ar.schoolText, !activity.schoolName && ar.placeholder]} numberOfLines={1}>
              {activity.schoolName || 'Select school...'}
            </Text>
            <ChevronDown size={13} color="#9CA3AF" />
          </TouchableOpacity>
          <TextInput
            style={ar.notes}
            value={activity.notes || ''}
            onChangeText={v => onChange({ ...activity, notes: v })}
            placeholder="Notes..."
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Trash2 size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
        <SchoolPickerModal
          visible={showSchoolPicker}
          schools={schools}
          onSelect={s => { onChange({ ...activity, schoolId: s.id, schoolName: s.name }); }}
          onClose={() => setShowSchoolPicker(false)}
        />
      </View>
    );
  };
  const ar = StyleSheet.create({
    container: { marginBottom: 10, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#F3F4F6' },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
    typeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: '#F3F4F6' },
    typeText: { fontSize: rf(11), fontWeight: '600', color: '#6B7280' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    schoolBtn: { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
    schoolText: { fontSize: rf(12), color: '#111827', flex: 1 },
    placeholder: { color: '#9CA3AF' },
    notes: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: rf(12), color: '#111827' },
  });

  // ─── Day Card ──────────────────────────────────────────────────────────────────
  const DayCard = ({
    day, schools, leads, onChange, editable, color,
  }: {
    day: DayPlan;
    schools: any[];
    leads: any[];
    onChange?: (d: DayPlan) => void;
    editable: boolean;
    color: string;
  }) => {
    const total = Array.isArray(day.activities) ? day.activities.length : 0;
    const [expanded, setExpanded] = useState(!editable && total > 0);
    const date = new Date(day.date + 'T00:00:00');
    const dateStr = `${SHORT_DAYS[date.getDay()]}, ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;

    const addActivity = () => {
      if (!onChange) return;
      onChange({ ...day, activities: [...day.activities, { type: 'Visit', schoolId: '', schoolName: '', notes: '' }] });
      setExpanded(true);
    };
    const updateActivity = (i: number, a: WeeklyActivity) => {
      if (!onChange) return;
      const acts = [...day.activities];
      acts[i] = a;
      onChange({ ...day, activities: acts });
    };
    const removeActivity = (i: number) => {
      if (!onChange) return;
      onChange({ ...day, activities: day.activities.filter((_, idx) => idx !== i) });
    };

    return (
      <View style={dc.card}>
        <TouchableOpacity style={dc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
          <View style={dc.dayInfo}>
            <Text style={dc.dayName}>{dateStr}</Text>
            {total > 0 ? (
              <View style={dc.countBadge}>
                <Text style={dc.countText}>{total} {total === 1 ? 'activity' : 'activities'}</Text>
              </View>
            ) : (
              <Text style={dc.emptyLabel}>No activities</Text>
            )}
          </View>
          <View style={dc.headerRight}>
            {editable && (
              <TouchableOpacity style={[dc.addBtn, { backgroundColor: color }]} onPress={addActivity}>
                <Plus size={14} color="#FFF" />
              </TouchableOpacity>
            )}
            {expanded ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={dc.body}>
            {total === 0 ? (
              <Text style={dc.noActivities}>No activities for this day. Tap + to add.</Text>
            ) : (
              (Array.isArray(day.activities) ? day.activities : []).map((act, i) => (
                editable ? (
                  <ActivityRow
                    key={i}
                    activity={act}
                    schools={schools}
                    leads={leads}
                    onChange={a => updateActivity(i, a)}
                    onRemove={() => removeActivity(i)}
                  />
                ) : (
                  <View key={i} style={dc.readonlyRow}>
                    <View style={[dc.typeDot, { backgroundColor: ACTIVITY_COLORS[act.type] || '#6B7280' }]} />
                    <Text style={dc.readonlyType}>{act.type}</Text>
                    {act.schoolName ? <Text style={dc.readonlySchool} numberOfLines={1}>{act.schoolName}</Text> : null}
                    {act.notes ? <Text style={dc.readonlyNotes} numberOfLines={1}>{act.notes}</Text> : null}
                  </View>
                )
              ))
            )}
          </View>
        )}
      </View>
    );
  };
  const dc = StyleSheet.create({
    card: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    dayInfo: { flex: 1, gap: 3 },
    dayName: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
    countBadge: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
    countText: { fontSize: rf(11), color: '#2563EB', fontWeight: '600' },
    emptyLabel: { fontSize: rf(12), color: '#9CA3AF' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 14, paddingBottom: 14 },
    noActivities: { textAlign: 'center', color: '#9CA3AF', fontSize: rf(13), paddingVertical: 12 },
    readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    typeDot: { width: 8, height: 8, borderRadius: 4 },
    readonlyType: { fontSize: rf(12), fontWeight: '600', color: '#374151', minWidth: 56 },
    readonlySchool: { flex: 1, fontSize: rf(12), color: '#111827' },
    readonlyNotes: { fontSize: rf(11), color: '#9CA3AF', flex: 1 },
  });

  // ─── Team Member Card ──────────────────────────────────────────────────────────
  const TeamMemberCard = ({
    plan, schools, leads, onApprove, onReject, color,
  }: {
    plan: WeeklyPlan;
    schools: any[];
    leads: any[];
    onApprove: () => void;
    onReject: () => void;
    color: string;
  }) => {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editDays, setEditDays] = useState<DayPlan[]>([]);
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const safePlanData = parsePlanData(plan.planData);
    const totalActivities = safePlanData.reduce((s, d) => s + (Array.isArray(d.activities) ? d.activities.length : 0), 0);

    const startEdit = () => {
      setEditDays(JSON.parse(JSON.stringify(safePlanData)));
      setEditNotes('');
      setEditing(true);
      setExpanded(true);
    };
    const saveEdit = async () => {
      setSaving(true);
      try {
        await weeklyPlanApi.managerEdit(plan.id, editDays, editNotes || undefined);
        setEditing(false);
        Alert.alert('Saved', 'Plan edits saved successfully');
      } catch { Alert.alert('Error', 'Failed to save edits'); }
      finally { setSaving(false); }
    };

    const managerEdits = parsePlanData((plan as any).managerEdits);
    const displayDays = editing ? editDays : (managerEdits.length > 0 ? managerEdits : safePlanData);

    return (
      <View style={tm.card}>
        {/* Card Header */}
        <TouchableOpacity style={tm.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
          <View style={[tm.avatar, { backgroundColor: color }]}>
            <Text style={tm.avatarText}>{initials(plan.userName || '')}</Text>
          </View>
          <View style={tm.info}>
            <Text style={tm.name}>{plan.userName || 'Unknown'}</Text>
            <View style={tm.metaRow}>
              <Text style={tm.role}>{plan.userRole}</Text>
              <Text style={tm.dot}>·</Text>
              <Text style={tm.acts}>{totalActivities} activities</Text>
            </View>
          </View>
          <View style={tm.right}>
            <View style={[tm.statusBadge, { backgroundColor: (STATUS_COLORS[plan.status] || '#6B7280') + '20' }]}>
              <Text style={[tm.statusText, { color: STATUS_COLORS[plan.status] || '#6B7280' }]}>{plan.status}</Text>
            </View>
            {expanded ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
          </View>
        </TouchableOpacity>

        {/* Action Buttons — Submitted plans */}
        {plan.status === 'Submitted' && (
          <View style={tm.actions}>
            <TouchableOpacity style={[tm.actionBtn, { backgroundColor: '#16A34A' }]} onPress={onApprove}>
              <Check size={14} color="#FFF" />
              <Text style={tm.actionLabel}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[tm.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={startEdit}>
              <Pencil size={14} color="#FFF" />
              <Text style={tm.actionLabel}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[tm.actionBtn, { backgroundColor: '#DC2626' }]} onPress={onReject}>
              <CircleX size={14} color="#FFF" />
              <Text style={tm.actionLabel}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expanded plan */}
        {expanded && (
          <View style={tm.body}>
            {displayDays.length === 0 ? (
              <Text style={tm.emptyPlan}>No plan data</Text>
            ) : (
              displayDays.map((day, i) => (
                <DayCard
                  key={day.date}
                  day={day}
                  schools={schools}
                  leads={leads}
                  editable={editing}
                  onChange={editing ? (d) => {
                    const updated = [...editDays];
                    updated[i] = d;
                    setEditDays(updated);
                  } : undefined}
                  color={color}
                />
              ))
            )}
            {editing && (
              <View>
                <TextInput
                  style={tm.editNotesInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Review notes (optional)..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={2}
                />
                <View style={tm.editBtns}>
                  <TouchableOpacity style={tm.cancelEdit} onPress={() => setEditing(false)}>
                    <Text style={tm.cancelEditText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tm.saveEdit, { backgroundColor: color, opacity: saving ? 0.6 : 1 }]}
                    onPress={saveEdit}
                    disabled={saving}
                  >
                    <Text style={tm.saveEditText}>{saving ? 'Saving...' : 'Save Edits'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };
  const tm = StyleSheet.create({
    card: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: rf(15), fontWeight: '700', color: '#FFF' },
    info: { flex: 1 },
    name: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    role: { fontSize: rf(12), color: '#6B7280' },
    dot: { fontSize: rf(12), color: '#D1D5DB' },
    acts: { fontSize: rf(12), color: '#6B7280' },
    right: { alignItems: 'flex-end', gap: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
    statusText: { fontSize: rf(11), fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
    actionLabel: { fontSize: rf(13), fontWeight: '600', color: '#FFF' },
    body: { paddingHorizontal: 16, paddingBottom: 16 },
    emptyPlan: { textAlign: 'center', color: '#9CA3AF', fontSize: rf(13), padding: 20 },
    editBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelEdit: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
    cancelEditText: { fontSize: rf(13), fontWeight: '600', color: '#6B7280' },
    saveEdit: { flex: 2, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
    saveEditText: { fontSize: rf(13), fontWeight: '600', color: '#FFF' },
    editNotesInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: rf(13), color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 10, textAlignVertical: 'top' as const, minHeight: 60 },
  });

  // ─── Main Screen ───────────────────────────────────────────────────────────────
  export const WeeklyPlanScreen = ({ navigation }: any) => {
    const { user } = useAuth();
    const role = user?.role || 'FO';
    const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];
    const isManager = ['ZH', 'RH', 'SH', 'SCA'].includes(role);

    const [tab, setTab] = useState<'my' | 'team'>('my');
    const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()));

    // My Plan state
    const [myPlan, setMyPlan] = useState<WeeklyPlan | null>(null);
    const [planDays, setPlanDays] = useState<DayPlan[]>([]);
    const [loadingMy, setLoadingMy] = useState(false);
    const [saving, setSaving] = useState(false);

    // Team Plans state
    const [teamPlans, setTeamPlans] = useState<WeeklyPlan[]>([]);
    const [loadingTeam, setLoadingTeam] = useState(false);
    const [refreshingTeam, setRefreshingTeam] = useState(false);

    // Schools for pickers + leads for stage filtering
    const [schools, setSchools] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);

    // Reject modal
    const [rejectTarget, setRejectTarget] = useState<WeeklyPlan | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [rejecting, setRejecting] = useState(false);

    // Load assigned schools for the week (date-specific) + leads for stage info
    useEffect(() => {
      const loadSchoolsAndLeads = async () => {
        // Fetch assigned schools per day and deduplicate
        try {
          const allAssignments: any[] = [];
          for (let i = 0; i < 7; i++) {
            const date = toYMD(addDays(weekMonday, i));
            try {
              const res = await schoolsApi.getMyAssignments(date);
              const items: any[] = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? [];
              items.forEach((a: any) => {
                if (!allAssignments.find(x => (x.schoolId || x.id) === (a.schoolId || a.id)))
                  allAssignments.push(a);
              });
            } catch {}
          }
          if (allAssignments.length > 0) {
            setSchools(allAssignments.map(a => ({
              id: a.schoolId || a.id,
              name: a.schoolName || a.name,
              city: a.schoolCity || a.city || '',
            })));
          } else {
            // Fallback to all schools if no assignments found
            const res = await schoolsApi.getAll({ limit: 500 } as any);
            const d: any = res.data;
            setSchools(Array.isArray(d) ? d : d?.items ?? d?.schools ?? []);
          }
        } catch {
          // Fallback to all schools
          try {
            const res = await schoolsApi.getAll({ limit: 500 } as any);
            const d: any = res.data;
            setSchools(Array.isArray(d) ? d : d?.items ?? d?.schools ?? []);
          } catch {}
        }

        // Fetch leads for stage info
        try {
          const res = await leadsApi.getLeads({ pageSize: 200 });
          const d: any = res.data;
          setLeads(Array.isArray(d) ? d : d?.items ?? d?.leads ?? []);
        } catch {}
      };
      loadSchoolsAndLeads();
    }, [weekMonday]);

    // Load My Plan
    const loadMyPlan = useCallback(async () => {
      setLoadingMy(true);
      try {
        const res = await weeklyPlanApi.getMy(toYMD(weekMonday));
        const plan: any = res.data;
        if (plan && plan.id) {
          setMyPlan(plan);
          const parsed = parsePlanData(plan.planData);
          setPlanDays(parsed.length > 0 ? parsed : buildEmptyWeek(weekMonday));
        } else {
          setMyPlan(null);
          setPlanDays(buildEmptyWeek(weekMonday));
        }
      } catch {
        setMyPlan(null);
        setPlanDays(buildEmptyWeek(weekMonday));
      } finally {
        setLoadingMy(false);
      }
    }, [weekMonday]);

    // Load Team Plans
    const loadTeamPlans = useCallback(async (refresh = false) => {
      if (refresh) setRefreshingTeam(true); else setLoadingTeam(true);
      try {
        const res = await weeklyPlanApi.getTeam(toYMD(weekMonday));
        const data: any = res.data;
        setTeamPlans(Array.isArray(data) ? data : data?.items ?? []);
      } catch {
        setTeamPlans([]);
      } finally {
        setLoadingTeam(false);
        setRefreshingTeam(false);
      }
    }, [weekMonday]);

    useEffect(() => {
      if (tab === 'my') loadMyPlan();
      else if (isManager) loadTeamPlans();
    }, [tab, weekMonday]);

    const prevWeek = () => setWeekMonday(d => addDays(d, -7));
    const nextWeek = () => setWeekMonday(d => addDays(d, 7));

    // Save Draft
    const handleSaveDraft = async () => {
      setSaving(true);
      try {
        if (myPlan?.id) {
          await weeklyPlanApi.update(myPlan.id, JSON.stringify(planDays));
        } else {
          await weeklyPlanApi.create({
            weekStartDate: toYMD(weekMonday),
            weekEndDate: toYMD(addDays(weekMonday, 6)),
            planData: JSON.stringify(planDays),
          });
        }
        Alert.alert('Saved', 'Weekly plan saved as draft');
        loadMyPlan();
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to save plan');
      } finally {
        setSaving(false);
      }
    };

    // Submit for Review — auto-saves first if no plan exists (like web)
    const handleSubmit = async () => {
      Alert.alert('Submit Plan', 'Submit this plan for review?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit', onPress: async () => {
            setSaving(true);
            try {
              let planId = myPlan?.id;
              // Auto-save first if plan doesn't exist yet
              if (!planId) {
                const createRes = await weeklyPlanApi.create({
                  weekStartDate: toYMD(weekMonday),
                  weekEndDate: toYMD(addDays(weekMonday, 6)),
                  planData: JSON.stringify(planDays),
                });
                planId = (createRes.data as any)?.id;
              } else {
                // Save latest changes before submitting
                await weeklyPlanApi.update(planId, JSON.stringify(planDays));
              }
              if (planId) {
                await weeklyPlanApi.submit(planId);
                loadMyPlan();
              } else {
                Alert.alert('Error', 'Failed to create plan');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to submit');
            } finally {
              setSaving(false);
            }
          },
        },
      ]);
    };

    // Approve
    const handleApprove = async (plan: WeeklyPlan) => {
      Alert.alert('Approve Plan', `Approve ${plan.userName}'s plan?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', onPress: async () => {
            try {
              await weeklyPlanApi.approve(plan.id);
              loadTeamPlans();
            } catch { Alert.alert('Error', 'Failed to approve plan'); }
          },
        },
      ]);
    };

    // Reject
    const handleRejectSubmit = async () => {
      if (!rejectTarget) return;
      if (!rejectNotes.trim()) { Alert.alert('Required', 'Please enter rejection reason'); return; }
      setRejecting(true);
      try {
        await weeklyPlanApi.reject(rejectTarget.id, rejectNotes);
        setRejectTarget(null);
        setRejectNotes('');
        loadTeamPlans();
      } catch { Alert.alert('Error', 'Failed to reject plan'); }
      finally { setRejecting(false); }
    };

    const isSubmitted = myPlan?.status === 'Submitted' || myPlan?.status === 'Approved';
    const canEdit = !myPlan || myPlan.status === 'Draft' || myPlan.status === 'Rejected' || myPlan.status === 'EditedByManager';

    const WeekControls = () => (
      <View style={s.controlsCard}>
        <View style={s.controlsTopRow}>
          <Text style={s.controlsTitle}>Weekly Plan</Text>
        </View>

        <View style={s.weekNav}>
          <TouchableOpacity style={s.weekBtn} onPress={prevWeek}>
            <ChevronLeft size={18} color={COLOR.primary} />
          </TouchableOpacity>
          <Text style={s.weekRange}>{fmtWeekRange(weekMonday)}</Text>
          <TouchableOpacity style={s.weekBtn} onPress={nextWeek}>
            <ChevronRight size={18} color={COLOR.primary} />
          </TouchableOpacity>
        </View>

        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'my' && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
            onPress={() => setTab('my')}
          >
            <Text style={[s.tabText, tab === 'my' && { color: '#FFF' }]}>My Plan</Text>
          </TouchableOpacity>
          {isManager && (
            <TouchableOpacity
              style={[s.tabBtn, tab === 'team' && { backgroundColor: COLOR.primary, borderColor: COLOR.primary }]}
              onPress={() => setTab('team')}
            >
              <Text style={[s.tabText, tab === 'team' && { color: '#FFF' }]}>Team Plans</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );

    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>

        {/* ── MY PLAN TAB ── */}
        {tab === 'my' && (
          loadingMy ? (
            <View style={s.center}><ActivityIndicator color={COLOR.primary} size="large" /></View>
          ) : (
            <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              <WeekControls />
              {/* Status */}
              {myPlan && (
                <View style={s.statusRow}>
                  <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[myPlan.status] || '#6B7280') + '20' }]}>
                    <Text style={[s.statusText, { color: STATUS_COLORS[myPlan.status] || '#6B7280' }]}>
                      {myPlan.status}
                    </Text>
                  </View>
                  {myPlan.reviewedByName && (
                    <Text style={s.reviewedBy}>by {myPlan.reviewedByName}</Text>
                  )}
                </View>
              )}

              {/* Rejection banner */}
              {myPlan?.status === 'Rejected' && myPlan.reviewNotes && (
                <View style={s.rejectedBanner}>
                  <Text style={s.rejectedTitle}>Plan Rejected</Text>
                  <Text style={s.rejectedNotes}>{myPlan.reviewNotes}</Text>
                  <Text style={s.rejectedHint}>Please revise and resubmit.</Text>
                </View>
              )}

              {/* Manager edit banner */}
              {myPlan?.status === 'EditedByManager' && (
                <View style={s.editedBanner}>
                  <Text style={s.editedTitle}>Manager Edited Your Plan</Text>
                  <Text style={s.editedHint}>Your plan was edited by your manager. Review the changes below and resubmit.</Text>
                </View>
              )}

              {/* Days */}
              {(Array.isArray(planDays) ? planDays : []).map((day, i) => (
                <DayCard
                  key={day.date}
                  day={day}
                  schools={schools}
                  leads={leads}
                  editable={canEdit}
                  onChange={canEdit ? (d) => {
                    const updated = [...planDays];
                    updated[i] = d;
                    setPlanDays(updated);
                  } : undefined}
                  color={COLOR.primary}
                />
              ))}

              {/* Action Buttons */}
              {canEdit && (
                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={[s.draftBtn, { borderColor: COLOR.primary, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSaveDraft}
                    disabled={saving}
                  >
                    <Text style={[s.draftText, { color: COLOR.primary }]}>{saving ? 'Saving...' : 'Save Draft'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.submitBtn, { backgroundColor: COLOR.primary, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSubmit}
                    disabled={saving || !myPlan?.id}
                  >
                    <Text style={s.submitText}>Submit for Review</Text>
                  </TouchableOpacity>
                </View>
              )}

              {isSubmitted && (
                <View style={s.submittedNote}>
                  <Text style={s.submittedNoteText}>
                    Plan is {myPlan?.status?.toLowerCase()} and cannot be edited.
                  </Text>
                </View>
              )}
            </ScrollView>
          )
        )}

        {/* ── TEAM PLANS TAB ── */}
        {tab === 'team' && isManager && (
          loadingTeam ? (
            <View style={s.center}><ActivityIndicator color={COLOR.primary} size="large" /></View>
          ) : (
            <FlatList
              data={teamPlans}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={[s.content, teamPlans.length === 0 && { flex: 1 }]}
              ListHeaderComponent={<WeekControls />}
              refreshControl={
                <RefreshControl
                  refreshing={refreshingTeam}
                  onRefresh={() => loadTeamPlans(true)}
                  colors={[COLOR.primary]}
                />
              }
              renderItem={({ item }) => (
                <TeamMemberCard
                  plan={item}
                  schools={schools}
                  leads={leads}
                  color={COLOR.primary}
                  onApprove={() => handleApprove(item)}
                  onReject={() => { setRejectTarget(item); setRejectNotes(''); }}
                />
              )}
              ListEmptyComponent={
                <View style={s.emptyCenter}>
                  <Text style={s.emptyIcon}>📋</Text>
                  <Text style={s.emptyTitle}>No team plans</Text>
                  <Text style={s.emptySub}>No plans submitted for this week</Text>
                </View>
              }
            />
          )
        )}

        {/* Reject Modal */}
        <Modal visible={!!rejectTarget} transparent animationType="slide" onRequestClose={() => setRejectTarget(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Reject Plan</Text>
              <Text style={s.modalSub}>
                Rejecting plan for <Text style={{ fontWeight: '700' }}>{rejectTarget?.userName}</Text>
              </Text>
              <Text style={s.fieldLabel}>Reason *</Text>
              <TextInput
                style={s.textarea}
                value={rejectNotes}
                onChangeText={setRejectNotes}
                placeholder="Explain why this plan is being rejected..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setRejectTarget(null)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.rejectBtn, { opacity: rejecting ? 0.6 : 1 }]}
                  onPress={handleRejectSubmit}
                  disabled={rejecting}
                >
                  <Text style={s.rejectText}>{rejecting ? 'Rejecting...' : 'Reject Plan'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  };

  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F9FAFB' },
    controlsCard: {
      backgroundColor: '#FFF',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#EEF2F7',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    controlsTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    controlsTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
    weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    weekBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekRange: { fontSize: rf(13), fontWeight: '700', color: '#111827' },
    tabRow: { flexDirection: 'row', gap: 8 },
    tabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 100,
      backgroundColor: '#FFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    tabText: { fontSize: rf(13), fontWeight: '700', color: '#374151' },
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
    statusText: { fontSize: rf(12), fontWeight: '700' },
    reviewedBy: { fontSize: rf(12), color: '#9CA3AF' },
    rejectedBanner: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#DC2626' },
    rejectedTitle: { fontSize: rf(14), fontWeight: '700', color: '#DC2626', marginBottom: 4 },
    rejectedNotes: { fontSize: rf(13), color: '#374151', marginBottom: 4 },
    rejectedHint: { fontSize: rf(12), color: '#9CA3AF' },
    editedBanner: { backgroundColor: '#F5F3FF', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#7C3AED' },
    editedTitle: { fontSize: rf(14), fontWeight: '700', color: '#7C3AED', marginBottom: 4 },
    editedHint: { fontSize: rf(13), color: '#374151' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    draftBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
    draftText: { fontSize: rf(14), fontWeight: '700' },
    submitBtn: { flex: 1.4, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
    submitText: { fontSize: rf(14), fontWeight: '700', color: '#FFF' },
    submittedNote: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
    submittedNoteText: { fontSize: rf(13), color: '#16A34A', fontWeight: '600' },
    emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: rf(16), fontWeight: '700', color: '#374151', marginBottom: 6 },
    emptySub: { fontSize: rf(13), color: '#9CA3AF', textAlign: 'center' },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: rf(18), fontWeight: '700', color: '#111827', marginBottom: 4 },
    modalSub: { fontSize: rf(13), color: '#6B7280', marginBottom: 16 },
    fieldLabel: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
    textarea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: rf(14), color: '#111827', height: 110, textAlignVertical: 'top', backgroundColor: '#FAFAFA' },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
    cancelText: { fontSize: rf(14), fontWeight: '600', color: '#6B7280' },
    rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
    rejectText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
  });
