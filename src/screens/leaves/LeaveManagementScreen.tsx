import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal,
  TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Check, X, ChevronDown, ChevronUp, Send, Ban, AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { leavesApi } from '../../api/leaves';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Pending:     { bg: '#FEF3C7', text: '#D97706' },
  Approved:    { bg: '#D1FAE5', text: '#059669' },
  AutoApproved:{ bg: '#CCFBF1', text: '#0D9488' },
  Rejected:    { bg: '#FEE2E2', text: '#DC2626' },
  Cancelled:   { bg: '#F3F4F6', text: '#6B7280' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Casual:    { bg: '#DBEAFE', text: '#2563EB' },
  Sick:      { bg: '#FFEDD5', text: '#EA580C' },
  Personal:  { bg: '#EDE9FE', text: '#7C3AED' },
  Emergency: { bg: '#FEE2E2', text: '#DC2626' },
};

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={fm.header}>
          <Text style={fm.title}>Apply for Leave</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={8}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={fm.content}>
          <DateInput
            label="Leave Date *"
            value={form.leaveDate}
            onChange={v => setForm(f => ({ ...f, leaveDate: v }))}
            accentColor="#0D9488"
          />
          {isSameDay && form.leaveDate ? (
            <Text style={fm.autoNote}>Same-day leave will be auto-approved</Text>
          ) : null}

          <SelectPicker
            label="Leave Type *"
            options={LEAVE_TYPES}
            value={form.leaveType}
            onChange={v => setForm(f => ({ ...f, leaveType: String(v) }))}
            accentColor="#0D9488"
          />
          <SelectPicker
            label="Leave Category *"
            options={LEAVE_CATEGORIES}
            value={form.leaveCategory}
            onChange={v => setForm(f => ({ ...f, leaveCategory: String(v) }))}
            accentColor="#0D9488"
          />

          <Text style={fm.label}>Reason *</Text>
          <TextInput
            style={fm.textarea}
            value={form.reason}
            onChangeText={t => setForm(f => ({ ...f, reason: t }))}
            placeholder="Why are you taking leave?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={[fm.label, { marginTop: 12 }]}>Cover Arrangement (optional)</Text>
          <TextInput
            style={fm.textarea}
            value={form.coverArrangement}
            onChangeText={t => setForm(f => ({ ...f, coverArrangement: t }))}
            placeholder="Who will handle your responsibilities?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[fm.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Send size={16} color="#FFF" />
            )}
            <Text style={fm.submitText}>
              {submitting ? 'Submitting...' : isSameDay ? 'Submit (Auto-Approve)' : 'Submit for Approval'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const fm = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF' },
  title: { fontSize: rf(17), fontWeight: '700', color: '#111827' },
  content: { padding: 16, gap: 4 },
  label: { fontSize: rf(13), fontWeight: '600', color: '#374151', marginBottom: 6 },
  autoNote: { fontSize: rf(12), color: '#0D9488', fontWeight: '500', marginBottom: 12, marginTop: -8 },
  textarea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: rf(14), color: '#111827', minHeight: 80, marginBottom: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0D9488', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  submitText: { color: '#FFF', fontSize: rf(15), fontWeight: '700' },
});

// ─── Reject Modal ────────────────────────────────────────────────────────────

function RejectModal({ visible, onClose, onReject, rejecting }: any) {
  const [reason, setReason] = useState('');
  const handle = () => {
    if (!reason.trim()) { Alert.alert('Error', 'Please provide a rejection reason'); return; }
    onReject(reason.trim());
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.box}>
          <Text style={rm.title}>Reject Leave Request</Text>
          <TextInput
            style={rm.textarea}
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={rm.actions}>
            <TouchableOpacity style={rm.cancelBtn} onPress={onClose}>
              <Text style={rm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rm.rejectBtn, rejecting && { opacity: 0.6 }]} onPress={handle} disabled={rejecting}>
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
  box: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  title: { fontSize: rf(16), fontWeight: '700', color: '#111827', marginBottom: 12 },
  textarea: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: rf(14), color: '#111827', minHeight: 80, marginBottom: 16, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontSize: rf(14), fontWeight: '600', color: '#374151' },
  rejectBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
  rejectText: { fontSize: rf(14), fontWeight: '600', color: '#FFF' },
});

// ─── Leave Card ──────────────────────────────────────────────────────────────

function LeaveCard({ leave, isTeam, onCancel, onApprove, onReject }: any) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_COLORS[leave.status] || { bg: '#F3F4F6', text: '#6B7280' };
  const cc = CATEGORY_COLORS[leave.leaveCategory] || { bg: '#F3F4F6', text: '#6B7280' };
  const leaveTypeLabel = LEAVE_TYPES.find(t => t.value === leave.leaveType)?.label || leave.leaveType;
  const canCancel = ['Pending', 'Approved', 'AutoApproved'].includes(leave.status) &&
    new Date(leave.leaveDate) >= new Date(getToday());

  return (
    <View style={lc.card}>
      <TouchableOpacity style={lc.row} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        {isTeam ? (
          <View style={lc.avatar}>
            <Text style={lc.avatarText}>{initials(leave.userName || '')}</Text>
          </View>
        ) : (
          <View style={lc.dateBox}>
            <Text style={lc.dateDay}>{new Date(leave.leaveDate).getDate()}</Text>
            <Text style={lc.dateMon}>{new Date(leave.leaveDate).toLocaleDateString('en-IN', { month: 'short' })}</Text>
            <Text style={lc.dateWkd}>{new Date(leave.leaveDate).toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {isTeam && (
            <Text style={lc.name}>{leave.userName} <Text style={lc.role}>({leave.userRole})</Text></Text>
          )}
          {isTeam && (
            <Text style={lc.dateStr}>{formatDate(leave.leaveDate)}</Text>
          )}
          <View style={lc.badges}>
            <View style={[lc.badge, { backgroundColor: sc.bg }]}>
              <Text style={[lc.badgeText, { color: sc.text }]}>{leave.status === 'AutoApproved' ? 'Auto-Approved' : leave.status}</Text>
            </View>
            <View style={[lc.badge, { backgroundColor: cc.bg }]}>
              <Text style={[lc.badgeText, { color: cc.text }]}>{leave.leaveCategory}</Text>
            </View>
            <Text style={lc.typeText}>{leaveTypeLabel}</Text>
          </View>
          <Text style={lc.reason} numberOfLines={expanded ? undefined : 2}>{leave.reason}</Text>
        </View>

        <View style={lc.actions}>
          {isTeam && leave.status === 'Pending' && (
            <>
              <TouchableOpacity style={lc.approveBtn} onPress={() => onApprove(leave)}>
                <Check size={14} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={lc.rejectBtn} onPress={() => onReject(leave.id)}>
                <X size={14} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
          {!isTeam && canCancel && (
            <TouchableOpacity style={lc.cancelBtn} onPress={() => onCancel(leave.id)}>
              <Ban size={12} color="#DC2626" />
            </TouchableOpacity>
          )}
          {expanded ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={lc.expanded}>
          {leave.coverArrangement ? <Text style={lc.expandText}><Text style={lc.expandLabel}>Cover: </Text>{leave.coverArrangement}</Text> : null}
          {leave.actionedByName ? (
            <Text style={lc.expandText}>
              <Text style={lc.expandLabel}>{leave.status === 'Rejected' ? 'Rejected' : 'Approved'} by: </Text>
              {leave.actionedByName}{leave.actionedAt ? ` on ${new Date(leave.actionedAt).toLocaleDateString('en-IN')}` : ''}
            </Text>
          ) : null}
          {leave.rejectionReason ? <Text style={[lc.expandText, { color: '#DC2626' }]}><Text style={lc.expandLabel}>Rejection reason: </Text>{leave.rejectionReason}</Text> : null}
          {leave.planImpactMessage ? (
            <View style={lc.impactBox}>
              <AlertTriangle size={12} color="#D97706" />
              <Text style={lc.impactText}>{leave.planImpactMessage}</Text>
            </View>
          ) : null}
          <Text style={lc.appliedAt}>Applied: {leave.createdAt ? new Date(leave.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
        </View>
      )}
    </View>
  );
}

const lc = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  dateBox: { alignItems: 'center', minWidth: 44 },
  dateDay: { fontSize: rf(20), fontWeight: '800', color: '#111827' },
  dateMon: { fontSize: rf(11), color: '#6B7280' },
  dateWkd: { fontSize: rf(10), color: '#9CA3AF' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: rf(13), fontWeight: '700', color: '#0D9488' },
  name: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  role: { fontSize: rf(12), color: '#6B7280', fontWeight: '400' },
  dateStr: { fontSize: rf(12), color: '#6B7280', marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeText: { fontSize: rf(11), fontWeight: '700' },
  typeText: { fontSize: rf(11), color: '#9CA3AF', alignSelf: 'center' },
  reason: { fontSize: rf(13), color: '#374151' },
  actions: { alignItems: 'center', gap: 6 },
  approveBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  expandLabel: { fontWeight: '600', color: '#374151' },
  expandText: { fontSize: rf(12), color: '#6B7280' },
  impactBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginTop: 4 },
  impactText: { fontSize: rf(12), color: '#D97706', flex: 1 },
  appliedAt: { fontSize: rf(11), color: '#9CA3AF', marginTop: 4 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const LeaveManagementScreen = () => {
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const isManager = role !== 'FO';
  const COLOR = ROLE_COLORS[role as keyof typeof ROLE_COLORS];

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
  const [approveLeave, setApproveLeave] = useState<any>(null);

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

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* Header */}
      <View style={s.headerBar}>
        <View>
          <Text style={s.pageTitle}>Leave Management</Text>
          <Text style={s.pageSub}>Apply for leaves and track your leave history</Text>
        </View>
        <TouchableOpacity style={[s.applyBtn, { backgroundColor: COLOR.primary }]} onPress={() => setShowApply(true)}>
          <Plus size={16} color="#FFF" />
          <Text style={s.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tabBtn, tab === 'my' && { backgroundColor: COLOR.primary }]} onPress={() => setTab('my')}>
          <Text style={[s.tabText, tab === 'my' && { color: '#FFF' }]}>My Leaves</Text>
        </TouchableOpacity>
        {isManager && (
          <TouchableOpacity style={[s.tabBtn, tab === 'team' && { backgroundColor: COLOR.primary }]} onPress={() => setTab('team')}>
            <Text style={[s.tabText, tab === 'team' && { color: '#FFF' }]}>Team Leaves</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* My Leaves Tab */}
      {tab === 'my' && (
        <View style={{ flex: 1 }}>
          {/* Filters */}
          <View style={s.filterRow}>
            <SelectPicker
              placeholder="Status"
              options={STATUS_OPTIONS}
              value={myStatusFilter}
              onChange={v => setMyStatusFilter(String(v))}
              accentColor={COLOR.primary}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <SelectPicker
              placeholder="Category"
              options={[{ value: '', label: 'All Categories' }, ...LEAVE_CATEGORIES]}
              value={myCatFilter}
              onChange={v => setMyCatFilter(String(v))}
              accentColor={COLOR.primary}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
          </View>

          {myLoading ? (
            <LoadingSpinner fullScreen color={COLOR.primary} message="Loading leaves..." />
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
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>📋</Text>
                  <Text style={s.emptyText}>No leave records found</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Team Leaves Tab */}
      {tab === 'team' && isManager && (
        <View style={{ flex: 1 }}>
          <View style={s.filterRow}>
            <SelectPicker
              placeholder="Status"
              options={STATUS_OPTIONS}
              value={teamStatusFilter}
              onChange={v => setTeamStatusFilter(String(v))}
              accentColor={COLOR.primary}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            {teamMemberOptions.length > 1 && (
              <SelectPicker
                placeholder="All Members"
                options={teamMemberOptions}
                value={userFilter}
                onChange={v => setUserFilter(String(v))}
                accentColor={COLOR.primary}
                containerStyle={{ flex: 1, marginBottom: 0 }}
              />
            )}
          </View>

          {teamLoading ? (
            <LoadingSpinner fullScreen color={COLOR.primary} message="Loading team leaves..." />
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
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>👥</Text>
                  <Text style={s.emptyText}>No team leave requests</Text>
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
    </SafeAreaView>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pageTitle: { fontSize: rf(18), fontWeight: '800', color: '#111827' },
  pageSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  applyBtnText: { color: '#FFF', fontSize: rf(13), fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tabText: { fontSize: rf(13), fontWeight: '700', color: '#6B7280' },
  filterRow: { flexDirection: 'row', gap: 8, padding: 12 },
  list: { padding: 12, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: rf(14), color: '#9CA3AF', textAlign: 'center' },
});
