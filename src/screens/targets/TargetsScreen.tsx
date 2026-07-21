import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, ArrowLeft, Trash2, Send, Eye, Pencil, ChevronRight, ChevronDown, ChevronUp,
  Target as TargetIcon, Check, AlertCircle, X, ThumbsUp, ThumbsDown, IndianRupee,
  School as SchoolIcon, LogIn, Users,
} from 'lucide-react-native';

import { targetsApi } from '../../api/targets';
import { TargetAssignmentDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { ProgressBar } from '../../components/common/ProgressBar';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Segmented, Trigger, Dropdown,
  StatusBadge, Pagination, ListCard, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { withAlpha } from '../../theme';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Targets — web parity with Sales_CRM_Web/src/pages/common/Targets.jsx.
 *
 * Verified against TargetsController.cs (every literal `return Ok(...)`):
 *   POST   /targets                → ApiResponse<TargetAssignmentDto>
 *   GET    /targets/my             → ApiResponse<List<TargetAssignmentDto>>
 *   GET    /targets/assigned       → ApiResponse<List<TargetAssignmentDto>>
 *   GET    /targets/{id}/subtargets→ ApiResponse<List<TargetAssignmentDto>>
 *   PUT    /targets/{id}/progress  → ApiResponse<TargetAssignmentDto>  (UpdateTargetRequest)
 *   PUT    /targets/{id}/submit    → ApiResponse<TargetAssignmentDto>
 *   PUT    /targets/{id}/review    → ApiResponse<TargetAssignmentDto>  (ReviewTargetRequest)
 *   DELETE /targets/{id}           → ApiResponse<object>
 *   GET    /targets/assignable-users → ApiResponse<List<UserDto>>
 * apiClient unwraps the {success,data,message} envelope, so `res.data` is the payload.
 */

const PAGE_SIZE = 10;
const DASH = '—';
const GUTTER = 12;

const PERIODS: { label: string; value: string }[] = [
  { label: 'Monthly', value: 'Monthly' },
  { label: 'Quarterly', value: 'Quarterly' },
  { label: 'Annually', value: 'Annually' },
];
const PERIOD_LETTER: Record<string, string> = { Monthly: 'M', Quarterly: 'Q', Annually: 'A' };

/** Web: pct(a,t) = t ? min(100, round(a/t*100)) : 0 */
const pct = (a: number, t: number) => (t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 0);
const daysLeft = (end: string) => Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);

/**
 * Attainment ramp. Web uses green / teal / amber; on the Sunstone status ramp those
 * map to three DISTINCT spec hues — adjacent tiers must never share one.
 */
const attainColor = (T: AppTheme, p: number) => (p >= 100 ? T.success : p >= 50 ? T.info : T.warning);

/** Status ramp — spec tokens only (getTargetStatusColor returns off-spec Palette values). */
const statusColor = (T: AppTheme, st?: string) => {
  switch (st) {
    case 'Approved':   return T.success;
    case 'InProgress': return T.info;
    case 'Submitted':  return T.warning;
    case 'Rejected':
    case 'Overdue':    return T.danger;
    default:           return T.sub;
  }
};
const STATUS_LABEL: Record<string, string> = {
  Pending: 'Pending', InProgress: 'In Progress', Submitted: 'Submitted',
  Approved: 'Approved', Rejected: 'Rejected', Overdue: 'Overdue',
};

/** Role badge — four distinct spec hues (web uses teal/purple/orange/blue). */
const roleColor = (T: AppTheme, r?: string) =>
  r === 'ZH' ? T.info : r === 'RH' ? T.warning : r === 'SH' ? T.success : T.accent;

const num = (v: any) => (v === '' || v == null ? 0 : Number(v));

// ─── Banners ──────────────────────────────────────────────────────────────────
const SuccessBanner = ({ msg }: { msg: string }) => {
  const T = useAppTheme();
  return (
    <View style={[s.banner, { backgroundColor: withAlpha(T.success, 0.1), borderColor: withAlpha(T.success, 0.2) }]}>
      <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
      <Text style={[s.bannerTxt, { color: T.success }]}>{msg}</Text>
    </View>
  );
};

const ErrorBanner = ({ msg, onClose }: { msg: string; onClose?: () => void }) => {
  const T = useAppTheme();
  return (
    <View style={[s.banner, { backgroundColor: withAlpha(T.danger, 0.1), borderColor: withAlpha(T.danger, 0.2) }]}>
      <AlertCircle size={14} color={T.danger} strokeWidth={ICON_STROKE} />
      <Text style={[s.bannerTxt, { color: T.danger, flex: 1 }]}>{msg}</Text>
      {!!onClose && (
        <TouchableOpacity onPress={onClose} hitSlop={10}>
          <X size={14} color={T.danger} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── One KPI tile inside the expanded detail panel ────────────────────────────
/**
 * The four tiles must read as one set: the grid is `alignItems:'stretch'` and the tile
 * is `flex:1`, so every tile in a row is exactly as tall as the tallest; the bar is
 * pinned with `marginTop:'auto'` so all four bars sit on the same baseline even when a
 * value wraps to a different height.
 */
const KpiTile = ({ label, icon, value, total, p, w }: {
  label: string; icon: React.ReactNode; value: string; total: string; p: number; w: string;
}) => {
  const T = useAppTheme();
  return (
    <View style={{ width: w as any, padding: GUTTER / 2 }}>
      <View style={[s.kpi, { backgroundColor: T.card, borderColor: T.line }]}>
        <View style={s.kpiTop}>
          {icon}
          <Text style={[s.kpiLabel, { color: T.dim }]} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={[s.kpiVal, { color: T.text }]} numberOfLines={1}>
          {value}<Text style={[s.kpiTotal, { color: T.dim }]}> / {total}</Text>
        </Text>
        <ProgressBar
          value={p}
          height={5}
          color={attainColor(T, p)}
          trackColor={T.line}
          style={{ marginTop: 'auto' }}
        />
      </View>
    </View>
  );
};

// ─── Create / Split-and-assign modal ──────────────────────────────────────────
function CreateModal({ parent, users, onClose, onSaved }: {
  parent: TargetAssignmentDto | null;
  users: UserDto[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [form, setForm] = useState({
    assignedToId: '' as any, title: '', description: '',
    targetAmount: '', numberOfSchools: '', numberOfLogins: '', numberOfStudents: '',
    periodType: 'Quarterly', startDate: '', endDate: '',
  });
  const [openDd, setOpenDd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const selectedUser = users.find(u => String(u.id) === String(form.assignedToId));

  const handleCreate = async () => {
    // Web requires every one of these before it will POST.
    if (!form.title.trim() || !form.targetAmount || !form.numberOfSchools ||
        !form.startDate || !form.endDate || !form.assignedToId) {
      setError('All fields are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      await targetsApi.createTarget({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        targetAmount: Number(form.targetAmount),
        numberOfSchools: Number(form.numberOfSchools),
        numberOfLogins: form.numberOfLogins ? Number(form.numberOfLogins) : undefined,
        numberOfStudents: form.numberOfStudents ? Number(form.numberOfStudents) : undefined,
        periodType: form.periodType as any,
        startDate: form.startDate,
        endDate: form.endDate,
        assignedToId: Number(form.assignedToId),
        parentTargetId: parent?.id ?? undefined,
      });
      onSaved('Target assigned successfully!');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create target.');
    } finally {
      setSaving(false);
    }
  };

  const remAmt = parent ? parent.targetAmount - (parent.subTargetTotal || 0) : 0;
  const remSch = parent ? parent.numberOfSchools - (parent.subTargetSchoolsTotal || 0) : 0;

  return (
    <FormModal
      visible
      wide
      title={parent ? 'Assign Sub-Target' : 'Assign New Target'}
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={saving ? 'Assigning…' : 'Assign Target'}
            onPress={handleCreate}
            loading={saving}
            small
            icon={<Plus size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <ScrollView
        style={{ maxHeight: 460 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.mForm}>
          {!!parent && (
            <View style={[s.infoTile, { backgroundColor: T.cardAlt }]}>
              <Text style={[s.infoName, { color: T.text }]} numberOfLines={2}>Parent: {parent.title}</Text>
              <Text style={[s.infoMeta, { color: T.sub }]}>
                {formatCurrency(remAmt)} / {remSch} schools remaining
              </Text>
            </View>
          )}

          <Field label="Assign To *">
            {users.length === 0 ? (
              <View style={[s.hint, { backgroundColor: withAlpha(T.warning, 0.1), borderColor: withAlpha(T.warning, 0.2) }]}>
                <Text style={[s.hintTxt, { color: T.warning }]}>
                  No users available. Create team members first.
                </Text>
              </View>
            ) : (
              <>
                <Trigger
                  label={selectedUser
                    ? `${selectedUser.name} (${selectedUser.role})`
                    : 'Select user'}
                  open={openDd}
                  onPress={() => setOpenDd(o => !o)}
                />
                {openDd && (
                  <Dropdown
                    style={{ width: '100%' }}
                    maxHeight={210}
                    value={String(form.assignedToId)}
                    onSelect={v => { set('assignedToId', v); setOpenDd(false); }}
                    options={users.map(u => ({
                      value: String(u.id),
                      label: `${u.name} (${u.role}${u.region ? ` — ${u.region}` : u.zone ? ` — ${u.zone}` : ''})`,
                    }))}
                  />
                )}
              </>
            )}
          </Field>

          <Input
            label="Title *"
            value={form.title}
            onChangeText={v => set('title', v)}
            placeholder="e.g. Q1 Sales Target - West Region"
          />

          <Field label="Description">
            <TextInput
              value={form.description}
              onChangeText={v => set('description', v)}
              placeholder="Details…"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textArea, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
            />
          </Field>

          <View style={wide ? s.row2 : s.col2}>
            <Input
              label="Target Amount (₹) *"
              value={form.targetAmount}
              onChangeText={v => set('targetAmount', v)}
              keyboardType="numeric"
              placeholder="e.g. 2500000"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Number of Schools *"
              value={form.numberOfSchools}
              onChangeText={v => set('numberOfSchools', v)}
              keyboardType="numeric"
              placeholder="e.g. 50"
              containerStyle={{ flex: 1 }}
            />
          </View>
          {Number(form.targetAmount) > 0 && (
            <Text style={[s.previewTxt, { color: T.dim }]}>{formatCurrency(Number(form.targetAmount))}</Text>
          )}

          <View style={wide ? s.row2 : s.col2}>
            <Input
              label="Number of Logins (optional)"
              value={form.numberOfLogins}
              onChangeText={v => set('numberOfLogins', v)}
              keyboardType="numeric"
              placeholder="e.g. 1000"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Number of Students (optional)"
              value={form.numberOfStudents}
              onChangeText={v => set('numberOfStudents', v)}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              containerStyle={{ flex: 1 }}
            />
          </View>

          <Field label="Period Type *">
            <Segmented<string>
              value={form.periodType}
              options={PERIODS}
              onChange={v => set('periodType', v)}
            />
          </Field>

          <View style={wide ? s.row2 : s.col2}>
            <Field label="Start Date *" style={{ flex: 1 }}>
              <DateInput
                value={form.startDate}
                onChange={v => set('startDate', v)}
                placeholder="Select start date"
                accentColor={T.accent}
              />
            </Field>
            <Field label="End Date *" style={{ flex: 1 }}>
              <DateInput
                value={form.endDate}
                onChange={v => set('endDate', v)}
                placeholder="Select end date"
                accentColor={T.accent}
              />
            </Field>
          </View>

          {!!error && <ErrorBanner msg={error} />}
        </View>
      </ScrollView>
    </FormModal>
  );
}

// ─── Update-progress modal ────────────────────────────────────────────────────
function ProgressModal({ target, onClose, onSaved }: {
  target: TargetAssignmentDto;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const T = useAppTheme();
  const [form, setForm] = useState({
    achievedAmount: String(target.achievedAmount ?? 0),
    achievedSchools: String(target.achievedSchools ?? 0),
    achievedLogins: String(target.achievedLogins ?? 0),
    achievedStudents: String(target.achievedStudents ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      // UpdateTargetRequest: AchievedAmount, AchievedSchools, AchievedLogins?, AchievedStudents?, Status
      await targetsApi.updateProgress(target.id, {
        achievedAmount: num(form.achievedAmount),
        achievedSchools: num(form.achievedSchools),
        achievedLogins: target.numberOfLogins != null ? num(form.achievedLogins) : null,
        achievedStudents: target.numberOfStudents != null ? num(form.achievedStudents) : null,
        status: 'InProgress',
      });
      onSaved('Progress updated!');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const amt = num(form.achievedAmount);

  return (
    <FormModal
      visible
      title="Update Progress"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={saving ? 'Saving…' : 'Save Progress'}
            onPress={handleSave}
            loading={saving}
            small
            icon={<Pencil size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <View style={[s.infoTile, { backgroundColor: T.cardAlt }]}>
          <Text style={[s.infoName, { color: T.text }]} numberOfLines={2}>{target.title}</Text>
          <Text style={[s.infoMeta, { color: T.sub }]}>
            Target: {formatCurrency(target.targetAmount)} / {target.numberOfSchools} schools
          </Text>
        </View>

        <Input
          label="Achieved Amount (₹)"
          value={form.achievedAmount}
          onChangeText={v => set('achievedAmount', v)}
          keyboardType="numeric"
        />
        {amt > 0 && (
          <Text style={[s.previewTxt, { color: T.dim }]}>
            {formatCurrency(amt)} — {pct(amt, target.targetAmount)}% of target
          </Text>
        )}

        <Input
          label="Achieved Schools"
          value={form.achievedSchools}
          onChangeText={v => set('achievedSchools', v)}
          keyboardType="numeric"
        />

        {target.numberOfLogins != null && (
          <Input
            label={`Achieved Logins (target: ${target.numberOfLogins})`}
            value={form.achievedLogins}
            onChangeText={v => set('achievedLogins', v)}
            keyboardType="numeric"
          />
        )}

        {target.numberOfStudents != null && (
          <Input
            label={`Achieved Students (target: ${target.numberOfStudents})`}
            value={form.achievedStudents}
            onChangeText={v => set('achievedStudents', v)}
            keyboardType="numeric"
          />
        )}

        {!!error && <ErrorBanner msg={error} />}
      </View>
    </FormModal>
  );
}

// ─── Review modal ─────────────────────────────────────────────────────────────
function ReviewModal({ target, onClose, onSaved }: {
  target: TargetAssignmentDto;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const T = useAppTheme();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const review = async (approved: boolean) => {
    setSaving(true); setError('');
    try {
      // ReviewTargetRequest { Approved, Note }
      await targetsApi.reviewTarget(target.id, approved, note.trim() || undefined);
      onSaved(approved ? 'Target approved!' : 'Target rejected.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed.');
      setSaving(false);
    }
  };

  const recap: { label: string; val: string; p: number }[] = [
    {
      label: 'Amount',
      val: `${formatCurrency(target.achievedAmount)} / ${formatCurrency(target.targetAmount)}`,
      p: pct(target.achievedAmount, target.targetAmount),
    },
    {
      label: 'Schools',
      val: `${target.achievedSchools} / ${target.numberOfSchools}`,
      p: pct(target.achievedSchools, target.numberOfSchools),
    },
  ];
  if (target.numberOfLogins != null) {
    recap.push({
      label: 'Logins',
      val: `${target.achievedLogins || 0} / ${target.numberOfLogins}`,
      p: pct(target.achievedLogins || 0, target.numberOfLogins),
    });
  }
  if (target.numberOfStudents != null) {
    recap.push({
      label: 'Students',
      val: `${target.achievedStudents || 0} / ${target.numberOfStudents}`,
      p: pct(target.achievedStudents || 0, target.numberOfStudents),
    });
  }

  return (
    <FormModal
      visible
      wide
      title="Review Target"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn
            label="Reject"
            variant="danger"
            onPress={() => review(false)}
            disabled={saving}
            small
            icon={<ThumbsDown size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
          <Btn
            label="Approve"
            variant="success"
            onPress={() => review(true)}
            disabled={saving}
            small
            icon={<ThumbsUp size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <View style={[s.infoTile, { backgroundColor: T.cardAlt }]}>
          <Text style={[s.infoName, { color: T.text }]} numberOfLines={2}>{target.title}</Text>
          <Text style={[s.infoMeta, { color: T.sub }]}>
            Submitted by {target.assignedToName || DASH} ({target.assignedToRole || DASH})
          </Text>
        </View>

        <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
          {recap.map(r => (
            <View key={r.label} style={{ width: '50%', padding: GUTTER / 2 }}>
              <View style={[s.kpi, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                <Text style={[s.kpiLabel, { color: T.dim }]}>{r.label.toUpperCase()}</Text>
                <Text style={[s.kpiVal, { color: T.text }]} numberOfLines={1}>{r.val}</Text>
                <Text style={[s.kpiTotal, { color: attainColor(T, r.p) }]}>{r.p}% achieved</Text>
              </View>
            </View>
          ))}
        </View>

        <Field label="Review Note (optional)">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={T.dim}
            multiline
            style={[s.textArea, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
          />
        </Field>

        {!!error && <ErrorBanner msg={error} />}
      </View>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const TargetsScreen = (_: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /**
   * iPad gets the table, phones get list rows — same rule as Schools/Leads/Demos/
   * Performance, so every page in the app presents its records the same way.
   * (Tablets are orientation-locked to landscape by applyAuthedOrientation, so this
   * table only ever renders at landscape width.)
   */
  const table = isTabletDevice;

  const role = user?.role || 'FO';
  /** Web: canAssign = user.role !== 'FO'. No other role gate exists on this page. */
  const canAssign = role !== 'FO';
  /**
   * FO reaches this screen through the drawer's AppTopbar (which already renders a
   * title + hamburger). The manager drawers register "Targets" WITHOUT `withHeader`,
   * so for them this screen is the only place a title/menu affordance can live.
   */
  const ownHeader = role !== 'FO';

  const [tab, setTab] = useState<'my' | 'assigned'>('my');
  const [myTargets, setMyTargets] = useState<TargetAssignmentDto[]>([]);
  const [assignedTargets, setAssignedTargets] = useState<TargetAssignmentDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Drill-down
  const [drillTarget, setDrillTarget] = useState<TargetAssignmentDto | null>(null);
  const [subTargets, setSubTargets] = useState<TargetAssignmentDto[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [createParent, setCreateParent] = useState<TargetAssignmentDto | null>(null);
  const [progressTarget, setProgressTarget] = useState<TargetAssignmentDto | null>(null);
  const [reviewTarget, setReviewTarget] = useState<TargetAssignmentDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TargetAssignmentDto | null>(null);

  const flash = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const drillInto = useCallback(async (t: TargetAssignmentDto) => {
    setDrillTarget(t);
    setExpanded(null);
    setSubLoading(true);
    try {
      const res = await targetsApi.getSubTargets(t.id);
      setSubTargets(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSubTargets([]);
    } finally {
      setSubLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [myRes, assignedRes, usersRes] = await Promise.all([
        targetsApi.getMyTargets().catch(() => ({ data: [] as any })),
        canAssign ? targetsApi.getAssignedTargets().catch(() => ({ data: [] as any })) : Promise.resolve({ data: [] as any }),
        canAssign ? targetsApi.getAssignableUsers().catch(() => ({ data: [] as any })) : Promise.resolve({ data: [] as any }),
      ]);
      setMyTargets(Array.isArray(myRes.data) ? myRes.data : []);
      setAssignedTargets(Array.isArray(assignedRes.data) ? assignedRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch {
      setMyTargets([]); setAssignedTargets([]); setUsers([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canAssign]);

  useEffect(() => { load(); }, [load]);

  const refreshAll = useCallback(async () => {
    await load();
    if (drillTarget) await drillInto(drillTarget);
  }, [load, drillTarget, drillInto]);

  const handleSubmit = async (t: TargetAssignmentDto) => {
    try {
      await targetsApi.submitTarget(t.id);
      flash('Target submitted for review!');
      await refreshAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setDeleteTarget(null);
    try {
      await targetsApi.deleteTarget(t.id);
      flash('Target deleted.');
      await refreshAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed.');
    }
  };

  const listFor = tab === 'my' ? myTargets : assignedTargets;
  const totalPages = Math.max(1, Math.ceil(listFor.length / PAGE_SIZE));
  const paged = useMemo(
    () => listFor.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [listFor, page],
  );
  useEffect(() => { setPage(1); setExpanded(null); }, [tab]);

  /** KPI tiles: four across on the tablet table, two across on a phone. */
  const kpiW = table ? '25%' : '50%';

  /**
   * Row actions — identical set and identical gates on the table and on phone rows.
   * Every gate below is copied verbatim from the card this replaced: ownership-based
   * (isMyTarget / isMyAssignment) plus the one `canAssign` gate web already applies to
   * Split & Assign. Nothing here is role-gated beyond that.
   */
  const actionBtns = (t: TargetAssignmentDto) => {
    const isMyTarget = t.assignedToId === user?.id;
    const isMyAssignment = t.assignedById === user?.id;
    const subCount = t.subTargetCount || 0;
    return (
      <>
        {isMyTarget && (t.status === 'Pending' || t.status === 'InProgress' || t.status === 'Rejected') && (
          <>
            <IconBtn kind="edit" label="Update Progress" onPress={() => setProgressTarget(t)}>
              <Pencil size={14} color={T.accent} strokeWidth={ICON_STROKE} />
            </IconBtn>
            <IconBtn kind="view" label="Submit" onPress={() => handleSubmit(t)}>
              <Send size={14} color={T.accent} strokeWidth={ICON_STROKE} />
            </IconBtn>
          </>
        )}
        {isMyAssignment && t.status === 'Submitted' && (
          <IconBtn kind="view" label="Review" onPress={() => setReviewTarget(t)}>
            <Eye size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          </IconBtn>
        )}
        {canAssign && isMyTarget && t.status !== 'Approved' && (
          <IconBtn kind="view" label="Split & Assign" onPress={() => { setCreateParent(t); setShowCreate(true); }}>
            <Plus size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          </IconBtn>
        )}
        {isMyAssignment && subCount === 0 && (
          <IconBtn kind="del" label="Delete" onPress={() => setDeleteTarget(t)}>
            <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
          </IconBtn>
        )}
      </>
    );
  };

  // ── expanded detail (shared by the table and the phone rows) ──
  const renderExpanded = (t: TargetAssignmentDto) => {
    const subCount = t.subTargetCount || 0;
    return (
      <View style={[s.exp, { borderTopColor: T.line, backgroundColor: T.cardAlt }]}>
        <View style={[s.grid, { marginHorizontal: -GUTTER / 2 }]}>
          <KpiTile
            w={kpiW}
            label="Amount"
            icon={<IndianRupee size={11} color={T.dim} strokeWidth={ICON_STROKE} />}
            value={formatCurrency(t.achievedAmount)}
            total={formatCurrency(t.targetAmount)}
            p={pct(t.achievedAmount, t.targetAmount)}
          />
          <KpiTile
            w={kpiW}
            label="Schools"
            icon={<SchoolIcon size={11} color={T.dim} strokeWidth={ICON_STROKE} />}
            value={String(t.achievedSchools)}
            total={String(t.numberOfSchools)}
            p={pct(t.achievedSchools, t.numberOfSchools)}
          />
          {t.numberOfLogins != null && (
            <KpiTile
              w={kpiW}
              label="Logins"
              icon={<LogIn size={11} color={T.dim} strokeWidth={ICON_STROKE} />}
              value={String(t.achievedLogins || 0)}
              total={String(t.numberOfLogins)}
              p={pct(t.achievedLogins || 0, t.numberOfLogins)}
            />
          )}
          {t.numberOfStudents != null && (
            <KpiTile
              w={kpiW}
              label="Students"
              icon={<Users size={11} color={T.dim} strokeWidth={ICON_STROKE} />}
              value={String(t.achievedStudents || 0)}
              total={String(t.numberOfStudents)}
              p={pct(t.achievedStudents || 0, t.numberOfStudents)}
            />
          )}
        </View>

        {t.status === 'Rejected' && !!t.reviewNote && (
          <View style={[s.note, { backgroundColor: withAlpha(T.danger, 0.1), borderColor: withAlpha(T.danger, 0.2) }]}>
            <Text style={[s.noteTxt, { color: T.danger }]}>
              <Text style={{ fontWeight: '700' }}>Rejected: </Text>{t.reviewNote}
            </Text>
          </View>
        )}
        {t.status === 'Approved' && !!t.reviewedAt && (
          <View style={[s.note, { backgroundColor: withAlpha(T.success, 0.1), borderColor: withAlpha(T.success, 0.2) }]}>
            <Text style={[s.noteTxt, { color: T.success }]}>
              Approved on {formatDate(t.reviewedAt)}{t.reviewNote ? ` — ${t.reviewNote}` : ''}
            </Text>
          </View>
        )}

        {subCount > 0 && (
          <TouchableOpacity
            style={[s.subLink, { borderTopColor: T.line }]}
            activeOpacity={0.7}
            onPress={() => drillInto(t)}
          >
            <Eye size={13} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[s.subLinkTxt, { color: T.accent }]} numberOfLines={2}>
              {subCount} sub-target{subCount > 1 ? 's' : ''} — {formatCurrency(t.subTargetTotal || 0)} / {t.subTargetSchoolsTotal || 0} schools assigned
            </Text>
            <ChevronRight size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const daysCell = (t: TargetAssignmentDto) => {
    const days = daysLeft(t.endDate);
    return (
      <Text style={[s.tDays, { color: days < 0 ? T.danger : days <= 7 ? T.warning : T.dim }]} numberOfLines={1}>
        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
      </Text>
    );
  };

  // ── table (tablet) ──
  /**
   * Horizontally scrollable, because this table cannot fit a narrow iPad.
   * The fixed columns alone take 370pt (Status 108 + Period 92 + Actions 152 +
   * chevron 18). On a 1080pt landscape iPad the content box is only ~762pt once
   * the 240pt sidebar, page padding and row padding are removed, leaving ~312pt
   * for five flexible columns — Timeline collapsed to ~54pt and truncated
   * "12 Jan – 31 Mar" to "12 Ja…". TABLE_MIN_W keeps every column at a readable
   * width and lets the user scroll instead of losing data to an ellipsis.
   *
   * Same pattern PipelineScreen uses for its five-stage board.
   */
  const renderTable = (items: TargetAssignmentDto[], context: 'my' | 'assigned') => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tblScroll}
    >
    <View style={[s.tbl, s.tblMin, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cTarget]}>Target</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        <Text style={[s.th, { color: T.dim }, s.cPeriod]}>Period</Text>
        <Text style={[s.th, { color: T.dim }, s.cAmount]}>Amount</Text>
        <Text style={[s.th, { color: T.dim }, s.cSchools]}>Schools</Text>
        <Text style={[s.th, { color: T.dim }, s.cWhen]}>Timeline</Text>
        <Text style={[s.th, { color: T.dim }, s.cWho]}>{context === 'assigned' ? 'Assigned To' : 'Assigned By'}</Text>
        {/* header <Text> ignores alignItems — keep the label left so the icons below
            line up under it (web parity, same as the Schools table) */}
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
        {/* spacer for the expand chevron — a View, since alignItems does nothing to Text */}
        <View style={s.cChevron} />
      </View>

      {items.map(t => {
        const revPct = pct(t.achievedAmount, t.targetAmount);
        const schoolPct = pct(t.achievedSchools, t.numberOfSchools);
        const who = context === 'assigned' ? t.assignedToName : t.assignedByName;
        const whoRole = context === 'assigned' ? t.assignedToRole : t.assignedByRole;
        const open = expanded === t.id;
        return (
          <View key={t.id}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpanded(open ? null : t.id)}
              style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
            >
              <View style={s.cTarget}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{t.title}</Text>
                {!!t.description && (
                  <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{t.description}</Text>
                )}
              </View>
              <View style={s.cStatus}>
                <StatusBadge label={STATUS_LABEL[t.status] || t.status} color={statusColor(T, t.status)} />
              </View>
              <View style={s.cPeriod}>
                <StatusBadge label={t.periodType} color={T.accent} />
              </View>
              <View style={s.cAmount}>
                <Text style={[s.tdStrong, { color: T.text }]} numberOfLines={1}>
                  {formatCurrency(t.achievedAmount)}
                  <Text style={[s.tdMuted, { color: T.dim }]}> / {formatCurrency(t.targetAmount)}</Text>
                </Text>
                <ProgressBar value={revPct} height={5} color={attainColor(T, revPct)} trackColor={T.line} style={s.cellBar} />
              </View>
              <View style={s.cSchools}>
                <Text style={[s.tdStrong, { color: T.text }]} numberOfLines={1}>
                  {t.achievedSchools}
                  <Text style={[s.tdMuted, { color: T.dim }]}> / {t.numberOfSchools}</Text>
                </Text>
                <ProgressBar value={schoolPct} height={5} color={attainColor(T, schoolPct)} trackColor={T.line} style={s.cellBar} />
              </View>
              <View style={s.cWhen}>
                <Text style={[s.td, { color: T.sub }]} numberOfLines={1}>
                  {formatDate(t.startDate)} {DASH} {formatDate(t.endDate)}
                </Text>
                {daysCell(t)}
              </View>
              <View style={s.cWho}>
                <View style={s.whoTop}>
                  <Text style={[s.tdName, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>{who || DASH}</Text>
                  {!!whoRole && <StatusBadge label={whoRole} color={roleColor(T, whoRole)} />}
                </View>
                {context === 'assigned' && !!t.assignedToRegion && (
                  <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                    {t.assignedToRegion}{t.assignedToZone ? ` / ${t.assignedToZone}` : ''}
                  </Text>
                )}
              </View>
              <View style={s.cActions}>
                <View style={s.actions}>{actionBtns(t)}</View>
              </View>
              <View style={s.cChevron}>
                {open
                  ? <ChevronUp size={14} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <ChevronDown size={14} color={T.dim} strokeWidth={ICON_STROKE} />}
              </View>
            </TouchableOpacity>
            {open && renderExpanded(t)}
          </View>
        );
      })}
    </View>
    </ScrollView>
  );

  // ── list rows (phone) ──
  const renderRows = (items: TargetAssignmentDto[], context: 'my' | 'assigned') => (
    <View style={{ gap: 8 }}>
      {items.map(t => {
        const revPct = pct(t.achievedAmount, t.targetAmount);
        const who = context === 'assigned' ? t.assignedToName : t.assignedByName;
        const whoRole = context === 'assigned' ? t.assignedToRole : t.assignedByRole;
        const open = expanded === t.id;
        return (
          <View key={t.id}>
            <ListCard onPress={() => setExpanded(open ? null : t.id)} style={open ? s.rowOpen : undefined}>
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <Text style={[s.tdName, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>{t.title}</Text>
                  <StatusBadge label={STATUS_LABEL[t.status] || t.status} color={statusColor(T, t.status)} />
                  <StatusBadge label={PERIOD_LETTER[t.periodType] || 'Q'} color={T.accent} />
                </View>
                {!!t.description && (
                  <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{t.description}</Text>
                )}
                <View style={s.rowStats}>
                  <Text style={[s.tdSmall, { color: T.sub, flexShrink: 1 }]} numberOfLines={1}>
                    {formatCurrency(t.achievedAmount)} / {formatCurrency(t.targetAmount)}
                  </Text>
                  <Text style={[s.tdSmall, { color: T.dim }]}>•</Text>
                  <Text style={[s.tdSmall, { color: T.sub, flexShrink: 1 }]} numberOfLines={1}>
                    {t.achievedSchools} / {t.numberOfSchools} schools
                  </Text>
                </View>
                <View style={s.rowBar}>
                  <ProgressBar value={revPct} height={5} color={attainColor(T, revPct)} trackColor={T.line} style={{ flex: 1 }} />
                  <Text style={[s.tdSmall, { color: T.text }]}>{revPct}%</Text>
                </View>
                <View style={s.rowMeta}>
                  <Text style={[s.tMetaTxt, { color: T.dim, flexShrink: 1 }]} numberOfLines={1}>
                    {formatDate(t.startDate)} {DASH} {formatDate(t.endDate)}
                  </Text>
                  {daysCell(t)}
                </View>
                <View style={s.rowWho}>
                  <Text style={[s.tMetaTxt, { color: T.dim }]}>{context === 'assigned' ? 'To: ' : 'From: '}</Text>
                  <Text style={[s.tWhoName, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>{who || DASH}</Text>
                  {!!whoRole && <StatusBadge label={whoRole} color={roleColor(T, whoRole)} />}
                  {context === 'assigned' && !!t.assignedToRegion && (
                    <Text style={[s.tMetaTxt, { color: T.dim, flexShrink: 1 }]} numberOfLines={1}>
                      ({t.assignedToRegion}{t.assignedToZone ? ` / ${t.assignedToZone}` : ''})
                    </Text>
                  )}
                </View>
              </View>
              <View style={s.rowRight}>
                {open
                  ? <ChevronUp size={16} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
                <View style={s.actionsPhone}>{actionBtns(t)}</View>
              </View>
            </ListCard>
            {open && <Card padded={false} style={s.rowExpCard}>{renderExpanded(t)}</Card>}
          </View>
        );
      })}
    </View>
  );

  const renderList = (items: TargetAssignmentDto[], context: 'my' | 'assigned') =>
    table ? renderTable(items, context) : renderRows(items, context);

  const emptyState = (
    <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
      <TargetIcon size={34} color={T.dim} strokeWidth={ICON_STROKE} />
      <Text style={[s.emptyTitle, { color: T.text }]}>No targets yet</Text>
      <Text style={[s.emptyTxt, { color: T.dim }]}>
        {tab === 'my'
          ? 'Targets assigned to you for this period will appear here.'
          : 'You have not assigned any targets yet.'}
      </Text>
    </View>
  );

  // ── Drill-down view ──
  if (drillTarget) {
    const remAmt = drillTarget.targetAmount - (drillTarget.subTargetTotal || 0);
    const remSch = drillTarget.numberOfSchools - (drillTarget.subTargetSchoolsTotal || 0);
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={[s.scroll, wide && s.scrollWide]}>
          <View style={s.drillHead}>
            <IconBtn kind="view" label="Back" onPress={() => { setDrillTarget(null); setSubTargets([]); setExpanded(null); }}>
              <ArrowLeft size={16} color={T.accent} strokeWidth={ICON_STROKE} />
            </IconBtn>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: T.text }]} numberOfLines={2}>{drillTarget.title}</Text>
              <Text style={[s.subtitle, { color: T.sub }]}>
                {formatCurrency(drillTarget.targetAmount)} target | {formatCurrency(drillTarget.subTargetTotal || 0)} assigned | {formatCurrency(remAmt)} remaining
              </Text>
              <Text style={[s.subtitle, { color: T.sub }]}>
                {drillTarget.numberOfSchools} schools | {drillTarget.subTargetSchoolsTotal || 0} assigned | {remSch} remaining
              </Text>
            </View>
          </View>

          {!!success && <SuccessBanner msg={success} />}
          {!!error && <ErrorBanner msg={error} onClose={() => setError('')} />}

          {canAssign && remAmt > 0 && (
            <Btn
              label={`Assign Sub-Target (${formatCurrency(remAmt)} / ${remSch} schools remaining)`}
              onPress={() => { setCreateParent(drillTarget); setShowCreate(true); }}
              icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={wide ? { alignSelf: 'flex-start' } : undefined}
            />
          )}

          {subLoading ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
          ) : subTargets.length === 0 ? (
            <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
              <TargetIcon size={34} color={T.dim} strokeWidth={ICON_STROKE} />
              <Text style={[s.emptyTitle, { color: T.text }]}>No sub-targets yet</Text>
              <Text style={[s.emptyTxt, { color: T.dim }]}>Split this target to assign it to your team.</Text>
            </View>
          ) : (
            renderList(subTargets, 'assigned')
          )}
        </ScrollView>

        {showCreate && (
          <CreateModal
            parent={createParent}
            users={users}
            onClose={() => { setShowCreate(false); setCreateParent(null); }}
            onSaved={async (msg) => {
              setShowCreate(false); setCreateParent(null);
              flash(msg); await refreshAll();
            }}
          />
        )}
        {!!progressTarget && (
          <ProgressModal
            target={progressTarget}
            onClose={() => setProgressTarget(null)}
            onSaved={async (msg) => { setProgressTarget(null); flash(msg); await refreshAll(); }}
          />
        )}
        {!!reviewTarget && (
          <ReviewModal
            target={reviewTarget}
            onClose={() => setReviewTarget(null)}
            onSaved={async (msg) => { setReviewTarget(null); flash(msg); await refreshAll(); }}
          />
        )}
        <ConfirmModal
          visible={!!deleteTarget}
          tone="danger"
          title="Delete Target"
          message={`Delete "${deleteTarget?.title ?? 'this target'}"?`}
          icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </SafeAreaView>
    );
  }

  // ── Main view ──
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {ownHeader && (
          // No in-page title or hamburger — the topbar (native drawer header for
          // RH/SH/SCA) names the screen and carries the menu. Just the action.
          <View style={s.actionBar}>
            <Btn
              label="Assign Target"
              small
              onPress={() => { setCreateParent(null); setShowCreate(true); }}
              icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
            />
          </View>
        )}

        {!ownHeader && (
          <Text style={[s.subtitle, { color: T.sub }]}>
            View and update targets assigned to you
          </Text>
        )}

        {!!success && <SuccessBanner msg={success} />}
        {!!error && <ErrorBanner msg={error} onClose={() => setError('')} />}

        {canAssign && (
          <Segmented<'my' | 'assigned'>
            value={tab}
            onChange={setTab}
            style={wide ? { width: 340 } : undefined}
            options={[
              { label: `My Targets (${myTargets.length})`, value: 'my' },
              { label: `Assigned by Me (${assignedTargets.length})`, value: 'assigned' },
            ]}
          />
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : loadFailed ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <AlertCircle size={34} color={T.danger} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>Couldn't load targets</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Check your connection and pull down to retry.</Text>
          </View>
        ) : listFor.length === 0 ? (
          emptyState
        ) : (
          <>
            {renderList(paged, tab)}
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  Showing {(page - 1) * PAGE_SIZE + 1}{DASH}{Math.min(page * PAGE_SIZE, listFor.length)} of {listFor.length}
                </Text>
                <Pagination page={page} pageCount={totalPages} onChange={setPage} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showCreate && (
        <CreateModal
          parent={createParent}
          users={users}
          onClose={() => { setShowCreate(false); setCreateParent(null); }}
          onSaved={async (msg) => {
            setShowCreate(false); setCreateParent(null);
            flash(msg); await refreshAll();
          }}
        />
      )}
      {!!progressTarget && (
        <ProgressModal
          target={progressTarget}
          onClose={() => setProgressTarget(null)}
          onSaved={async (msg) => { setProgressTarget(null); flash(msg); await refreshAll(); }}
        />
      )}
      {!!reviewTarget && (
        <ReviewModal
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSaved={async (msg) => { setReviewTarget(null); flash(msg); await refreshAll(); }}
        />
      )}
      <ConfirmModal
        visible={!!deleteTarget}
        tone="danger"
        title="Delete Target"
        message={`Delete "${deleteTarget?.title ?? 'this target'}"?`}
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour is applied inline from the theme) ────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  actionBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  title: { fontSize: rf(22), fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 11, borderRadius: 13, borderWidth: 1,
  },
  bannerTxt: { fontSize: rf(12.5), fontWeight: '600' },

  // grid — percentage cells + stretch keeps every KPI tile exactly the same size
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },

  kpi: { borderRadius: 13, borderWidth: 1, padding: 10, gap: 3, flex: 1 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kpiLabel: { fontSize: rf(10), fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  kpiVal: { fontSize: rf(13.5), fontWeight: '800' },
  kpiTotal: { fontSize: rf(11), fontWeight: '500' },

  /**
   * Table. Flexible cells hold only ellipsised Text and a flex ProgressBar, so they
   * shrink cleanly; the three cells whose content has a fixed intrinsic width (the two
   * badge cells and the icon-button cell) are given exactly the width their widest
   * possible content needs, so nothing can ever spill into a neighbour.
   */
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(10.5), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(12.5), fontWeight: '500' },
  tdStrong: { fontSize: rf(12.5), fontWeight: '700' },
  tdMuted: { fontSize: rf(11), fontWeight: '500' },
  tdSmall: { fontSize: rf(11.5), fontWeight: '600' },
  tdName: { fontSize: rf(13), fontWeight: '700' },
  tdSub: { fontSize: rf(10.5), fontWeight: '500', marginTop: 1 },
  cellBar: { marginTop: 5 },
  whoTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  cTarget: { flex: 2.4 },
  /**
   * 370pt of fixed columns + ~600pt for the five flexible ones. Below this the
   * flexible columns start truncating real values, so the table scrolls instead.
   */
  tblMin: { minWidth: 970 },
  tblScroll: { flexGrow: 1 },
  cStatus: { width: 108 },  // widest badge is "In Progress"
  cPeriod: { width: 92 },   // widest badge is "Quarterly"
  cAmount: { flex: 1.6 },
  cSchools: { flex: 1.2 },
  cWhen: { flex: 1.4 },
  cWho: { flex: 1.5 },
  cActions: { width: 152 }, // 4 × 32 IconBtn + 3 × 6 gap = 146; header <Text> ignores
                            // alignItems, so both stay left and the icons line up
  cChevron: { width: 18, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  // phone rows
  rowOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  rowBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  rowWho: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  // 70 = two IconBtns + gap; a third wraps to the next line instead of clipping
  actionsPhone: { width: 70, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  rowExpCard: { borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: -1, overflow: 'hidden' },

  tMetaTxt: { fontSize: rf(11.5), fontWeight: '500' },
  tDays: { fontSize: rf(11.5), fontWeight: '700' },
  tWhoName: { fontSize: rf(12), fontWeight: '700' },

  // expanded detail
  exp: { borderTopWidth: 1, padding: 14 },
  note: { padding: 9, borderRadius: 11, borderWidth: 1, marginTop: 8 },
  noteTxt: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 17 },

  subLink: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  subLinkTxt: { flex: 1, fontSize: rf(11.5), fontWeight: '600' },

  drillHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modals
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  infoTile: { borderRadius: 13, padding: 12, gap: 2 },
  infoName: { fontSize: rf(13.5), fontWeight: '700' },
  infoMeta: { fontSize: rf(11.5), fontWeight: '500' },
  hint: { padding: 10, borderRadius: 13, borderWidth: 1 },
  hintTxt: { fontSize: rf(12), fontWeight: '600' },
  previewTxt: { fontSize: rf(11.5), fontWeight: '500', marginTop: -8 },
  // kit Input hard-codes height:46 — multiline needs a themed TextInput
  textArea: {
    minHeight: 64, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: rf(14), fontWeight: '500', textAlignVertical: 'top',
  },
});
