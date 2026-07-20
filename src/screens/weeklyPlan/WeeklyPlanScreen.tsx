import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, RefreshControl, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, ChevronDown, ChevronUp,
  Check, Pencil, CircleX, Users, WifiOff, TriangleAlert, CalendarDays,
} from 'lucide-react-native';

import { weeklyPlanApi } from '../../api/weeklyPlan';
import { schoolsApi } from '../../api/schools';
import { leadsApi } from '../../api/leads';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { WeeklyPlan, DayPlan, WeeklyActivity } from '../../types';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Segmented, Trigger, Dropdown,
  StatusBadge, Avatar, FormModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = ['Visit', 'Demo', 'Call', 'Meeting', 'FollowUp'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The full status set is the `WeeklyPlanStatus` C# enum
 * (SalesCRM.Core/Enums/WeeklyPlanStatus.cs): Draft, Submitted, Approved,
 * EditedByManager, Rejected, PendingReApproval.
 * `types/index.ts` omits PendingReApproval, so statuses are read through statusOf().
 */
type PlanStatus =
  | 'Draft' | 'Submitted' | 'Approved' | 'EditedByManager' | 'Rejected' | 'PendingReApproval';

const statusOf = (p?: WeeklyPlan | null): PlanStatus =>
  (String((p as any)?.status || 'Draft') as PlanStatus);

/** Web parity: WeeklyPlanner.jsx relabels exactly these two. */
const statusLabel = (st: string) =>
  st === 'EditedByManager' ? 'Edited by Manager'
    : st === 'PendingReApproval' ? 'Pending Re-Approval'
      : st;

/** Plan-status colours, mapped onto the spec palette to track web's hues. */
const statusColors = (T: AppTheme): Record<string, string> => ({
  Draft: T.sub,                 // web gray
  Submitted: T.info,            // web blue
  Approved: T.success,          // web green
  EditedByManager: T.warning,   // web amber
  Rejected: T.danger,           // web red
  PendingReApproval: T.accent,  // web orange — accent is the palette's nearest hue
});

/** Activity-type colours. Purple `Meeting` has no spec equivalent — it takes `accent`. */
const activityColors = (T: AppTheme): Record<string, string> => ({
  Visit: T.success, Demo: T.info, Call: T.sub,
  Meeting: T.accent, FollowUp: T.warning,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');

function getMonday(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay(); // 0 = Sun
  day.setDate(day.getDate() + (dow === 0 ? -6 : 1 - dow));
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * BUG FIX — day-boundary correctness.
 * This was `d.toISOString().split('T')[0]`. getMonday() zeroes the clock to LOCAL
 * midnight, so in any timezone east of UTC (e.g. IST +5:30) toISOString() rolls back to
 * the PREVIOUS day: local Mon 13 Jul 00:00 → "2026-07-12" (a Sunday). The API then hands
 * that Sunday to WeeklyPlanController, whose NormalizeWeekStart does
 * `diff = (7 + DayOfWeek - Monday) % 7` → Sunday yields 6 → it snaps back to the Monday
 * BEFORE the one the user picked. Every read and write landed on the wrong week.
 * Formatting from local Y/M/D keeps the wall-clock day the user actually selected.
 */
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Backend stores planData as a JSON string — tolerate both string and array. */
function parsePlanData(raw: any): DayPlan[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch {}
  }
  return [];
}

/**
 * Web parity: always render a full Monday→Sunday skeleton and merge saved activities into
 * it by date. Previously mobile rendered `parsed` as-is, so a plan whose planData held
 * only 3 days showed only 3 day cards.
 */
function buildWeek(monday: Date, saved?: any): DayPlan[] {
  const parsed = parsePlanData(saved);
  return DAY_NAMES.map((dayOfWeek, i) => {
    const date = toYMD(addDays(monday, i));
    const match = parsed.find((d: any) => d?.date === date);
    return {
      date,
      dayOfWeek,
      activities: Array.isArray(match?.activities) ? match!.activities : [],
    };
  });
}

/** Web parity: fmtDate → "07 Jul". */
const fmtDay = (d: Date) => `${pad2(d.getDate())} ${SHORT_MONTHS[d.getMonth()]}`;
const fmtWeekRange = (monday: Date) => `${fmtDay(monday)} — ${fmtDay(addDays(monday, 6))}`;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/**
 * Allowed activity types for a school, from its lead's stage.
 *
 * Web's getActivityTypes has a dead branch: its first `if` already matches every stage the
 * second one lists, so web can only ever hide `Visit`, never `Demo`. This keeps mobile's
 * existing (and evidently intended) two-tier gating. Reported; web not touched.
 */
function getAllowedActivityTypes(schoolName: string | undefined, leads: any[]): string[] {
  const all = [...ACTIVITY_TYPES] as string[];
  if (!schoolName) return all;
  // LeadListDto exposes `School` (a string) — there is no schoolName field.
  const lead = leads.find((l: any) => (l.school || l.schoolName) === schoolName);
  if (!lead) return all;
  const stage = lead.stage || '';
  if (['DemoDone', 'ProposalSent', 'Negotiation', 'ContractSent', 'Won', 'ImplementationStarted'].includes(stage))
    return all.filter(t => t !== 'Visit' && t !== 'Demo');
  if (stage === 'DemoStage') return all.filter(t => t !== 'Visit');
  return all;
}

// ─── Activity row ─────────────────────────────────────────────────────────────
const ActivityRow = ({
  activity, schools, leads, onChange, onRemove, wide, isNew,
}: {
  activity: WeeklyActivity;
  schools: any[];
  leads: any[];
  onChange: (a: WeeklyActivity) => void;
  onRemove: () => void;
  wide: boolean;
  isNew: boolean;
}) => {
  const T = useAppTheme();
  const [open, setOpen] = useState<'school' | 'type' | null>(null);
  const allowed = getAllowedActivityTypes(activity.schoolName, leads);

  // Web parity: school options carry the lead stage — "St. Xavier's [DemoStage]".
  const schoolOpts = useMemo(() => ([
    { label: 'Select School', value: '' },
    ...(Array.isArray(schools) ? schools : []).map((sc: any) => {
      const lead = leads.find((l: any) => (l.school || l.schoolName) === sc.name);
      return {
        label: `${sc.name}${lead?.stage ? ` [${lead.stage}]` : ''}`,
        value: String(sc.id),
      };
    }),
  ]), [schools, leads]);

  return (
    <View
      style={[
        ar.wrap,
        { backgroundColor: T.cardAlt, borderColor: T.line },
        // Web parity: activities added on top of an approved plan read as dashed + tinted.
        isNew && { backgroundColor: T.accentSoft, borderColor: T.accent, borderStyle: 'dashed' },
      ]}
    >
      <View style={[ar.fields, wide && ar.fieldsWide]}>
        <Field label="School" style={ar.cell}>
          <Trigger
            label={activity.schoolName || 'Select School'}
            open={open === 'school'}
            onPress={() => setOpen(o => (o === 'school' ? null : 'school'))}
          />
          {open === 'school' && (
            <Dropdown
              style={{ width: '100%' }}
              maxHeight={220}
              value={String(activity.schoolId ?? '')}
              options={schoolOpts}
              onSelect={v => {
                const sc = (schools || []).find((x: any) => String(x.id) === v);
                onChange({ ...activity, schoolId: sc ? sc.id : '', schoolName: sc?.name || '' });
                setOpen(null);
              }}
            />
          )}
        </Field>

        <Field label="Type" style={ar.cell}>
          <Trigger
            label={activity.type}
            open={open === 'type'}
            onPress={() => setOpen(o => (o === 'type' ? null : 'type'))}
          />
          {open === 'type' && (
            <Dropdown
              style={{ width: '100%' }}
              maxHeight={200}
              value={activity.type}
              options={allowed.map(t => ({ label: t, value: t }))}
              onSelect={v => {
                onChange({ ...activity, type: v as WeeklyActivity['type'] });
                setOpen(null);
              }}
            />
          )}
        </Field>

        <Input
          label="Notes"
          value={activity.notes || ''}
          onChangeText={v => onChange({ ...activity, notes: v })}
          placeholder="Notes"
          containerStyle={ar.cell}
        />
      </View>

      <View style={ar.tail}>
        {isNew && <StatusBadge label="NEW" color={T.accent} />}
        <IconBtn kind="del" label="Remove activity" onPress={onRemove}>
          <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
        </IconBtn>
      </View>
    </View>
  );
};

const ar = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 1, padding: 10, gap: 10 },
  fields: { gap: 10 },
  fieldsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1 },
  tail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
});

// ─── Read-only activity line ──────────────────────────────────────────────────
const ReadonlyActivity = ({ act }: { act: WeeklyActivity }) => {
  const T = useAppTheme();
  const c = activityColors(T)[act.type] || T.sub;
  return (
    <View style={[ro.row, { borderColor: T.line }]}>
      <StatusBadge label={act.type} color={c} />
      <Text style={[ro.school, { color: T.text }]} numberOfLines={1}>
        {act.schoolName || act.notes || '—'}
      </Text>
      {!!(act.notes && act.schoolName) && (
        <Text style={[ro.notes, { color: T.dim }]} numberOfLines={1}>— {act.notes}</Text>
      )}
    </View>
  );
};
const ro = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  school: { flex: 1, fontSize: rf(12.5), fontWeight: '600' },
  notes: { flex: 1, fontSize: rf(11.5), fontWeight: '500' },
});

// ─── Day card ─────────────────────────────────────────────────────────────────
/** Web renders all seven days open — there is no per-day collapse. */
const DayCard = ({
  day, schools, leads, onChange, editable, wide, addOnly, approvedCount,
}: {
  day: DayPlan;
  schools: any[];
  leads: any[];
  onChange?: (d: DayPlan) => void;
  editable: boolean;
  wide: boolean;
  /** True only in the approved add-only flow, where prior activities are frozen. */
  addOnly: boolean;
  /** Activities below this index came from the approved snapshot and are locked. */
  approvedCount: number;
}) => {
  const T = useAppTheme();
  const acts = Array.isArray(day.activities) ? day.activities : [];
  const date = new Date(day.date + 'T00:00:00');

  const addActivity = () => {
    onChange?.({ ...day, activities: [...acts, { type: 'Visit', schoolId: '', schoolName: '', notes: '' }] });
  };
  const updateActivity = (i: number, a: WeeklyActivity) => {
    const next = [...acts];
    next[i] = a;
    onChange?.({ ...day, activities: next });
  };
  const removeActivity = (i: number) => {
    onChange?.({ ...day, activities: acts.filter((_, idx) => idx !== i) });
  };

  return (
    <View style={[dc.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={dc.head}>
        <View style={dc.headLeft}>
          <CalendarDays size={14} color={T.accent} strokeWidth={ICON_STROKE} />
          <Text style={[dc.dayName, { color: T.text }]}>{day.dayOfWeek}</Text>
          <Text style={[dc.dayDate, { color: T.dim }]}>{fmtDay(date)}</Text>
        </View>
        {editable && (
          <Btn
            label="Add"
            variant="soft"
            small
            onPress={addActivity}
            icon={<Plus size={13} color={T.accent} strokeWidth={ICON_STROKE} />}
          />
        )}
      </View>

      {acts.length === 0 ? (
        <Text style={[dc.none, { color: T.dim }]}>No activities planned</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {acts.map((act, i) => {
            // Web parity: in the add-only flow everything up to the approved count is
            // frozen, and everything past it is a NEW addition awaiting re-approval.
            const locked = addOnly && i < approvedCount;
            return editable && !locked ? (
              <ActivityRow
                key={i}
                activity={act}
                schools={schools}
                leads={leads}
                wide={wide}
                isNew={addOnly && i >= approvedCount}
                onChange={a => updateActivity(i, a)}
                onRemove={() => removeActivity(i)}
              />
            ) : (
              <ReadonlyActivity key={i} act={act} />
            );
          })}
        </View>
      )}
    </View>
  );
};

const dc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  dayName: { fontSize: rf(13.5), fontWeight: '800' },
  dayDate: { fontSize: rf(11.5), fontWeight: '600' },
  none: { fontSize: rf(12), fontWeight: '500', fontStyle: 'italic', paddingVertical: 4 },
});

// ─── Team member card ─────────────────────────────────────────────────────────
const TeamMemberCard = ({
  plan, schools, leads, weekMonday, onApprove, onReject, onEdited, wide,
}: {
  plan: WeeklyPlan;
  schools: any[];
  leads: any[];
  weekMonday: Date;
  onApprove: () => void;
  onReject: () => void;
  onEdited: () => void;
  wide: boolean;
}) => {
  const T = useAppTheme();
  const STATUS_COLORS = statusColors(T);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDays, setEditDays] = useState<DayPlan[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const st = statusOf(plan);

  /**
   * Prefer managerEdits when they exist. Web's team tab always renders planData, so a
   * manager who edits a plan is shown the FO's original and never their own edits.
   */
  const managerEdits = parsePlanData((plan as any).managerEdits);
  const source = managerEdits.length > 0 ? (plan as any).managerEdits : plan.planData;
  const days = useMemo(() => buildWeek(weekMonday, source), [weekMonday, source]);
  const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);
  const displayDays = editing ? editDays : days;

  const startEdit = () => {
    setEditDays(JSON.parse(JSON.stringify(days)));
    setEditNotes('');
    setEditing(true);
    setExpanded(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      // POST /weekly-plans/{id}/edit → ManagerEditRequest { ManagerEdits, ReviewNotes }
      await weeklyPlanApi.managerEdit(plan.id, editDays, editNotes.trim() || undefined);
      setEditing(false);
      onEdited();
    } catch {
      Alert.alert('Error', 'Failed to save edits.');
    } finally {
      setSaving(false);
    }
  };

  const canReview = (st === 'Submitted' || st === 'PendingReApproval') && !editing;

  return (
    <View style={[tm.card, { backgroundColor: T.card, borderColor: T.line }]}>
      <TouchableOpacity
        style={tm.head}
        activeOpacity={0.8}
        onPress={() => { if (!editing) setExpanded(e => !e); }}
      >
        <Avatar initials={initialsOf(plan.userName)} />
        <View style={{ flex: 1 }}>
          <Text style={[tm.name, { color: T.text }]} numberOfLines={1}>{plan.userName || 'Unknown'}</Text>
          <Text style={[tm.meta, { color: T.dim }]} numberOfLines={1}>
            {plan.userRole} | {totalActivities} activities planned
          </Text>
        </View>
        <StatusBadge label={statusLabel(st)} color={STATUS_COLORS[st] || T.sub} />
        {expanded
          ? <ChevronUp size={16} color={T.dim} strokeWidth={ICON_STROKE} />
          : <ChevronDown size={16} color={T.dim} strokeWidth={ICON_STROKE} />}
      </TouchableOpacity>

      {canReview && (
        <View style={tm.actions}>
          <Btn
            label="Approve" variant="success" small onPress={onApprove}
            icon={<Check size={13} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
          <Btn
            label="Edit" variant="soft" small onPress={startEdit}
            icon={<Pencil size={13} color={T.accent} strokeWidth={ICON_STROKE} />}
          />
          <Btn
            label="Reject" variant="dangerGhost" small onPress={onReject}
            icon={<CircleX size={13} color={T.danger} strokeWidth={ICON_STROKE} />}
          />
        </View>
      )}

      {expanded && (
        <View style={[tm.body, { borderTopColor: T.line }]}>
          {displayDays.map((day, i) => (
            <DayCard
              key={day.date}
              day={day}
              schools={schools}
              leads={leads}
              editable={editing}
              wide={wide}
              addOnly={false}
              approvedCount={0}
              onChange={editing ? (d) => {
                const next = [...editDays];
                next[i] = d;
                setEditDays(next);
              } : undefined}
            />
          ))}

          {editing && (
            <View style={{ gap: 10 }}>
              {/* Kit Input hard-codes height 46 — multiline needs Field + themed TextInput. */}
              <Field label="Review notes">
                <TextInput
                  style={[tm.textarea, { borderColor: T.line, color: T.text, backgroundColor: T.card }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Optional — shown to the plan's owner"
                  placeholderTextColor={T.dim}
                  multiline
                  textAlignVertical="top"
                />
              </Field>
              <View style={tm.editBtns}>
                <Btn label="Cancel" variant="secondary" small onPress={() => setEditing(false)} />
                <Btn label="Save Edits" small onPress={saveEdit} loading={saving} />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const tm = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  meta: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12, flexWrap: 'wrap' },
  body: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  editBtns: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  textarea: {
    minHeight: 62, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: rf(14), fontWeight: '500',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
const ROLE_FILTERS = ['ALL', 'FO', 'ZH', 'RH', 'SH'] as const;

export const WeeklyPlanScreen = (_: any) => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { isOnline } = useOffline();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const STATUS_COLORS = statusColors(T);
  // Web parity: WeeklyPlanner.jsx gates on `user?.role !== 'FO'` — no invented role list.
  const isManager = (user?.role || 'FO') !== 'FO';

  const [tab, setTab] = useState<'my' | 'team'>('my');
  const [weekMonday, setWeekMonday] = useState(() => getMonday(new Date()));

  // My Plan
  const [myPlan, setMyPlan] = useState<WeeklyPlan | null>(null);
  const [planDays, setPlanDays] = useState<DayPlan[]>([]);
  const [approvedCounts, setApprovedCounts] = useState<Record<string, number>>({});
  const [loadingMy, setLoadingMy] = useState(true);
  const [saving, setSaving] = useState(false);

  // Team
  const [teamPlans, setTeamPlans] = useState<WeeklyPlan[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pickers
  const [schools, setSchools] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<WeeklyPlan | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // ── Schools for the pickers + leads for stage gating ───────────────────────
  useEffect(() => {
    const load = async () => {
      /**
       * Web parity (WeeklyPlanner.jsx): one scope-aware `GET /schools?limit=500`, plus
       * `assignedTo` for managers. This replaced a 7×`/school-assignments/my?date=` sweep
       * that only fell back to /schools when EVERY day came back empty — so an FO with a
       * single day-assignment saw a one-school dropdown here and the full list on web.
       *
       * The sweep was a strict subset: SchoolService.GetSchoolsAsync scopes a non-manager
       * caller to `SchoolAssignments.Where(a => a.UserId == callerId)` UNION their
       * lead-derived schools, with no date filter — i.e. every date's assignments at once.
       *
       * Shapes verified against SalesCRM.API/Controllers/SchoolsController.cs:
       *   [HttpGet] … [FromQuery] int limit = 20 …
       *   return Ok(ApiResponse<object>.Ok(new { schools, total, page, limit }));
       * The query key is `limit` — `pageSize` is unbound and silently dropped — and the
       * payload is { schools, … }, NOT PaginatedResult's { items, totalCount }.
       */
      try {
        const params: any = { page: 1, limit: 500 };
        const myId = (user as any)?.id;
        if (isManager && myId) params.assignedTo = myId;
        const res = await schoolsApi.getAll(params);
        const d: any = res.data;
        const list: any[] = Array.isArray(d) ? d : d?.schools ?? d?.items ?? [];
        setSchools(list.map((sc: any) => ({ id: sc.id, name: sc.name, city: sc.city || '' })));
      } catch {
        setSchools([]);
      }

      try {
        // LeadsController.GetLeads binds [FromQuery] PaginationParams → `pageSize`
        // (capped at MaxPageSize = 50) and returns PaginatedResult { items, totalCount, … }.
        const res = await leadsApi.getLeads({ pageSize: 200 });
        const d: any = res.data;
        setLeads(Array.isArray(d) ? d : d?.items ?? d?.leads ?? []);
      } catch {}
    };
    load();
    // Web parity: the school/lead lists are week-independent, so this no longer refetches
    // on every week arrow — only when the caller (and therefore the scope) changes.
  }, [isManager, user]);

  // ── My plan ────────────────────────────────────────────────────────────────
  const loadMyPlan = useCallback(async (silent = false) => {
    if (!silent) setLoadingMy(true);
    try {
      // GET /weekly-plans/my?weekStart= → ApiResponse<WeeklyPlanDto?>; data may be null.
      const res = await weeklyPlanApi.getMy(toYMD(weekMonday));
      const plan: any = res.data;
      if (plan && plan.id) {
        setMyPlan(plan);
        setPlanDays(buildWeek(weekMonday, plan.planData));

        /**
         * Baseline for the approved add-only flow. UpdatePlanAsync snapshots
         * `ApprovedPlanData = PlanData` on the FIRST edit after approval, so until then the
         * approved set IS planData. Web's `approvedCount = ... || 0` fallback therefore tags
         * every existing activity "NEW" and leaves them deletable right after approval,
         * defeating the lock; using planData as the baseline matches the backend's own
         * snapshot semantics. Captured at load so it stays stable while the user adds rows.
         */
        if (statusOf(plan) === 'Approved') {
          const base = buildWeek(weekMonday, plan.approvedPlanData || plan.planData);
          const counts: Record<string, number> = {};
          base.forEach(d => { counts[d.date] = d.activities.length; });
          setApprovedCounts(counts);
        } else {
          setApprovedCounts({});
        }
      } else {
        setMyPlan(null);
        setPlanDays(buildWeek(weekMonday));
        setApprovedCounts({});
      }
      setError(null);
    } catch {
      setMyPlan(null);
      setPlanDays(buildWeek(weekMonday));
      setApprovedCounts({});
      setError('Failed to load plan.');
    } finally {
      setLoadingMy(false);
      setRefreshing(false);
    }
  }, [weekMonday]);

  // ── Team plans ─────────────────────────────────────────────────────────────
  const loadTeamPlans = useCallback(async (silent = false) => {
    if (!silent) setLoadingTeam(true);
    try {
      // GET /weekly-plans/team?weekStart= → ApiResponse<List<WeeklyPlanDto>> (bare array).
      const res = await weeklyPlanApi.getTeam(toYMD(weekMonday));
      const d: any = res.data;
      setTeamPlans(Array.isArray(d) ? d : d?.items ?? []);
      setError(null);
    } catch {
      setTeamPlans([]);
      setError('Failed to load team plans.');
    } finally {
      setLoadingTeam(false);
      setRefreshing(false);
    }
  }, [weekMonday]);

  useEffect(() => {
    if (tab === 'my') loadMyPlan();
    else if (isManager) loadTeamPlans();
  }, [tab, weekMonday, isManager, loadMyPlan, loadTeamPlans]);

  /** Pull-to-refresh keeps the current content on screen instead of flashing skeletons. */
  const reload = () => { if (tab === 'my') loadMyPlan(true); else loadTeamPlans(true); };

  const prevWeek = () => setWeekMonday(d => addDays(d, -7));
  const nextWeek = () => setWeekMonday(d => addDays(d, 7));

  const st = statusOf(myPlan);
  /** Web parity: an approved plan may still take NEW activities, then be re-submitted. */
  const isApprovedAddOnly = !!myPlan && st === 'Approved';
  const canEdit =
    !myPlan || st === 'Draft' || st === 'Rejected' || st === 'EditedByManager' || isApprovedAddOnly;

  // ── Save / submit ──────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      if (myPlan?.id) {
        await weeklyPlanApi.update(myPlan.id, JSON.stringify(planDays));
      } else {
        // CreateWeeklyPlanRequest binds only { WeekStartDate, PlanData } — the
        // `weekEndDate` the TS signature demands is dropped server-side (it computes
        // ws.AddDays(6)). Harmless, but api/weeklyPlan.ts should drop it.
        await weeklyPlanApi.create({
          weekStartDate: toYMD(weekMonday),
          weekEndDate: toYMD(addDays(weekMonday, 6)),
          planData: JSON.stringify(planDays),
        });
      }
      flash('Plan saved');
      loadMyPlan();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    Alert.alert(
      isApprovedAddOnly ? 'Submit for Re-Approval' : 'Submit Plan',
      isApprovedAddOnly
        ? 'Send the added activities back to your manager for re-approval?'
        : 'Submit this plan for review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSaving(true);
            try {
              let planId = myPlan?.id;
              // Always persist the latest edits first: SubmitPlanAsync only flips the
              // status, and UpdatePlanAsync is what snapshots ApprovedPlanData.
              if (!planId) {
                const created = await weeklyPlanApi.create({
                  weekStartDate: toYMD(weekMonday),
                  weekEndDate: toYMD(addDays(weekMonday, 6)),
                  planData: JSON.stringify(planDays),
                });
                planId = (created.data as any)?.id;
              } else {
                await weeklyPlanApi.update(planId, JSON.stringify(planDays));
              }
              if (!planId) { Alert.alert('Error', 'Failed to create plan.'); return; }
              await weeklyPlanApi.submit(planId);
              flash(isApprovedAddOnly ? 'Submitted for re-approval' : 'Plan submitted for review');
              loadMyPlan();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to submit.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleApprove = (plan: WeeklyPlan) => {
    Alert.alert('Approve Plan', `Approve ${plan.userName}'s plan?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            await weeklyPlanApi.approve(plan.id);
            flash('Plan approved');
            loadTeamPlans();
          } catch { Alert.alert('Error', 'Failed to approve plan.'); }
        },
      },
    ]);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) { Alert.alert('Required', 'Please enter a rejection reason.'); return; }
    setRejecting(true);
    try {
      await weeklyPlanApi.reject(rejectTarget.id, rejectNotes.trim());
      setRejectTarget(null);
      setRejectNotes('');
      flash('Plan rejected');
      loadTeamPlans();
    } catch { Alert.alert('Error', 'Failed to reject plan.'); }
    finally { setRejecting(false); }
  };

  // ── Banners ────────────────────────────────────────────────────────────────
  const banner = (tone: string, icon: React.ReactNode, text: string, key: string) => (
    <View
      key={key}
      style={[s.banner, { backgroundColor: withAlpha(tone, SOFT_TINT), borderColor: withAlpha(tone, 0.3) }]}
    >
      {icon}
      <Text style={[s.bannerTxt, { color: tone }]}>{text}</Text>
    </View>
  );

  const filteredTeam = teamPlans.filter(p => roleFilter === 'ALL' || p.userRole === roleFilter);

  // ── My Plan tab ────────────────────────────────────────────────────────────
  const renderMyPlan = () => {
    if (loadingMy) {
      return (
        <View style={{ gap: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[s.skel, { backgroundColor: T.cardAlt, borderColor: T.line }]} />
          ))}
        </View>
      );
    }
    return (
      <View style={{ gap: 10 }}>
        {!!myPlan && (
          <View style={s.statusRow}>
            <StatusBadge label={statusLabel(st)} color={STATUS_COLORS[st] || T.sub} />
            {!!myPlan.reviewedByName && (
              <Text style={[s.statusMeta, { color: T.dim }]}>Reviewed by {myPlan.reviewedByName}</Text>
            )}
            {!!myPlan.reviewNotes && (
              <Text style={[s.statusNote, { color: T.sub }]} numberOfLines={2}>"{myPlan.reviewNotes}"</Text>
            )}
          </View>
        )}

        {st === 'Rejected' && !!myPlan?.reviewNotes &&
          banner(T.danger, <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />,
            `Plan rejected — ${myPlan.reviewNotes}. Please revise and resubmit.`, 'rej')}

        {st === 'EditedByManager' && !!(myPlan as any)?.managerEdits &&
          banner(T.warning, <Pencil size={14} color={T.warning} strokeWidth={ICON_STROKE} />,
            `Manager edited your plan. Review the changes below.${myPlan?.reviewNotes ? ` ${myPlan.reviewNotes}` : ''}`, 'edt')}

        {isApprovedAddOnly &&
          banner(T.success, <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />,
            'This plan is approved. You can add more activities and submit for re-approval.', 'app')}

        {planDays.map((day, i) => (
          <DayCard
            key={day.date}
            day={day}
            schools={schools}
            leads={leads}
            editable={canEdit}
            wide={wide}
            addOnly={isApprovedAddOnly}
            approvedCount={isApprovedAddOnly ? (approvedCounts[day.date] || 0) : 0}
            onChange={canEdit ? (d) => {
              const next = [...planDays];
              next[i] = d;
              setPlanDays(next);
            } : undefined}
          />
        ))}

        {canEdit ? (
          <View style={s.btnRow}>
            {/* Web parity: an approved plan can only be re-submitted, not re-drafted. */}
            {!isApprovedAddOnly && (
              <Btn label="Save Draft" variant="secondary" onPress={handleSaveDraft} disabled={saving} />
            )}
            <Btn
              label={isApprovedAddOnly ? 'Submit for Re-Approval' : 'Submit for Review'}
              onPress={handleSubmit}
              loading={saving}
            />
          </View>
        ) : (
          <View style={[s.locked, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <Text style={[s.lockedTxt, { color: T.sub }]}>
              This plan is {statusLabel(st).toLowerCase()} and cannot be edited.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Team tab ───────────────────────────────────────────────────────────────
  const renderTeam = () => {
    if (loadingTeam) {
      return (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.skel, { backgroundColor: T.cardAlt, borderColor: T.line }]} />
          ))}
        </View>
      );
    }
    return (
      <View style={{ gap: 10 }}>
        {teamPlans.length > 0 && (
          <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
            <View style={s.roleRow}>
              {ROLE_FILTERS.map(r => (
                <Btn
                  key={r}
                  small
                  label={r === 'ALL'
                    ? `All (${teamPlans.length})`
                    : `${r} (${teamPlans.filter(p => p.userRole === r).length})`}
                  variant={roleFilter === r ? 'primary' : 'secondary'}
                  onPress={() => setRoleFilter(r)}
                />
              ))}
            </View>
          </View>
        )}

        {filteredTeam.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Users size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No submitted plans for this week</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>
              Plans appear here once your team submits them for review.
            </Text>
          </View>
        ) : (
          filteredTeam.map(p => (
            <TeamMemberCard
              key={p.id}
              plan={p}
              schools={schools}
              leads={leads}
              weekMonday={weekMonday}
              wide={wide}
              onApprove={() => handleApprove(p)}
              onReject={() => { setRejectTarget(p); setRejectNotes(''); }}
              onEdited={() => { flash('Plan edits saved'); loadTeamPlans(); }}
            />
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); reload(); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* House pattern: plain themed title block on T.bg — no gradient hero. */}
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]}>Weekly Plan</Text>
          <Text style={[s.h2, { color: T.dim }]}>Plan your week and submit for review</Text>
        </View>

        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }, wide && s.controlsWide]}>
          <View style={s.weekNav}>
            <IconBtn kind="view" label="Previous week" onPress={prevWeek}>
              <ChevronLeft size={15} color={T.accent} strokeWidth={ICON_STROKE} />
            </IconBtn>
            <Text style={[s.weekRange, { color: T.text }]}>{fmtWeekRange(weekMonday)}</Text>
            <IconBtn kind="view" label="Next week" onPress={nextWeek}>
              <ChevronRight size={15} color={T.accent} strokeWidth={ICON_STROKE} />
            </IconBtn>
          </View>
          {isManager && (
            <Segmented<'my' | 'team'>
              value={tab}
              onChange={setTab}
              style={wide ? { width: 260 } : undefined}
              options={[{ label: 'My Plan', value: 'my' }, { label: 'Team Plans', value: 'team' }]}
            />
          )}
        </View>

        {!isOnline && banner(T.warning, <WifiOff size={14} color={T.warning} strokeWidth={ICON_STROKE} />, 'You are offline. Changes cannot be saved right now.', 'off')}
        {!!error && banner(T.danger, <TriangleAlert size={14} color={T.danger} strokeWidth={ICON_STROKE} />, error, 'err')}
        {!!notice && banner(T.success, <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />, notice, 'ok')}

        {tab === 'my' || !isManager ? renderMyPlan() : renderTeam()}
      </ScrollView>

      {!!rejectTarget && (
        <FormModal
          visible
          title="Reject Plan"
          onClose={() => setRejectTarget(null)}
          footer={
            <>
              <View style={{ flex: 1 }} />
              <Btn label="Cancel" variant="secondary" small onPress={() => setRejectTarget(null)} />
              <Btn
                label="Reject Plan"
                variant="danger"
                small
                onPress={handleRejectSubmit}
                loading={rejecting}
                disabled={!rejectNotes.trim()}
              />
            </>
          }
        >
          <View style={{ gap: 14 }}>
            <Text style={[s.modalSub, { color: T.sub }]}>
              Rejecting the plan for{' '}
              <Text style={{ fontWeight: '700', color: T.text }}>{rejectTarget.userName}</Text>.
            </Text>
            <Field label="Reason *">
              <TextInput
                style={[s.textarea, { borderColor: T.line, color: T.text, backgroundColor: T.card }]}
                value={rejectNotes}
                onChangeText={setRejectNotes}
                placeholder="Explain why this plan is being rejected…"
                placeholderTextColor={T.dim}
                multiline
                textAlignVertical="top"
                autoFocus
              />
            </Field>
          </View>
        </FormModal>
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — every colour comes from useAppTheme(), inline) ─────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  titleBlock: { gap: 2 },
  h1: { fontSize: rf(21), fontWeight: '800', letterSpacing: -0.4 },
  h2: { fontSize: rf(12.5), fontWeight: '500' },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  controlsWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: 1 },
  weekRange: { fontSize: rf(14), fontWeight: '800', letterSpacing: -0.2 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12,
  },
  bannerTxt: { flex: 1, fontSize: rf(12.5), fontWeight: '600' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusMeta: { fontSize: rf(11.5), fontWeight: '600' },
  statusNote: { flex: 1, fontSize: rf(11.5), fontWeight: '500', fontStyle: 'italic' },

  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  skel: { height: 92, borderRadius: 16, borderWidth: 1 },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  btnRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' },
  locked: { borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center' },
  lockedTxt: { fontSize: rf(12.5), fontWeight: '600', textAlign: 'center' },

  modalSub: { fontSize: rf(13), fontWeight: '500' },
  textarea: {
    minHeight: 96, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: rf(14), fontWeight: '500',
  },
});
