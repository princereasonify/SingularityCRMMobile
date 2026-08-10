import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Image, Alert, PermissionsAndroid,
  Platform, Linking, TextInput, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { launchCamera, Asset } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import { Plus, Camera, MapPin, ShieldCheck, ExternalLink } from 'lucide-react-native';
import { Screen } from '../../components/ui';
import {
  Btn, Field, Input, SearchBar, Segmented, Trigger, Dropdown, StatusBadge,
  Pagination, ListCard, FormModal,
} from '../../components/crud';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { FEEDBACK_TYPES } from '../../api/b2c/b2cObjectionService';
import {
  B2CActivityListDto, B2CLeadListDto, B2CActivityTypeName, CreateB2CActivityRequest,
} from '../../types/b2c';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme';
import { rf } from '../../utils/responsive';
import { useToast } from '../../context/ToastContext';

/**
 * B2CActivityLogScreen — mobile port of Sales_CRM_Web/src/pages/b2c/B2CActivityLog.jsx.
 * Log an activity against a student (type, mandatory notes, feedback; a required selfie +
 * GPS for Visit/Session) and browse the recent activity log.
 *
 * Structure mirrors AgentDashboard (the role reference): a single <Screen scroll> — the
 * Agent/Counselor drawer already renders the "Activity Log" AppTopbar, so no in-screen
 * header. The mobile b2cActivityService exposes only the per-lead list (getActivities),
 * so — faithfully adapting the web's cross-student /mine feed to the available API — the
 * log is scoped to a chosen student. Selfie / GPS / permission handling mirrors
 * B2CAgentVisitScreen.
 */

const PAGE_SIZE = 20;
const LOG_TYPES: B2CActivityTypeName[] = ['Call', 'Visit', 'WhatsApp', 'Email', 'Session', 'Note'];
const PROOF_TYPES: B2CActivityTypeName[] = ['Visit', 'Session'];
// Web parity: the list filter offers every activity type.
const FILTER_TYPES = ['Call', 'Visit', 'WhatsApp', 'Email', 'Session', 'Note', 'VisitClose', 'DocumentUpload'];

type Coords = { lat: number; lng: number; accuracy?: number };
type Selfie = { uri: string; name: string; type: string };
// The per-lead DTO also carries feedback server-side (see backend B2CActivityListDto).
type ActivityRow = B2CActivityListDto & { feedback?: string | null };

const feedbackMeta = (v?: string | null) => FEEDBACK_TYPES.find(f => f.value === v);
const feedbackLabel = (v?: string | null) => feedbackMeta(v)?.label || v || '';
const toneColor = (tone: string | undefined, T: AppTheme) =>
  tone === 'positive' ? T.success : tone === 'warn' ? T.warning : tone === 'negative' ? T.danger : T.sub;
const geoColor = (s: string | undefined | null, T: AppTheme) =>
  s === 'Pass' ? T.success : s === 'Warning' ? T.warning : s === 'Violation' ? T.danger : T.sub;

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const emptyForm = {
  leadId: '' as string,
  type: 'Call' as B2CActivityTypeName,
  feedback: '' as string,
  notes: '' as string,
  nextFollowUpDate: '' as string,
};

export const B2CActivityLogScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  // ─── Leads (shared: view scope + log picker) ───────────────────────────────
  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const leadName = useCallback((id: string) => leads.find(l => String(l.id) === id)?.studentName, [leads]);

  // ─── List (scoped to a viewed student) ─────────────────────────────────────
  const [viewLeadId, setViewLeadId] = useState<string>('');
  const [viewOpen, setViewOpen] = useState(false);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Client-side filters (getActivities has no type/search query, so filter the loaded page).
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);

  // ─── Log modal ─────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selfie, setSelfie] = useState<Selfie | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const needsProof = PROOF_TYPES.includes(form.type);

  // ─── Load the assigned leads once ──────────────────────────────────────────
  const loadLeads = useCallback(() => {
    b2cLeadService.getLeads({ page: 1, pageSize: 200 })
      .then(res => setLeads(res.data?.items ?? []))
      .catch(() => setLeads([]));
  }, []);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ─── Load the viewed student's activity log ────────────────────────────────
  const fetchActivities = useCallback(async (pg = 1) => {
    if (!viewLeadId) { setRows([]); setTotalPages(1); setTotalCount(0); setLoading(false); setRefreshing(false); return; }
    try {
      const res = await b2cActivityService.getActivities(Number(viewLeadId), { page: pg, pageSize: PAGE_SIZE });
      setRows((res.data?.items ?? []) as ActivityRow[]);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      setRows([]); setTotalPages(1); setTotalCount(0);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [viewLeadId]);

  useEffect(() => {
    if (!viewLeadId) return;
    setLoading(true); setPage(1); fetchActivities(1);
  }, [viewLeadId, fetchActivities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeads();
    if (viewLeadId) fetchActivities(page); else setRefreshing(false);
  }, [loadLeads, fetchActivities, viewLeadId, page]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchActivities(p);
  };

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(a => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (!q) return true;
      return `${a.type} ${a.notes ?? ''} ${feedbackLabel(a.feedback)} ${a.performedByName ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, typeFilter]);

  // ─── Android permissions (mirrors B2CAgentVisitScreen) ─────────────────────
  const askAndroid = async (permission: any, title: string, message: string) => {
    if (Platform.OS !== 'android') return true;
    try {
      if (await PermissionsAndroid.check(permission)) return true;
      const result = await PermissionsAndroid.request(permission, {
        title, message, buttonPositive: 'Allow', buttonNegative: 'Deny',
      });
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(title, 'Access is blocked. Please enable it in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', message);
        return false;
      }
      return true;
    } catch {
      Alert.alert('Error', 'Could not request permission.');
      return false;
    }
  };

  const captureLocation = useCallback(async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'Location Permission Required',
      'The app needs your location to geo-verify this visit.',
    );
    if (!ok) return;
    setLocating(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        Alert.alert('Location error', err?.message || 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  const takeSelfie = useCallback(async () => {
    const ok = await askAndroid(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Camera Permission Required',
      'The app needs camera access to capture your visit selfie.',
    );
    if (!ok) return;
    launchCamera(
      { mediaType: 'photo', quality: 0.7, cameraType: 'front', saveToPhotos: false, includeBase64: false },
      (res) => {
        if (res.didCancel) return;
        if (res.errorCode) { Alert.alert('Camera', res.errorMessage ?? 'Could not open the camera.'); return; }
        const asset: Asset | undefined = res.assets?.[0];
        if (!asset?.uri) return;
        setSelfie({
          uri: asset.uri,
          name: asset.fileName || `activity-selfie-${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      },
    );
  }, []);

  // ─── Log modal open / submit ───────────────────────────────────────────────
  const openModal = () => {
    setForm({ ...emptyForm, leadId: viewLeadId || '' });
    setSelfie(null); setCoords(null); setError('');
    setLeadPickerOpen(false); setFeedbackOpen(false);
    setOpen(true);
  };

  const setType = (t: B2CActivityTypeName) => setForm(f => ({ ...f, type: t }));

  const submit = async () => {
    if (!form.leadId) { setError('Select a student.'); return; }
    if (!form.notes.trim()) { setError('Notes are required.'); return; }
    if (needsProof && !selfie) { setError('A selfie is required as proof for a visit.'); return; }
    if (needsProof && !coords) { setError('Capture your GPS location for this visit.'); return; }

    // Follow-up date is optional; send a UTC-kind ISO string when present (timestamptz).
    let nextFollowUpDate: string | undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(form.nextFollowUpDate.trim())) {
      nextFollowUpDate = new Date(`${form.nextFollowUpDate.trim()}T00:00:00.000Z`).toISOString();
    }

    setSaving(true); setError('');
    try {
      const payload = {
        leadId: Number(form.leadId),
        type: form.type,
        feedback: form.feedback || undefined,
        notes: form.notes.trim(),
        nextFollowUpDate,
        latitude: coords?.lat,
        longitude: coords?.lng,
        authMethod: needsProof ? 'Selfie' : undefined,
        completedAt: needsProof ? new Date().toISOString() : undefined,
      } as CreateB2CActivityRequest & { feedback?: string };

      const res = await b2cActivityService.createActivity(payload);
      const created = res.data;
      if (needsProof && selfie && created?.id) {
        await b2cActivityService.uploadSelfie(created.id, selfie);
      }
      setOpen(false);
      toast.success('Activity logged');
      // Show the student we just logged against so the result is visible.
      if (form.leadId !== viewLeadId) { setViewLeadId(form.leadId); }
      else { setLoading(true); fetchActivities(1); }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not log the activity. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const leadOptions = useMemo(
    () => leads.map(l => ({ label: l.city ? `${l.studentName} · ${l.city}` : l.studentName, value: String(l.id) })),
    [leads],
  );

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      {/* Intro + primary action (mirrors the web header row) */}
      <View style={[s.top, isWide && s.topWide]}>
        <Text style={[s.subtitle, { color: T.sub }, isWide && { flex: 1 }]}>
          Log calls, visits & demos across your students
        </Text>
        <Btn
          label="Log Activity"
          onPress={openModal}
          icon={<Plus size={16} color="#FFF" strokeWidth={2.4} />}
          style={isWide ? undefined : { alignSelf: 'stretch' }}
        />
      </View>

      {/* Student to view */}
      <View style={{ zIndex: 30, marginTop: 16 }}>
        <Field label="Student">
          <Trigger
            label={leadName(viewLeadId) || 'Select a student to view their log…'}
            open={viewOpen}
            onPress={() => setViewOpen(o => !o)}
          />
          {viewOpen && (
            <Dropdown
              style={{ width: '100%' }}
              maxHeight={280}
              value={viewLeadId || undefined}
              options={leadOptions}
              onSelect={(v) => { setViewLeadId(v); setViewOpen(false); setTypeFilter(''); setSearch(''); }}
            />
          )}
        </Field>
      </View>

      {!viewLeadId ? (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <Text style={[s.emptyTitle, { color: T.text }]}>Pick a student</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Choose a student above to see their activity log, or tap “Log Activity” to record a new one.</Text>
        </View>
      ) : (
        <>
          {/* Filters */}
          <View style={{ marginTop: 12 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search notes, type, feedback…" />
          </View>
          <View style={{ zIndex: 20, marginTop: 12 }}>
            <Trigger
              label={typeFilter ? typeFilter.replace(/([A-Z])/g, ' $1').trim() : 'All activities'}
              open={typeFilterOpen}
              onPress={() => setTypeFilterOpen(o => !o)}
            />
            {typeFilterOpen && (
              <Dropdown
                style={{ width: '100%' }}
                maxHeight={280}
                value={typeFilter || 'ALL'}
                options={[{ label: 'All activities', value: 'ALL' },
                  ...FILTER_TYPES.map(t => ({ label: t.replace(/([A-Z])/g, ' $1').trim(), value: t }))]}
                onSelect={(v) => { setTypeFilter(v === 'ALL' ? '' : v); setTypeFilterOpen(false); }}
              />
            )}
          </View>

          <Text style={[s.count, { color: T.dim }]}>
            {totalCount} activit{totalCount === 1 ? 'y' : 'ies'}
          </Text>

          {loading ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
          ) : visibleRows.length === 0 ? (
            <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
              <Text style={[s.emptyTitle, { color: T.text }]}>No activities yet</Text>
              <Text style={[s.emptyTxt, { color: T.dim }]}>Log the first one with the “Log Activity” button.</Text>
            </View>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                {visibleRows.map(a => (
                  <ListCard
                    key={a.id}
                    style={s.row}
                    onPress={() => navigation?.navigate('B2CLeadDetail', { leadId: Number(viewLeadId) })}
                  >
                    <View style={[s.dot, { backgroundColor: T.accent }]} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.type, { color: T.accent }]}>{a.type}</Text>
                        <Text style={[s.time, { color: T.dim }]}>{fmtDateTime(a.createdAt)}</Text>
                      </View>
                      {!!a.feedback && (
                        <StatusBadge label={feedbackLabel(a.feedback)} color={toneColor(feedbackMeta(a.feedback)?.tone, T)} />
                      )}
                      {!!a.notes && <Text style={[s.notes, { color: T.sub }]}>{a.notes}</Text>}
                      <View style={s.metaRow}>
                        {!!a.performedByName && <Text style={[s.meta, { color: T.dim }]}>by {a.performedByName}</Text>}
                        {!!a.photoUrl && (
                          <TouchableOpacity style={s.metaItem} onPress={() => a.photoUrl && Linking.openURL(a.photoUrl)}>
                            <Camera size={12} color={T.accent} strokeWidth={2.2} />
                            <Text style={[s.meta, { color: T.accent }]}>Selfie {a.authVerified ? '✓' : '(pending)'}</Text>
                            <ExternalLink size={10} color={T.accent} />
                          </TouchableOpacity>
                        )}
                        {!!a.geoStatus && (
                          <View style={s.metaItem}>
                            <MapPin size={12} color={geoColor(a.geoStatus, T)} strokeWidth={2.2} />
                            <Text style={[s.meta, { color: geoColor(a.geoStatus, T) }]}>{a.geoStatus}</Text>
                          </View>
                        )}
                        {!!a.nextFollowUpDate && (
                          <Text style={[s.meta, { color: T.warning }]}>
                            Follow-up: {new Date(a.nextFollowUpDate).toLocaleDateString('en-IN')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </ListCard>
                ))}
              </View>
              {totalPages > 1 && (
                <View style={s.pgRow}><Pagination page={page} pageCount={totalPages} onChange={goToPage} /></View>
              )}
            </>
          )}
        </>
      )}

      {/* Log Activity modal */}
      <FormModal
        visible={open}
        title="Log Activity"
        wide={isWide}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setOpen(false)} disabled={saving} style={{ flex: 1 }} />
            <Btn label={saving ? 'Saving…' : 'Save'} onPress={submit} loading={saving} disabled={saving} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 14 }}>
          {!!error && (
            <View style={[s.alert, { backgroundColor: T.danger + '1A', borderColor: T.danger }]}>
              <Text style={[s.alertTxt, { color: T.danger }]}>{error}</Text>
            </View>
          )}

          {/* Student */}
          <View style={{ zIndex: 40 }}>
            <Field label="Student *">
              <Trigger
                label={leadName(form.leadId) || 'Select a student'}
                open={leadPickerOpen}
                onPress={() => { setLeadPickerOpen(o => !o); setFeedbackOpen(false); }}
              />
              {leadPickerOpen && (
                <Dropdown
                  style={{ width: '100%' }}
                  maxHeight={220}
                  value={form.leadId || undefined}
                  options={leadOptions}
                  onSelect={(v) => { setForm(f => ({ ...f, leadId: v })); setLeadPickerOpen(false); }}
                />
              )}
            </Field>
          </View>

          {/* Type */}
          <Field label="Activity Type">
            <Segmented
              value={form.type}
              onChange={setType}
              options={LOG_TYPES.slice(0, 3).map(t => ({ label: t, value: t }))}
            />
            <Segmented
              style={{ marginTop: 8 }}
              value={form.type}
              onChange={setType}
              options={LOG_TYPES.slice(3).map(t => ({ label: t, value: t }))}
            />
          </Field>

          {/* Feedback */}
          <View style={{ zIndex: 30 }}>
            <Field label="Feedback">
              <Trigger
                label={form.feedback ? feedbackLabel(form.feedback) : 'Pick what the student/parent said'}
                open={feedbackOpen}
                onPress={() => { setFeedbackOpen(o => !o); setLeadPickerOpen(false); }}
              />
              {feedbackOpen && (
                <Dropdown
                  style={{ width: '100%' }}
                  maxHeight={240}
                  value={form.feedback || undefined}
                  options={FEEDBACK_TYPES.map(f => ({ label: f.label, value: f.value }))}
                  onSelect={(v) => { setForm(f => ({ ...f, feedback: v })); setFeedbackOpen(false); }}
                />
              )}
            </Field>
          </View>

          {/* Notes */}
          <View style={{ zIndex: 1 }}>
            <Field label="Notes *">
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput
                  value={form.notes}
                  onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder="What happened?"
                  placeholderTextColor={T.dim}
                  multiline
                  style={[s.textareaTxt, { color: T.text }]}
                />
              </View>
            </Field>
          </View>

          {/* Follow-up */}
          <Input
            label="Schedule follow-up (optional)"
            value={form.nextFollowUpDate}
            onChangeText={v => setForm(f => ({ ...f, nextFollowUpDate: v }))}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          {/* Visit / Session proof */}
          {needsProof && (
            <View style={[s.proof, { backgroundColor: T.fieldBg, borderColor: T.line }]}>
              <View style={s.proofHead}>
                <ShieldCheck size={14} color={T.accent} strokeWidth={2.2} />
                <Text style={[s.proofTitle, { color: T.text }]}>Visit proof (required)</Text>
              </View>

              <View style={s.selfieRow}>
                {selfie ? (
                  <Image source={{ uri: selfie.uri }} style={[s.thumb, { borderColor: T.line }]} />
                ) : (
                  <View style={[s.thumb, s.thumbEmpty, { borderColor: T.line, backgroundColor: T.card }]}>
                    <Camera size={20} color={T.dim} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Btn
                    label={selfie ? 'Retake selfie' : 'Take selfie'}
                    variant={selfie ? 'secondary' : 'soft'}
                    small
                    onPress={takeSelfie}
                    icon={<Camera size={13} color={selfie ? T.text : T.accent} strokeWidth={2.2} />}
                  />
                </View>
              </View>

              <Btn
                label={coords ? 'Location captured ✓' : 'Capture GPS location'}
                variant={coords ? 'secondary' : 'soft'}
                small
                onPress={captureLocation}
                loading={locating}
                icon={<MapPin size={13} color={coords ? T.text : T.accent} strokeWidth={2.2} />}
              />
              {!!coords && (
                <Text style={[s.coords, { color: T.dim }]}>
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  {coords.accuracy ? `  (±${Math.round(coords.accuracy)}m)` : ''}
                </Text>
              )}
            </View>
          )}
        </View>
      </FormModal>
    </Screen>
  );
};

const s = StyleSheet.create({
  top: { gap: 12 },
  topWide: { flexDirection: 'row', alignItems: 'center' },
  subtitle: { fontSize: rf(13), fontWeight: '500', lineHeight: 18 },

  count: { fontSize: rf(11.5), fontWeight: '600', marginTop: 12 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center', gap: 8, marginTop: 12 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: 18 },

  row: { alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  type: { fontSize: rf(11.5), fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  time: { fontSize: rf(11), fontWeight: '500' },
  notes: { fontSize: rf(12.5), fontWeight: '500', lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: rf(11), fontWeight: '600' },

  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },

  alert: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  alertTxt: { fontSize: rf(12.5), fontWeight: '600' },

  textarea: { minHeight: 84, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 60 },

  proof: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  proofHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proofTitle: { fontSize: rf(12.5), fontWeight: '700' },
  selfieRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 12, borderWidth: 1 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  coords: { fontSize: rf(11), fontWeight: '500' },
});
