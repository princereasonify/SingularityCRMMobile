import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Check, X, ChevronDown, ChevronUp, Send, Ban, AlertTriangle,
  CalendarOff, Clock, Filter, Users, WifiOff,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { leavesApi } from '../../api/leaves';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Segmented, Trigger, Dropdown,
  StatusBadge, FilterChip, Pagination, Avatar, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Leave Management — apply, track, and (for managers) approve/reject team leave.
 *
 * Web parity source: Sales_CRM_Web/src/pages/common/LeaveManagement.jsx.
 *
 * VERIFIED against LeavesController.cs:
 *  · POST /leaves                  → Ok(ApiResponse<LeaveRequestDto>.Ok(leave, "Leave applied successfully"))
 *  · GET  /leaves/my?status&category&from&to   → Ok(ApiResponse<List<LeaveRequestDto>>.Ok(leaves))
 *  · GET  /leaves/team?status&category&from&to&filterUserId
 *                                  → Ok(ApiResponse<List<LeaveRequestDto>>.Ok(leaves))  [403 for FO]
 *  · POST /leaves/{id}/approve     → Ok(ApiResponse<LeaveRequestDto>.Ok(leave, "Leave approved"))
 *  · POST /leaves/{id}/reject      → Ok(ApiResponse<LeaveRequestDto>.Ok(leave, "Leave rejected"))
 *  · POST /leaves/{id}/cancel      → Ok(ApiResponse<LeaveRequestDto>.Ok(leave, "Leave cancelled"))
 * `category` is bound on BOTH my and team — web filters by it on both tabs, so we do too.
 */

const PAGE_SIZE = 10;
const DASH = '—';

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

const CATEGORY_OPTIONS = [{ value: '', label: 'All Categories' }, ...LEAVE_CATEGORIES];

type Tab = 'my' | 'team';

/**
 * Status → token. Approved and AutoApproved are ADJACENT approval tiers and must never
 * share a hue: Approved→success, AutoApproved→info (web: green vs teal).
 */
const statusToken = (T: AppTheme, status: string): string =>
  (({
    Pending: T.warning,
    Approved: T.success,
    AutoApproved: T.info,
    Rejected: T.danger,
    Cancelled: T.dim,
  } as Record<string, string>)[status]) || T.dim;

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  AutoApproved: 'Auto-Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
};
const statusLabel = (st: string) => STATUS_LABELS[st] || st;

/** Category → token. Web: Casual blue · Sick orange · Personal purple · Emergency red. */
const categoryToken = (T: AppTheme, cat: string): string =>
  (({
    Casual: T.info,
    Sick: T.warning,
    Personal: T.accent,
    Emergency: T.danger,
  } as Record<string, string>)[cat]) || T.dim;

const getToday = () => new Date().toISOString().split('T')[0];

const fmtDate = (d?: string) =>
  !d ? DASH : new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const fmtApplied = (d?: string) =>
  !d
    ? DASH
    : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

const typeLabel = (t: string) => LEAVE_TYPES.find(x => x.value === t)?.label || t;

// ─── Apply modal ──────────────────────────────────────────────────────────────
function ApplyModal({ onClose, onSubmit, submitting }: {
  onClose: () => void; onSubmit: (f: any) => void; submitting: boolean;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [leaveDate, setLeaveDate] = useState('');
  const [leaveType, setLeaveType] = useState('FullDay');
  const [leaveCategory, setLeaveCategory] = useState('Casual');
  const [reason, setReason] = useState('');
  const [coverArrangement, setCoverArrangement] = useState('');
  const [openDd, setOpenDd] = useState<'type' | 'cat' | null>(null);

  const isSameDay = leaveDate === getToday();

  const handleSubmit = () => {
    if (!leaveDate) { Alert.alert('Date Required', 'Please select a leave date.'); return; }
    if (!reason.trim()) { Alert.alert('Reason Required', 'Please provide a reason.'); return; }
    onSubmit({
      leaveDate,
      leaveType,
      leaveCategory,
      reason: reason.trim(),
      coverArrangement: coverArrangement.trim() || null,
    });
  };

  return (
    <FormModal
      visible
      wide={wide}
      title="Apply for Leave"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={submitting ? 'Submitting…' : isSameDay ? 'Submit (Auto-Approve)' : 'Submit for Approval'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            small
            icon={<Send size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <Field label="Leave Date *">
          <DateInput value={leaveDate} onChange={setLeaveDate} accentColor={T.accent} />
        </Field>
        {isSameDay && !!leaveDate && (
          <View style={[s.note, { backgroundColor: withAlpha(T.info, SOFT_TINT) }]}>
            <Clock size={13} color={T.info} strokeWidth={ICON_STROKE} />
            <Text style={[s.noteTxt, { color: T.info }]}>Same-day leave — will be auto-approved</Text>
          </View>
        )}

        {/* Trigger+Dropdown inside a form modal is a field, not a modal-as-picker. */}
        <View style={wide ? s.row2 : s.col2}>
          <Field label="Leave Type *" style={wide ? { flex: 1, zIndex: 30 } : { zIndex: 30 }}>
            <Trigger
              label={typeLabel(leaveType)}
              open={openDd === 'type'}
              onPress={() => setOpenDd(openDd === 'type' ? null : 'type')}
            />
            {openDd === 'type' && (
              <Dropdown
                style={s.ddFull}
                value={leaveType}
                onSelect={v => { setLeaveType(v); setOpenDd(null); }}
                options={LEAVE_TYPES}
              />
            )}
          </Field>

          <Field label="Leave Category *" style={wide ? { flex: 1, zIndex: 20 } : { zIndex: 20 }}>
            <Trigger
              label={LEAVE_CATEGORIES.find(c => c.value === leaveCategory)?.label || leaveCategory}
              open={openDd === 'cat'}
              onPress={() => setOpenDd(openDd === 'cat' ? null : 'cat')}
            />
            {openDd === 'cat' && (
              <Dropdown
                style={s.ddFull}
                value={leaveCategory}
                onSelect={v => { setLeaveCategory(v); setOpenDd(null); }}
                options={LEAVE_CATEGORIES}
              />
            )}
          </Field>
        </View>

        {/* Kit Input hard-codes height 46 — multiline needs Field + themed TextInput. */}
        <Field label="Reason *">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you taking leave?"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textareaTxt, { color: T.text }]}
            />
          </View>
        </Field>

        <Field label="Cover Arrangement (optional)">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={coverArrangement}
              onChangeText={setCoverArrangement}
              placeholder="Who will handle your responsibilities?"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textareaTxt, { color: T.text }]}
            />
          </View>
        </Field>
      </View>
    </FormModal>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────
function RejectModal({ onClose, onReject, rejecting }: {
  onClose: () => void; onReject: (reason: string) => void; rejecting: boolean;
}) {
  const T = useAppTheme();
  const [reason, setReason] = useState('');
  return (
    <FormModal
      visible
      title="Reject Leave Request"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={rejecting ? 'Rejecting…' : 'Reject Leave'}
            variant="danger"
            onPress={() => {
              if (!reason.trim()) { Alert.alert('Reason Required', 'Please provide a rejection reason.'); return; }
              onReject(reason.trim());
            }}
            loading={rejecting}
            disabled={rejecting}
            small
          />
        </>
      }
    >
      <Field label="Reason *">
        <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor={T.dim}
            multiline
            style={[s.textareaTxt, { color: T.text }]}
          />
        </View>
      </Field>
    </FormModal>
  );
}

// ─── Leave card ───────────────────────────────────────────────────────────────
function LeaveCard({ leave, isTeam, onCancel, onApprove, onReject }: {
  leave: any; isTeam: boolean;
  onCancel: (id: number) => void; onApprove: (l: any) => void; onReject: (id: number) => void;
}) {
  const T = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const sc = statusToken(T, leave.status);
  const cc = categoryToken(T, leave.leaveCategory);
  const canCancel =
    ['Pending', 'Approved', 'AutoApproved'].includes(leave.status) &&
    new Date(leave.leaveDate) >= new Date(getToday());

  const d = new Date(leave.leaveDate);

  return (
    <View
      style={[
        s.lcard,
        { backgroundColor: T.card, borderColor: T.line },
        // Web left-borders pending team rows in amber; mirrored with the warning token.
        isTeam && leave.status === 'Pending' && { borderLeftWidth: 3, borderLeftColor: T.warning },
      ]}
    >
      <TouchableOpacity style={s.lrow} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        {isTeam ? (
          <Avatar initials={initialsOf(leave.userName)} />
        ) : (
          <View style={s.dateBox}>
            <Text style={[s.dateDay, { color: T.text }]}>{d.getDate()}</Text>
            <Text style={[s.dateMon, { color: T.sub }]}>
              {d.toLocaleDateString('en-IN', { month: 'short' })}
            </Text>
            <Text style={[s.dateWkd, { color: T.dim }]}>
              {d.toLocaleDateString('en-IN', { weekday: 'short' })}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {isTeam && (
            <Text style={[s.lname, { color: T.text }]} numberOfLines={1}>
              {leave.userName}
              {!!leave.userRole && <Text style={[s.lrole, { color: T.dim }]}> ({leave.userRole})</Text>}
            </Text>
          )}
          {isTeam && (
            <Text style={[s.lmeta, { color: T.sub }]} numberOfLines={1}>{fmtDate(leave.leaveDate)}</Text>
          )}

          <View style={s.badges}>
            <StatusBadge label={statusLabel(leave.status)} color={sc} />
            <StatusBadge label={leave.leaveCategory} color={cc} />
            <Text style={[s.typeTxt, { color: T.dim }]}>{typeLabel(leave.leaveType)}</Text>
          </View>

          <Text style={[s.reason, { color: T.sub }]} numberOfLines={expanded ? undefined : 2}>
            {leave.reason}
          </Text>
        </View>

        <View style={s.lactions}>
          {isTeam && leave.status === 'Pending' && (
            <>
              <IconBtn kind="view" label="Approve" onPress={() => onApprove(leave)}>
                <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
              </IconBtn>
              <IconBtn kind="del" label="Reject" onPress={() => onReject(leave.id)}>
                <X size={14} color={T.danger} strokeWidth={ICON_STROKE} />
              </IconBtn>
            </>
          )}
          {!isTeam && canCancel && (
            <IconBtn kind="del" label="Cancel leave" onPress={() => onCancel(leave.id)}>
              <Ban size={13} color={T.danger} strokeWidth={ICON_STROKE} />
            </IconBtn>
          )}
          {expanded
            ? <ChevronUp size={16} color={T.dim} strokeWidth={ICON_STROKE} />
            : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[s.expanded, { borderTopColor: T.line }]}>
          {!!leave.coverArrangement && (
            <Text style={[s.expTxt, { color: T.sub }]}>
              <Text style={[s.expLabel, { color: T.text }]}>Cover: </Text>{leave.coverArrangement}
            </Text>
          )}
          {!!leave.actionedByName && (
            <Text style={[s.expTxt, { color: T.sub }]}>
              <Text style={[s.expLabel, { color: T.text }]}>
                {leave.status === 'Rejected' ? 'Rejected' : 'Approved'} by:{' '}
              </Text>
              {leave.actionedByName}
              {leave.actionedAt ? ` on ${new Date(leave.actionedAt).toLocaleDateString('en-IN')}` : ''}
            </Text>
          )}
          {!!leave.rejectionReason && (
            <Text style={[s.expTxt, { color: T.danger }]}>
              <Text style={[s.expLabel, { color: T.danger }]}>Rejection reason: </Text>{leave.rejectionReason}
            </Text>
          )}
          {!!leave.planImpactMessage && (
            <View style={[s.impact, { backgroundColor: withAlpha(T.warning, SOFT_TINT) }]}>
              <AlertTriangle size={13} color={T.warning} strokeWidth={ICON_STROKE} />
              <Text style={[s.impactTxt, { color: T.warning }]}>{leave.planImpactMessage}</Text>
            </View>
          )}
          <Text style={[s.applied, { color: T.dim }]}>Applied: {fmtApplied(leave.createdAt)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const LeaveManagementScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const role = user?.role || 'FO';
  /** Web: `const isManager = user?.role !== 'FO'`. Matched exactly — never narrow this. */
  const isManager = role !== 'FO';

  const [tab, setTab] = useState<Tab>('my');
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState<'none' | 'offline' | 'error'>('none');
  const [myStatus, setMyStatus] = useState('');
  const [myCat, setMyCat] = useState('');
  const [myPage, setMyPage] = useState(1);

  const [teamLeaves, setTeamLeaves] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<'none' | 'offline' | 'error'>('none');
  const [teamStatus, setTeamStatus] = useState('');
  const [teamCat, setTeamCat] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamPage, setTeamPage] = useState(1);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openDd, setOpenDd] = useState<'status' | 'cat' | 'member' | null>(null);

  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    authApi.getUsers().then(res => setTeamMembers(res.data || [])).catch(() => {});
  }, [isManager]);

  const fetchMyLeaves = useCallback(async (silent = false) => {
    if (!silent) setMyLoading(true);
    try {
      const params: any = {};
      if (myStatus) params.status = myStatus;
      if (myCat) params.category = myCat;
      const res = await leavesApi.getMyLeaves(params);
      setMyLeaves(res.data || []);
      setMyError('none');
    } catch (err: any) {
      setMyLeaves([]);
      setMyError(err?.response ? 'error' : 'offline');
    } finally {
      setMyLoading(false);
      setRefreshing(false);
    }
  }, [myStatus, myCat]);

  const fetchTeamLeaves = useCallback(async (silent = false) => {
    if (!silent) setTeamLoading(true);
    try {
      const params: any = {};
      if (teamStatus) params.status = teamStatus;
      if (teamCat) params.category = teamCat;
      if (userFilter) params.filterUserId = userFilter;
      const res = await leavesApi.getTeamLeaves(params);
      setTeamLeaves(res.data || []);
      setTeamError('none');
    } catch (err: any) {
      setTeamLeaves([]);
      setTeamError(err?.response ? 'error' : 'offline');
    } finally {
      setTeamLoading(false);
      setRefreshing(false);
    }
  }, [teamStatus, teamCat, userFilter]);

  useEffect(() => { fetchMyLeaves(); }, [fetchMyLeaves]);
  useEffect(() => { if (tab === 'team' && isManager) fetchTeamLeaves(); }, [tab, fetchTeamLeaves, isManager]);

  useEffect(() => { setMyPage(1); }, [myStatus, myCat]);
  useEffect(() => { setTeamPage(1); }, [teamStatus, teamCat, userFilter]);

  const handleApply = async (form: any) => {
    setSubmitting(true);
    try {
      const res = await leavesApi.applyLeave(form);
      const status = (res.data as any)?.status;
      setShowApply(false);
      fetchMyLeaves(true);
      Alert.alert(
        'Leave Submitted',
        status === 'AutoApproved'
          ? 'Same-day leave auto-approved.'
          : 'Leave applied — pending approval.',
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to apply for leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const id = cancelId;
    setCancelId(null);
    if (!id) return;
    try {
      await leavesApi.cancelLeave(id);
      fetchMyLeaves(true);
      Alert.alert('Leave Cancelled', 'Your leave request was cancelled.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel leave.');
    }
  };

  const handleApprove = async () => {
    const leave = approveTarget;
    setApproveTarget(null);
    if (!leave) return;
    try {
      await leavesApi.approveLeave(leave.id);
      fetchTeamLeaves(true);
      Alert.alert('Leave Approved', `Leave approved for ${leave.userName}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to approve leave.');
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectId) return;
    setRejecting(true);
    try {
      await leavesApi.rejectLeave(rejectId, { rejectionReason: reason });
      setRejectId(null);
      fetchTeamLeaves(true);
      Alert.alert('Leave Rejected', 'The leave request was rejected.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reject leave.');
    } finally {
      setRejecting(false);
    }
  };

  const memberOptions = useMemo(() => ([
    { label: 'All Team Members', value: '' },
    ...teamMembers.map(m => ({ label: `${m.name} (${m.role})`, value: String(m.id) })),
  ]), [teamMembers]);

  // ── current tab's data ──
  const isTeam = tab === 'team';
  const leaves = isTeam ? teamLeaves : myLeaves;
  const loading = isTeam ? teamLoading : myLoading;
  const error = isTeam ? teamError : myError;
  const page = isTeam ? teamPage : myPage;
  const setPage = isTeam ? setTeamPage : setMyPage;
  const status = isTeam ? teamStatus : myStatus;
  const setStatus = isTeam ? setTeamStatus : setMyStatus;
  const cat = isTeam ? teamCat : myCat;
  const setCat = isTeam ? setTeamCat : setMyCat;

  const totalPages = Math.max(1, Math.ceil(leaves.length / PAGE_SIZE));
  const rows = useMemo(
    () => leaves.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [leaves, page],
  );

  const activeChips = [
    status ? { label: statusLabel(status), clear: () => setStatus('') } : null,
    cat ? { label: CATEGORY_OPTIONS.find(c => c.value === cat)?.label || cat, clear: () => setCat('') } : null,
    isTeam && userFilter
      ? { label: memberOptions.find(m => m.value === userFilter)?.label || 'Member', clear: () => setUserFilter('') }
      : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const renderBody = () => {
    if (loading) return <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />;
    if (error !== 'none') {
      return (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          {error === 'offline'
            ? <WifiOff size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            : <AlertTriangle size={34} color={T.danger} strokeWidth={ICON_STROKE} />}
          <Text style={[s.emptyTitle, { color: T.text }]}>
            {error === 'offline' ? "You're offline" : 'Could not load leaves'}
          </Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            {error === 'offline' ? 'Reconnect and pull down to try again.' : 'Pull down to retry.'}
          </Text>
        </View>
      );
    }
    if (leaves.length === 0) {
      return (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          {isTeam
            ? <Users size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            : <CalendarOff size={34} color={T.dim} strokeWidth={ICON_STROKE} />}
          <Text style={[s.emptyTitle, { color: T.text }]}>
            {isTeam ? 'No team leave requests' : 'No leave records found'}
          </Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            {isTeam
              ? 'Requests from your team will appear here.'
              : 'Apply for leave and it will appear here.'}
          </Text>
        </View>
      );
    }
    return (
      <>
        {/* Full-width rows on every size. The old two-up grid left a card at ~48%
            with dead space beside it whenever the count was odd — most visibly with
            a single leave — and the two cells never matched height. */}
        <View style={{ gap: 10 }}>
          {rows.map(l => (
            <View key={l.id}>
              <LeaveCard
                leave={l}
                isTeam={isTeam}
                onCancel={id => setCancelId(id)}
                onApprove={lv => setApproveTarget(lv)}
                onReject={id => setRejectId(id)}
              />
            </View>
          ))}
        </View>
        {totalPages > 1 && (
          <View style={s.pgRow}>
            <Text style={[s.count, { color: T.dim }]}>
              Showing {(page - 1) * PAGE_SIZE + 1}{DASH}{Math.min(page * PAGE_SIZE, leaves.length)} of {leaves.length}
            </Text>
            <Pagination page={page} pageCount={totalPages} onChange={setPage} />
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              isTeam ? fetchTeamLeaves(true) : fetchMyLeaves(true);
            }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Plain themed title block on T.bg — house pattern, no gradient hero. */}
        <View style={[s.header, wide && s.headerWide]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]}>Leave Management</Text>
            <Text style={[s.sub, { color: T.dim }]}>Apply for leaves and track your leave history</Text>
          </View>
          {/* Ungated, matching web: Apply Leave renders for every role. */}
          <Btn
            label="Apply Leave"
            small
            onPress={() => setShowApply(true)}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
            style={wide ? undefined : { alignSelf: 'flex-start' }}
          />
        </View>

        {isManager && (
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            style={wide ? { width: 280 } : undefined}
            options={[{ label: 'My Leaves', value: 'my' }, { label: 'Team Leaves', value: 'team' }]}
          />
        )}

        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.ctrlRow}>
            <Text style={[s.count, { color: T.dim, flex: 1 }]}>
              {leaves.length} leave{leaves.length === 1 ? '' : 's'}
            </Text>
            <Trigger
              label="Filters"
              open={filtersOpen}
              onPress={() => setFiltersOpen(v => !v)}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
          </View>

          {activeChips.length > 0 && (
            <View style={s.chipWrap}>
              {activeChips.map(c => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
            </View>
          )}

          {filtersOpen && (
            <View style={[s.filters, { borderTopColor: T.line }, wide && s.filtersWide]}>
              <Field label="Status" style={wide ? { flex: 1, zIndex: 30 } : { zIndex: 30 }}>
                <Trigger
                  label={status ? statusLabel(status) : 'All'}
                  open={openDd === 'status'}
                  onPress={() => setOpenDd(openDd === 'status' ? null : 'status')}
                />
                {openDd === 'status' && (
                  <Dropdown
                    style={s.ddFull}
                    value={status}
                    onSelect={v => { setStatus(v); setOpenDd(null); }}
                    options={STATUS_OPTIONS}
                  />
                )}
              </Field>

              <Field label="Category" style={wide ? { flex: 1, zIndex: 20 } : { zIndex: 20 }}>
                <Trigger
                  label={CATEGORY_OPTIONS.find(c => c.value === cat)?.label || 'All Categories'}
                  open={openDd === 'cat'}
                  onPress={() => setOpenDd(openDd === 'cat' ? null : 'cat')}
                />
                {openDd === 'cat' && (
                  <Dropdown
                    style={s.ddFull}
                    value={cat}
                    onSelect={v => { setCat(v); setOpenDd(null); }}
                    options={CATEGORY_OPTIONS}
                  />
                )}
              </Field>

              {isTeam && memberOptions.length > 1 && (
                <Field label="Team Member" style={wide ? { flex: 1, zIndex: 10 } : { zIndex: 10 }}>
                  <Trigger
                    label={memberOptions.find(m => m.value === userFilter)?.label || 'All Team Members'}
                    open={openDd === 'member'}
                    onPress={() => setOpenDd(openDd === 'member' ? null : 'member')}
                  />
                  {openDd === 'member' && (
                    <Dropdown
                      style={s.ddFull}
                      maxHeight={220}
                      value={userFilter}
                      onSelect={v => { setUserFilter(v); setOpenDd(null); }}
                      options={memberOptions}
                    />
                  )}
                </Field>
              )}
            </View>
          )}
        </View>

        {renderBody()}
      </ScrollView>

      {showApply && (
        <ApplyModal
          onClose={() => setShowApply(false)}
          onSubmit={handleApply}
          submitting={submitting}
        />
      )}

      {rejectId !== null && (
        <RejectModal
          onClose={() => setRejectId(null)}
          onReject={handleReject}
          rejecting={rejecting}
        />
      )}

      {/* Web shows a confirmation with the plan-impact warning before approving. */}
      <ConfirmModal
        visible={!!approveTarget}
        tone="success"
        title="Confirm Leave Approval"
        message={
          approveTarget
            ? `Approve leave for ${approveTarget.userName} (${approveTarget.userRole}) on ${fmtDate(approveTarget.leaveDate)}.` +
              (approveTarget.planImpactMessage ? `\n\n${approveTarget.planImpactMessage}` : '')
            : ''
        }
        icon={<Check size={24} color={T.success} strokeWidth={ICON_STROKE} />}
        confirmLabel="Approve Leave"
        onConfirm={handleApprove}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmModal
        visible={cancelId !== null}
        tone="danger"
        title="Cancel Leave?"
        message="This leave request will be cancelled. This cannot be undone."
        icon={<Ban size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filters: { borderTopWidth: 1, paddingTop: 12, gap: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'flex-start' },
  ddFull: { width: '100%' },

  // iPad two-up grid — uses the horizontal room without stretching a single column.

  // leave card
  lcard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  lrow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  dateBox: { alignItems: 'center', minWidth: 42 },
  dateDay: { fontSize: rf(19), fontWeight: '800', letterSpacing: -0.4 },
  dateMon: { fontSize: rf(11), fontWeight: '600' },
  dateWkd: { fontSize: rf(10), fontWeight: '500' },
  lname: { fontSize: rf(13.5), fontWeight: '700' },
  lrole: { fontSize: rf(11.5), fontWeight: '500' },
  lmeta: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 },
  typeTxt: { fontSize: rf(11), fontWeight: '600' },
  reason: { fontSize: rf(12.5), fontWeight: '500', marginTop: 5 },
  lactions: { alignItems: 'center', gap: 6 },

  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 5, borderTopWidth: 1, paddingTop: 10 },
  expLabel: { fontWeight: '700' },
  expTxt: { fontSize: rf(12), fontWeight: '500' },
  impact: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 10, padding: 8, marginTop: 4 },
  impactTxt: { fontSize: rf(11.5), fontWeight: '500', flex: 1 },
  applied: { fontSize: rf(11), fontWeight: '500', marginTop: 4 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modals
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: -6 },
  noteTxt: { fontSize: rf(12), fontWeight: '600', flex: 1 },
  textarea: { minHeight: 76, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 56 },
});
