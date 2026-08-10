import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, TextInput, useWindowDimensions,
} from 'react-native';
import {
  ArrowLeft, Phone, Mail, MapPin, User, Calendar, Edit2, CheckCircle2, UserCheck, UserPlus,
  Clock, Trash2, AlertTriangle, GraduationCap, School, Users, Sparkles, GitBranch,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge, FormModal, ConfirmModal,
} from '../../components/crud';
import { Screen, Card, SectionLabel, Chip } from '../../components/ui';
import { DateInput } from '../../components/common/DateInput';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cCounselorService } from '../../api/b2c/b2cCounselorService';
import { b2cObjectionService, OBJECTION_TYPES } from '../../api/b2c/b2cObjectionService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import {
  B2CLeadDetailDto, B2CActivityListDto, B2C_LEAD_STAGES, B2C_LEAD_SOURCES, B2C_LEAD_PRIORITIES,
  B2C_ENROLLMENT_TIMELINES, B2CActivityTypeName, UpdateB2CLeadRequest, B2CLeadSource, B2CLeadPriority,
  B2CEnrollmentTimeline,
} from '../../types/b2c';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { formatDate, formatDateTime, formatRelativeDate, formatFullCurrency } from '../../utils/formatting';
import { rf } from '../../utils/responsive';

const DASH = '—';
type ModalKind = 'stage' | 'agent' | 'counselor' | 'activity' | 'edit' | null;

// Web parity (B2CLeadDetail.jsx ACTIVITY_TYPES) — the generic Log-Activity set.
const ACTIVITY_TYPES: B2CActivityTypeName[] = ['Call', 'Visit', 'WhatsApp', 'Email', 'Session', 'Note'];

// Split a PascalCase enum name into words for display ("GoogleAds" → "Google Ads").
const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');

// Stage → theme colour (mirrors AgentDashboard.stageTint + web stageTag intent).
const stageColor = (T: AppTheme, stage?: string): string => {
  if (stage === 'Converted') return T.success;
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

const emptyEdit = {
  studentName: '', mobileNumber: '', email: '', parentName: '', parentMobile: '', parentEmail: '',
  grade: '', schoolName: '', city: '', state: '', area: '', pincode: '',
  source: 'Website' as B2CLeadSource, priority: 'Warm' as B2CLeadPriority,
  enrollmentTimeline: 'Immediate' as B2CEnrollmentTimeline, notes: '',
};

export const B2CLeadDetailScreen = ({ route, navigation }: any) => {
  const { leadId } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const T = useAppTheme();
  const { width } = useWindowDimensions();
  const twoCol = width >= 720;               // iPad landscape → 2-up detail fields
  const fieldW = twoCol ? '48.5%' : '100%';

  const role = user?.role;
  const isAdmin = role === 'B2CAdmin';
  const isAgent = role === 'Agent';
  const isCounselor = role === 'Counselor';
  const canAssignCounselor = isAdmin;
  const canConvert = isAdmin || isAgent;
  const canUpdateStage = isAdmin || isAgent || isCounselor;

  const [lead, setLead] = useState<B2CLeadDetailDto | null>(null);
  const [activities, setActivities] = useState<B2CActivityListDto[]>([]);
  const [objections, setObjections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [briefBusy, setBriefBusy] = useState<number | null>(null);
  const [openDd, setOpenDd] = useState<string | null>(null);

  // Admin/agent dropdown rosters
  const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
  const [counselors, setCounselors] = useState<{ id: number; name: string }[]>([]);

  // Modal forms
  const [stageForm, setStageForm] = useState({ stage: '', notes: '' });
  const [escForm, setEscForm] = useState({ counselorId: '', type: 'Price', details: '', scheduledDate: '', scheduledTime: '' });
  const [escError, setEscError] = useState('');
  const [agentForm, setAgentForm] = useState({ agentId: '', reason: '' });
  const [counselorId, setCounselorId] = useState('');
  const [actForm, setActForm] = useState({ type: 'Call' as B2CActivityTypeName, notes: '', nextFollowUpDate: '' });
  const [editForm, setEditForm] = useState({ ...emptyEdit });

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

  const isConverted = lead?.stage === 'Converted';
  // Extended lead fields the detail response carries but the shared DTO doesn't declare.
  const lx: any = lead || {};

  // Role-aware stage options (web parity).
  const stageOptions = isAgent
    ? ['New', 'Contacted', 'Interested', 'CounselingBooked', 'FollowUp', 'NotInterested']
    : isCounselor
      ? ['CounselingDone', 'FollowUp']
      : B2C_LEAD_STAGES.filter(s => s !== 'Converted');

  // ── Modal openers ──
  const openStage = () => {
    setStageForm({ stage: stageOptions.includes(lead?.stage as any) ? (lead?.stage || '') : stageOptions[0], notes: '' });
    setEscForm({ counselorId: lead?.assignedCounselorId ? String(lead.assignedCounselorId) : '', type: 'Price', details: '', scheduledDate: '', scheduledTime: '' });
    setEscError('');
    setModal('stage');
  };
  const openAgent = () => { setAgentForm({ agentId: lead?.assignedAgentId ? String(lead.assignedAgentId) : '', reason: '' }); setModal('agent'); };
  const openCounselor = () => { setCounselorId(lead?.assignedCounselorId ? String(lead.assignedCounselorId) : ''); setModal('counselor'); };
  const openActivity = () => { setActForm({ type: 'Call', notes: '', nextFollowUpDate: '' }); setModal('activity'); };
  const openEdit = () => {
    if (!lead) return;
    setEditForm({
      studentName: lead.studentName || '', mobileNumber: lead.mobileNumber || '', email: lead.email || '',
      parentName: lx.parentName || '', parentMobile: lx.parentMobile || '', parentEmail: lx.parentEmail || '',
      grade: lx.grade || '', schoolName: lx.schoolName || '', city: lead.city || '', state: lead.state || '',
      area: lx.area || '', pincode: lead.pincode || '',
      source: (lead.source as B2CLeadSource) || 'Website', priority: (lead.priority as B2CLeadPriority) || 'Warm',
      enrollmentTimeline: (lead.enrollmentTimeline as B2CEnrollmentTimeline) || 'Immediate', notes: lead.notes || '',
    });
    setModal('edit');
  };

  // ── Handlers ──
  const handleEscalate = async () => {
    if (!escForm.counselorId) return;
    setSaving(true); setEscError('');
    try {
      const scheduledAt = escForm.scheduledDate
        ? new Date(`${escForm.scheduledDate}T${escForm.scheduledTime || '10:00'}`).toISOString()
        : undefined;
      await b2cObjectionService.escalate(Number(leadId), {
        counselorId: Number(escForm.counselorId),
        type: escForm.type,
        details: escForm.details || undefined,
        scheduledAt,
      });
      toast.success('Escalated to counselling');
      setModal(null); await load();
    } catch (err: any) {
      setEscError(err?.response?.data?.message || 'Failed to escalate lead');
      toast.error(err?.response?.data?.message || 'Failed to escalate lead');
    } finally { setSaving(false); }
  };

  const handleUpdateStage = async () => {
    // Booking counseling folds in the counselor + date/time + objection → escalate flow.
    if (stageForm.stage === 'CounselingBooked') { await handleEscalate(); return; }
    if (!stageForm.notes.trim()) return;
    setSaving(true);
    try {
      await b2cLeadService.updateStage(leadId, stageForm.stage, stageForm.notes.trim());
      toast.success('Stage updated');
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update stage');
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

  const handleEdit = async () => {
    if (!editForm.studentName.trim()) return;
    setSaving(true);
    try {
      // Widen with Record<string, any> so the web-parity extras (parentMobile / parentEmail)
      // pass through even though the shared DTO doesn't declare them.
      const payload: UpdateB2CLeadRequest & Record<string, any> = {
        studentName: editForm.studentName.trim(),
        mobileNumber: editForm.mobileNumber.trim() || undefined,
        email: editForm.email.trim() || null,
        parentName: editForm.parentName.trim() || null,
        parentMobile: editForm.parentMobile.trim() || null,
        parentEmail: editForm.parentEmail.trim() || null,
        grade: editForm.grade.trim() || null,
        schoolName: editForm.schoolName.trim() || null,
        city: editForm.city.trim() || undefined,
        state: editForm.state.trim() || undefined,
        area: editForm.area.trim() || null,
        pincode: editForm.pincode.trim() || null,
        source: editForm.source,
        priority: editForm.priority,
        enrollmentTimeline: editForm.enrollmentTimeline,
        notes: editForm.notes.trim() || null,
      };
      await b2cLeadService.updateLead(leadId, payload);
      toast.success('Lead updated');
      setModal(null); await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update lead');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await b2cLeadService.deleteLead(leadId);
      toast.success('Lead deleted');
      setShowDelete(false);
      navigation.goBack();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete lead');
    }
  };

  const regenerateBrief = async (objId: number) => {
    setBriefBusy(objId);
    try { await b2cObjectionService.generateBrief(objId); await load(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Could not generate brief'); }
    finally { setBriefBusy(null); }
  };

  const setEdit = (k: keyof typeof emptyEdit, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const renderSelect = (key: string, options: { label: string; value: string }[], value: string, onChange: (v: string) => void, placeholder: string) => (
    <>
      <Trigger label={options.find(o => o.value === value)?.label ?? placeholder} open={openDd === key} onPress={() => setOpenDd(openDd === key ? null : key)} />
      {openDd === key && (
        <Dropdown style={{ width: '100%' }} maxHeight={260} value={value} options={options} onSelect={v => { onChange(v); setOpenDd(null); }} />
      )}
    </>
  );

  // ── Student info field list (web parity) ──
  const infoFields = lead ? [
    { icon: <Phone size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Mobile', value: lead.mobileNumber, onPress: () => Linking.openURL(`tel:${lead.mobileNumber}`) },
    { icon: <Mail size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Email', value: lead.email || DASH, onPress: lead.email ? () => Linking.openURL(`mailto:${lead.email}`) : undefined },
    { icon: <Users size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent', value: lx.parentName || DASH },
    { icon: <GraduationCap size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Standard', value: lx.grade || DASH },
    { icon: <School size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'School', value: lx.schoolName || DASH },
    { icon: <MapPin size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Address', value: `${lx.area ? lx.area + ', ' : ''}${lead.city || DASH}${lead.state ? ', ' + lead.state : ''}${lead.pincode ? ' - ' + lead.pincode : ''}` },
    { icon: <Phone size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent Mobile', value: lx.parentMobile || DASH },
    { icon: <Mail size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Parent Email', value: lx.parentEmail || DASH },
    { icon: <Calendar size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'DOB', value: lead.dateOfBirth ? formatDate(lead.dateOfBirth) : DASH },
    { icon: <Clock size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Timeline', value: spaced(lead.enrollmentTimeline) || DASH },
    { icon: <User size={15} color={T.dim} strokeWidth={ICON_STROKE} />, label: 'Priority', value: lead.priority || 'Normal' },
  ] : [];

  const stageBooking = stageForm.stage === 'CounselingBooked';

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      {/* Header */}
      <View style={s.header}>
        <IconBtn kind="view" label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <View style={s.titleBlock}>
          <Text style={[s.h1, { color: T.text }]} numberOfLines={1}>{lead?.studentName || 'Lead'}</Text>
          <Text style={[s.h2, { color: T.sub }]} numberOfLines={1}>
            {lead ? [lead.city, spaced(lead.source)].filter(Boolean).join(' · ') : 'Loading…'}
          </Text>
        </View>
        {!!lead && <StatusBadge label={lead.stage} color={stageColor(T, lead.stage)} />}
      </View>

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : !lead ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Lead not found.</Text></Card>
      ) : (
        <>
          {/* Actions */}
          <View style={s.actionRow}>
            {(isAdmin || isAgent) && !isConverted && (
              <Btn label="Edit" variant="secondary" small onPress={openEdit} icon={<Edit2 size={13} color={T.text} strokeWidth={ICON_STROKE} />} />
            )}
            {canUpdateStage && !isConverted && (
              <Btn label="Update Stage" variant="secondary" small onPress={openStage} icon={<GitBranch size={13} color={T.text} strokeWidth={ICON_STROKE} />} />
            )}
            {(isAdmin || isAgent || isCounselor) && !isConverted && (
              <Btn label="Log Activity" variant="soft" small onPress={openActivity} icon={<Clock size={13} color={T.accent} strokeWidth={ICON_STROKE} />} />
            )}
            {canConvert && !isConverted && (
              <Btn label="Convert" variant="success" small onPress={() => navigation.navigate('B2CConvert', { leadId })} icon={<CheckCircle2 size={13} color="#FFF" strokeWidth={ICON_STROKE} />} />
            )}
            {(isAdmin || (isAgent && lead.assignedAgentId === user?.id)) && (
              <Btn label="Delete" variant="dangerGhost" small onPress={() => setShowDelete(true)} icon={<Trash2 size={13} color={T.danger} strokeWidth={ICON_STROKE} />} />
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
                <View key={f.label} style={[s.infoCell, { width: fieldW }]}>
                  <View style={[s.infoIcon, { backgroundColor: T.cardAlt }]}>{f.icon}</View>
                  <TouchableOpacity disabled={!f.onPress} activeOpacity={0.7} onPress={f.onPress} style={{ flex: 1 }}>
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
                <View style={{ flex: 1 }}>
                  <Text style={[s.kLabel, { color: T.dim }]}>Assigned Agent</Text>
                  <Text style={[s.kVal, { color: T.text }]}>{lead.assignedAgentName || 'Unassigned'}</Text>
                </View>
                <Btn label={lead.assignedAgentId ? 'Reassign' : 'Assign'} variant="soft" small onPress={openAgent} icon={<UserPlus size={13} color={T.accent} strokeWidth={ICON_STROKE} />} />
              </View>
              <View style={[s.rowBetween, { borderTopColor: T.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.kLabel, { color: T.dim }]}>Counselor</Text>
                  <Text style={[s.kVal, { color: T.text }]}>{lead.assignedCounselorName || 'Not assigned'}</Text>
                </View>
                {canAssignCounselor && (
                  <Btn label={lead.assignedCounselorName ? 'Change' : 'Assign'} variant="soft" small onPress={openCounselor} icon={<UserCheck size={13} color={T.accent} strokeWidth={ICON_STROKE} />} />
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
                <View><Text style={[s.kLabel, { color: T.success }]}>Payment Mode</Text><Text style={[s.kVal, { color: T.text }]}>{lead.paymentMode || DASH}</Text></View>
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

          {/* Activity Log */}
          <Card style={{ marginTop: 12 }}>
            <SectionLabel>Activity Log</SectionLabel>
            {activities.length === 0 ? (
              <Text style={[s.empty, { color: T.dim }]}>No activities yet</Text>
            ) : activities.map(a => (
              <View key={a.id} style={[s.actRow, { borderTopColor: T.line }]}>
                <View style={[s.dot, { backgroundColor: T.accent }]} />
                <View style={{ flex: 1 }}>
                  <View style={s.rowBetween}>
                    <Text style={[s.actType, { color: T.accent }]}>{a.type}</Text>
                    <Text style={[s.actMeta, { color: T.dim }]}>{formatDateTime(a.createdAt)}</Text>
                  </View>
                  <Text style={[s.actNotes, { color: T.text }]}>{a.notes || DASH}</Text>
                  {!!a.nextFollowUpDate && <Text style={[s.actFollow, { color: T.warning }]}>Follow-up: {formatDate(a.nextFollowUpDate)}</Text>}
                  {a.studentIdCardUrl ? (
                    <Text style={[s.actFollow, { color: T.accent }]} onPress={() => Linking.openURL(a.studentIdCardUrl!)}>
                      📇 Student ID card
                    </Text>
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
                      <StatusBadge label={o.status} color={objectionColor(T, o.status)} />
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
                        <TouchableOpacity disabled={briefBusy === o.id} onPress={() => regenerateBrief(o.id)}>
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

      {/* Update Stage modal (folds in Book Counseling when CounselingBooked) */}
      <FormModal
        visible={modal === 'stage'}
        title={stageBooking ? 'Book Counseling' : 'Update Stage'}
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn
            label={saving ? 'Saving…' : stageBooking ? 'Book Counseling' : 'Update Stage'}
            onPress={handleUpdateStage}
            loading={saving}
            disabled={saving || (stageBooking ? !escForm.counselorId : !stageForm.notes.trim())}
            style={{ flex: 1 }}
          />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="New Stage">
            {renderSelect('stage', stageOptions.map(x => ({ label: x, value: x })), stageForm.stage, v => setStageForm(f => ({ ...f, stage: v })), 'Select stage')}
          </Field>

          {stageBooking ? (
            <>
              {!!escError && <Text style={[s.errBanner, { color: T.danger, backgroundColor: T.danger + '1A' }]}>{escError}</Text>}
              <Text style={[s.hint, { color: T.sub }]}>Hand this student to a counselor for a deeper conversation. This books the session and prepares an AI brief for them.</Text>
              <Field label="Counselor">
                {renderSelect('escCounselor', counselors.map(c => ({ label: c.name, value: String(c.id) })), escForm.counselorId, v => setEscForm(f => ({ ...f, counselorId: v })), counselors.length ? 'Select a counselor' : 'No counselors available')}
              </Field>
              <View style={s.rowGap}>
                <View style={{ flex: 1 }}>
                  <DateInput label="Visit date" value={escForm.scheduledDate} onChange={v => setEscForm(f => ({ ...f, scheduledDate: v }))} accentColor={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Visit time" value={escForm.scheduledTime} onChangeText={v => setEscForm(f => ({ ...f, scheduledTime: v }))} placeholder="HH:MM" />
                </View>
              </View>
              <Field label="Objection">
                {renderSelect('escType', OBJECTION_TYPES.map(t => ({ label: t.label, value: t.value })), escForm.type, v => setEscForm(f => ({ ...f, type: v })), 'Select objection')}
              </Field>
              <Field label="Details (what the student/parent said)">
                <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                  <TextInput value={escForm.details} onChangeText={v => setEscForm(f => ({ ...f, details: v }))} placeholder="Context for the counselor…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
                </View>
              </Field>
            </>
          ) : (
            <Field label="Details">
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput value={stageForm.notes} onChangeText={v => setStageForm(f => ({ ...f, notes: v }))} placeholder="Describe what happened at this stage (required)…" placeholderTextColor={T.dim} multiline style={[s.textareaTxt, { color: T.text }]} />
              </View>
            </Field>
          )}
        </View>
      </FormModal>

      {/* Assign / Reassign Agent modal */}
      <FormModal
        visible={modal === 'agent'}
        title={lead?.assignedAgentId ? 'Reassign Agent' : 'Assign Agent'}
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
        onClose={() => setModal(null)}
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Log Activity'} onPress={handleLogActivity} loading={saving} disabled={saving || !actForm.notes.trim()} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Field label="Activity Type">
            <View style={s.chipWrap}>
              {ACTIVITY_TYPES.map(t => (
                <Chip key={t} label={t} active={actForm.type === t} onPress={() => setActForm(f => ({ ...f, type: t }))} />
              ))}
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

      {/* Edit Lead modal */}
      <FormModal
        visible={modal === 'edit'}
        title="Edit Lead"
        onClose={() => setModal(null)}
        wide
        footer={<>
          <Btn label="Cancel" variant="secondary" onPress={() => setModal(null)} style={{ flex: 1 }} />
          <Btn label={saving ? 'Saving…' : 'Save Changes'} onPress={handleEdit} loading={saving} disabled={saving || !editForm.studentName.trim()} style={{ flex: 1 }} />
        </>}
      >
        <View style={{ gap: 12 }}>
          <Input label="Full Name" value={editForm.studentName} onChangeText={v => setEdit('studentName', v)} placeholder="Student name" />
          <View style={s.fieldGrid}>
            <View style={{ width: fieldW }}><Input label="Mobile" value={editForm.mobileNumber} onChangeText={v => setEdit('mobileNumber', v)} keyboardType="phone-pad" /></View>
            <View style={{ width: fieldW }}><Input label="Email" value={editForm.email} onChangeText={v => setEdit('email', v)} keyboardType="email-address" autoCapitalize="none" /></View>
            <View style={{ width: fieldW }}><Input label="Parent Name" value={editForm.parentName} onChangeText={v => setEdit('parentName', v)} /></View>
            <View style={{ width: fieldW }}><Input label="Standard / Grade" value={editForm.grade} onChangeText={v => setEdit('grade', v)} placeholder="e.g. 9" /></View>
            <View style={{ width: fieldW }}><Input label="Parent Mobile" value={editForm.parentMobile} onChangeText={v => setEdit('parentMobile', v)} keyboardType="phone-pad" /></View>
            <View style={{ width: fieldW }}><Input label="Parent Email" value={editForm.parentEmail} onChangeText={v => setEdit('parentEmail', v)} keyboardType="email-address" autoCapitalize="none" /></View>
            <View style={{ width: '100%' }}><Input label="School" value={editForm.schoolName} onChangeText={v => setEdit('schoolName', v)} /></View>
            <View style={{ width: fieldW }}><Input label="Area / Locality" value={editForm.area} onChangeText={v => setEdit('area', v)} placeholder="e.g. Satellite" /></View>
            <View style={{ width: fieldW }}><Input label="City" value={editForm.city} onChangeText={v => setEdit('city', v)} /></View>
            <View style={{ width: fieldW }}><Input label="State" value={editForm.state} onChangeText={v => setEdit('state', v)} /></View>
            <View style={{ width: fieldW }}><Input label="Pincode" value={editForm.pincode} onChangeText={v => setEdit('pincode', v)} keyboardType="number-pad" /></View>
            <View style={{ width: fieldW }}>
              <Field label="Source">
                {renderSelect('editSource', B2C_LEAD_SOURCES.map(x => ({ label: spaced(x), value: x })), editForm.source, v => setEdit('source', v), 'Select source')}
              </Field>
            </View>
            <View style={{ width: fieldW }}>
              <Field label="Priority">
                {renderSelect('editPriority', B2C_LEAD_PRIORITIES.map(x => ({ label: x, value: x })), editForm.priority, v => setEdit('priority', v), 'Select priority')}
              </Field>
            </View>
            <View style={{ width: fieldW }}>
              <Field label="Enrollment Timeline">
                {renderSelect('editTimeline', B2C_ENROLLMENT_TIMELINES.map(x => ({ label: x.label, value: x.value })), editForm.enrollmentTimeline, v => setEdit('enrollmentTimeline', v), 'Select timeline')}
              </Field>
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
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </Screen>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  h1: { fontWeight: '800', fontSize: rf(20), letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: rf(12.5) },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap: { flexDirection: 'row', gap: 12 },
  score: { fontSize: rf(12), fontWeight: '700' },
  cardTitle: { fontSize: rf(14.5), fontWeight: '700' },

  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  infoCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: rf(11), fontWeight: '600' },
  infoValue: { fontSize: rf(13.5), fontWeight: '600', marginTop: 2 },

  notesBox: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 3 },
  notesTxt: { fontSize: rf(13.5), fontWeight: '500', lineHeight: 19 },

  kLabel: { fontSize: rf(11), fontWeight: '600' },
  kVal: { fontSize: rf(13.5), fontWeight: '700', marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  metaKey: { fontSize: rf(13), fontWeight: '500' },
  metaVal: { fontSize: rf(13), fontWeight: '600' },

  actRow: { flexDirection: 'row', gap: 10, paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  actType: { fontSize: rf(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  actMeta: { fontSize: rf(11), fontWeight: '500' },
  actNotes: { fontSize: rf(13), fontWeight: '500', marginTop: 2, lineHeight: 18 },
  actFollow: { fontSize: rf(11.5), fontWeight: '600', marginTop: 3 },

  objBox: { borderRadius: 13, borderWidth: 1, padding: 12, gap: 5 },
  objTitle: { fontSize: rf(13.5), fontWeight: '700', flex: 1 },
  objTxt: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 18 },
  objAccent: { fontSize: rf(11.5), fontWeight: '600' },
  objMeta: { fontSize: rf(11), fontWeight: '500' },
  objBrief: { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  objBriefLbl: { fontSize: rf(11.5), fontWeight: '800' },
  objRegen: { fontSize: rf(11.5), fontWeight: '600' },

  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 18 },
  hint: { fontSize: rf(12), fontWeight: '500', lineHeight: 17 },
  errBanner: { fontSize: rf(12), fontWeight: '600', padding: 10, borderRadius: 10, overflow: 'hidden' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
});
