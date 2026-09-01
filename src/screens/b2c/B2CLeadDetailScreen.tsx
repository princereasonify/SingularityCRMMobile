import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, Platform,
} from 'react-native';
import {
  ArrowLeft, Phone, Mail, MapPin, User, Calendar, CalendarClock, Edit2, CheckCircle2,
  UserCheck, UserPlus, Clock, Trash2, AlertTriangle, GraduationCap, School, Users,
  Sparkles, GitBranch, History, Eye, RefreshCw, Globe,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, Field, Input, Trigger, Dropdown, StatusBadge, FormModal, ConfirmModal,
} from '../../components/crud';
import { Screen, Card, SectionLabel } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cCounselorService } from '../../api/b2c/b2cCounselorService';
import { b2cObjectionService, OBJECTION_TYPES } from '../../api/b2c/b2cObjectionService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import {
  B2CLeadDetailDto, B2CActivityListDto, B2C_LEAD_STAGES, B2C_LEAD_SOURCES, B2C_LEAD_PRIORITIES,
  B2C_ENROLLMENT_TIMELINES, B2CActivityTypeName, UpdateB2CLeadRequest, B2CLeadSource, B2CLeadPriority,
  B2CEnrollmentTimeline, B2CLeadCredentialsDto, B2CLeadStageHistoryDto, B2CLookupOption,
  B2CNationality, B2C_NATIONALITIES, B2C_ACTIVITY_TYPES, B2C_TERMINAL_STAGES, B2C_APPOINTMENT_STAGE,
  DuplicateCheckResult,
} from '../../types/b2c';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { formatDate, formatDateTime, formatFullCurrency } from '../../utils/formatting';
import { appointmentLabel, splitLocal, joinLocal } from '../../utils/dates';
import { useResponsive, MIN_TAP, Responsive } from '../../hooks/useResponsive';

const DASH = '—';
type ModalKind = 'stage' | 'agent' | 'counselor' | 'activity' | 'edit' | 'appointment' | null;

/**
 * What a user may LOG here. 'Note' is deliberately absent (web parity): every type already
 * carries a required Notes box, so it only duplicated the field under it. Existing Note
 * activities still render in the timeline below.
 */
const ACTIVITY_TYPES: B2CActivityTypeName[] = [...B2C_ACTIVITY_TYPES];

/**
 * Not a stored stage — picking it hands the counselor to the enrollment/payment wizard, which
 * is what actually marks the lead Converted. The plain stage endpoint refuses Converted.
 */
const CONFIRM_LOGIN = 'ConfirmLogin';

// The rule the API enforces on the Reasonify passwords (CreateB2CLeadRequest's
// RegularExpression). Checked here so an edit can never store a password Reasonify would
// refuse — that leaves the CRM and the family's actual login disagreeing.
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]).{8,16}$/;
const PASSWORD_HINT = '8-16 chars, 1 uppercase, 1 number, 1 special';

// Split a PascalCase enum name into words for display ("GoogleAds" → "Google Ads").
const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');

// Stage → theme colour (mirrors AgentDashboard.stageTint + web stageTag intent).
const stageColor = (T: AppTheme, stage?: string): string => {
  if (stage === 'Converted' || stage === 'DemoDone') return T.success;
  if (stage === 'Lost' || stage === 'NotInterested') return T.danger;
  if (stage === 'DocumentPending' || stage === 'FollowUp') return T.warning;
  return T.accent;
};

const objectionColor = (T: AppTheme, status?: string): string => {
  if (status === 'Resolved') return T.success;
  if (status === 'LostCause') return T.danger;
  if (status === 'InProgress') return T.accent;
  return T.warning;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `14:30` → `2:30 pm`. */
const timeLabel = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  if (isNaN(h)) return '';
  return `${h % 12 || 12}:${pad2(m || 0)} ${h >= 12 ? 'pm' : 'am'}`;
};

/**
 * Quarter-hour slots from 6am to 10pm. An appointment is a slot promised to a family, not a
 * stopwatch reading, and picking one from a list beats typing "HH:MM" through the app's own
 * keyboard — which is where a mistyped time silently becomes a missed visit.
 */
const TIME_SLOTS: { label: string; value: string }[] = (() => {
  const out: { label: string; value: string }[] = [];
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      const value = `${pad2(h)}:${pad2(m)}`;
      out.push({ value, label: timeLabel(value) });
    }
  }
  return out;
})();

const emptyEdit = {
  studentName: '', mobileNumber: '', email: '', parentName: '', parentMobile: '', parentEmail: '',
  grade: '', board: '', schoolName: '', city: '', state: '', area: '', pincode: '',
  nationality: 'Indian' as B2CNationality,
  // Reasonify lookup ids, held as strings for the dropdowns. Changing the board or medium
  // invalidates the class, because Reasonify scopes its grade list to that pair.
  reasonifyBoardId: '', reasonifyLanguageId: '', reasonifyGradeId: '',
  source: 'Website' as B2CLeadSource, priority: 'Warm' as B2CLeadPriority,
  enrollmentTimeline: 'Immediate' as B2CEnrollmentTimeline, sourceReference: '', notes: '',
  // Never prefilled: a masked value here would be indistinguishable from a real one the user
  // meant to keep. Blank means "leave the Reasonify login alone".
  studentPassword: '', parentPassword: '',
};

export const B2CLeadDetailScreen = ({ route, navigation }: any) => {
  const { leadId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const T = useAppTheme();
  const r = useResponsive();
  const s = useMemo(() => makeStyles(r), [r]);
  // Exact point widths, not percentages: in a wrapping row with a `gap`, N × (100/N)% always
  // overflows by the gaps and the last card silently drops onto its own line.
  // Detail fields: one per row on a phone, two on a tablet, three when there is real width.
  const cardInnerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - 32; // 32 = Card padding
  const fieldW: number | '100%' = r.columns > 1
    ? Math.floor((cardInnerW - r.gap * (r.columns - 1)) / r.columns)
    : '100%';
  // Form fields stay at two columns even on a wide iPad — a three-across form makes the eye
  // hunt for the next input. Measured off the modal, which is capped at 560 and padded 24.
  const editModalW = Math.min(r.width - 48, 560) - 48;
  const formW: number | '100%' = r.isTablet ? Math.floor((editModalW - r.gap) / 2) : '100%';

  const role = user?.role;
  const isAdmin = role === 'B2CAdmin';
  const isAgent = role === 'Agent';
  const isCounselor = role === 'Counselor';
  const canAssignCounselor = isAdmin;

  const [lead, setLead] = useState<B2CLeadDetailDto | null>(null);
  const [activities, setActivities] = useState<B2CActivityListDto[]>([]);
  const [objections, setObjections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [briefBusy, setBriefBusy] = useState<number | null>(null);
  const [openDd, setOpenDd] = useState<string | null>(null);

  // Reasonify login, fetched on demand rather than preloaded — the credentials endpoint
  // decrypts, so it is only called when someone actually asks to see them.
  const [credentials, setCredentials] = useState<B2CLeadCredentialsDto | null>(null);
  const [credentialsError, setCredentialsError] = useState('');
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [syncingReasonify, setSyncingReasonify] = useState(false);

  // The note text the stage dialog filled in by itself, so a stage change can replace its own
  // prefill without wiping something the user typed.
  const stagePrefillRef = useRef('');

  // Reasonify Board → Medium → Class lookups for the Edit modal's cascading dropdowns — the
  // same lists the create form uses. Grades refetch whenever board or medium changes.
  const [boards, setBoards] = useState<B2CLookupOption[]>([]);
  const [languages, setLanguages] = useState<B2CLookupOption[]>([]);
  const [grades, setGrades] = useState<B2CLookupOption[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Admin/agent dropdown rosters
  const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
  const [counselors, setCounselors] = useState<{ id: number; name: string }[]>([]);

  // Modal forms
  const [stageForm, setStageForm] = useState({ stage: '', notes: '' });
  // The slot being promised in the Update Stage dialog, and the same thing again for the
  // standalone Reschedule dialog — kept apart so opening one cannot half-fill the other.
  const [stageAppt, setStageAppt] = useState({ date: '', time: '' });
  const [apptForm, setApptForm] = useState({ date: '', time: '', notes: '' });
  const [escForm, setEscForm] = useState({ counselorId: '', type: 'Price', details: '', scheduledDate: '', scheduledTime: '' });
  const [escError, setEscError] = useState('');
  const [agentForm, setAgentForm] = useState({ agentId: '', reason: '' });
  const [counselorId, setCounselorId] = useState('');
  const [actForm, setActForm] = useState({ type: 'Call' as B2CActivityTypeName, notes: '', nextFollowUpDate: '' });
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  // Validation the dialog itself decides (a shared email, a name/mobile that now collides with
  // another lead) — shown inside the modal rather than as a toast, because the field it is
  // about is on screen and the user has to go back to it.
  const [editError, setEditError] = useState('');
  const [editDup, setEditDup] = useState<DuplicateCheckResult | null>(null);

  const load = useCallback(async () => {
    try {
      const [leadRes, actRes, objRes] = await Promise.all([
        b2cLeadService.getLead(leadId),
        b2cActivityService.getActivities(leadId),
        b2cObjectionService.getForLead(leadId).catch(() => ({ data: [] as any[] })),
      ]);
      setLead(leadRes.data);
      setActivities(actRes.data?.items ?? []);
      setObjections((objRes.data as any[]) ?? []);
      setStageForm(f => ({ ...f, stage: leadRes.data?.stage || '' }));
    } catch {
      toast.error('Could not load this lead.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [leadId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    b2cLeadService.getReasonifyBoards().then(res => setBoards(res.data ?? [])).catch(() => setBoards([]));
    b2cLeadService.getReasonifyLanguages().then(res => setLanguages(res.data ?? [])).catch(() => setLanguages([]));
  }, []);

  useEffect(() => {
    if (!editForm.reasonifyBoardId || !editForm.reasonifyLanguageId) { setGrades([]); return; }
    setLoadingGrades(true);
    b2cLeadService.getReasonifyGrades(Number(editForm.reasonifyBoardId), Number(editForm.reasonifyLanguageId))
      .then(res => setGrades(res.data ?? []))
      .catch(() => setGrades([]))
      .finally(() => setLoadingGrades(false));
  }, [editForm.reasonifyBoardId, editForm.reasonifyLanguageId]);

  // Counselor roster: admins (assignment) + agents (escalation). Agent roster: admins only —
  // the full Agent list via b2cUserService.getUsers (matches the web fix, not the dashboard slice).
  useEffect(() => {
    if (isCounselor) return;
    b2cCounselorService.getCounselors({ pageSize: 50 })
      .then(res => setCounselors((res.data?.items ?? []).map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    if (!isAdmin) return;
    b2cUserService.getUsers({ role: 'Agent', pageSize: 200 })
      .then(res => {
        const list: any[] = res.data?.items ?? res.data ?? [];
        setAgents(list.map(u => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, [isAdmin, isCounselor]);

  // The most recent note recorded for each stage this lead has passed through. Sorted
  // oldest-first and overwritten as we go, so a stage entered more than once keeps the latest
  // note rather than whichever the API happened to return first.
  const lastStageNote = useMemo(() => {
    const byStage: Record<string, B2CLeadStageHistoryDto> = {};
    [...(lead?.stageHistory ?? [])]
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
      .forEach(h => { if (h.notes?.trim()) byStage[h.toStage] = h; });
    return byStage;
  }, [lead]);

  const isConverted = lead?.stage === 'Converted';
  const isTerminal = !!lead && B2C_TERMINAL_STAGES.includes(lead.stage as any);
  // Edit / Update Stage / Log Activity / Convert / credentials all 400 server-side for an
  // Agent who isn't the lead's assigned owner, while a manager may still VIEW a team member's
  // lead — so ownership is checked separately from role. Derived once, used by the action row
  // and the Reasonify Login card alike.
  const isOwnLead = isAdmin || isCounselor || (isAgent && lead?.assignedAgentId === user?.id);
  // Extended lead fields the detail response carries but the shared DTO doesn't declare.
  const lx: any = lead || {};

  // Role-aware stage options (web parity). Agent runs the lead but hands counseling to the
  // counselor; the counselor closes through 'ConfirmLogin', which is not a stored stage but a
  // handoff to the enrollment wizard (a lead cannot be PATCHed straight to Converted).
  const stageOptions: string[] = isAgent
    ? ['New', 'Contacted', 'Interested', B2C_APPOINTMENT_STAGE, 'CounselingBooked', 'FollowUp', 'NotInterested']
    : isCounselor
      ? ['CounselingDone', 'DemoDone', B2C_APPOINTMENT_STAGE, 'FollowUp', 'NotInterested', CONFIRM_LOGIN]
      : B2C_LEAD_STAGES.filter(x => x !== 'Converted');

  // ── Modal openers ──
  // Pick a stage and pull its last recorded note along with it, so whoever opens the dialog
  // reads what was written the previous time the lead sat at that stage instead of an empty box.
  const selectStage = (nextStage: string) => {
    const prefill = lastStageNote[nextStage]?.notes?.trim() ?? '';
    // Only replace text this dialog put there — anything typed survives the switch.
    const typed = !!stageForm.notes && stageForm.notes !== stagePrefillRef.current;
    stagePrefillRef.current = prefill;
    setStageForm({ stage: nextStage, notes: typed ? stageForm.notes : prefill });
  };

  const loadCredentials = async () => {
    setLoadingCredentials(true);
    setCredentialsError('');
    try {
      const res = await b2cLeadService.getCredentials(leadId);
      setCredentials(res.data ?? null);
    } catch (err: any) {
      setCredentialsError(err?.response?.data?.message || 'Could not load credentials');
    } finally {
      setLoadingCredentials(false);
    }
  };

  /**
   * Provisioning runs once, at lead creation — a lead that failed there stays failed with no
   * way back short of re-entering it. This re-runs it with the credentials already stored.
   */
  const retryReasonifySync = async () => {
    setSyncingReasonify(true);
    setCredentialsError('');
    try {
      const res = await b2cLeadService.retryReasonifySync(leadId);
      const next = res.data ?? null;
      setCredentials(next);
      if (next?.reasonifySyncStatus === 'Synced') {
        toast.success('Reasonify account created');
        await load();               // refresh the status badge on the card header
      } else {
        // Still failing. The reason is rendered under the credentials.
        toast.error('Reasonify sync still failing');
      }
    } catch (err: any) {
      setCredentialsError(err?.response?.data?.message || 'Could not sync to Reasonify');
    } finally {
      setSyncingReasonify(false);
    }
  };

  // Board/Medium changing invalidates whatever Class was picked under the old pair, and the
  // free-text grade/board fields track the picked option's NAME (reports read those, the
  // Reasonify registration call reads the ids).
  const setEditBoardId = (id: string) => setEditForm(f => ({
    ...f, reasonifyBoardId: id, reasonifyGradeId: '', grade: '',
    board: boards.find(b => String(b.id) === id)?.name ?? '',
  }));
  const setEditLanguageId = (id: string) => setEditForm(f => ({
    ...f, reasonifyLanguageId: id, reasonifyGradeId: '', grade: '',
  }));
  const setEditGradeId = (id: string) => setEditForm(f => ({
    ...f, reasonifyGradeId: id,
    grade: grades.find(g => String(g.id) === id)?.name ?? '',
  }));

  const openStage = () => {
    const first = stageOptions.includes(lead?.stage as any) ? (lead?.stage || '') : stageOptions[0];
    const prefill = lastStageNote[first]?.notes?.trim() ?? '';
    stagePrefillRef.current = prefill;
    setStageForm({ stage: first, notes: prefill });
    // Prime the slot with whatever is already promised, so re-entering the stage to add a note
    // does not silently blank the time the family is expecting.
    setStageAppt(splitLocal(lead?.appointmentAt));
    setEscForm({ counselorId: lead?.assignedCounselorId ? String(lead.assignedCounselorId) : '', type: 'Price', details: '', scheduledDate: '', scheduledTime: '' });
    setEscError('');
    setOpenDd(null);
    setModal('stage');
  };
  const openAppointment = () => {
    const { date, time } = splitLocal(lead?.appointmentAt);
    setApptForm({ date, time, notes: lead?.appointmentNotes || '' });
    setOpenDd(null);
    setModal('appointment');
  };
  const openAgent = () => { setAgentForm({ agentId: lead?.assignedAgentId ? String(lead.assignedAgentId) : '', reason: '' }); setOpenDd(null); setModal('agent'); };
  const openCounselor = () => { setCounselorId(lead?.assignedCounselorId ? String(lead.assignedCounselorId) : ''); setOpenDd(null); setModal('counselor'); };
  const openActivity = () => { setActForm({ type: 'Call', notes: '', nextFollowUpDate: '' }); setOpenDd(null); setModal('activity'); };
  const openEdit = () => {
    if (!lead) return;
    setEditForm({
      studentName: lead.studentName || '', mobileNumber: lead.mobileNumber || '', email: lead.email || '',
      parentName: lx.parentName || '', parentMobile: lx.parentMobile || '', parentEmail: lx.parentEmail || '',
      grade: lx.grade || '', board: lx.board || '', schoolName: lx.schoolName || '', city: lead.city || '', state: lead.state || '',
      area: lx.area || '', pincode: lead.pincode || '',
      nationality: (lead.nationality as B2CNationality) || 'Indian',
      reasonifyBoardId: lx.reasonifyBoardId != null ? String(lx.reasonifyBoardId) : '',
      reasonifyLanguageId: lx.reasonifyLanguageId != null ? String(lx.reasonifyLanguageId) : '',
      reasonifyGradeId: lx.reasonifyGradeId != null ? String(lx.reasonifyGradeId) : '',
      source: (lead.source as B2CLeadSource) || 'Website', priority: (lead.priority as B2CLeadPriority) || 'Warm',
      enrollmentTimeline: (lead.enrollmentTimeline as B2CEnrollmentTimeline) || 'Immediate',
      sourceReference: lead.sourceReference || '', notes: lead.notes || '',
      studentPassword: '', parentPassword: '',
    });
    setEditError('');
    setEditDup(null);
    setOpenDd(null);
    setModal('edit');
  };

  // ── Handlers ──
  const handleEscalate = async () => {
    if (!escForm.counselorId) return;
    setSaving(true); setEscError('');
    try {
      const scheduledAt = escForm.scheduledDate
        ? joinLocal(escForm.scheduledDate, escForm.scheduledTime || '10:00') ?? undefined
        : undefined;
      await b2cObjectionService.escalate(Number(leadId), {
        counselorId: Number(escForm.counselorId),
        type: escForm.type,
        details: escForm.details || undefined,
        scheduledAt,
      });
      toast.success('Counseling booked');
      setModal(null); await load();
    } catch (err: any) {
      setEscError(err?.response?.data?.message || 'Failed to escalate lead');
    } finally { setSaving(false); }
  };

  const handleUpdateStage = async () => {
    // Booking counseling folds in the counselor + date/time + objection → escalate flow.
    if (stageForm.stage === 'CounselingBooked') { await handleEscalate(); return; }
    // Counselor's "Confirm Login" hands off to the same convert/enrollment wizard the Agent's
    // Convert button opens — the backend blocks a direct PATCH to Converted either way.
    if (stageForm.stage === CONFIRM_LOGIN) { setModal(null); navigation.navigate('B2CConvert', { leadId }); return; }
    // An appointment IS its date and time — saving the stage without one would promise the
    // family nothing and leave the route planner a stop it cannot place in the day. The
    // server refuses it too; blocking here turns a 400 into an answerable question.
    const at = stageForm.stage === B2C_APPOINTMENT_STAGE
      ? joinLocal(stageAppt.date, stageAppt.time)
      : null;
    if (stageForm.stage === B2C_APPOINTMENT_STAGE && (!stageAppt.date || !stageAppt.time || !at)) {
      toast.error('Pick the date and time the family is expecting you.');
      return;
    }
    if (!stageForm.notes.trim()) return;
    setSaving(true);
    try {
      await b2cLeadService.updateStage(leadId, stageForm.stage, stageForm.notes.trim(), at ?? undefined);
      toast.success(at ? `Appointment booked for ${appointmentLabel(at)}` : `Moved to ${spaced(stageForm.stage)}`);
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update stage');
    } finally { setSaving(false); }
  };

  /** Moving a booked visit is NOT a stage change — that would write a meaningless
   *  AppointmentBooked → AppointmentBooked step into the history on every reschedule. */
  const handleReschedule = async () => {
    const at = joinLocal(apptForm.date, apptForm.time);
    if (!apptForm.date || !apptForm.time || !at) {
      toast.error('Pick the date and time the family is expecting you.');
      return;
    }
    setSaving(true);
    try {
      await b2cLeadService.rescheduleAppointment(leadId, at, apptForm.notes.trim() || undefined);
      toast.success(`Appointment set for ${appointmentLabel(at)}`);
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update the appointment');
    } finally { setSaving(false); }
  };

  const handleAssignAgent = async () => {
    if (!agentForm.agentId) return;
    setSaving(true);
    try {
      if (lead?.assignedAgentId) await b2cLeadService.reassignLead(leadId, Number(agentForm.agentId), agentForm.reason);
      else await b2cLeadService.assignLead(leadId, Number(agentForm.agentId));
      toast.success('Agent assigned');
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to assign agent');
    } finally { setSaving(false); }
  };

  const handleAssignCounselor = async () => {
    if (!counselorId) return;
    setSaving(true);
    try {
      await b2cLeadService.assignCounselor(leadId, Number(counselorId));
      toast.success('Counsellor assigned');
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to assign counselor');
    } finally { setSaving(false); }
  };

  const handleLogActivity = async () => {
    if (!actForm.notes.trim()) return;
    setSaving(true);
    try {
      await b2cActivityService.createActivity({
        leadId: Number(leadId),
        type: actForm.type,
        notes: actForm.notes.trim(),
        // Send a full UTC ISO string — the backend timestamptz rejects a bare "yyyy-MM-dd".
        nextFollowUpDate: actForm.nextFollowUpDate ? new Date(`${actForm.nextFollowUpDate}T00:00:00.000Z`).toISOString() : undefined,
      });
      toast.success('Activity logged');
      setModal(null);
      setActForm({ type: 'Call', notes: '', nextFollowUpDate: '' });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to log activity');
    } finally { setSaving(false); }
  };

  /**
   * Renaming or renumbering a lead can collide with a DIFFERENT student already in the
   * pipeline, so the warning has to appear while the field is still in hand rather than as a
   * rejection after Save. Driven off the value with a debounce rather than onBlur: `Input`
   * routes single-line fields to the app's own keyboard (KeyField), which never mounts a
   * TextInput and so never fires a blur — a blur-driven check would simply never run.
   *
   * This lead is excluded server-side, so the question asked is the real one — does ANOTHER
   * student already hold this name and mobile — rather than being inferred from whether the
   * pair happens to be unchanged.
   */
  useEffect(() => {
    if (modal !== 'edit') return;
    const name = editForm.studentName.trim();
    const mobile = editForm.mobileNumber.trim();
    if (!name || mobile.replace(/\D/g, '').length < 10) { setEditDup(null); return; }
    let live = true;
    const t = setTimeout(() => {
      b2cLeadService.checkDuplicate(mobile, name, undefined, Number(leadId))
        .then(res => { if (live) setEditDup(res.data?.isHardDuplicate ? res.data : null); })
        .catch(() => { if (live) setEditDup(null); });
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [modal, editForm.studentName, editForm.mobileNumber, leadId]);

  // Reasonify makes the student and the parent two separate accounts and refuses a shared
  // address, so catching it here keeps a save from half-landing: the lead updated, the login not.
  const editEmailClash = !!editForm.email.trim() && !!editForm.parentEmail.trim()
    && editForm.email.trim().toLowerCase() === editForm.parentEmail.trim().toLowerCase();

  // This student joined a parent account a sibling already had. It keeps its own password, so
  // the server refuses a reset from here — read off the lead, which is always loaded, rather
  // than off the credentials card the user may never have opened.
  const parentAccountShared = !!lead?.reasonifyParentLinked || !!credentials?.parentAccountLinked;

  /**
   * The same set the create form and the web's edit dialog mark required. They are not
   * decoration: each one feeds the student's or the parent's Reasonify account, and the update
   * applies every property it is sent — so saving a blank here would quietly erase the value
   * the family's login is built on.
   */
  const editMissing = (): string | null => {
    const need: [string, string][] = [
      ['Student name', editForm.studentName],
      ['Student mobile', editForm.mobileNumber],
      ['Parent name', editForm.parentName],
      ['Parent mobile', editForm.parentMobile],
      ['Parent email', editForm.parentEmail],
      ['School', editForm.schoolName],
      ['Board', editForm.reasonifyBoardId],
      ['Medium', editForm.reasonifyLanguageId],
      ['Class', editForm.reasonifyGradeId],
      ['City', editForm.city],
      ['State', editForm.state],
      ['Pincode', editForm.pincode],
    ];
    const blank = need.filter(([, v]) => !v.trim()).map(([label]) => label);
    if (blank.length) return `Still needed: ${blank.join(', ')}.`;
    // An NRI student's postal code is not a six-digit Indian PIN, so the strict rule only
    // applies to the nationality it is actually true for.
    if (editForm.nationality === 'Indian' && !/^\d{6}$/.test(editForm.pincode.trim())) {
      return 'Enter a 6-digit pincode.';
    }
    return null;
  };

  const handleEdit = async () => {
    if (!editForm.studentName.trim()) return;
    if (editEmailClash) {
      setEditError('The student and parent need different email addresses — each one gets its own Reasonify login.');
      return;
    }
    const missing = editMissing();
    if (missing) { setEditError(missing); return; }
    if (editForm.studentPassword && !PASSWORD_RE.test(editForm.studentPassword)) {
      setEditError(`Student password: ${PASSWORD_HINT}.`);
      return;
    }
    if (editForm.parentPassword && !PASSWORD_RE.test(editForm.parentPassword)) {
      setEditError(`Parent password: ${PASSWORD_HINT}.`);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      // The API binds the three Reasonify ids to int? — send real numbers, or null when
      // nothing is chosen. Posting "" is what made every Save fail with an invisible 400.
      const num = (v: string) => (v === '' ? null : Number(v));
      const text = (v: string) => v.trim();
      // Widen with Record<string, any> so the web-parity extras (parent details, passwords)
      // pass through even though the shared DTO doesn't declare them.
      const payload: UpdateB2CLeadRequest & Record<string, any> = {
        studentName: text(editForm.studentName),
        mobileNumber: text(editForm.mobileNumber),
        // "" is a real instruction here — it clears the address and makes the student sign in
        // with their mobile, which the create form has always allowed.
        email: text(editForm.email),
        parentName: text(editForm.parentName),
        parentMobile: text(editForm.parentMobile),
        parentEmail: text(editForm.parentEmail),
        schoolName: text(editForm.schoolName),
        nationality: editForm.nationality,
        // Sent alongside the ids, same as the create form: Board/Grade stay free text for the
        // existing reports and filters, the ids are what Reasonify's account actually needs.
        board: text(editForm.board),
        grade: text(editForm.grade),
        reasonifyBoardId: num(editForm.reasonifyBoardId),
        reasonifyLanguageId: num(editForm.reasonifyLanguageId),
        reasonifyGradeId: num(editForm.reasonifyGradeId),
        area: text(editForm.area),
        city: text(editForm.city),
        state: text(editForm.state),
        pincode: text(editForm.pincode),
        enrollmentTimeline: editForm.enrollmentTimeline,
        source: editForm.source,
        priority: editForm.priority,
        sourceReference: text(editForm.sourceReference),
        notes: editForm.notes ?? '',
        // Only sent when actually typed. An omitted password means "keep the current login" —
        // sending "" would fail the server's length rule and reject the whole save.
        ...(editForm.studentPassword ? { studentPassword: editForm.studentPassword } : {}),
        ...(editForm.parentPassword ? { parentPassword: editForm.parentPassword } : {}),
      };
      const res = await b2cLeadService.updateLead(leadId, payload);
      setModal(null);
      // The lead saving and Reasonify accepting the same edit are two outcomes. Reporting a
      // plain success for a half-applied change is how the CRM and the family's actual login
      // drift apart without anyone noticing.
      if (res.data?.reasonifySyncError) {
        toast.warning(`Lead updated, but Reasonify was NOT: ${res.data.reasonifySyncError}`);
      } else {
        toast.success('Lead updated — Reasonify account updated too');
      }
      await load();
      // The credentials card is showing decrypted passwords this save may have replaced.
      if (credentials) await loadCredentials();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update lead');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await b2cLeadService.deleteLead(leadId);
      toast.success('Lead deleted');
      setShowDelete(false);
      navigation.goBack();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete lead');
    } finally { setDeleting(false); }
  };

  const regenerateBrief = async (objId: number) => {
    setBriefBusy(objId);
    try { await b2cObjectionService.generateBrief(objId); await load(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Could not generate brief'); }
    finally { setBriefBusy(null); }
  };

  const setEdit = (k: keyof typeof emptyEdit, v: string) => {
    setEditForm(f => ({ ...f, [k]: v }));
    setEditError('');
  };

  const renderSelect = (
    key: string, options: { label: string; value: string }[],
    value: string, onChange: (v: string) => void, placeholder: string,
  ) => (
    <>
      <Trigger label={options.find(o => o.value === value)?.label ?? placeholder} open={openDd === key} onPress={() => setOpenDd(openDd === key ? null : key)} />
      {openDd === key && (
        <Dropdown style={{ width: '100%' }} maxHeight={r.height * 0.32} value={value} options={options} onSelect={v => { onChange(v); setOpenDd(null); }} />
      )}
    </>
  );

  /** Date + time, side by side — the two halves of a promise made to a family. */
  const renderSlot = (
    keyPrefix: string,
    value: { date: string; time: string },
    onChange: (next: { date: string; time: string }) => void,
  ) => (
    <View style={s.slotRow}>
      <View style={s.slotCell}>
        <DateInput
          label="Date"
          value={value.date}
          onChange={d => onChange({ ...value, date: d })}
          accentColor={T.accent}
          placeholder="Pick a day"
        />
      </View>
      <View style={s.slotCell}>
        <Field label="Time">
          {renderSelect(
            `${keyPrefix}Time`,
            // A time set from the web can land off the quarter-hour grid; keep it selectable
            // rather than silently resetting the slot the family already agreed to.
            TIME_SLOTS.some(t => t.value === value.time) || !value.time
              ? TIME_SLOTS
              : [{ label: timeLabel(value.time), value: value.time }, ...TIME_SLOTS],
            value.time,
            t => onChange({ ...value, time: t }),
            'Pick a time',
          )}
        </Field>
      </View>
    </View>
  );

  // ── Student info field list (web parity) ──
  const infoFields = lead ? [
    { icon: <Phone size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Mobile', value: lead.mobileNumber, onPress: () => Linking.openURL(`tel:${lead.mobileNumber}`) },
    { icon: <Mail size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Email', value: lead.email || DASH, onPress: lead.email ? () => Linking.openURL(`mailto:${lead.email}`) : undefined },
    { icon: <Users size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent', value: lx.parentName || DASH },
    { icon: <GraduationCap size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Standard', value: lx.grade || DASH },
    { icon: <GraduationCap size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Board', value: lx.board || DASH },
    { icon: <School size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'School', value: lx.schoolName || DASH },
    { icon: <Globe size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Nationality', value: lead.nationality || DASH },
    { icon: <MapPin size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Address', value: `${lx.area ? lx.area + ', ' : ''}${lead.city || DASH}${lead.state ? ', ' + lead.state : ''}${lead.pincode ? ' - ' + lead.pincode : ''}` },
    { icon: <Phone size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent Mobile', value: lx.parentMobile || DASH },
    { icon: <Mail size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent Email', value: lx.parentEmail || DASH },
    { icon: <Calendar size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'DOB', value: lead.dateOfBirth ? formatDate(lead.dateOfBirth) : DASH },
    { icon: <Clock size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Timeline', value: spaced(lead.enrollmentTimeline) || DASH },
    { icon: <User size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Priority', value: lead.priority || 'Normal' },
  ] : [];

  const stageBooking = stageForm.stage === 'CounselingBooked';
  const stageConfirmLogin = stageForm.stage === CONFIRM_LOGIN;
  const stageAppointment = stageForm.stage === B2C_APPOINTMENT_STAGE;

  // What the Update Stage dialog has to say about the stage currently picked in it.
  const previousStageNote = lastStageNote[stageForm.stage];
  const showingPreviousNote = !!previousStageNote
    && stageForm.notes.trim() === (previousStageNote.notes ?? '').trim();

  const stageSaveDisabled = saving || (
    stageBooking ? !escForm.counselorId
      : stageConfirmLogin ? false
      : stageAppointment ? (!stageAppt.date || !stageAppt.time || !stageForm.notes.trim())
      : !stageForm.notes.trim()
  );

  const sectionHead = (title: string) => (
    <Text style={[s.formSection, { color: T.accent }]}>{title}</Text>
  );

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentStyle={s.page}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          accessibilityLabel="Back"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={[s.backBtn, { backgroundColor: T.accentSoft }]}
        >
          <ArrowLeft size={20} color={T.accent} strokeWidth={ICON_STROKE} />
        </TouchableOpacity>
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]} numberOfLines={2}>{lead?.studentName || 'Lead'}</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>
            {lead ? [lead.city, spaced(lead.source)].filter(Boolean).join(' · ') : 'Loading…'}
          </Text>
        </View>
        {!!lead && <StatusBadge label={spaced(lead.stage)} color={stageColor(T, lead.stage)} />}
      </View>

      {/* WHY the lead is at that stage. Its own full-width line rather than a column squeezed
         beside the name: on a phone that column steals the title's width, and the note is the
         one sentence explaining where this student stands. It used to be visible only inside
         the Update Stage dialog — i.e. only to someone already about to change it. */}
      {!!lead?.currentStageNote?.trim() && (
        <View style={[s.stageNoteBox, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
          <Text style={[s.stageNote, { color: T.sub }]} numberOfLines={3}>
            {`“${lead.currentStageNote.trim()}”`}
          </Text>
          {!!lead.currentStageNoteBy && (
            <Text style={[s.stageNoteBy, { color: T.dim }]} numberOfLines={1}>
              {`— ${lead.currentStageNoteBy}${lead.currentStageNoteAt ? `, ${formatDate(lead.currentStageNoteAt)}` : ''}`}
            </Text>
          )}
        </View>
      )}

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !lead ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Lead not found.</Text></Card>
      ) : (
        <>
          {/* Appointment — a promise made to a family about a specific moment, so it sits above
             everything with the one action it needs. Hidden once the lead is closed: a
             converted or lost student has no visit pending. */}
          {!!lead.appointmentAt && !isTerminal && (
            <View style={[s.apptBanner, { borderColor: T.accent, backgroundColor: T.accentSoft }]}>
              <CalendarClock size={18} color={T.accent} strokeWidth={ICON_STROKE} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[s.apptTitle, { color: T.text }]}>
                  {`Appointment · ${appointmentLabel(lead.appointmentAt)}`}
                </Text>
                <Text style={[s.apptSub, { color: T.sub }]}>
                  {lead.appointmentNotes?.trim()
                    || 'In your Route Planner for that day — the driving order is built around this time.'}
                </Text>
              </View>
              {isOwnLead && (
                <Btn
                  label="Reschedule"
                  variant="secondary"
                  small
                  onPress={openAppointment}
                  icon={<Edit2 size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                  style={s.tap}
                />
              )}
            </View>
          )}

          {/* Actions */}
          {/* Edit / Update Stage / Log Activity / Convert all 400 server-side for an Agent who
              isn't the lead's assigned owner (LoadLeadForAgentAsync etc.) — a manager can still
              VIEW a team member's lead (see GetLeadByIdAsync's isTeamLead check), so gating on
              role alone showed these buttons on a lead the tap would then fail against. A
              Counselor never reaches this screen for a lead that isn't theirs (GetLeadByIdAsync
              hard-blocks that at the read level), so only Agent needs the extra check. */}
          <View style={s.actionRow}>
            {isOwnLead && !isConverted && (
              <Btn label="Edit" variant="secondary" small onPress={openEdit} icon={<Edit2 size={13} color={T.text} strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
            {isOwnLead && !isConverted && (
              <Btn label="Update Stage" variant="secondary" small onPress={openStage} icon={<GitBranch size={13} color={T.text} strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
            {/* Booking the first visit without walking through the stage dialog. Hidden once
                one exists — the banner above owns it from then on. */}
            {isOwnLead && !lead.appointmentAt && !isTerminal && (
              <Btn label="Book Visit" variant="secondary" small onPress={openAppointment} icon={<CalendarClock size={13} color={T.text} strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
            {isOwnLead && !isConverted && (
              <Btn label="Log Activity" variant="soft" small onPress={openActivity} icon={<Clock size={13} color={T.accent} strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
            {isOwnLead && !isConverted && (
              <Btn label="Convert" variant="success" small onPress={() => navigation.navigate('B2CConvert', { leadId })} icon={<CheckCircle2 size={13} color="#FFF" strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
            {(isAdmin || (isAgent && lead.assignedAgentId === user?.id)) && (
              <Btn label="Delete" variant="dangerGhost" small onPress={() => setShowDelete(true)} icon={<Trash2 size={13} color={T.danger} strokeWidth={ICON_STROKE} />} style={s.tap} />
            )}
          </View>

          {/* Student Information */}
          <Card style={{ marginTop: 12 }}>
            <View style={s.rowBetween}>
              <SectionLabel style={{ marginBottom: 0 }}>Student Information</SectionLabel>
              <Text style={[s.score, { color: T.sub }]}>Score {lead.leadScore}</Text>
            </View>
            <View style={[s.fieldGrid, { marginTop: 14 }]}>
              {infoFields.map(f => (
                <View key={f.label} style={[s.infoCell, { width: fieldW as any }]}>
                  <View style={[s.infoIcon, { backgroundColor: T.cardAlt }]}>{f.icon}</View>
                  <TouchableOpacity disabled={!f.onPress} activeOpacity={0.7} onPress={f.onPress} style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.infoLabel, { color: T.dim }]}>{f.label}</Text>
                    <Text style={[s.infoValue, { color: f.onPress ? T.accent : T.text }]} numberOfLines={2}>{f.value}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {!!lead.notes && (
              <View style={[s.notesBox, { borderTopColor: T.line }]}>
                <Text style={[s.infoLabel, { color: T.dim }]}>Notes</Text>
                <Text style={[s.notesTxt, { color: T.text }]}>{lead.notes}</Text>
              </View>
            )}
          </Card>

          {/* Assignment (admin) */}
          {isAdmin && (
            <Card style={{ marginTop: 12 }}>
              <SectionLabel>Assignment</SectionLabel>
              <View style={s.rowBetween}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.kLabel, { color: T.dim }]}>Assigned Agent</Text>
                  <Text style={[s.kVal, { color: T.text }]} numberOfLines={1}>{lead.assignedAgentName || 'Unassigned'}</Text>
                </View>
                <Btn label={lead.assignedAgentId ? 'Reassign' : 'Assign'} variant="soft" small onPress={openAgent} icon={<UserPlus size={13} color={T.accent} strokeWidth={ICON_STROKE} />} style={s.tap} />
              </View>
              <View style={[s.rowBetween, { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.kLabel, { color: T.dim }]}>Counselor</Text>
                  <Text style={[s.kVal, { color: T.text }]} numberOfLines={1}>{lead.assignedCounselorName || 'Not assigned'}</Text>
                </View>
                {canAssignCounselor && (
                  <Btn label={lead.assignedCounselorName ? 'Change' : 'Assign'} variant="soft" small onPress={openCounselor} icon={<UserCheck size={13} color={T.accent} strokeWidth={ICON_STROKE} />} style={s.tap} />
                )}
              </View>
            </Card>
          )}

          {/* Conversion info (any role, when converted) */}
          {isConverted && (
            <Card style={[{ marginTop: 12 }, { borderColor: T.success }]}>
              <View style={s.rowIcon}>
                <CheckCircle2 size={18} color={T.success} strokeWidth={ICON_STROKE} />
                <Text style={[s.cardTitle, { color: T.success }]}>Converted</Text>
              </View>
              <View style={{ marginTop: 12, gap: 10 }}>
                <View><Text style={[s.kLabel, { color: T.success }]}>Amount</Text><Text style={[s.kVal, { color: T.text }]}>{formatFullCurrency(lead.confirmedAmount || 0)}</Text></View>
                <View><Text style={[s.kLabel, { color: T.success }]}>Payment Mode</Text><Text style={[s.kVal, { color: T.text }]}>{spaced(lead.paymentMode) || DASH}</Text></View>
                {!!lead.firstPaymentDate && (
                  <View><Text style={[s.kLabel, { color: T.success }]}>First Payment</Text><Text style={[s.kVal, { color: T.text }]}>{formatDate(lead.firstPaymentDate)}</Text></View>
                )}
              </View>
            </Card>
          )}

          {/* Lead Info (admin) */}
          {isAdmin && (
            <Card style={{ marginTop: 12 }}>
              <SectionLabel>Lead Info</SectionLabel>
              {[
                { label: 'Source', value: spaced(lead.source) || DASH },
                { label: 'State', value: lead.state || DASH },
                { label: 'Score', value: String(lead.leadScore ?? DASH) },
                { label: 'Sibling', value: lead.siblingFlag ? 'Yes' : 'No' },
                { label: 'Created', value: formatDate(lead.createdAt) },
              ].map(m => (
                <View key={m.label} style={s.metaRow}>
                  <Text style={[s.metaKey, { color: T.sub }]}>{m.label}</Text>
                  <Text style={[s.metaVal, { color: T.text }]}>{m.value}</Text>
                </View>
              ))}
            </Card>
          )}

          {/* Reasonify Login — the student/parent account is provisioned when the lead is
             created, so an agent standing in the house can log in as the student. Credentials
             are decrypted on demand, not preloaded. */}
          <Card style={{ marginTop: 12 }}>
            <View style={s.rowBetween}>
              <SectionLabel style={{ marginBottom: 0 }}>Reasonify Login</SectionLabel>
              <StatusBadge
                label={
                  lead.reasonifySyncStatus === 'Synced'
                    ? `Created${lead.reasonifyStudentId ? ` (#${lead.reasonifyStudentId})` : ''}`
                    : lead.reasonifySyncStatus === 'Failed' ? 'Failed'
                    : lead.reasonifySyncStatus === 'Pending' ? 'Pending' : 'Not created'
                }
                color={
                  lead.reasonifySyncStatus === 'Synced' ? T.success
                    : lead.reasonifySyncStatus === 'Failed' ? T.danger
                    : lead.reasonifySyncStatus === 'Pending' ? T.warning : T.dim
                }
              />
            </View>

            {/* An EDIT can fail to reach Reasonify while the lead itself saves perfectly — the
               account still exists, so the badge above still reads "Created". Without this the
               screen would show a cleanly saved lead and never mention that the login the
               family actually uses still holds the old details. */}
            {!!lead.reasonifySyncError && !credentials && (
              <Text style={[s.syncErr, { color: T.danger }]}>{lead.reasonifySyncError}</Text>
            )}

            {!isOwnLead ? (
              <Text style={[s.empty, { color: T.dim }]}>Only the assigned agent/counselor or an admin can view these credentials.</Text>
            ) : credentials ? (
              <View style={{ gap: 12, marginTop: 6 }}>
                <View style={{ gap: 2 }}>
                  <Text style={[s.credWho, { color: T.dim }]}>Student</Text>
                  {/* A student with no email of their own signs in with their MOBILE — show
                     that as the username rather than an empty line above the password. */}
                  <Text style={[s.credVal, { color: T.text }]} selectable>
                    {credentials.studentEmail || credentials.studentMobile || DASH}
                  </Text>
                  <Text style={[s.credPwd, { color: T.text }]} selectable>{credentials.studentPassword || DASH}</Text>
                  {!credentials.studentEmail && !!credentials.studentMobile && (
                    <Text style={[s.credHint, { color: T.dim }]}>Signs in with this mobile — no email on file.</Text>
                  )}
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={[s.credWho, { color: T.dim }]}>Parent</Text>
                  <Text style={[s.credVal, { color: T.text }]} selectable>{credentials.parentEmail || DASH}</Text>
                  <Text style={[s.credPwd, { color: T.text }]} selectable>{credentials.parentPassword || DASH}</Text>
                  {/* The student joined a parent account that already existed (a sibling is
                     enrolled). That account kept its own password, so there is nothing here to
                     show and saying so beats an unexplained dash. */}
                  {!!credentials.parentAccountLinked && (
                    <Text style={[s.credHint, { color: T.dim }]}>Added to an existing parent account — it keeps its own password.</Text>
                  )}
                </View>

                {/* "Failed" with no reason leaves the agent nothing to act on. */}
                {!!credentials.reasonifySyncError && (
                  <Text style={[s.syncErr, { color: T.danger }]}>{credentials.reasonifySyncError}</Text>
                )}

                {/* Provisioning runs once, at creation. Hidden once synced — running it again
                   would create a second Reasonify student for the same child. Hidden too when
                   the lead carries no stored passwords: an account cannot be created without
                   them, and a button guaranteed to fail is worse than no button. */}
                {(credentials.reasonifySyncStatus ?? lead.reasonifySyncStatus) !== 'Synced' && (
                  credentials.studentPassword && credentials.parentPassword ? (
                    <View style={{ gap: 6 }}>
                      <Btn
                        label={syncingReasonify ? 'Creating…' : 'Create in Reasonify'}
                        variant="secondary"
                        small
                        onPress={retryReasonifySync}
                        loading={syncingReasonify}
                        disabled={syncingReasonify}
                        icon={<RefreshCw size={14} color={T.text} strokeWidth={ICON_STROKE} />}
                        style={[s.tap, { alignSelf: 'flex-start' }]}
                      />
                      <Text style={[s.credHint, { color: T.dim }]}>Retries with the credentials shown above.</Text>
                    </View>
                  ) : (
                    <Text style={[s.credHint, { color: T.dim }]}>
                      This lead has no Reasonify passwords saved, so no account can be created for
                      it. Add them by editing the lead.
                    </Text>
                  )
                )}
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Btn
                  label={loadingCredentials ? 'Loading…' : 'View Credentials'}
                  variant="secondary"
                  small
                  onPress={loadCredentials}
                  loading={loadingCredentials}
                  disabled={loadingCredentials}
                  icon={<Eye size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
                  style={[s.tap, { alignSelf: 'flex-start' }]}
                />
                {!!credentialsError && <Text style={[s.syncErr, { color: T.danger }]}>{credentialsError}</Text>}
              </View>
            )}
          </Card>

          {/* Stage history — every stage move with the note recorded at the time, so the whole
             story is readable without opening the update dialog. */}
          {(lead.stageHistory?.length ?? 0) > 0 && (
            <Card style={{ marginTop: 12 }}>
              <View style={s.rowBetween}>
                <SectionLabel style={{ marginBottom: 0 }}>Stage History</SectionLabel>
                <History size={15} color={T.dim} strokeWidth={ICON_STROKE} />
              </View>
              {[...lead.stageHistory]
                .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                .map(h => (
                  <View key={h.id} style={[s.actRow, { borderTopColor: T.line }]}>
                    <View style={[s.dot, { backgroundColor: T.accent }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={s.rowBetween}>
                        <Text style={[s.stageMove, { color: T.text }]}>
                          {h.fromStage ? <Text style={{ color: T.dim, fontWeight: '500' }}>{`${spaced(h.fromStage)} → `}</Text> : null}
                          {spaced(h.toStage)}
                        </Text>
                        <Text style={[s.actMeta, { color: T.dim }]}>{formatDateTime(h.changedAt)}</Text>
                      </View>
                      <Text style={[s.actNotes, { color: h.notes?.trim() ? T.text : T.dim }]}>
                        {h.notes?.trim() || 'No note recorded'}
                      </Text>
                      {!!h.changedByName && <Text style={[s.actMeta, { color: T.dim, marginTop: 2 }]}>by {h.changedByName}</Text>}
                    </View>
                  </View>
                ))}
            </Card>
          )}

          {/* Activity Log */}
          <Card style={{ marginTop: 12 }}>
            <SectionLabel>Activity Log</SectionLabel>
            {activities.length === 0 ? (
              <Text style={[s.empty, { color: T.dim }]}>No activities yet</Text>
            ) : activities.map(a => (
              <View key={a.id} style={[s.actRow, { borderTopColor: T.line }]}>
                <View style={[s.dot, { backgroundColor: T.accent }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.rowBetween}>
                    <Text style={[s.actType, { color: T.accent }]} numberOfLines={1}>{spaced(a.type)}</Text>
                    <Text style={[s.actMeta, { color: T.dim }]}>{formatDateTime(a.createdAt)}</Text>
                  </View>
                  <Text style={[s.actNotes, { color: T.text }]}>{a.notes || DASH}</Text>
                  {!!a.nextFollowUpDate && <Text style={[s.actFollow, { color: T.warning }]}>Follow-up: {formatDate(a.nextFollowUpDate)}</Text>}
                  {a.studentIdCardUrl ? (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      onPress={() => a.studentIdCardUrl && Linking.openURL(a.studentIdCardUrl)}
                    >
                      <Text style={[s.actFollow, { color: T.accent }]}>Student ID card</Text>
                    </TouchableOpacity>
                  ) : (a.studentIdSchoolName || a.studentIdBoard || a.studentIdStandard) ? (
                    <Text style={[s.actFollow, { color: T.sub }]}>
                      Student ID: {[a.studentIdSchoolName, a.studentIdBoard, a.studentIdStandard].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>

          {/* Counseling & AI Brief */}
          {objections.length > 0 && (
            <Card style={{ marginTop: 12 }}>
              <View style={s.rowIcon}>
                <AlertTriangle size={16} color={T.warning} strokeWidth={ICON_STROKE} />
                <Text style={[s.cardTitle, { color: T.text }]}>Counseling & AI Brief</Text>
              </View>
              <View style={{ marginTop: 12, gap: 10 }}>
                {objections.map(o => (
                  <View key={o.id} style={[s.objBox, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                    <View style={s.rowBetween}>
                      <Text style={[s.objTitle, { color: T.text }]} numberOfLines={1}>
                        {OBJECTION_TYPES.find(t => t.value === o.type)?.label || o.type}
                      </Text>
                      <StatusBadge label={spaced(o.status)} color={objectionColor(T, o.status)} />
                    </View>
                    {!!o.details && <Text style={[s.objTxt, { color: T.sub }]}>{o.details}</Text>}
                    {!!o.scheduledAt && <Text style={[s.objAccent, { color: T.accent }]}>Counselor visit: {formatDateTime(o.scheduledAt)}</Text>}
                    <Text style={[s.objMeta, { color: T.dim }]}>
                      Raised by {o.raisedByName}{o.counselorName ? ` · Counselor: ${o.counselorName}` : ''} · {formatDate(o.createdAt)}
                    </Text>
                    {!!o.resolution && <Text style={[s.objTxt, { color: T.success }]}>Resolution: {o.resolution}</Text>}

                    <View style={[s.objBrief, { borderTopColor: T.line }]}>
                      <View style={s.rowBetween}>
                        <View style={s.rowIcon}>
                          <Sparkles size={12} color={T.accent} strokeWidth={ICON_STROKE} />
                          <Text style={[s.objBriefLbl, { color: T.accent }]}>AI Prep Brief</Text>
                        </View>
                        <TouchableOpacity
                          disabled={briefBusy === o.id}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          onPress={() => regenerateBrief(o.id)}
                        >
                          <Text style={[s.objRegen, { color: T.sub }]}>
                            {briefBusy === o.id ? 'Generating…' : (o.aiBrief ? 'Regenerate' : 'Generate')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[s.objTxt, { color: o.aiBrief ? T.text : T.dim }]}>{o.aiBrief || 'Not generated yet.'}</Text>
                      {!!o.aiPostSession && (
                        <View style={[s.objBrief, { borderTopColor: T.line }]}>
                          <Text style={[s.objBriefLbl, { color: T.success }]}>Suggested next step</Text>
                          <Text style={[s.objTxt, { color: T.text }]}>{o.aiPostSession}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}

      {/* Update Stage modal (folds in Book Counseling when CounselingBooked, collects the slot
          when AppointmentBooked, and hands off to the convert wizard when the counselor picks
          the "Confirm Login" pseudo-stage) */}
      <FormModal
        visible={modal === 'stage'}
        title={stageBooking ? 'Book Counseling' : stageConfirmLogin ? 'Confirm Login' : stageAppointment ? 'Book Appointment' : 'Update Stage'}
        wide={r.isTablet}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn
            label={saving ? 'Saving…' : stageBooking ? 'Book Counseling' : stageConfirmLogin ? 'Continue' : stageAppointment ? 'Book Appointment' : 'Update Stage'}
            onPress={handleUpdateStage}
            loading={saving}
            disabled={stageSaveDisabled}
            style={{ flex: 1 }}
          />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="New Stage">
            {renderSelect(
              'stage',
              stageOptions.map(x => ({ label: x === CONFIRM_LOGIN ? 'Confirm Login' : spaced(x), value: x })),
              stageForm.stage,
              selectStage,
              'Select stage',
            )}
          </Field>

          {stageBooking ? (
            <>
              {!!escError && <Text style={[s.errBanner, { color: T.danger, backgroundColor: T.danger + '1A' }]}>{escError}</Text>}
              <Text style={[s.hint, { color: T.sub }]}>Hand this student to a counselor for a deeper conversation. This books the session and prepares an AI brief for them.</Text>
              <Field label="Counselor">
                {renderSelect('escCounselor', counselors.map(c => ({ label: c.name, value: String(c.id) })), escForm.counselorId, v => setEscForm(f => ({ ...f, counselorId: v })), counselors.length ? 'Select a counselor' : 'No counselors available')}
              </Field>
              {renderSlot(
                'esc',
                { date: escForm.scheduledDate, time: escForm.scheduledTime },
                next => setEscForm(f => ({ ...f, scheduledDate: next.date, scheduledTime: next.time })),
              )}
              <Field label="Objection">
                {renderSelect('escType', OBJECTION_TYPES.map(t => ({ label: t.label, value: t.value })), escForm.type, v => setEscForm(f => ({ ...f, type: v })), 'Select objection')}
              </Field>
              <Field label="Details (what the student/parent said)">
                <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                  <TextInput value={escForm.details} onChangeText={v => setEscForm(f => ({ ...f, details: v }))} placeholder="Context for the counselor…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
                </View>
              </Field>
            </>
          ) : stageConfirmLogin ? (
            <Text style={[s.hint, { color: T.sub }]}>This opens the enrollment &amp; payment wizard, the same one Agents use to convert a lead — no notes needed here.</Text>
          ) : stageAppointment ? (
            // The slot the family has agreed to. Editable later from the Appointment banner —
            // students move their times, and re-running a whole stage change to say so would
            // write a meaningless AppointmentBooked → AppointmentBooked step into the history.
            <>
              <Text style={[s.hint, { color: T.sub }]}>
                Fix the day and time {lead?.studentName || 'the'}'s family is expecting you. This lands in your
                Route Planner for that date and is what the day's driving order is built around.
              </Text>
              {renderSlot('stage', stageAppt, setStageAppt)}
              <Field label="Details">
                <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                  <TextInput value={stageForm.notes} onChangeText={v => setStageForm(f => ({ ...f, notes: v }))} placeholder="Who will be home, what to bring, parking…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
                </View>
              </Field>
            </>
          ) : (
            <Field label="Details">
              {/* What was written the last time this lead sat at the selected stage. Prefilled
                 into the box so it is readable and editable; while the box still holds that
                 prefill there is no point printing it twice, but once it has been cleared or
                 edited this is the only place the old note is still visible. */}
              {!!previousStageNote && (
                <View style={[s.prevNote, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                  <History size={13} color={T.dim} strokeWidth={ICON_STROKE} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.prevNoteMeta, { color: T.dim }]}>
                      Last note for <Text style={{ color: T.text, fontWeight: '700' }}>{spaced(stageForm.stage)}</Text>
                      {previousStageNote.changedByName ? ` by ${previousStageNote.changedByName}` : ''}
                      {` · ${formatDate(previousStageNote.changedAt)}`}
                    </Text>
                    {!showingPreviousNote && (
                      <Text style={[s.prevNoteTxt, { color: T.text }]}>{`“${previousStageNote.notes?.trim()}”`}</Text>
                    )}
                    <TouchableOpacity
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      onPress={() => {
                        const restore = previousStageNote.notes?.trim() ?? '';
                        stagePrefillRef.current = showingPreviousNote ? '' : restore;
                        setStageForm(f => ({ ...f, notes: showingPreviousNote ? '' : restore }));
                      }}
                    >
                      <Text style={[s.prevNoteLink, { color: T.accent }]}>
                        {showingPreviousNote ? 'Clear and write a new one' : 'Restore previous note'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput value={stageForm.notes} onChangeText={v => setStageForm(f => ({ ...f, notes: v }))} placeholder="Describe what happened at this stage (required)…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
              </View>
            </Field>
          )}
        </View>
      </FormModal>

      {/* Book / Reschedule appointment — deliberately not a stage change: the lead stays
          exactly where it is in the funnel and only the promised time moves. */}
      <FormModal
        visible={modal === 'appointment'}
        title={lead?.appointmentAt ? 'Reschedule appointment' : 'Book appointment'}
        wide={r.isTablet}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn
            label={saving ? 'Saving…' : lead?.appointmentAt ? 'Reschedule' : 'Book Appointment'}
            onPress={handleReschedule}
            loading={saving}
            disabled={saving || !apptForm.date || !apptForm.time}
            style={{ flex: 1 }}
          />
        </>}
      >
        <View style={{ gap: 12 }}>
          {renderSlot('appt', { date: apptForm.date, time: apptForm.time }, next => setApptForm(f => ({ ...f, ...next })))}
          <Field label="Notes">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput value={apptForm.notes} onChangeText={v => setApptForm(f => ({ ...f, notes: v }))} placeholder="What was agreed — who will be home, what to bring…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
            </View>
          </Field>
          {!!lead?.appointmentAt && (
            <Text style={[s.hint, { color: T.sub }]}>
              {`Currently set for ${appointmentLabel(lead.appointmentAt)}. Saving moves the visit in your Route Planner to the new day and time.`}
            </Text>
          )}
        </View>
      </FormModal>

      {/* Assign / Reassign Agent modal */}
      <FormModal
        visible={modal === 'agent'}
        title={lead?.assignedAgentId ? 'Reassign Agent' : 'Assign Agent'}
        wide={r.isTablet}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : lead?.assignedAgentId ? 'Reassign' : 'Assign'} onPress={handleAssignAgent} loading={saving} disabled={saving || !agentForm.agentId || (!!lead?.assignedAgentId && !agentForm.reason.trim())} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="Agent">
            {renderSelect('agent', agents.map(a => ({ label: a.name, value: String(a.id) })), agentForm.agentId, v => setAgentForm(f => ({ ...f, agentId: v })), agents.length ? 'Select an agent' : 'No agents available')}
          </Field>
          {!!lead?.assignedAgentId && (
            <Field label="Reason for reassignment">
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput value={agentForm.reason} onChangeText={v => setAgentForm(f => ({ ...f, reason: v }))} placeholder="Why is this lead being reassigned?" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
              </View>
            </Field>
          )}
        </View>
      </FormModal>

      {/* Assign Counselor modal */}
      <FormModal
        visible={modal === 'counselor'}
        title="Assign Counselor"
        wide={r.isTablet}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Assigning…' : 'Assign Counselor'} onPress={handleAssignCounselor} loading={saving} disabled={saving || !counselorId} style={{ flex: 1 }} />
        </>}
      >
        <Field label="Counselor">
          {renderSelect('counselor', counselors.map(c => ({ label: c.name, value: String(c.id) })), counselorId, v => setCounselorId(v), counselors.length ? 'Select a counselor' : 'No counselors available')}
        </Field>
      </FormModal>

      {/* Log Activity modal */}
      <FormModal
        visible={modal === 'activity'}
        title="Log Activity"
        wide={r.isTablet}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Log Activity'} onPress={handleLogActivity} loading={saving} disabled={saving || !actForm.notes.trim()} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="Activity Type">
            <View style={s.pillWrap}>
              {ACTIVITY_TYPES.map(t => {
                const on = actForm.type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    onPress={() => setActForm(f => ({ ...f, type: t }))}
                    style={[s.pill, { backgroundColor: on ? T.accent : T.cardAlt, borderColor: on ? T.accent : T.line }]}
                  >
                    <Text style={[s.pillTxt, { color: on ? T.onAccent : T.sub }]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
          <Field label="Notes">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput value={actForm.notes} onChangeText={v => setActForm(f => ({ ...f, notes: v }))} placeholder="What happened?" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
            </View>
          </Field>
          <DateInput label="Schedule Follow-up (optional)" value={actForm.nextFollowUpDate} onChange={v => setActForm(f => ({ ...f, nextFollowUpDate: v }))} accentColor={T.accent} />
        </View>
      </FormModal>

      {/* Edit Lead modal — the same fields the create form captures, because a lead IS the
          student's and parent's Reasonify account: correcting a class, a mobile or a login
          here has to reach both systems or the family ends up with a CRM record and a login
          that disagree. */}
      <FormModal
        visible={modal === 'edit'}
        title="Edit Lead"
        onClose={() => setModal(null)}
        wide
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Save Changes'} onPress={handleEdit} loading={saving} disabled={saving || editEmailClash || !editForm.studentName.trim()} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 14 }}>
          {!!editError && (
            <Text style={[s.errBanner, { color: T.danger, backgroundColor: T.danger + '1A' }]}>{editError}</Text>
          )}
          {!!editDup && (
            <View style={[s.dupBanner, { backgroundColor: T.warning + '1A', borderColor: T.warning }]}>
              <AlertTriangle size={18} color={T.warning} strokeWidth={ICON_STROKE} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[s.dupTitle, { color: T.warning }]}>Another lead already has this name and mobile</Text>
                <Text style={[s.dupMsg, { color: T.sub }]}>
                  {editDup.message || `'${editDup.existingStudentName}' is already registered with this number.`}
                  {editDup.existingAgentName ? ` Assigned to ${editDup.existingAgentName}.` : ''} Saving will be refused.
                </Text>
              </View>
            </View>
          )}

          {sectionHead('Student & Parent')}
          <View style={s.fieldGrid}>
            <View style={{ width: formW as any }}>
              <Input label="Student Name *" value={editForm.studentName} onChangeText={v => setEdit('studentName', v)} placeholder="First Middle Last" />
            </View>
            <View style={{ width: formW as any }}>
              <Input label="Mobile (student) *" value={editForm.mobileNumber} onChangeText={v => setEdit('mobileNumber', v)} keyboardType="phone-pad" placeholder="10-digit mobile" />
            </View>
            <View style={{ width: formW as any }}>
              <Input
                label="Email (student)"
                value={editForm.email}
                onChangeText={v => setEdit('email', v)}
                error={editEmailClash ? 'Must differ from the parent email' : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="student@example.com (optional)"
              />
            </View>
            <View style={{ width: formW as any }}>
              <Input label="Parent Name *" value={editForm.parentName} onChangeText={v => setEdit('parentName', v)} placeholder="Parent / guardian name" />
            </View>
            <View style={{ width: formW as any }}>
              <Input label="Mobile (parent) *" value={editForm.parentMobile} onChangeText={v => setEdit('parentMobile', v)} keyboardType="phone-pad" placeholder="10-digit mobile" />
            </View>
            <View style={{ width: formW as any }}>
              <Input
                label="Email (parent) *"
                value={editForm.parentEmail}
                onChangeText={v => setEdit('parentEmail', v)}
                error={editEmailClash ? 'Must differ from the student email' : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="parent@example.com"
              />
            </View>
            <View style={{ width: formW as any }}>
              <Field label="Nationality">
                {renderSelect('editNationality', B2C_NATIONALITIES.map(n => ({ label: n, value: n })), editForm.nationality, v => setEdit('nationality', v), 'Select nationality')}
              </Field>
            </View>
            <View style={{ width: '100%' }}>
              <Input label="School *" value={editForm.schoolName} onChangeText={v => setEdit('schoolName', v)} placeholder="School name" />
            </View>
          </View>

          {/* Academic — the ids the student's Reasonify account is actually keyed on. */}
          {sectionHead('Academic')}
          <View style={s.fieldGrid}>
            <View style={{ width: formW as any }}>
              <Field label="Board *">
                {renderSelect('editBoard', boards.map(b => ({ label: b.name, value: String(b.id) })), editForm.reasonifyBoardId, setEditBoardId, 'Select board')}
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              <Field label="Medium *">
                {renderSelect('editMedium', languages.map(l => ({ label: l.name, value: String(l.id) })), editForm.reasonifyLanguageId, setEditLanguageId, 'Select medium')}
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              <Field label="Class / Grade *">
                {(!editForm.reasonifyBoardId || !editForm.reasonifyLanguageId || loadingGrades) ? (
                  <Trigger
                    label={!editForm.reasonifyBoardId || !editForm.reasonifyLanguageId ? 'Select board & medium first' : 'Loading…'}
                    open={false}
                    onPress={() => {}}
                  />
                ) : renderSelect('editClass', grades.map(g => ({ label: g.name, value: String(g.id) })), editForm.reasonifyGradeId, setEditGradeId, 'Select class')}
              </Field>
            </View>
          </View>

          {/* Reasonify login — blank means "leave it alone", which is why nothing is prefilled. */}
          {sectionHead('Reasonify Login')}
          <Text style={[s.hint, { color: T.sub }]}>
            Leave both blank to keep the current passwords. Anything typed here resets that login in
            Reasonify as well, and the new credentials are emailed to
            {editForm.email.trim() ? ' the student and the parent.' : ' the parent (the student has no email of their own).'}
          </Text>
          <View style={s.fieldGrid}>
            <View style={{ width: formW as any }}>
              <Input
                label="New Student Password"
                value={editForm.studentPassword}
                onChangeText={v => setEdit('studentPassword', v)}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Leave blank to keep current"
              />
            </View>
            <View style={{ width: formW as any }}>
              <Input
                label="New Parent Password"
                value={editForm.parentPassword}
                onChangeText={v => setEdit('parentPassword', v)}
                secureTextEntry
                autoCapitalize="none"
                editable={!parentAccountShared}
                placeholder={parentAccountShared ? 'Shared account — not editable' : 'Leave blank to keep current'}
              />
            </View>
          </View>
          <Text style={[s.hintSmall, { color: T.dim }]}>
            {parentAccountShared
              ? `${PASSWORD_HINT}. This parent account is shared with a sibling — it keeps its own password and cannot be reset from here.`
              : `${PASSWORD_HINT}.`}
          </Text>

          {sectionHead('Address')}
          <View style={s.fieldGrid}>
            <View style={{ width: formW as any }}>
              <Input label="Area / Locality" value={editForm.area} onChangeText={v => setEdit('area', v)} placeholder="e.g. Satellite" />
            </View>
            <View style={{ width: formW as any }}>
              <Input label="City *" value={editForm.city} onChangeText={v => setEdit('city', v)} placeholder="City" />
            </View>
            <View style={{ width: formW as any }}>
              <Input label="State *" value={editForm.state} onChangeText={v => setEdit('state', v)} placeholder="State" />
            </View>
            <View style={{ width: formW as any }}>
              <Input
                label="Pincode *"
                value={editForm.pincode}
                onChangeText={v => setEdit('pincode', v)}
                keyboardType="number-pad"
                maxLength={10}
                // An NRI student's postal code is not a six-digit Indian PIN, so the strict
                // hint only applies to the nationality it is actually true for.
                placeholder={editForm.nationality === 'Indian' ? 'e.g. 380015' : 'Postal code'}
              />
            </View>
          </View>

          {sectionHead('Enrollment & Source')}
          <View style={s.fieldGrid}>
            <View style={{ width: formW as any }}>
              <Field label="Enrollment Timeline">
                {renderSelect('editTimeline', B2C_ENROLLMENT_TIMELINES.map(x => ({ label: x.label, value: x.value })), editForm.enrollmentTimeline, v => setEdit('enrollmentTimeline', v), 'Select timeline')}
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              <Field label="Lead Source">
                {renderSelect('editSource', B2C_LEAD_SOURCES.map(x => ({ label: spaced(x), value: x })), editForm.source, v => setEdit('source', v), 'Select source')}
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              <Field label="Priority">
                {renderSelect('editPriority', B2C_LEAD_PRIORITIES.map(x => ({ label: x, value: x })), editForm.priority, v => setEdit('priority', v), 'Select priority')}
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              {/* Read-only on purpose: the code was spent when Reasonify granted (or did not
                 grant) this student their signup coins. Changing it now cannot move those
                 coins, so an editable field would only promise something it cannot do. */}
              <Field label="Referral Code">
                <View style={[s.readOnly, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                  <Text style={[s.readOnlyTxt, { color: T.sub }]} numberOfLines={1}>{lead?.referralCode || DASH}</Text>
                </View>
                <Text style={[s.hintSmall, { color: T.dim }]}>Credited at creation — cannot be changed.</Text>
              </Field>
            </View>
            <View style={{ width: formW as any }}>
              <Input label="Source Reference" value={editForm.sourceReference} onChangeText={v => setEdit('sourceReference', v)} placeholder="Referral name, campaign, etc." />
            </View>
          </View>
          <Field label="Notes">
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput value={editForm.notes} onChangeText={v => setEdit('notes', v)} placeholder="Any additional notes…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
            </View>
          </Field>
        </View>
      </FormModal>

      <ConfirmModal
        visible={showDelete}
        title="Delete lead?"
        message={lead ? `${lead.studentName}'s lead will be permanently removed. This cannot be undone.` : ''}
        icon={<Trash2 size={24} color={T.danger} />}
        tone="danger"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </Screen>
  );
};

/**
 * Built from the LIVE window metrics. A module-level StyleSheet is evaluated once at import,
 * so every font size and padding would stay frozen at whatever orientation the app launched
 * in — which is exactly what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  // No paddingBottom: Screen's own `insets.bottom + 28` must survive, or the last card sits
  // under the home indicator.
  page: { padding: r.gutter, width: '100%', maxWidth: r.maxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backBtn: { width: MIN_TAP, height: MIN_TAP, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  h1: { fontWeight: '800', fontSize: r.rf(20), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: r.rf(12.5) },
  stageNoteBox: { marginTop: 10, borderWidth: 1, borderRadius: 12, padding: r.rs(10), gap: 3 },
  stageNote: { fontSize: r.rf(12), fontWeight: '500', fontStyle: 'italic', lineHeight: r.rf(17) },
  stageNoteBy: { fontSize: r.rf(11), fontWeight: '500' },

  apptBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    borderWidth: 1, borderRadius: 14, padding: r.rs(14), marginTop: 14,
  },
  apptTitle: { fontSize: r.rf(13.5), fontWeight: '800' },
  apptSub: { fontSize: r.rf(11.5), fontWeight: '500', lineHeight: r.rf(16) },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tap: { minHeight: MIN_TAP },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: { fontSize: r.rf(12), fontWeight: '700' },
  cardTitle: { fontSize: r.rf(14.5), fontWeight: '700' },

  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  infoCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: r.rf(11), fontWeight: '600' },
  infoValue: { fontSize: r.rf(13.5), fontWeight: '600', marginTop: 2 },

  notesBox: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 3 },
  notesTxt: { fontSize: r.rf(13.5), fontWeight: '500', lineHeight: r.rf(19) },

  kLabel: { fontSize: r.rf(11), fontWeight: '600' },
  kVal: { fontSize: r.rf(13.5), fontWeight: '700', marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, gap: 10 },
  metaKey: { fontSize: r.rf(13), fontWeight: '500' },
  metaVal: { fontSize: r.rf(13), fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  actRow: { flexDirection: 'row', gap: 10, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  actType: { fontSize: r.rf(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 1 },
  actMeta: { fontSize: r.rf(11), fontWeight: '500' },
  actNotes: { fontSize: r.rf(13), fontWeight: '500', marginTop: 2, lineHeight: r.rf(18) },
  actFollow: { fontSize: r.rf(11.5), fontWeight: '600', marginTop: 3 },

  objBox: { borderRadius: 13, borderWidth: 1, padding: 12, gap: 5 },
  objTitle: { fontSize: r.rf(13.5), fontWeight: '700', flex: 1, minWidth: 0 },
  objTxt: { fontSize: r.rf(12.5), fontWeight: '500', lineHeight: r.rf(18) },
  objAccent: { fontSize: r.rf(11.5), fontWeight: '600' },
  objMeta: { fontSize: r.rf(11), fontWeight: '500' },
  objBrief: { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  objBriefLbl: { fontSize: r.rf(11.5), fontWeight: '800' },
  objRegen: { fontSize: r.rf(11.5), fontWeight: '600' },

  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 18 },
  hint: { fontSize: r.rf(12), fontWeight: '500', lineHeight: r.rf(17) },
  hintSmall: { fontSize: r.rf(11), fontWeight: '500', lineHeight: r.rf(15) },
  errBanner: { fontSize: r.rf(12), fontWeight: '600', padding: 10, borderRadius: 10, overflow: 'hidden', lineHeight: r.rf(17) },
  syncErr: { fontSize: r.rf(11.5), fontWeight: '600', marginTop: 6, lineHeight: r.rf(16) },

  dupBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 13, padding: 12 },
  dupTitle: { fontSize: r.rf(12.5), fontWeight: '700' },
  dupMsg: { fontSize: r.rf(11.5), fontWeight: '500', lineHeight: r.rf(16) },

  formSection: { fontWeight: '700', fontSize: r.rf(11.5), letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  readOnly: { height: 46, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', paddingHorizontal: 14 },
  readOnlyTxt: { fontSize: r.rf(13.5), fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  slotCell: { flexGrow: 1, flexBasis: 150, minWidth: 0 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: MIN_TAP, minWidth: MIN_TAP, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  pillTxt: { fontSize: r.rf(12.5), fontWeight: '700' },

  credWho: { fontSize: r.rf(11), fontWeight: '600' },
  credVal: { fontSize: r.rf(13), fontWeight: '600' },
  credPwd: { fontSize: r.rf(13), fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  credHint: { fontSize: r.rf(11), fontWeight: '500', lineHeight: r.rf(15) },

  stageMove: { fontSize: r.rf(13), fontWeight: '700', flex: 1, minWidth: 0 },
  prevNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  prevNoteMeta: { fontSize: r.rf(11), fontWeight: '500', lineHeight: r.rf(15) },
  prevNoteTxt: { fontSize: r.rf(12), fontWeight: '500', lineHeight: r.rf(17), marginTop: 3 },
  prevNoteLink: { fontSize: r.rf(11), fontWeight: '700', marginTop: 5 },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
});
