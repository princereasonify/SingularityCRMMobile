import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
  TextInput, Image, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin, ShieldAlert, Camera, Check, X, ExternalLink, Filter, AlertTriangle,
} from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Segmented, Trigger, Dropdown, Pagination, ListCard, Avatar,
  StatusBadge, Btn, FormModal, ConfirmModal,
} from '../../components/crud';
import { StatTile } from '../../components/ui';
import { b2cGeoService } from '../../api/b2c/b2cGeoService';
import { b2cActivityService } from '../../api/b2c/b2cActivityService';
import { useFieldStaff, buildPersonFilterOptions, resolvePersonSelection } from '../../components/b2c/useFieldStaff';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CGeoCompliance.jsx pages 20 at a time. Admin-only route. */
const PAGE_SIZE = 20;
const DASH = '—';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : DASH;

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const sevColor = (sev: string, T: any) =>
  sev === 'Violation' ? T.danger : sev === 'Warning' ? T.warning : T.success;

const geoColor = (g: string, T: any) =>
  g === 'Pass' ? T.success : g === 'Warning' ? T.warning : T.danger;

type Tab = 'violations' | 'selfies';

export const B2CGeoComplianceScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('violations');

  // Violations
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [reviewed, setReviewed] = useState(''); // '', 'true', 'false'
  const [agentVal, setAgentVal] = useState(''); // '' | 'a:<id>' — '' = all
  const [openAgent, setOpenAgent] = useState(false);
  const [search, setSearch] = useState('');

  // Agents for the filter — geo-compliance is an agent-only concept (route/pincode
  // compliance), so counselors are excluded here (web parity: includeCounselors={false}).
  // This screen is B2CAdmin-only at the route level, so no `enabled` guard needed.
  const { agents } = useFieldStaff();
  const person = useMemo(() => resolvePersonSelection(agentVal, agents, []), [agentVal, agents]);

  // Selfies
  const [selfies, setSelfies] = useState<any[]>([]);
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [selfieLoadError, setSelfieLoadError] = useState(false);
  const [selfieSearch, setSelfieSearch] = useState('');

  // Modals
  const [review, setReview] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejectSelfie, setRejectSelfie] = useState<any>(null);
  const [rejecting, setRejecting] = useState(false);
  // Which selfie's Approve button is mid-request — guards against a fast double-tap
  // firing two concurrent approve calls for the same activity.
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadViolations = useCallback(async (pg = page) => {
    try {
      const res = await b2cGeoService.getViolations({
        page: pg, pageSize: PAGE_SIZE,
        severity: severity || undefined,
        reviewed: reviewed === '' ? undefined : reviewed === 'true',
        agentId: person?.kind === 'agent' ? person.agentId : undefined,
      });
      setRows(res.data?.items ?? []);
      setTotal(res.data?.totalCount ?? 0);
      setSummary(res.data?.summary ?? {});
      setLoadError(false);
    } catch {
      setRows([]); setTotal(0);
      setLoadError(true);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [page, severity, reviewed, person]);

  const loadSelfies = useCallback(async () => {
    setSelfieLoading(true);
    try {
      const res = await b2cGeoService.getPendingSelfies();
      setSelfies(res.data ?? []);
      setSelfieLoadError(false);
    } catch {
      setSelfies([]);
      setSelfieLoadError(true);
    } finally {
      setSelfieLoading(false);
    }
  }, []);

  // Re-fetch violations whenever a filter changes (reset to page 1).
  useEffect(() => { setLoading(true); setPage(1); loadViolations(1); }, [severity, reviewed, person]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'selfies') loadSelfies(); }, [tab, loadSelfies]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); loadViolations(p);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'violations') await loadViolations(page);
    else { await loadSelfies(); setRefreshing(false); }
  };

  const submitReview = async () => {
    if (!review) return;
    setBusy(true); setError('');
    try {
      await b2cGeoService.review(review.id, note.trim() || undefined);
      setReview(null); setNote('');
      toast.success('Violation reviewed');
      loadViolations(page);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Review failed');
      toast.error(err?.response?.data?.message || 'Review failed');
    } finally { setBusy(false); }
  };

  const decideSelfie = async (activityId: number, approved: boolean) => {
    if (decidingId === activityId) return;
    setDecidingId(activityId);
    try {
      await b2cActivityService.approveSelfie(activityId, approved);
      toast.success(approved ? 'Selfie approved' : 'Selfie rejected');
      loadSelfies();
      loadViolations(page); // refresh pending-selfie count in summary
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not update selfie');
    } finally {
      setDecidingId(null);
    }
  };

  const confirmRejectSelfie = async () => {
    if (!rejectSelfie) return;
    setRejecting(true);
    await decideSelfie(rejectSelfie.activityId, false);
    setRejecting(false);
    setRejectSelfie(null);
  };

  const agentLabel = person?.name || 'All agents';
  const agentOptions = useMemo(
    () => buildPersonFilterOptions(agents, [], { includeCounselors: false, allLabel: 'All agents' }),
    [agents],
  );

  const q = search.trim().toLowerCase();
  const visibleRows = q
    ? rows.filter(v =>
        (v.studentName || '').toLowerCase().includes(q) ||
        (v.agentName || '').toLowerCase().includes(q))
    : rows;

  const sq = selfieSearch.trim().toLowerCase();
  const visibleSelfies = sq
    ? selfies.filter(sfe =>
        (sfe.studentName || '').toLowerCase().includes(sq) ||
        (sfe.performedByName || '').toLowerCase().includes(sq))
    : selfies;

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Verify that field visits happened where they should</Text>

        {/* Summary */}
        <View style={s.tiles}>
          <StatTile style={s.tile} label="Warnings" value={summary.warnings ?? 0} icon={<MapPin size={16} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={s.tile} label="Violations" value={summary.violations ?? 0} icon={<ShieldAlert size={16} color={T.danger} strokeWidth={ICON_STROKE} />} tint={T.danger} />
          <StatTile style={s.tile} label="Unreviewed" value={summary.unreviewed ?? 0} />
          <StatTile style={s.tile} label="Pending selfies" value={summary.pendingSelfies ?? 0} icon={<Camera size={16} color={T.accent} strokeWidth={ICON_STROKE} />} />
        </View>

        {/* Tabs */}
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[{ label: 'Violations', value: 'violations' }, { label: 'Pending Selfies', value: 'selfies' }]}
        />

        {tab === 'violations' ? (
          <>
            {/* Filters */}
            <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search student or agent…" />

              <Trigger
                label={agentLabel}
                open={openAgent}
                onPress={() => setOpenAgent(v => !v)}
                icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              />
              {openAgent && (
                <Dropdown style={{ width: '100%' }} maxHeight={280} value={agentVal}
                  onSelect={v => { setAgentVal(v); setOpenAgent(false); }}
                  options={agentOptions}
                />
              )}

              <View>
                <Text style={[s.fLabel, { color: T.text }]}>Severity</Text>
                <Segmented
                  value={severity}
                  onChange={setSeverity}
                  options={[{ label: 'All', value: '' }, { label: 'Warning', value: 'Warning' }, { label: 'Violation', value: 'Violation' }]}
                />
              </View>
              <View>
                <Text style={[s.fLabel, { color: T.text }]}>Review status</Text>
                <Segmented
                  value={reviewed}
                  onChange={setReviewed}
                  options={[{ label: 'All', value: '' }, { label: 'Unreviewed', value: 'false' }, { label: 'Reviewed', value: 'true' }]}
                />
              </View>
            </View>

            {loading ? (
              <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
            ) : loadError ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.emptyTitle, { color: T.danger }]}>Couldn't load violations</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>Pull down to retry.</Text>
              </View>
            ) : visibleRows.length === 0 ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.emptyTitle, { color: T.text }]}>No geo violations 🎉</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>Nothing matches these filters.</Text>
              </View>
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  {visibleRows.map(v => (
                    <ListCard key={v.id} style={s.rowCard}>
                      <Avatar initials={initialsOf(v.studentName)} color={sevColor(v.severity, T)} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.rowTop}>
                          <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{v.studentName}</Text>
                          <StatusBadge label={v.severity} color={sevColor(v.severity, T)} />
                        </View>
                        <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                          {v.studentCity || DASH} · {v.agentName || DASH}
                        </Text>
                        <View style={s.metaRow}>
                          <Text style={[s.metaStrong, { color: T.text }]}>{v.distanceKm != null ? Number(v.distanceKm).toFixed(1) : DASH} km</Text>
                          <Text style={[s.sub, { color: T.dim }]}>{fmtDate(v.createdAt)}</Text>
                          {v.reviewed
                            ? <Text style={[s.sub, { color: T.success }]} numberOfLines={1}>Reviewed{v.reviewedByName ? ` · ${v.reviewedByName}` : ''}</Text>
                            : <Text style={[s.sub, { color: T.warning }]}>Pending</Text>}
                        </View>
                        <View style={s.actions}>
                          {v.submittedLatitude != null && v.submittedLongitude != null && (
                            <Btn label="Map" variant="secondary" small
                              icon={<MapPin size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                              onPress={() => Linking.openURL(mapsUrl(v.submittedLatitude, v.submittedLongitude))} />
                          )}
                          <Btn label="Lead" variant="secondary" small
                            icon={<ExternalLink size={13} color={T.text} strokeWidth={ICON_STROKE} />}
                            onPress={() => navigation.navigate('B2CLeadDetail', { leadId: v.leadId })} />
                          {!v.reviewed && (
                            <Btn label="Review" small
                              onPress={() => { setReview(v); setNote(''); setError(''); }} />
                          )}
                        </View>
                      </View>
                    </ListCard>
                  ))}
                </View>

                {totalPages > 1 && (
                  <View style={s.pgRow}>
                    <Text style={[s.count, { color: T.dim }]}>Showing {from}{DASH}{to} of {total}</Text>
                    <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <SearchBar value={selfieSearch} onChangeText={setSelfieSearch} placeholder="Search student or agent…" />

            {selfieLoading ? (
              <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
            ) : selfieLoadError ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.emptyTitle, { color: T.danger }]}>Couldn't load selfies</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>Pull down to retry.</Text>
              </View>
            ) : visibleSelfies.length === 0 ? (
              <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
                <Text style={[s.emptyTitle, { color: T.text }]}>No selfies awaiting verification</Text>
                <Text style={[s.emptyTxt, { color: T.dim }]}>Approved and rejected selfies won't appear here.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {visibleSelfies.map(sfe => (
                  <ListCard key={sfe.activityId} style={s.rowCard}>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => sfe.selfieUrl && Linking.openURL(sfe.selfieUrl)}>
                      <Image source={{ uri: sfe.selfieUrl }} style={[s.thumb, { backgroundColor: T.cardAlt, borderColor: T.line }]} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, gap: 4 }}>
                      <TouchableOpacity onPress={() => navigation.navigate('B2CLeadDetail', { leadId: sfe.leadId })}>
                        <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{sfe.studentName || 'Visit'}</Text>
                      </TouchableOpacity>
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                        by {sfe.performedByName || DASH} · {fmtDate(sfe.createdAt)}
                      </Text>
                      {!!sfe.geoStatus && (
                        <Text style={[s.sub, { color: geoColor(sfe.geoStatus, T), fontWeight: '600' }]}>Geo: {sfe.geoStatus}</Text>
                      )}
                      <View style={s.actions}>
                        <Btn label="Approve" variant="success" small style={{ flex: 1 }}
                          icon={<Check size={14} color="#FFF" strokeWidth={2.4} />}
                          loading={decidingId === sfe.activityId}
                          disabled={decidingId != null}
                          onPress={() => decideSelfie(sfe.activityId, true)} />
                        <Btn label="Reject" variant="danger" small style={{ flex: 1 }}
                          icon={<X size={14} color="#FFF" strokeWidth={2.4} />}
                          disabled={decidingId != null}
                          onPress={() => setRejectSelfie(sfe)} />
                      </View>
                    </View>
                  </ListCard>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Review modal */}
      <FormModal
        visible={!!review}
        title="Review violation"
        onClose={() => { setReview(null); setError(''); }}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => { setReview(null); setError(''); }} disabled={busy} style={{ flex: 1 }} />
            <Btn label={busy ? 'Saving…' : 'Mark reviewed'} onPress={submitReview} loading={busy} disabled={busy} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          {!!error && <Text style={[s.errorTxt, { color: T.danger }]}>{error}</Text>}
          {review && (
            <Text style={[s.sub, { color: T.sub }]}>
              {review.studentName} · {review.agentName} · {review.distanceKm != null ? Number(review.distanceKm).toFixed(1) : DASH} km away
            </Text>
          )}
          <View>
            <Text style={[s.fLabel, { color: T.text }]}>Review note (optional)</Text>
            <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add context or a decision…"
                placeholderTextColor={T.dim}
                multiline
                style={[s.textareaTxt, { color: T.text }]}
              />
            </View>
          </View>
        </View>
      </FormModal>

      <ConfirmModal
        visible={!!rejectSelfie}
        title="Reject this selfie?"
        message={rejectSelfie ? `${rejectSelfie.studentName || 'This visit'}'s selfie will be marked rejected.` : ''}
        icon={<AlertTriangle size={24} color={T.danger} />}
        tone="danger"
        confirmLabel={rejecting ? 'Rejecting…' : 'Reject'}
        onConfirm={confirmRejectSelfie}
        onCancel={() => setRejectSelfie(null)}
        loading={rejecting}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 140 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  fLabel: { fontSize: rf(12.5), fontWeight: '600', marginBottom: 7 },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaStrong: { fontSize: rf(12.5), fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  thumb: { width: 64, height: 64, borderRadius: 12, borderWidth: 1 },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
  errorTxt: { fontSize: rf(12.5), fontWeight: '600' },
  textarea: { minHeight: 80, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 60 },
});

export default B2CGeoComplianceScreen;
