/**
 * Caller Assignments (B2CAdmin) — which Calling Agent owns which family. Mobile twin of web's
 * B2CCallerAssignments.jsx.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, UserX, Headphones, Inbox, ExternalLink } from 'lucide-react-native';
import {
  Btn, StatusBadge, SearchBar, Dropdown, Trigger, Segmented, Checkbox, ConfirmModal,
} from '../../components/crud';
import { StatTile, Card, SectionLabel } from '../../components/ui';
import { statusMeta } from '../../api/b2c/b2cParentRequestService';
import { ICON_STROKE } from '../../components/common/Icon';
import { useAppTheme } from '../../theme/useAppTheme';
import { useToast } from '../../context/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import {
  b2cCallerAssignmentService, CallerAssignmentsOverview, AssignableLeadRow, UnassignedRequestRow,
} from '../../api/b2c/b2cCallerAssignmentService';

const PAGE_SIZE = 25;
const REQ_PAGE_SIZE = 10;
const STAGES = ['New', 'Contacted', 'Interested', 'AppointmentBooked', 'DocumentPending', 'CounselingBooked',
  'CounselingDone', 'DemoDone', 'ApplicationSent', 'FollowUp', 'Converted', 'NotInterested', 'Lost'];
const VIEWS: { value: 'unassigned' | 'assigned' | 'all'; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' }, { value: 'assigned', label: 'Assigned' }, { value: 'all', label: 'All' },
];

const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');
const stageColor = (T: ReturnType<typeof useAppTheme>, stage: string) => {
  if (['Interested', 'AppointmentBooked', 'Converted'].includes(stage)) return T.success;
  if (['NotInterested', 'Lost'].includes(stage)) return T.danger;
  if (['Contacted', 'CounselingBooked'].includes(stage)) return T.accent;
  return T.dim;
};
const toneColor = (T: ReturnType<typeof useAppTheme>, tone?: string) => {
  switch (tone) {
    case 'accent': return T.accent; case 'violet': return T.info; case 'warn': return T.warning;
    case 'negative': return T.danger; case 'positive': return T.success; default: return T.dim;
  }
};
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');

export const B2CCallerAssignmentsScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();

  const [overview, setOverview] = useState<CallerAssignmentsOverview | null>(null);
  const [view, setView] = useState<'unassigned' | 'assigned' | 'all'>('unassigned');
  const [callerFilter, setCallerFilter] = useState('');
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [openDd, setOpenDd] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState<AssignableLeadRow[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetCaller, setTargetCaller] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingUnassign, setPendingUnassign] = useState<{ ids: number[]; title: string; message: string } | null>(null);

  const [requests, setRequests] = useState<UnassignedRequestRow[]>([]);
  const [reqTotal, setReqTotal] = useState(0);
  const [requestsError, setRequestsError] = useState('');
  const [reqPage, setReqPage] = useState(1);
  const [rowCaller, setRowCaller] = useState<Record<number, string>>({});

  const loadOverview = useCallback(() => {
    b2cCallerAssignmentService.getOverview().then((res) => setOverview(res.data || null)).catch(() => setOverview(null));
  }, []);

  const loadLeads = useCallback(() => {
    setLoadingLeads(true);
    b2cCallerAssignmentService.getLeads({ view, callerId: callerFilter || undefined, stage: stage || undefined, search: search || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => { setLeads(res.data?.items || []); setLeadsTotal(res.data?.totalCount || 0); })
      .catch(() => { setLeads([]); setLeadsTotal(0); })
      .finally(() => setLoadingLeads(false));
  }, [view, callerFilter, stage, search, page]);

  const loadRequests = useCallback(() => {
    b2cCallerAssignmentService.getUnassignedRequests({ page: reqPage, pageSize: REQ_PAGE_SIZE })
      .then((res) => { setRequests(res.data?.items || []); setReqTotal(res.data?.totalCount || 0); setRequestsError(''); })
      .catch((err: any) => { setRequests([]); setRequestsError(err?.response?.data?.message || 'Could not load parent requests.'); });
  }, [reqPage]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { setSelected(new Set()); }, [view, callerFilter, stage, search, page]);

  const callers = overview?.callers || [];
  const activeCallers = callers.filter((c) => c.isActive);
  const refreshAll = () => { loadOverview(); loadLeads(); loadRequests(); };

  const reportResult = (res: any, verb: string) => {
    const rr = res?.data || {};
    const parts = [`${rr.updated ?? 0} lead${rr.updated === 1 ? '' : 's'} ${verb}`];
    if (rr.siblingsIncluded) parts.push(`${rr.siblingsIncluded} sibling${rr.siblingsIncluded === 1 ? '' : 's'} included`);
    if (rr.parentRequestsMoved) parts.push(`${rr.parentRequestsMoved} open request${rr.parentRequestsMoved === 1 ? '' : 's'} moved`);
    if (rr.warning) toast.error(rr.warning); else toast.success(parts.join(' · '));
  };

  const assign = async (leadIds: number[], callerId: string) => {
    if (!leadIds.length || !callerId) return;
    setSaving(true);
    try {
      const res = await b2cCallerAssignmentService.assign(leadIds, Number(callerId));
      reportResult(res, 'assigned');
      setSelected(new Set()); setTargetCaller('');
      refreshAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not assign');
    } finally { setSaving(false); }
  };

  const unassign = async (leadIds: number[]) => {
    if (!leadIds.length) return;
    setSaving(true);
    try {
      const res = await b2cCallerAssignmentService.unassign(leadIds);
      reportResult(res, 'unassigned');
      setSelected(new Set());
      refreshAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not unassign');
    } finally { setSaving(false); setPendingUnassign(null); }
  };

  const toggleOne = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectedIds = [...selected];
  const selectedRows = leads.filter((l) => selected.has(l.leadId));
  const selectedAssigned = selectedRows.filter((l) => l.assignedCallerId);
  const canAssign = selectedIds.length > 0 && selectedAssigned.length === 0;

  const askUnassign = (targets: AssignableLeadRow[]) => {
    const siblingText = (n: number) => (n === 1 ? '1 sibling of the same parent is' : `${n} siblings of the same parent are`);
    if (targets.length === 1) {
      const lr = targets[0];
      setPendingUnassign({
        ids: [lr.leadId],
        title: `Unassign ${lr.studentName}?`,
        message: `${lr.studentName} will be removed from ${lr.assignedCallerName}'s Call Queue, My Leads and Parent Requests.`
          + ((lr.siblingCount || 0) > 0 ? ` ${siblingText(lr.siblingCount!)} unassigned too.` : ''),
      });
      return;
    }
    const withSiblings = targets.some((lr) => (lr.siblingCount || 0) > 0);
    setPendingUnassign({
      ids: targets.map((lr) => lr.leadId),
      title: `Unassign ${targets.length} leads?`,
      message: `They will be removed from their calling agents' lists.${withSiblings ? ' Siblings of the same parent are unassigned too.' : ''}`,
    });
  };

  const kpiW = r.isTablet ? '24%' : '48.5%';
  const leadsPageCount = Math.ceil(leadsTotal / PAGE_SIZE) || 1;
  const reqPageCount = Math.ceil(reqTotal / REQ_PAGE_SIZE) || 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: r.gutter, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.h1, { color: T.text }]}>Caller Assignments</Text>
          <Text style={[styles.h2, { color: T.sub }]}>Give each family to one calling agent. They see only their own leads, call requests and feedback.</Text>
        </View>

        <View style={styles.kpiGrid}>
          <StatTile style={{ width: kpiW }} label="Unassigned leads" value={overview?.unassignedLeads ?? '…'} icon={<UserX size={17} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={{ width: kpiW }} label="Assigned leads" value={overview?.assignedLeads ?? '…'} icon={<Users size={17} color={T.text} strokeWidth={ICON_STROKE} />} />
          <StatTile style={{ width: kpiW }} label="Calling agents" value={overview ? activeCallers.length : '…'} icon={<Headphones size={17} color={T.text} strokeWidth={ICON_STROKE} />} />
          <StatTile style={{ width: kpiW }} label="No caller" value={reqTotal} icon={<Inbox size={17} color={reqTotal > 0 ? T.danger : T.text} strokeWidth={ICON_STROKE} />} tint={reqTotal > 0 ? T.danger : undefined} />
        </View>

        <Card>
          <SectionLabel>Workload</SectionLabel>
          {!overview ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 16 }} />
          ) : callers.length === 0 ? (
            <Text style={{ color: T.sub, textAlign: 'center', paddingVertical: 12 }}>No calling agents yet — add one in User Management.</Text>
          ) : (
            <View style={styles.workloadGrid}>
              {callers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setView('assigned'); setCallerFilter(String(c.id)); setPage(1); }}
                  style={[styles.workloadChip, { borderColor: callerFilter === String(c.id) ? T.accent : T.line, backgroundColor: callerFilter === String(c.id) ? T.accentSoft : T.card }]}
                >
                  <Text style={[styles.workloadName, { color: T.text }]}>{c.name}{!c.isActive ? ' (Inactive)' : ''}</Text>
                  <Text style={[styles.workloadSub, { color: T.dim }]}>{c.openLeads} open · {c.assignedLeads} total</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <Segmented value={view} options={VIEWS} onChange={(v) => { setView(v); if (v === 'unassigned') setCallerFilter(''); setPage(1); }} />
          <SearchBar value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Student, parent, number, city…" />
          <View style={styles.filterRow}>
            {view !== 'unassigned' && (
              <View style={{ flex: 1 }}>
                <Trigger label={callerFilter ? callers.find((c) => String(c.id) === callerFilter)?.name || 'Everyone' : 'Everyone'} open={openDd === 'caller'} onPress={() => setOpenDd((d) => (d === 'caller' ? null : 'caller'))} />
                {openDd === 'caller' && <Dropdown options={[{ label: 'Everyone', value: '' }, ...callers.map((c) => ({ label: c.name, value: String(c.id) }))]} value={callerFilter} onSelect={(v) => { setCallerFilter(v); setPage(1); setOpenDd(null); }} />}
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Trigger label={stage ? spaced(stage) : 'All stages'} open={openDd === 'stage'} onPress={() => setOpenDd((d) => (d === 'stage' ? null : 'stage'))} />
              {openDd === 'stage' && <Dropdown options={[{ label: 'All stages', value: '' }, ...STAGES.map((s) => ({ label: spaced(s), value: s }))]} value={stage} onSelect={(v) => { setStage(v); setPage(1); setOpenDd(null); }} />}
            </View>
          </View>

          {selectedIds.length > 0 && (
            <View style={[styles.selectionBar, { backgroundColor: T.card, borderColor: T.accent }]}>
              <Text style={{ color: T.text, fontWeight: '700', fontSize: 13 }}>{selectedIds.length} selected</Text>
              {canAssign ? (
                <>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Trigger label={targetCaller ? activeCallers.find((c) => String(c.id) === targetCaller)?.name || 'Choose a calling agent…' : 'Choose a calling agent…'} open={openDd === 'target'} onPress={() => setOpenDd((d) => (d === 'target' ? null : 'target'))} />
                    {openDd === 'target' && <Dropdown options={activeCallers.map((c) => ({ label: `${c.name} (${c.openLeads} open)`, value: String(c.id) }))} value={targetCaller} onSelect={(v) => { setTargetCaller(v); setOpenDd(null); }} />}
                  </View>
                  <Btn label={saving ? 'Saving…' : 'Assign'} small loading={saving} disabled={!targetCaller || saving} onPress={() => assign(selectedIds, targetCaller)} />
                </>
              ) : (
                <Btn label={`Unassign ${selectedAssigned.length}`} small variant="danger" disabled={saving || selectedAssigned.length === 0} onPress={() => askUnassign(selectedAssigned)} />
              )}
              <TouchableOpacity onPress={() => setSelected(new Set())}><Text style={{ color: T.dim, fontSize: 11 }}>Clear</Text></TouchableOpacity>
            </View>
          )}

          {loadingLeads ? (
            <ActivityIndicator color={T.accent} style={{ marginTop: 20 }} />
          ) : leads.length === 0 ? (
            <Text style={{ color: T.sub, textAlign: 'center', paddingVertical: 30 }}>{view === 'unassigned' ? 'Every lead has a calling agent.' : 'No leads match these filters.'}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {leads.map((lr) => (
                <View key={lr.leadId} style={[styles.leadCard, { backgroundColor: T.card, borderColor: T.line }]}>
                  <Checkbox on={selected.has(lr.leadId)} onToggle={() => toggleOne(lr.leadId)} label="" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TouchableOpacity onPress={() => navigation.navigate('B2CLeadDetail', { leadId: lr.leadId })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.leadName, { color: T.text }]} numberOfLines={1}>{lr.studentName}</Text>
                      <ExternalLink size={11} color={T.dim} />
                    </TouchableOpacity>
                    <Text style={[styles.leadSub, { color: T.sub }]} numberOfLines={1}>{lr.parentName || '—'} · {lr.city}{lr.grade ? ` · ${lr.grade}` : ''} · {lr.parentMobile || lr.mobileNumber}</Text>
                    <View style={styles.leadBadges}>
                      <StatusBadge label={spaced(lr.stage)} color={stageColor(T, lr.stage)} />
                      {lr.hasParentPortal ? <StatusBadge label="Linked" color={T.success} /> : <Text style={{ color: T.dim, fontSize: 11 }}>Not on Parent Portal</Text>}
                    </View>
                    {lr.assignedCallerName ? (
                      <View style={styles.callerRow}>
                        <Text style={[styles.leadSub, { color: T.text }]}>{lr.assignedCallerName} · since {fmtDate(lr.callerAssignedAt)}</Text>
                        <TouchableOpacity disabled={saving} onPress={() => askUnassign([lr])}><Text style={{ color: T.danger, fontSize: 11, fontWeight: '600' }}>Unassign</Text></TouchableOpacity>
                      </View>
                    ) : (
                      <StatusBadge label="Unassigned" color={T.warning} />
                    )}
                  </View>
                </View>
              ))}
              {leadsPageCount > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                  <Btn label="Prev" small variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                  <Text style={{ color: T.sub, alignSelf: 'center', fontSize: 12 }}>{page} / {leadsPageCount}</Text>
                  <Btn label="Next" small variant="secondary" disabled={page >= leadsPageCount} onPress={() => setPage((p) => p + 1)} />
                </View>
              )}
            </View>
          )}
        </View>

        <Card>
          <SectionLabel>Parent requests with no calling agent</SectionLabel>
          {requestsError ? (
            <Text style={{ color: T.warning, fontSize: 12, fontWeight: '500', marginTop: 8 }}>{requestsError}</Text>
          ) : requests.length === 0 ? (
            <Text style={{ color: T.sub, textAlign: 'center', paddingVertical: 20 }}>Every open request has a calling agent.</Text>
          ) : (
            <View style={{ gap: 8, marginTop: 8 }}>
              {requests.map(({ request: q, leadId, leadStudentName }) => {
                const st = statusMeta(q.status);
                return (
                  <View key={q.parentCallRequestId} style={[styles.reqCard, { backgroundColor: T.cardAlt }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.leadName, { color: T.text }]} numberOfLines={1}>{q.parentName || '—'} · {q.phoneNumber}</Text>
                      <Text style={[styles.leadSub, { color: T.sub }]} numberOfLines={1}>{q.category}{q.message ? ` — ${q.message}` : ''}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <StatusBadge label={st?.label || q.status} color={toneColor(T, st?.tone)} />
                        <Text style={{ color: T.dim, fontSize: 11 }}>{fmtDate(q.createdAt)}</Text>
                      </View>
                    </View>
                    {leadId ? (
                      <View style={{ gap: 6 }}>
                        <Trigger label={rowCaller[leadId] ? activeCallers.find((c) => String(c.id) === rowCaller[leadId])?.name || 'Choose…' : 'Choose…'} open={openDd === `req${leadId}`} onPress={() => setOpenDd((d) => (d === `req${leadId}` ? null : `req${leadId}`))} />
                        {openDd === `req${leadId}` && <Dropdown options={activeCallers.map((c) => ({ label: c.name, value: String(c.id) }))} value={rowCaller[leadId] || ''} onSelect={(v) => { setRowCaller((p) => ({ ...p, [leadId]: v })); setOpenDd(null); }} />}
                        <Btn label="Assign" small disabled={!rowCaller[leadId] || saving} onPress={() => assign([leadId], rowCaller[leadId])} />
                        {!!leadStudentName && <Text style={{ color: T.dim, fontSize: 10.5 }}>Lead: {leadStudentName}</Text>}
                      </View>
                    ) : (
                      <Text style={{ color: T.dim, fontSize: 11, maxWidth: 140 }}>No CRM lead for this parent</Text>
                    )}
                  </View>
                );
              })}
              {reqPageCount > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Btn label="Prev" small variant="secondary" disabled={reqPage <= 1} onPress={() => setReqPage((p) => p - 1)} />
                  <Text style={{ color: T.sub, alignSelf: 'center', fontSize: 12 }}>{reqPage} / {reqPageCount}</Text>
                  <Btn label="Next" small variant="secondary" disabled={reqPage >= reqPageCount} onPress={() => setReqPage((p) => p + 1)} />
                </View>
              )}
            </View>
          )}
        </Card>
      </ScrollView>

      <ConfirmModal
        visible={!!pendingUnassign}
        onCancel={() => !saving && setPendingUnassign(null)}
        onConfirm={() => pendingUnassign && unassign(pendingUnassign.ids)}
        title={pendingUnassign?.title || 'Unassign?'}
        message={pendingUnassign?.message || ''}
        confirmLabel="Unassign"
        tone="danger"
        icon={<UserX size={22} color={T.danger} strokeWidth={ICON_STROKE} />}
        loading={saving}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  h1: { fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  h2: { fontWeight: '500', fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  workloadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  workloadChip: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  workloadName: { fontWeight: '600', fontSize: 12.5 },
  workloadSub: { fontWeight: '500', fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 10 },
  selectionBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  leadCard: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  leadName: { fontWeight: '700', fontSize: 13.5 },
  leadSub: { fontWeight: '500', fontSize: 11.5, marginTop: 1 },
  leadBadges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  callerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  reqCard: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 10, alignItems: 'flex-start' },
});

export default B2CCallerAssignmentsScreen;
