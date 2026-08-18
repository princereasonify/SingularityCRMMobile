import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Phone, MapPin, IndianRupee, Check, ChevronDown, ChevronRight, Users } from 'lucide-react-native';
import { Screen, Card } from '../../components/ui';
import { SearchBar, Trigger, Dropdown, ListCard, StatusBadge } from '../../components/crud';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { useFieldStaff, buildPersonFilterOptions, resolvePersonSelection, FieldPersonSelection } from '../../components/b2c/useFieldStaff';
import { B2CLeadListDto } from '../../types/b2c';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/**
 * B2CPipelineScreen — mobile mirror of the web B2CPipeline.jsx kanban, adapted to
 * portrait as vertical collapsible stage sections. Each student stays visible in
 * every stage they've reached: a solid row in their CURRENT stage, a faded
 * "passed through" row in every earlier one. Admins get a view-as agent/counselor
 * filter that scopes the whole board.
 */

// Ordered active pipeline (terminal stages NotInterested/Lost are not shown).
const COLUMNS: { key: string; label: string }[] = [
  { key: 'New', label: 'New' },
  { key: 'Contacted', label: 'Contacted' },
  { key: 'Interested', label: 'Interested' },
  { key: 'DocumentPending', label: 'Docs Pending' },
  { key: 'CounselingBooked', label: 'Counseling Booked' },
  { key: 'CounselingDone', label: 'Counseling Done' },
  { key: 'ApplicationSent', label: 'Application Sent' },
  { key: 'FollowUp', label: 'Follow-up' },
  { key: 'Converted', label: 'Converted' },
];
const ORDER: Record<string, number> = COLUMNS.reduce((m, c, i) => { m[c.key] = i; return m; }, {} as Record<string, number>);
const idxOf = (stage: string) => (stage in ORDER ? ORDER[stage] : -1);

const priorityColor = (p: string, T: any) => (p === 'Hot' ? T.danger : p === 'Warm' ? T.warning : T.dim);

export const B2CPipelineScreen = () => {
  const T = useAppTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isAdmin = user?.role === 'B2CAdmin';
  const cols = width >= 720 ? 2 : 1;
  const colWidth = cols === 2 ? '48.5%' : '100%';

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
    <Screen scroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }}>
      <Text style={[st.title, { color: T.text }]}>Pipeline</Text>
      <Text style={[st.subtitle, { color: T.sub }]}>Each student stays visible in every stage they've reached</Text>

      {/* Search + admin view-as filter */}
      <Card style={{ marginTop: 14, gap: 10 }}>
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
              <Dropdown style={{ width: '100%' }} maxHeight={300} value={personVal} onSelect={onSelectPerson} options={filterOptions} />
            )}
          </>
        )}
      </Card>

      {isAdmin && person && (
        <Text style={[st.viewingNote, { color: T.sub }]}>
          Viewing <Text style={{ color: T.text, fontWeight: '700' }}>{person.name}</Text>'s pipeline
          {person.kind === 'agent' && person.isManager ? '  ·  Agent + Manager' : ''}
        </Text>
      )}

      {loading ? (
        <Card style={{ marginTop: 16 }}><Text style={[st.empty, { color: T.dim }]}>Loading…</Text></Card>
      ) : (
        <View style={[st.grid, { marginTop: 14 }]}>
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
                    style={st.stageHead}
                  >
                    {isOpen
                      ? <ChevronDown size={17} color={T.sub} strokeWidth={2.2} />
                      : <ChevronRight size={17} color={T.sub} strokeWidth={2.2} />}
                    <Text style={[st.stageTitle, { color: T.text }]} numberOfLines={1}>{col.label}</Text>
                    <StatusBadge label={String(reached.length)} color={T.accent} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={st.stageBody}>
                      {reached.length === 0 ? (
                        <View style={[st.emptyBox, { borderColor: T.line }]}>
                          <Text style={[st.emptyBoxTxt, { color: T.dim }]}>Empty</Text>
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
                                style={[st.passed, { borderColor: T.line, backgroundColor: T.bg }]}
                              >
                                <Check size={13} color={T.success} strokeWidth={2.4} />
                                <Text style={[st.passedTxt, { color: T.sub }]} numberOfLines={1}>{l.studentName}</Text>
                                <Text style={[st.passedTag, { color: T.dim }]}>passed</Text>
                              </TouchableOpacity>
                            );
                          }
                          // Solid row in the student's CURRENT stage.
                          const amount = (l as any).confirmedAmount as number | null | undefined;
                          return (
                            <ListCard key={l.id} onPress={() => openDetail(l.id)} style={st.leadCard}>
                              <View style={[st.dot, { backgroundColor: priorityColor(l.priority, T) }]} />
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text style={[st.leadName, { color: T.text }]} numberOfLines={1}>{l.studentName}</Text>
                                <View style={st.metaRow}>
                                  {!!l.mobileNumber && (
                                    <View style={st.meta}>
                                      <Phone size={11} color={T.dim} strokeWidth={2} />
                                      <Text style={[st.metaTxt, { color: T.dim }]} numberOfLines={1}>{l.mobileNumber}</Text>
                                    </View>
                                  )}
                                  {!!l.city && (
                                    <View style={st.meta}>
                                      <MapPin size={11} color={T.dim} strokeWidth={2} />
                                      <Text style={[st.metaTxt, { color: T.dim }]} numberOfLines={1}>{l.city}</Text>
                                    </View>
                                  )}
                                </View>
                                {l.stage === 'Converted' && amount != null && (
                                  <View style={st.meta}>
                                    <IndianRupee size={11} color={T.success} strokeWidth={2.2} />
                                    <Text style={[st.amount, { color: T.success }]}>{Number(amount).toLocaleString('en-IN')}</Text>
                                  </View>
                                )}
                                {!!l.assignedCounselorName && (
                                  <Text style={[st.counselor, { color: T.dim }]} numberOfLines={1}>Counselor: {l.assignedCounselorName}</Text>
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

const st = StyleSheet.create({
  title: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 3 },
  viewingNote: { fontSize: rf(12), fontWeight: '500', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  stageHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  stageTitle: { flex: 1, fontSize: rf(14), fontWeight: '800', letterSpacing: -0.2 },
  stageBody: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  emptyBoxTxt: { fontSize: rf(12), fontWeight: '600' },
  empty: { fontSize: rf(13), fontWeight: '500', textAlign: 'center', paddingVertical: 22 },
  leadCard: { alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  leadName: { fontSize: rf(13.5), fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: rf(11.5), fontWeight: '500' },
  amount: { fontSize: rf(12.5), fontWeight: '800' },
  counselor: { fontSize: rf(11), fontWeight: '500' },
  passed: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12,
  },
  passedTxt: { flex: 1, fontSize: rf(12), fontWeight: '500' },
  passedTag: { fontSize: rf(10), fontWeight: '600' },
});
