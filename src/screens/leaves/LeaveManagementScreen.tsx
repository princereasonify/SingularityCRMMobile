import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  TextInput, FlatList, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus, Check, X, ChevronDown, ChevronUp, Send, Ban, AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { leavesApi } from '../../api/leaves';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { GradientBackground } from '../../components/common/GradientBackground';
import { GradientButton } from '../../components/common/GradientButton';
import { Fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/appTheme';
import { rf, isTabletDevice } from '../../utils/responsive';

// ─── Constants ──────────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { value: 'FullDay', label: 'Full Day' },
  { value: 'HalfDayFirstHalf', label: 'Half Day - First Half' },
  { value: 'HalfDaySecondHalf', label: 'Half Day - Second Half' },
];

const LEAVE_CATEGORIES = [
  { value: 'Casual', label: 'Casual Leave' },
  { value: 'Sick', label: 'Sick Leave' },
  { value: 'Personal', label: 'Personal Leave' },
  { value: 'Emergency', label: 'Emergency Leave' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'AutoApproved', label: 'Auto-Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Cancelled', label: 'Cancelled' },
];

// Map leave status / category to a theme token so badges flip with light/dark.
const statusToken = (T: AppTheme, status: string): string =>
  (({
    Pending: T.warning,
    Approved: T.success,
    AutoApproved: T.info,
    Rejected: T.danger,
    Cancelled: T.sub,
  } as Record<string, string>)[status]) || T.sub;

const categoryToken = (T: AppTheme, cat: string): string =>
  (({
    Casual: T.info,
    Sick: T.warning,
    Personal: T.accent,
    Emergency: T.danger,
  } as Record<string, string>)[cat]) || T.sub;

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' });
}

function initials(name: string) {
  return (name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Apply Form Modal ────────────────────────────────────────────────────────

function ApplyModal({ visible, onClose, onSubmit, submitting }: any) {
  const T = useAppTheme();
  const [form, setForm] = useState({
    leaveDate: '',
    leaveType: 'FullDay',
    leaveCategory: 'Casual',
    reason: '',
    coverArrangement: '',
  });

  const isSameDay = form.leaveDate === getToday();

  const reset = () => setForm({ leaveDate: '', leaveType: 'FullDay', leaveCategory: 'Casual', reason: '', coverArrangement: '' });

  const handleSubmit = () => {
    if (!form.leaveDate) { Alert.alert('Error', 'Please select a leave date'); return; }
    if (!form.reason.trim()) { Alert.alert('Error', 'Please provide a reason'); return; }
    onSubmit({ ...form, reason: form.reason.trim(), coverArrangement: form.coverArrangement.trim() || null });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
        <View style={[fm.header, { backgroundColor: T.card, borderBottomColor: T.line }]}>
          <Text style={[fm.title, { color: T.text }]}>Apply for Leave</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <X size={22} color={T.sub} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={fm.content} keyboardShouldPersistTaps="handled">
          <DateInput
            label="Leave Date *"
            value={form.leaveDate}
            onChange={v => setForm(f => ({ ...f, leaveDate: v }))}
            accentColor={T.accent}
          />
          {isSameDay && form.leaveDate ? (
            <Text style={[fm.autoNote, { color: T.accent }]}>Same-day leave will be auto-approved</Text>
          ) : null}

          <SelectPicker
            label="Leave Type *"
            options={LEAVE_TYPES}
            value={form.leaveType}
            onChange={v => setForm(f => ({ ...f, leaveType: String(v) }))}
            accentColor={T.accent}
          />
          <SelectPicker
            label="Leave Category *"
            options={LEAVE_CATEGORIES}
            value={form.leaveCategory}
            onChange={v => setForm(f => ({ ...f, leaveCategory: String(v) }))}
            accentColor={T.accent}
          />

          <Text style={[fm.label, { color: T.text }]}>Reason *</Text>
          <TextInput
            style={[fm.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={form.reason}
            onChangeText={t => setForm(f => ({ ...f, reason: t }))}
            placeholder="Why are you taking leave?"
            placeholderTextColor={T.dim}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={[fm.label, { color: T.text, marginTop: 12 }]}>Cover Arrangement (optional)</Text>
          <TextInput
            style={[fm.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={form.coverArrangement}
            onChangeText={t => setForm(f => ({ ...f, coverArrangement: t }))}
            placeholder="Who will handle your responsibilities?"
            placeholderTextColor={T.dim}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <GradientButton
            label={submitting ? 'Submitting...' : isSameDay ? 'Submit (Auto-Approve)' : 'Submit for Approval'}
            onPress={handleSubmit}
            loading={submitting}
            icon={!submitting ? <Send size={16} color="#FFF" /> : undefined}
            style={{ marginTop: 20 }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const fm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: rf(17), fontFamily: Fonts.bold },
  content: { padding: 16, gap: 4 },
  label: { fontSize: rf(13), fontFamily: Fonts.medium, marginBottom: 6 },
  autoNote: { fontSize: rf(12), fontFamily: Fonts.medium, marginBottom: 12, marginTop: -8 },
  textarea: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: rf(14), fontFamily: Fonts.regular, minHeight: 80, marginBottom: 4 },
});

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ visible, onClose, onReject, rejecting }: any) {
  const T = useAppTheme();
  const [reason, setReason] = useState('');
  const handle = () => {
    if (!reason.trim()) { Alert.alert('Error', 'Please provide a rejection reason'); return; }
    onReject(reason.trim());
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={[rm.box, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[rm.title, { color: T.text }]}>Reject Leave Request</Text>
          <TextInput
            style={[rm.textarea, { backgroundColor: T.fieldBg, borderColor: T.line, color: T.text }]}
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor={T.dim}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={rm.actions}>
            <TouchableOpacity style={[rm.cancelBtn, { backgroundColor: T.cardAlt }]} onPress={onClose}>
              <Text style={[rm.cancelText, { color: T.sub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rm.rejectBtn, { backgroundColor: T.danger }, rejecting && { opacity: 0.6 }]} onPress={handle} disabled={rejecting}>
              <Text style={rm.rejectText}>{rejecting ? 'Rejecting...' : 'Reject Leave'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { borderRadius: 18, borderWidth: 1, padding: 20, width: '100%', maxWidth: 400 },
  title: { fontSize: rf(16), fontFamily: Fonts.bold, marginBottom: 12 },
  textarea: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: rf(14), fontFamily: Fonts.regular, minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontFamily: Fonts.medium },
  rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  rejectText: { fontSize: rf(14), fontFamily: Fonts.bold, color: '#FFF' },
});

// ─── Leave Card ──────────────────────────────────────────────────────────────

function LeaveCard({ leave, isTeam, onCancel, onApprove, onReject }: any) {
  const T = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const sc = statusToken(T, leave.status);
  const cc = categoryToken(T, leave.leaveCategory);
  const leaveTypeLabel = LEAVE_TYPES.find(t => t.value === leave.leaveType)?.label || leave.leaveType;
  const canCancel = ['Pending', 'Approved', 'AutoApproved'].includes(leave.status) &&
    new Date(leave.leaveDate) >= new Date(getToday());

  return (
    <View style={[lc.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <TouchableOpacity style={lc.row} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        {isTeam ? (
          <View style={[lc.avatar, { backgroundColor: T.accentSoft }]}>
            <Text style={[lc.avatarText, { color: T.accent }]}>{initials(leave.userName || '')}</Text>
          </View>
        ) : (
          <View style={lc.dateBox}>
            <Text style={[lc.dateDay, { color: T.text }]}>{new Date(leave.leaveDate).getDate()}</Text>
            <Text style={[lc.dateMon, { color: T.sub }]}>{new Date(leave.leaveDate).toLocaleDateString('en-IN', { month: 'short' })}</Text>
            <Text style={[lc.dateWkd, { color: T.dim }]}>{new Date(leave.leaveDate).toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {isTeam && (
            <Text style={[lc.name, { color: T.text }]}>{leave.userName} <Text style={[lc.role, { color: T.sub }]}>({leave.userRole})</Text></Text>
          )}
          {isTeam && (
            <Text style={[lc.dateStr, { color: T.sub }]}>{formatDate(leave.leaveDate)}</Text>
          )}
          <View style={lc.badges}>
            <View style={[lc.badge, { backgroundColor: sc + '22' }]}>
              <Text style={[lc.badgeText, { color: sc }]}>{leave.status === 'AutoApproved' ? 'Auto-Approved' : leave.status}</Text>
            </View>
            <View style={[lc.badge, { backgroundColor: cc + '22' }]}>
              <Text style={[lc.badgeText, { color: cc }]}>{leave.leaveCategory}</Text>
            </View>
            <Text style={[lc.typeText, { color: T.dim }]}>{leaveTypeLabel}</Text>
          </View>
          <Text style={[lc.reason, { color: T.sub }]} numberOfLines={expanded ? undefined : 2}>{leave.reason}</Text>
        </View>

        <View style={lc.actions}>
          {isTeam && leave.status === 'Pending' && (
            <>
              <TouchableOpacity style={[lc.approveBtn, { backgroundColor: T.success }]} onPress={() => onApprove(leave)}>
                <Check size={14} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[lc.rejectBtn, { backgroundColor: T.danger }]} onPress={() => onReject(leave.id)}>
                <X size={14} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
          {!isTeam && canCancel && (
            <TouchableOpacity style={[lc.cancelBtn, { backgroundColor: T.danger + '22' }]} onPress={() => onCancel(leave.id)}>
              <Ban size={12} color={T.danger} />
            </TouchableOpacity>
          )}
          {expanded ? <ChevronUp size={16} color={T.dim} /> : <ChevronDown size={16} color={T.dim} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[lc.expanded, { borderTopColor: T.line }]}>
          {leave.coverArrangement ? <Text style={[lc.expandText, { color: T.sub }]}><Text style={[lc.expandLabel, { color: T.text }]}>Cover: </Text>{leave.coverArrangement}</Text> : null}
          {leave.actionedByName ? (
            <Text style={[lc.expandText, { color: T.sub }]}>
              <Text style={[lc.expandLabel, { color: T.text }]}>{leave.status === 'Rejected' ? 'Rejected' : 'Approved'} by: </Text>
              {leave.actionedByName}{leave.actionedAt ? ` on ${new Date(leave.actionedAt).toLocaleDateString('en-IN')}` : ''}
            </Text>
          ) : null}
          {leave.rejectionReason ? <Text style={[lc.expandText, { color: T.danger }]}><Text style={[lc.expandLabel, { color: T.danger }]}>Rejection reason: </Text>{leave.rejectionReason}</Text> : null}
          {leave.planImpactMessage ? (
            <View style={[lc.impactBox, { backgroundColor: T.warning + '22' }]}>
              <AlertTriangle size={12} color={T.warning} />
              <Text style={[lc.impactText, { color: T.warning }]}>{leave.planImpactMessage}</Text>
            </View>
          ) : null}
          <Text style={[lc.appliedAt, { color: T.dim }]}>Applied: {leave.createdAt ? new Date(leave.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
        </View>
      )}
    </View>
  );
}

const lc = StyleSheet.create({
  card: { borderRadius: 18, marginBottom: 10, overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  dateBox: { alignItems: 'center', minWidth: 44 },
  dateDay: { fontSize: rf(20), fontFamily: Fonts.bold },
  dateMon: { fontSize: rf(11), fontFamily: Fonts.regular },
  dateWkd: { fontSize: rf(10), fontFamily: Fonts.regular },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: rf(13), fontFamily: Fonts.bold },
  name: { fontSize: rf(14), fontFamily: Fonts.bold },
  role: { fontSize: rf(12), fontFamily: Fonts.regular },
  dateStr: { fontSize: rf(12), fontFamily: Fonts.regular, marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeText: { fontSize: rf(11), fontFamily: Fonts.bold },
  typeText: { fontSize: rf(11), fontFamily: Fonts.regular, alignSelf: 'center' },
  reason: { fontSize: rf(13), fontFamily: Fonts.regular },
  actions: { alignItems: 'center', gap: 6 },
  approveBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 4, borderTopWidth: 1 },
  expandLabel: { fontFamily: Fonts.medium },
  expandText: { fontSize: rf(12), fontFamily: Fonts.regular },
  impactBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, padding: 8, marginTop: 4 },
  impactText: { fontSize: rf(12), fontFamily: Fonts.regular, flex: 1 },
  appliedAt: { fontSize: rf(11), fontFamily: Fonts.regular, marginTop: 4 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const LeaveManagementScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const twoWide = isTabletDevice && width > height;
  const role = user?.role || 'FO';
  const isManager = role !== 'FO';

  const [tab, setTab] = useState<'my' | 'team'>('my');
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myStatusFilter, setMyStatusFilter] = useState('');
  const [myCatFilter, setMyCatFilter] = useState('');

  const [teamLeaves, setTeamLeaves] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamStatusFilter, setTeamStatusFilter] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState('');

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Fetch team members for manager filter
  useEffect(() => {
    if (!isManager) return;
    authApi.getUsers().then(res => setTeamMembers(res.data || [])).catch(() => {});
  }, [isManager]);

  const fetchMyLeaves = useCallback(async () => {
    setMyLoading(true);
    try {
      const params: any = {};
      if (myStatusFilter) params.status = myStatusFilter;
      if (myCatFilter) params.category = myCatFilter;
      const res = await leavesApi.getMyLeaves(params);
      setMyLeaves(res.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load leaves');
    } finally {
      setMyLoading(false);
    }
  }, [myStatusFilter, myCatFilter]);

  const fetchTeamLeaves = useCallback(async () => {
    setTeamLoading(true);
    try {
      const params: any = {};
      if (teamStatusFilter) params.status = teamStatusFilter;
      if (userFilter) params.filterUserId = userFilter;
      const res = await leavesApi.getTeamLeaves(params);
      setTeamLeaves(res.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load team leaves');
    } finally {
      setTeamLoading(false);
    }
  }, [teamStatusFilter, userFilter]);

  useEffect(() => { fetchMyLeaves(); }, [fetchMyLeaves]);
  useEffect(() => { if (tab === 'team' && isManager) fetchTeamLeaves(); }, [tab, fetchTeamLeaves, isManager]);

  const handleApply = async (form: any) => {
    setSubmitting(true);
    try {
      const res = await leavesApi.applyLeave(form);
      const status = (res.data as any)?.status;
      Alert.alert('Success', status === 'AutoApproved' ? 'Same-day leave auto-approved' : 'Leave applied — pending approval');
      setShowApply(false);
      fetchMyLeaves();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    Alert.alert('Cancel Leave', 'Cancel this leave request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          try {
            await leavesApi.cancelLeave(id);
            fetchMyLeaves();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel leave');
          }
        },
      },
    ]);
  };

  const handleApprove = (leave: any) => {
    Alert.alert(
      'Approve Leave',
      `Approve leave for ${leave.userName} on ${formatDate(leave.leaveDate)}?${leave.planImpactMessage ? '\n\n' + leave.planImpactMessage : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', onPress: async () => {
            try {
              await leavesApi.approveLeave(leave.id);
              fetchTeamLeaves();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to approve');
            }
          },
        },
      ],
    );
  };

  const handleReject = async (reason: string) => {
    if (!rejectId) return;
    setRejecting(true);
    try {
      await leavesApi.rejectLeave(rejectId, { rejectionReason: reason });
      setRejectId(null);
      fetchTeamLeaves();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const teamMemberOptions = [
    { value: '', label: 'All Team Members' },
    ...teamMembers.map(m => ({ value: String(m.id), label: `${m.name} (${m.role})` })),
  ];

  const listContent = [s.list, { paddingBottom: insets.bottom + 32 }, twoWide && s.contentMax];
  const filterWrap = [s.filterRow, twoWide && s.contentMax];

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      {/* Sunstone hero header */}
      <GradientBackground glow style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Leave Management</Text>
            <Text style={s.pageSub}>Apply for leaves and track your leave history</Text>
          </View>
          <TouchableOpacity style={s.applyBtn} onPress={() => setShowApply(true)}>
            <Plus size={16} color={T.accent} />
            <Text style={[s.applyBtnText, { color: T.accent }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>

      {/* Tabs */}
      <View style={[s.tabsWrap, twoWide && s.contentMax]}>
        <TouchableOpacity
          style={[s.tabBtn, { backgroundColor: tab === 'my' ? T.accent : T.cardAlt }]}
          onPress={() => setTab('my')}
        >
          <Text style={[s.tabText, { color: tab === 'my' ? T.onAccent : T.sub }]}>My Leaves</Text>
        </TouchableOpacity>
        {isManager && (
          <TouchableOpacity
            style={[s.tabBtn, { backgroundColor: tab === 'team' ? T.accent : T.cardAlt }]}
            onPress={() => setTab('team')}
          >
            <Text style={[s.tabText, { color: tab === 'team' ? T.onAccent : T.sub }]}>Team Leaves</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My Leaves Tab */}
      {tab === 'my' && (
        <View style={{ flex: 1 }}>
          {/* Filters */}
          <View style={filterWrap}>
            <SelectPicker
              placeholder="Status"
              options={STATUS_OPTIONS}
              value={myStatusFilter}
              onChange={v => setMyStatusFilter(String(v))}
              accentColor={T.accent}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <SelectPicker
              placeholder="Category"
              options={[{ value: '', label: 'All Categories' }, ...LEAVE_CATEGORIES]}
              value={myCatFilter}
              onChange={v => setMyCatFilter(String(v))}
              accentColor={T.accent}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
          </View>

          {myLoading ? (
            <LoadingSpinner fullScreen color={T.accent} message="Loading leaves..." />
          ) : (
            <FlatList
              data={myLeaves}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <LeaveCard
                  leave={item}
                  isTeam={false}
                  onCancel={handleCancel}
                  onApprove={() => {}}
                  onReject={() => {}}
                />
              )}
              contentContainerStyle={listContent}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>📋</Text>
                  <Text style={[s.emptyText, { color: T.dim }]}>No leave records found</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Team Leaves Tab */}
      {tab === 'team' && isManager && (
        <View style={{ flex: 1 }}>
          <View style={filterWrap}>
            <SelectPicker
              placeholder="Status"
              options={STATUS_OPTIONS}
              value={teamStatusFilter}
              onChange={v => setTeamStatusFilter(String(v))}
              accentColor={T.accent}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            {teamMemberOptions.length > 1 && (
              <SelectPicker
                placeholder="All Members"
                options={teamMemberOptions}
                value={userFilter}
                onChange={v => setUserFilter(String(v))}
                accentColor={T.accent}
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
            )}
          </View>

          {teamLoading ? (
            <LoadingSpinner fullScreen color={T.accent} message="Loading team leaves..." />
          ) : (
            <FlatList
              data={teamLeaves}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <LeaveCard
                  leave={item}
                  isTeam
                  onCancel={() => {}}
                  onApprove={handleApprove}
                  onReject={(id: number) => setRejectId(id)}
                />
              )}
              contentContainerStyle={listContent}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>👥</Text>
                  <Text style={[s.emptyText, { color: T.dim }]}>No team leave requests</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Apply Modal */}
      <ApplyModal
        visible={showApply}
        onClose={() => setShowApply(false)}
        onSubmit={handleApply}
        submitting={submitting}
      />

      {/* Reject Modal */}
      <RejectModal
        visible={rejectId !== null}
        onClose={() => setRejectId(null)}
        onReject={handleReject}
        rejecting={rejecting}
      />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  pageTitle: { fontSize: rf(20), fontFamily: Fonts.bold, color: '#FFF', letterSpacing: -0.3 },
  pageSub: { fontSize: rf(12), fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.92)' },
  applyBtnText: { fontSize: rf(13), fontFamily: Fonts.bold },
  tabsWrap: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  tabText: { fontSize: rf(13), fontFamily: Fonts.bold },
  filterRow: { flexDirection: 'row', gap: 8, padding: 12 },
  contentMax: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  list: { padding: 12, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: rf(14), fontFamily: Fonts.regular, textAlign: 'center' },
});
