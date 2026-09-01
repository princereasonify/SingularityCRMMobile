import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Phone, MapPin, IndianRupee, Check, ChevronDown, ChevronRight, Users, CalendarClock } from 'lucide-react-native';
import { Screen, Card } from '../../components/ui';
import { SearchBar, Trigger, Dropdown, ListCard, StatusBadge } from '../../components/crud';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { useFieldStaff, buildPersonFilterOptions, resolvePersonSelection, FieldPersonSelection } from '../../components/b2c/useFieldStaff';
import { B2CLeadListDto } from '../../types/b2c';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme';
import { appointmentLabel } from '../../utils/dates';
import { useResponsive, MIN_TAP, Responsive } from '../../hooks/useResponsive';

/**
 * B2CPipelineScreen — mobile mirror of the web B2CPipeline.jsx kanban, adapted to
 * portrait as vertical collapsible stage sections. Each student stays visible in
 * every stage they've reached: a solid row in their CURRENT stage, a faded
 * "passed through" row in every earlier one. Admins get a view-as agent/counselor
 * filter that scopes the whole board.
 */

// Ordered active pipeline (terminal stages NotInterested/Lost are not shown). Kept in the
// same order as the web board's COLUMNS — the trail logic depends on it.
const COLUMNS: { key: string; label: string }[] = [
  { key: 'New', label: 'New' },
  { key: 'Contacted', label: 'Contacted' },
  { key: 'Interested', label: 'Interested' },
  { key: 'AppointmentBooked', label: 'Appointment Booked' },
  { key: 'DocumentPending', label: 'Docs Pending' },
  { key: 'CounselingBooked', label: 'Counseling Booked' },
  { key: 'CounselingDone', label: 'Counseling Done' },
  { key: 'DemoDone', label: 'Demo Done' },
  { key: 'ApplicationSent', label: 'Application Sent' },
  { key: 'FollowUp', label: 'Follow-up' },
  { key: 'Converted', label: 'Converted' },
];
const ORDER: Record<string, number> = COLUMNS.reduce((m, c, i) => { m[c.key] = i; return m; }, {} as Record<string, number>);
const idxOf = (stage: string) => (stage in ORDER ? ORDER[stage] : -1);

const priorityColor = (p: string, T: AppTheme) => (p === 'Hot' ? T.danger : p === 'Warm' ? T.warning : T.dim);

export const B2CPipelineScreen = () => {
  const T = useAppTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const r = useResponsive();
  const s = useMemo(() => makeStyles(r), [r]);
  const isAdmin = user?.role === 'B2CAdmin';
  // Exact point widths, not percentages: in a wrapping row with a `gap`, N × (100/N)% always
  // overflows by the gaps and the last card silently drops onto its own line.
  // The board is one column of stage sections on a phone; a tablet's width buys two.
  const boardInnerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2;
  const colWidth: number | '100%' = r.isTablet ? Math.floor((boardInnerW - r.gap) / 2) : '100%';

  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Admin view-as filter — web parity: B2CPipeline.jsx's <PersonFilter>. This
  // screen is reachable by Agent/Counselor too, who never render the filter —
  // `enabled: isAdmin` skips the (B2CAdmin-only, otherwise-403) roster fetch for them.
  const { agents, counselors } = useFieldStaff(isAdmin);
  const [personVal, setPersonVal] = useState(''); // encoded 'a:<id>' | 'c:<id>' | ''
  const [openFilter, setOpenFilter] = useState(false);
  const person: FieldPersonSelection | null = useMemo(
    () => resolvePersonSelection(personVal, agents, counselors),
    [personVal, agents, counselors],
  );

  // Collapsed stage keys (default: everything expanded).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchLeads = useCallback(async () => {
    try {
      const res = await b2cLeadService.getLeads({
        page: 1,
        pageSize: 300,
        search: search || undefined,
        agentId: person?.kind === 'agent' ? person.agentId : undefined,
        counselorId: person?.kind === 'counselor' ? person.counselorId : undefined,
      });
      setLeads(res.data?.items ?? []);
    } catch (err) {
      if (__DEV__) {
        console.error('[B2CPipelineScreen] fetchLeads failed:', err);
      }
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, person]);

  // Debounce the reload on search like the web page (300ms while typing).
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(fetchLeads, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchLeads, search]);

  const onSelectPerson = (v: string) => { setOpenFilter(false); setPersonVal(v); };

  const filterOptions = useMemo(() => buildPersonFilterOptions(agents, counselors), [agents, counselors]);

  const filterLabel = person ? person.name : 'Everyone';

  const openDetail = (id: number) => nav.navigate('B2CLeadDetail', { leadId: id });

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }} contentStyle={s.page}>
      <Text style={[s.title, { color: T.text }]}>Pipeline</Text>
      <Text style={[s.subtitle, { color: T.sub }]}>Each student stays visible in every stage they've reached</Text>

      {/* Search + admin view-as filter */}
      <Card style={{ marginTop: r.rs(14), gap: 10 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search students…" style={{ width: '100%' }} />
        {isAdmin && (
          <>
            <Trigger
              label={filterLabel}
              open={openFilter}
              onPress={() => setOpenFilter(v => !v)}
              icon={<Users size={14} color={T.sub} strokeWidth={2} />}
            />
            {openFilter && (
              <Dropdown style={{ width: '100%' }} maxHeight={r.height * 0.4} value={personVal} onSelect={onSelectPerson} options={filterOptions} />
            )}
          </>
        )}
      </Card>

      {isAdmin && person && (
        <Text style={[s.viewingNote, { color: T.sub }]}>
          Viewing <Text style={{ color: T.text, fontWeight: '700' }}>{person.name}</Text>'s pipeline
          {person.kind === 'agent' && person.isManager ? '  ·  Agent + Manager' : ''}
        </Text>
      )}

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[s.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : (
        <View style={[s.grid, { marginTop: r.rs(14) }]}>
          {COLUMNS.map((col, ci) => {
            // Trail: everyone whose current stage is at or past this column.
            const reached = leads.filter(l => idxOf(l.stage) >= ci);
            const isOpen = !collapsed[col.key];
            return (
              <View key={col.key} style={{ width: colWidth }}>
                <Card padded={false}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setCollapsed(m => ({ ...m, [col.key]: isOpen }))}
                    style={s.stageHead}
                  >
                    {isOpen
                      ? <ChevronDown size={17} color={T.sub} strokeWidth={2.2} />
                      : <ChevronRight size={17} color={T.sub} strokeWidth={2.2} />}
                    <Text style={[s.stageTitle, { color: T.text }]} numberOfLines={1}>{col.label}</Text>
                    <StatusBadge label={String(reached.length)} color={T.accent} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.stageBody}>
                      {reached.length === 0 ? (
                        <View style={[s.emptyBox, { borderColor: T.line }]}>
                          <Text style={[s.emptyBoxTxt, { color: T.dim }]}>Empty</Text>
                        </View>
                      ) : (
                        reached.map(l => {
                          const isCurrent = idxOf(l.stage) === ci;
                          if (!isCurrent) {
                            // Faded "passed through" row for earlier stages.
                            return (
                              <TouchableOpacity
                                key={l.id}
                                activeOpacity={0.7}
                                onPress={() => openDetail(l.id)}
                                style={[s.passed, { borderColor: T.line, backgroundColor: T.bg }]}
                              >
                                <Check size={13} color={T.success} strokeWidth={2.4} />
                                <Text style={[s.passedTxt, { color: T.sub }]} numberOfLines={1}>{l.studentName}</Text>
                                <Text style={[s.passedTag, { color: T.dim }]}>passed</Text>
                              </TouchableOpacity>
                            );
                          }
                          // Solid row in the student's CURRENT stage.
                          const amount = (l as any).confirmedAmount as number | null | undefined;
                          return (
                            <ListCard key={l.id} onPress={() => openDetail(l.id)} style={s.leadCard}>
                              <View style={[s.dot, { backgroundColor: priorityColor(l.priority, T) }]} />
                              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                                <Text style={[s.leadName, { color: T.text }]} numberOfLines={1}>{l.studentName}</Text>
                                <View style={s.metaRow}>
                                  {!!l.mobileNumber && (
                                    <View style={s.meta}>
                                      <Phone size={11} color={T.dim} strokeWidth={2} />
                                      <Text style={[s.metaTxt, { color: T.dim }]} numberOfLines={1}>{l.mobileNumber}</Text>
                                    </View>
                                  )}
                                  {!!l.city && (
                                    <View style={s.meta}>
                                      <MapPin size={11} color={T.dim} strokeWidth={2} />
                                      <Text style={[s.metaTxt, { color: T.dim }]} numberOfLines={1}>{l.city}</Text>
                                    </View>
                                  )}
                                </View>
                                {!!l.appointmentAt && (
                                  <View style={s.meta}>
                                    <CalendarClock size={11} color={T.accent} strokeWidth={2.2} />
                                    <Text style={[s.appt, { color: T.accent }]} numberOfLines={1}>{appointmentLabel(l.appointmentAt)}</Text>
                                  </View>
                                )}
                                {l.stage === 'Converted' && amount != null && (
                                  <View style={s.meta}>
                                    <IndianRupee size={11} color={T.success} strokeWidth={2.2} />
                                    <Text style={[s.amount, { color: T.success }]}>{Number(amount).toLocaleString('en-IN')}</Text>
                                  </View>
                                )}
                                {/* The note written when the student landed in this column — the
                                   board's whole job is showing where everyone stands, which reads
                                   far better with the one line explaining it. */}
                                {!!l.currentStageNote?.trim() && (
                                  <Text style={[s.stageNote, { color: T.sub }]} numberOfLines={2}>
                                    {l.currentStageNote.trim()}
                                  </Text>
                                )}
                                {!!l.assignedCounselorName && (
                                  <Text style={[s.counselor, { color: T.dim }]} numberOfLines={1}>Counselor: {l.assignedCounselorName}</Text>
                                )}
                              </View>
                            </ListCard>
                          );
                        })
                      )}
                    </View>
                  )}
                </Card>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
};

/** Live-metric styles: a module-level StyleSheet is evaluated once at import, so every size
 *  would stay frozen at the launch orientation and clip after an iPad rotation. */
const makeStyles = (r: Responsive) => StyleSheet.create({
  // No paddingBottom: Screen's own `insets.bottom + 28` must survive the override.
  page: { padding: r.gutter, width: '100%', maxWidth: r.maxContentWidth, alignSelf: 'center' },
  title: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginTop: 3 },
  viewingNote: { fontSize: r.rf(12), fontWeight: '500', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  stageHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TAP,
    paddingVertical: r.rs(14), paddingHorizontal: r.rs(16),
  },
  stageTitle: { flex: 1, minWidth: 0, fontSize: r.rf(14), fontWeight: '800', letterSpacing: -0.2 },
  stageBody: { gap: 8, paddingHorizontal: r.rs(12), paddingBottom: r.rs(12) },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  emptyBoxTxt: { fontSize: r.rf(12), fontWeight: '600' },
  empty: { fontSize: r.rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },
  leadCard: { alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  leadName: { fontSize: r.rf(13.5), fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaTxt: { fontSize: r.rf(11.5), fontWeight: '500', flexShrink: 1 },
  appt: { fontSize: r.rf(11.5), fontWeight: '700', flexShrink: 1 },
  amount: { fontSize: r.rf(12.5), fontWeight: '800' },
  stageNote: { fontSize: r.rf(11.5), fontWeight: '500', fontStyle: 'italic', lineHeight: r.rf(16) },
  counselor: { fontSize: r.rf(11), fontWeight: '500' },
  passed: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TAP,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12,
  },
  passedTxt: { flex: 1, minWidth: 0, fontSize: r.rf(12), fontWeight: '500' },
  passedTag: { fontSize: r.rf(10), fontWeight: '600' },
});
