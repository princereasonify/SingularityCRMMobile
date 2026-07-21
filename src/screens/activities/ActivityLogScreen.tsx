import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TextInput,
  useWindowDimensions, Alert, ActivityIndicator, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { Plus, ChevronDown, ChevronUp, ClipboardList, Edit2, Trash2, Camera } from 'lucide-react-native';

import { activitiesApi } from '../../api/activities';
import { leadsApi } from '../../api/leads';
import { ActivityDto, LeadListDto, UpdateActivityRequest } from '../../types';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Trigger, Dropdown, StatusBadge, FilterChip,
  Pagination, ListCard, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha } from '../../theme';
import {
  ACTIVITY_COLORS, ACTIVITY_TYPES, ACTIVITY_OUTCOMES, INTEREST_LEVELS, DEMO_MODES,
  API_BASE_URL,
} from '../../utils/constants';
import { formatRelativeDate, formatDate, formatTime } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';

/** Web parity: the list pages 10 at a time and reports the server's real totalCount. */
const PAGE_SIZE = 10;

const DASH = '—';

/** Web's `typeLabels` — the API's enum name differs from the label users read. */
const TYPE_LABELS: Record<string, string> = { FollowUp: 'Follow-up' };
const typeLabel = (t: string) => TYPE_LABELS[t] || t;

const TYPE_OPTIONS = ['All', ...ACTIVITY_TYPES];
const OUTCOME_OPTIONS = ['All', ...ACTIVITY_OUTCOMES];

/** Spec tokens for outcomes — Positive/Neutral/Negative/Pending. */
const outcomeColor = (o: string | undefined, T: AppTheme) =>
  o === 'Positive' ? T.success
  : o === 'Neutral' ? T.info
  : o === 'Negative' ? T.danger
  : o === 'Pending' ? T.warning
  : T.dim;

const interestColor = (l: string | undefined, T: AppTheme) =>
  l === 'High' ? T.success : l === 'Medium' ? T.warning : T.danger;

/**
 * CreateActivityRequest.TimeIn/TimeOut are `DateTime?` on the server
 * (SalesCRM.Core/DTOs/ActivityDto.cs), so a bare "HH:MM" fails to bind and 400s the
 * whole create. Web sends an ISO string; we do the same, anchoring the time to today.
 */
const timeToIso = (hhmm: string): string | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toISOString();
};

/**
 * Inverse of timeToIso for pre-filling the edit form. `formatTime` is en-IN 12-hour
 * ("02:30 pm") which the HH:MM field can't round-trip, so we read the local clock
 * directly and pad to 24-hour — exactly what timeToIso parses back.
 */
const isoToHhmm = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** `nextFollowUpDate` comes back as a full ISO stamp; DateInput wants YYYY-MM-DD. */
const isoToDate = (iso?: string): string => (iso ? iso.split('T')[0] : '');

/**
 * Visit proof photos. UploadPhoto stores to GCS and returns the bucket's public URL, so
 * `photoUrl` is normally absolute — but a local `file://` preview and any legacy relative
 * path also have to render, so we resolve exactly like web does
 * (`photoUrl.startsWith('http') ? photoUrl : API_ORIGIN + photoUrl`). Same helper idiom as
 * PerformanceScreen's avatar resolver.
 */
const photoSrc = (url: string): string =>
  /^(https?:|file:|content:|data:)/.test(url)
    ? url
    : `${String(API_BASE_URL || '').replace(/\/api\/?$/, '')}${url}`;

/** Web parity: ActivityLog.jsx offers the upload only for `Visit` and `FollowUp`. */
const PHOTO_TYPES = ['Visit', 'FollowUp'];

const EMPTY_FORM = {
  type: 'Visit', leadId: '' as any, outcome: 'Positive', notes: '',
  timeIn: '', timeOut: '', personMet: '', personDesignation: '', personPhone: '',
  interestLevel: 'High', nextAction: '', nextFollowUpDate: '',
  demoMode: 'Online', conductedBy: '', attendees: '', feedback: '',
};

export const ActivityLogScreen = ({ route }: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the table — never a card grid. Phones get list rows. */
  const table = isTabletDevice;

  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [typeFilter, setTypeFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [openDd, setOpenDd] = useState<'type' | 'outcome' | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  /** Non-null while the modal is editing an existing row; null = "Log New Activity". */
  const [editing, setEditing] = useState<ActivityDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityDto | null>(null);
  /** Id of the row whose visit-proof photo is currently uploading — web's `uploading`. */
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const fetchActivities = useCallback(async (pg: number) => {
    try {
      // GET /activities takes PaginationParams (`page`, `pageSize`) + `type` and returns
      // ApiResponse<PaginatedResult<ActivityDto>> → { items, totalCount, page, pageSize }
      // — see ActivitiesController.GetActivities. The client unwraps ApiResponse.data.
      const res = await activitiesApi.getActivities({
        page: pg,
        pageSize: PAGE_SIZE,
        type: typeFilter !== 'All' ? typeFilter : undefined,
      });
      const d: any = res.data;
      const total = d?.totalCount ?? 0;
      setActivities(d?.items ?? []);
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch {
      setActivities([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter]);

  // Any filter change resets to page 1.
  useEffect(() => {
    setLoading(true);
    setPage(1);
    setExpanded(null);
    fetchActivities(1);
  }, [typeFilter]);

  useEffect(() => {
    leadsApi.getPipeline()
      .then(r => setLeads(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (route?.params?.leadId) setForm(f => ({ ...f, leadId: route.params.leadId }));
    if (route?.params?.openModal) { setEditing(null); setShowModal(true); }
  }, [route?.params]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    setExpanded(null);
    setLoading(true);
    fetchActivities(p);
  };

  // The server has no `outcome` param, so — exactly like web — this narrows the page
  // that came back, never the query. See the note in the count row below.
  const filtered = useMemo(
    () => (outcomeFilter === 'All' ? activities : activities.filter(a => a.outcome === outcomeFilter)),
    [activities, outcomeFilter],
  );

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const isVisit = ['Visit', 'FollowUp'].includes(form.type);
  const isDemo = form.type === 'Demo';

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  /** Pre-fill the shared form from a row. `leadId` is carried for display only. */
  const openEdit = (act: ActivityDto) => {
    setEditing(act);
    setForm({
      type: act.type,
      leadId: act.leadId as any,
      outcome: act.outcome,
      notes: act.notes || '',
      timeIn: isoToHhmm(act.timeIn),
      timeOut: isoToHhmm(act.timeOut),
      personMet: act.personMet || '',
      personDesignation: act.personDesignation || '',
      personPhone: act.personPhone || '',
      interestLevel: act.interestLevel || 'High',
      nextAction: act.nextAction || '',
      nextFollowUpDate: isoToDate(act.nextFollowUpDate),
      demoMode: act.demoMode || 'Online',
      conductedBy: act.conductedBy || '',
      attendees: act.attendees != null ? String(act.attendees) : '',
      feedback: act.feedback || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  /**
   * Only changed fields go up — the server treats every property as optional and
   * leaves untouched anything absent. Times are diffed on their HH:MM projection
   * (a fresh timeToIso stamp is anchored to *today*, so raw ISO would always differ)
   * and re-encoded through timeToIso, since TimeIn/TimeOut bind as C# `DateTime?`
   * and a bare "14:30" 400s the whole request.
   */
  const buildUpdate = (act: ActivityDto): UpdateActivityRequest => {
    const u: UpdateActivityRequest = {};

    if (form.type !== act.type) u.type = form.type as any;
    if (form.outcome !== act.outcome) u.outcome = form.outcome as any;
    if (form.notes !== (act.notes || '')) u.notes = form.notes;

    if (isVisit) {
      const tIn = form.timeIn.trim();
      const tOut = form.timeOut.trim();
      if (tIn && tIn !== isoToHhmm(act.timeIn)) u.timeIn = timeToIso(tIn);
      if (tOut && tOut !== isoToHhmm(act.timeOut)) u.timeOut = timeToIso(tOut);
      if (form.personMet !== (act.personMet || '')) u.personMet = form.personMet;
      if (form.personDesignation !== (act.personDesignation || '')) u.personDesignation = form.personDesignation;
      if (form.personPhone !== (act.personPhone || '')) u.personPhone = form.personPhone;
      if (form.interestLevel !== (act.interestLevel || '')) u.interestLevel = form.interestLevel;
      if (form.nextAction !== (act.nextAction || '')) u.nextAction = form.nextAction;
      if (form.nextFollowUpDate !== isoToDate(act.nextFollowUpDate)) {
        u.nextFollowUpDate = form.nextFollowUpDate || undefined;
      }
    }

    if (isDemo) {
      if (form.demoMode !== (act.demoMode || '')) u.demoMode = form.demoMode;
      if (form.conductedBy !== (act.conductedBy || '')) u.conductedBy = form.conductedBy;
      const att = form.attendees.trim();
      if (att !== (act.attendees != null ? String(act.attendees) : '')) {
        const n = parseInt(att, 10);
        u.attendees = isNaN(n) ? undefined : n;
      }
      if (form.feedback !== (act.feedback || '')) u.feedback = form.feedback;
    }

    return u;
  };

  const handleUpdate = async (act: ActivityDto) => {
    const payload = buildUpdate(act);
    if (Object.keys(payload).length === 0) { closeModal(); return; }
    setFormLoading(true);
    try {
      await activitiesApi.updateActivity(act.id, payload);
      closeModal();
      setLoading(true);
      fetchActivities(page);
      Alert.alert('Success', 'Activity updated successfully!');
    } catch (err: any) {
      // The server returns a real 404 when the activity isn't yours — surface its text.
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update activity');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await activitiesApi.deleteActivity(id);
      setExpanded(null);
      setLoading(true);
      fetchActivities(page);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete activity');
    }
  };

  const handleSubmit = async () => {
    if (editing) { handleUpdate(editing); return; }
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
        timeIn: isVisit ? timeToIso(form.timeIn) : undefined,
        timeOut: isVisit ? timeToIso(form.timeOut) : undefined,
        personMet: form.personMet || undefined,
        personDesignation: form.personDesignation || undefined,
        personPhone: form.personPhone || undefined,
        interestLevel: form.interestLevel || undefined,
        nextAction: form.nextAction || undefined,
        nextFollowUpDate: form.nextFollowUpDate || undefined,
        demoMode: isDemo ? form.demoMode : undefined,
        conductedBy: form.conductedBy || undefined,
        attendees: form.attendees ? parseInt(form.attendees, 10) : undefined,
        feedback: form.feedback || undefined,
      });
      closeModal();
      setLoading(true);
      fetchActivities(page);
      Alert.alert('Success', 'Activity logged successfully!');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to log activity');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * Visit proof photo — web's handlePhotoUpload, with the browser file input replaced by
   * the library picker (ProfileScreen's avatar flow: optimistic local preview, reverted on
   * failure so we never show a picture the server didn't take).
   *
   * Verified against SalesCRM.API/Controllers/ActivitiesController.cs:
   *   [HttpPost("upload-photo")]
   *   public async Task<IActionResult> UploadPhoto(IFormFile file, [FromForm] int activityId, …)
   *   return Ok(ApiResponse<object>.Ok(new { photoUrl = result.PublicUrl }, "Photo uploaded successfully."));
   * activitiesApi.uploadPhoto already posts multipart `file` + `activityId` to match.
   *
   * The row is refreshed in place rather than by refetching the page, so an expanded row
   * doesn't collapse and the current page/filters are untouched.
   */
  const handlePhotoUpload = async (activityId: number) => {
    // The server allows JPEG/PNG/WebP under 5MB — quality 0.8 keeps a camera shot well
    // inside RequestSizeLimit(5 * 1024 * 1024); a rejection still surfaces its message.
    const picked = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    const uri = picked.assets?.[0]?.uri;
    if (!uri) return;

    const previous = activities.find(a => a.id === activityId)?.photoUrl;
    const patch = (photoUrl?: string) =>
      setActivities(prev => prev.map(a => (a.id === activityId ? { ...a, photoUrl } : a)));

    patch(uri);
    setUploadingId(activityId);
    try {
      const up = await activitiesApi.uploadPhoto(activityId, uri);
      patch((up.data as any)?.photoUrl || uri);
    } catch (err: any) {
      patch(previous);
      Alert.alert('Upload failed', err?.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingId(null);
    }
  };

  // ── expanded detail (shared by table + cards) ──
  const detailCell = (label: string, value: string, color?: string) => (
    <View key={label} style={s.dCell}>
      <Text style={[s.dLabel, { color: T.dim }]}>{label}</Text>
      <Text style={[s.dValue, { color: color || T.text }]}>{value}</Text>
    </View>
  );

  const renderDetail = (act: ActivityDto) => {
    const visit = [
      act.personMet
        ? detailCell('Person Met', act.personMet + (act.personDesignation ? ` (${act.personDesignation})` : ''))
        : null,
      act.personPhone ? detailCell('Phone', act.personPhone) : null,
      act.interestLevel ? detailCell('Interest', act.interestLevel, interestColor(act.interestLevel, T)) : null,
      act.nextAction ? detailCell('Next Action', act.nextAction) : null,
      act.nextFollowUpDate ? detailCell('Follow-up', formatDate(act.nextFollowUpDate)) : null,
      act.timeIn
        ? detailCell('Time In/Out', formatTime(act.timeIn) + (act.timeOut ? ` ${DASH} ${formatTime(act.timeOut)}` : ''))
        : null,
    ].filter(Boolean);

    const demo = [
      act.demoMode ? detailCell('Mode', act.demoMode) : null,
      act.conductedBy ? detailCell('Conducted By', act.conductedBy) : null,
      act.attendees != null ? detailCell('Attendees', String(act.attendees)) : null,
      act.feedback ? detailCell('Feedback', act.feedback) : null,
    ].filter(Boolean);

    // Web renders the proof block for every row, but its body is null unless there's a
    // photo or the type can take one — so the divider only appears when there's content.
    const canUpload = PHOTO_TYPES.includes(act.type);
    const uploading = uploadingId === act.id;

    return (
      <View style={[s.detail, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
        <Text style={[s.dHead, { color: T.text }]}>Full Notes</Text>
        <Text style={[s.dNotes, { color: T.sub }]}>{act.notes || 'No notes recorded.'}</Text>
        {visit.length > 0 && <View style={[s.dGrid, { borderTopColor: T.line }]}>{visit}</View>}
        {demo.length > 0 && <View style={[s.dGrid, { borderTopColor: T.line }]}>{demo}</View>}

        {(act.photoUrl || canUpload) && (
          <View style={[s.photoBlock, { borderTopColor: T.line }]}>
            {act.photoUrl ? (
              <>
                <Text style={[s.dLabel, { color: T.dim }]}>Visit Proof Photo</Text>
                <View>
                  <Image
                    source={{ uri: photoSrc(act.photoUrl) }}
                    style={[s.photo, { borderColor: T.line, backgroundColor: T.card }]}
                    resizeMode="cover"
                  />
                  {uploading && (
                    <View style={[s.photoBusy, { backgroundColor: withAlpha(T.card, 0.6) }]}>
                      <ActivityIndicator color={T.accent} />
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={s.photoRow}>
                <Btn
                  label={uploading ? 'Uploading…' : 'Upload Visit Proof Photo'}
                  variant="soft"
                  small
                  loading={uploading}
                  onPress={() => handlePhotoUpload(act.id)}
                  icon={<Camera size={13} color={T.accent} strokeWidth={ICON_STROKE} />}
                />
                <Text style={[s.photoHint, { color: T.dim }]} numberOfLines={2}>
                  JPEG, PNG, or WebP (max 5MB)
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={[s.dStamp, { color: T.dim }]}>{formatDate(act.date)}</Text>
      </View>
    );
  };

  /**
   * Ungated, matching web: ActivityLog.jsx renders edit/delete for every role and the
   * server already scopes both to the caller's own activities.
   */
  const rowActions = (act: ActivityDto) => (
    <View style={s.actions}>
      <IconBtn kind="edit" label="Edit" onPress={() => openEdit(act)}>
        <Edit2 size={14} color={T.sub} strokeWidth={ICON_STROKE} />
      </IconBtn>
      <IconBtn kind="del" label="Delete" onPress={() => setDeleteTarget(act)}>
        <Trash2 size={14} color={T.danger} strokeWidth={ICON_STROKE} />
      </IconBtn>
    </View>
  );

  // ── table (tablet) ──
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cType]}>Type</Text>
        <Text style={[s.th, { color: T.dim }, s.cSchool]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cNotes]}>Notes</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cOutcome]}>Outcome</Text>
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
        <View style={s.cChevron} />
      </View>

      {filtered.map(act => {
        const open = expanded === act.id;
        return (
          <View key={act.id} style={{ borderTopColor: T.line, borderTopWidth: 1 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setExpanded(open ? null : act.id)}
              style={s.tr}
            >
              <View style={s.cType}>
                <StatusBadge label={typeLabel(act.type)} color={ACTIVITY_COLORS[act.type] || T.accent} />
              </View>
              <Text style={[s.tdName, { color: T.text }, s.cSchool]} numberOfLines={1}>
                {act.school || DASH}
              </Text>
              <Text style={[s.td, { color: T.sub }, s.cNotes]} numberOfLines={1}>{act.notes || DASH}</Text>
              <Text style={[s.td, { color: T.sub }, s.cDate]} numberOfLines={1}>{formatRelativeDate(act.date)}</Text>
              <Text style={[s.tdOutcome, { color: outcomeColor(act.outcome, T) }, s.cOutcome]} numberOfLines={1}>
                {act.outcome}
              </Text>
              <View style={s.cActions}>{rowActions(act)}</View>
              <View style={s.cChevron}>
                {open
                  ? <ChevronUp size={14} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <ChevronDown size={14} color={T.dim} strokeWidth={ICON_STROKE} />}
              </View>
            </TouchableOpacity>
            {open && <View style={s.detailWrap}>{renderDetail(act)}</View>}
          </View>
        );
      })}
    </View>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {filtered.map(act => {
        const open = expanded === act.id;
        return (
          <View key={act.id} style={{ gap: 8 }}>
            <ListCard onPress={() => setExpanded(open ? null : act.id)} style={s.rowCard}>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <View style={s.rowTop}>
                  <StatusBadge label={typeLabel(act.type)} color={ACTIVITY_COLORS[act.type] || T.accent} />
                  <StatusBadge label={act.outcome} color={outcomeColor(act.outcome, T)} />
                </View>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>
                  {act.school || DASH}
                </Text>
                {!!act.notes && (
                  <Text style={[s.td, { color: T.sub }]} numberOfLines={open ? undefined : 1}>{act.notes}</Text>
                )}
                <Text style={[s.tdSub, { color: T.dim }]}>{formatRelativeDate(act.date)}</Text>
              </View>
              <View style={s.rowRight}>
                {rowActions(act)}
                {open
                  ? <ChevronUp size={14} color={T.dim} strokeWidth={ICON_STROKE} />
                  : <ChevronDown size={14} color={T.dim} strokeWidth={ICON_STROKE} />}
              </View>
            </ListCard>
            {open && renderDetail(act)}
          </View>
        );
      })}
    </View>
  );

  const activeChips = [
    typeFilter !== 'All' ? { label: typeLabel(typeFilter), clear: () => setTypeFilter('All') } : null,
    outcomeFilter !== 'All' ? { label: outcomeFilter, clear: () => setOutcomeFilter('All') } : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchActivities(page); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Ungated, matching web: ActivityLog.jsx renders Log Activity for every role. */}
        <View style={s.header}>
          <Text style={[s.title, { color: T.text }]}>Activity Log</Text>
          <Btn
            label="Log Activity"
            small
            onPress={openCreate}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        {/* Filters */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.filterRow}>
            <Field label="Type" style={s.filterCol}>
              <Trigger
                label={typeFilter === 'All' ? 'All Types' : typeLabel(typeFilter)}
                open={openDd === 'type'}
                onPress={() => setOpenDd(openDd === 'type' ? null : 'type')}
              />
              {openDd === 'type' && (
                <Dropdown
                  style={s.dd}
                  value={typeFilter}
                  onSelect={v => { setTypeFilter(v); setOpenDd(null); }}
                  options={TYPE_OPTIONS.map(t => ({ label: t === 'All' ? 'All Types' : typeLabel(t), value: t }))}
                />
              )}
            </Field>

            <Field label="Outcome" style={s.filterCol}>
              <Trigger
                label={outcomeFilter === 'All' ? 'All Outcomes' : outcomeFilter}
                open={openDd === 'outcome'}
                onPress={() => setOpenDd(openDd === 'outcome' ? null : 'outcome')}
              />
              {openDd === 'outcome' && (
                <Dropdown
                  style={s.dd}
                  value={outcomeFilter}
                  onSelect={v => { setOutcomeFilter(v); setOpenDd(null); }}
                  options={OUTCOME_OPTIONS.map(o => ({ label: o === 'All' ? 'All Outcomes' : o, value: o }))}
                />
              )}
            </Field>
          </View>

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>
              {outcomeFilter === 'All'
                ? `${totalCount} activit${totalCount === 1 ? 'y' : 'ies'}`
                : `${filtered.length} ${outcomeFilter.toLowerCase()} on this page · ${totalCount} total`}
            </Text>
            {activeChips.length > 0 && (
              <View style={s.chipWrap}>
                {activeChips.map(c => <FilterChip key={c.label} label={c.label} onRemove={c.clear} />)}
              </View>
            )}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <ClipboardList size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No activities match your filters.</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Log your first activity with the button above.</Text>
          </View>
        ) : (
          <>
            {table ? renderTable() : renderRows()}
            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  Showing {from}{DASH}{to} of {totalCount}
                </Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FormModal
        visible={showModal}
        wide={wide}
        title={editing ? 'Edit Activity' : 'Log New Activity'}
        onClose={closeModal}
        footer={
          <>
            <View style={{ flex: 1 }} />
            <Btn label="Cancel" variant="secondary" onPress={closeModal} small />
            <Btn label={editing ? 'Save Changes' : 'Save'} onPress={handleSubmit} loading={formLoading} small />
          </>
        }
      >
        <ScrollView style={s.mScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.mForm}>
            <SelectPicker
              label="Activity Type"
              options={ACTIVITY_TYPES.map(t => ({ label: typeLabel(t), value: t }))}
              value={form.type}
              onChange={v => set('type', String(v))}
              accentColor={T.accent}
            />
            {/* The backend refuses to re-point an activity at a different lead
                (UpdateActivityRequest has no leadId), so editing shows the linked lead
                as a read-only tile instead of a picker — there is no control to change. */}
            {editing ? (
              <Field label="Linked Lead">
                <View style={[s.readOnly, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
                  <Text style={[s.readOnlyTxt, { color: T.text }]} numberOfLines={1}>
                    {editing.school || DASH}
                  </Text>
                </View>
                <Text style={[s.hint, { color: T.dim }]}>
                  The linked lead can't be changed after an activity is logged.
                </Text>
              </Field>
            ) : (
              <>
                <SelectPicker
                  label="Linked Lead *"
                  placeholder="Select a lead"
                  options={leads.map(l => ({ label: l.school + (l.city ? ` ${DASH} ${l.city}` : ''), value: l.id }))}
                  value={form.leadId || undefined}
                  onChange={v => set('leadId', v)}
                  accentColor={T.accent}
                />
                {leads.length === 0 && (
                  <Text style={[s.warn, { color: T.warning }]}>
                    No leads yet. Create a lead before logging an activity.
                  </Text>
                )}
              </>
            )}
            <SelectPicker
              label="Outcome"
              options={ACTIVITY_OUTCOMES.map(o => ({ label: o, value: o }))}
              value={form.outcome}
              onChange={v => set('outcome', String(v))}
              accentColor={T.accent}
            />

            {isVisit && (
              <>
                <View style={s.row2}>
                  <Input
                    label="Time In"
                    value={form.timeIn}
                    onChangeText={v => set('timeIn', v)}
                    placeholder="HH:MM"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Time Out"
                    value={form.timeOut}
                    onChangeText={v => set('timeOut', v)}
                    placeholder="HH:MM"
                    containerStyle={{ flex: 1 }}
                  />
                </View>
                <View style={s.row2}>
                  <Input
                    label="Person Met"
                    value={form.personMet}
                    onChangeText={v => set('personMet', v)}
                    placeholder="Name"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Designation"
                    value={form.personDesignation}
                    onChangeText={v => set('personDesignation', v)}
                    placeholder="e.g. Principal"
                    containerStyle={{ flex: 1 }}
                  />
                </View>
                <Input
                  label="Phone"
                  value={form.personPhone}
                  onChangeText={v => set('personPhone', v)}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
                <SelectPicker
                  label="Interest Level"
                  options={INTEREST_LEVELS.map(l => ({ label: l, value: l }))}
                  value={form.interestLevel}
                  onChange={v => set('interestLevel', String(v))}
                  accentColor={T.accent}
                />
                <Input
                  label="Next Action"
                  value={form.nextAction}
                  onChangeText={v => set('nextAction', v)}
                  placeholder="e.g. Schedule demo"
                />
                <Field label="Next Follow-up">
                  <DateInput
                    value={form.nextFollowUpDate}
                    onChange={v => set('nextFollowUpDate', v)}
                    accentColor={T.accent}
                  />
                </Field>
              </>
            )}

            {isDemo && (
              <>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <SelectPicker
                      label="Mode"
                      options={DEMO_MODES.map(m => ({ label: m, value: m }))}
                      value={form.demoMode}
                      onChange={v => set('demoMode', String(v))}
                      accentColor={T.accent}
                    />
                  </View>
                  <Input
                    label="Conducted By"
                    value={form.conductedBy}
                    onChangeText={v => set('conductedBy', v)}
                    placeholder="Name"
                    containerStyle={{ flex: 1 }}
                  />
                </View>
                <View style={s.row2}>
                  <Input
                    label="Attendees"
                    value={form.attendees}
                    onChangeText={v => set('attendees', v)}
                    placeholder="Count"
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Feedback"
                    value={form.feedback}
                    onChangeText={v => set('feedback', v)}
                    placeholder="Overall feedback"
                    containerStyle={{ flex: 1 }}
                  />
                </View>
              </>
            )}

            {/* The kit's Input is a fixed 46px row — Notes needs a real multiline box. */}
            <Field label="Notes">
              <TextInput
                value={form.notes}
                onChangeText={v => set('notes', v)}
                placeholder="What happened?"
                placeholderTextColor={T.dim}
                multiline
                numberOfLines={4}
                style={[s.notes, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
              />
            </Field>
          </View>
        </ScrollView>
      </FormModal>

      <ConfirmModal
        visible={!!deleteTarget}
        tone="danger"
        title="Delete Activity?"
        message={
          `This ${typeLabel(deleteTarget?.type || 'activity').toLowerCase()} on ` +
          `${deleteTarget?.school || 'This activity'} will be permanently removed.`
        }
        icon={<Trash2 size={24} color={T.danger} strokeWidth={ICON_STROKE} />}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3 },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  filterCol: { flex: 1 },
  dd: { width: '100%' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line · pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500' },
  tdOutcome: { fontSize: rf(13), fontWeight: '700' },
  cType: { flex: 1 },
  cSchool: { flex: 1.6 },
  cNotes: { flex: 1.8 },
  cDate: { flex: 1 },
  cOutcome: { flex: 1 },
  cActions: { width: 70, flexShrink: 0 }, // header <Text> ignores alignItems — keep both
                                          // left so the icons sit under the ACTIONS label
  cChevron: { width: 20, flexShrink: 0, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: 6, flexShrink: 0 },

  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },

  // expanded detail
  detailWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  detail: { borderRadius: 13, borderWidth: 1, padding: 14, gap: 6 },
  dHead: { fontSize: rf(12.5), fontWeight: '700' },
  dNotes: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 19 },
  dGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 1, paddingTop: 9, marginTop: 3 },
  dCell: { minWidth: 120, gap: 2 },
  dLabel: { fontSize: rf(10.5), fontWeight: '600' },
  dValue: { fontSize: rf(12), fontWeight: '600' },
  dStamp: { fontSize: rf(11), fontWeight: '500', marginTop: 4 },

  // visit proof photo — web's w-40 h-28 rounded-xl thumbnail
  photoBlock: { borderTopWidth: 1, paddingTop: 9, marginTop: 3, gap: 6, alignItems: 'flex-start' },
  photo: { width: 160, height: 112, borderRadius: 13, borderWidth: 1 },
  photoBusy: { ...StyleSheet.absoluteFillObject, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  // The button is fixed-size (flexShrink 0, RN's default); only the hint may shrink —
  // otherwise its intrinsic width would paint over the button.
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  photoHint: { fontSize: rf(10.5), fontWeight: '500', flexShrink: 1, minWidth: 0 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modal
  mScroll: { maxHeight: 420 },
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  warn: { fontSize: rf(11), fontWeight: '600', marginTop: -6 },
  readOnly: { minHeight: 46, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: 'center' },
  readOnlyTxt: { fontSize: rf(14), fontWeight: '600', flexShrink: 1, minWidth: 0 },
  hint: { fontSize: rf(11), fontWeight: '500', marginTop: 5 },
  notes: {
    minHeight: 92, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: rf(14), fontWeight: '500', textAlignVertical: 'top',
  },
});
