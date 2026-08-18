import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Filter, Plus, Phone, MapPin, Upload, FileSpreadsheet, User, Users, GraduationCap } from 'lucide-react-native';
import { pick, types } from '@react-native-documents/picker';
import { ICON_STROKE } from '../../components/common/Icon';
import { Screen } from '../../components/ui';
import {
  Btn, SearchBar, Trigger, Dropdown, FilterChip, Pagination, ListCard, Avatar, StatusBadge, Fab, FormModal, Input,
} from '../../components/crud';
import { b2cLeadService } from '../../api/b2c/b2cLeadService';
import { B2CLeadListDto, B2C_LEAD_STAGES, B2C_LEAD_SOURCES } from '../../types/b2c';
import { useFieldStaff, buildPersonFilterOptions, resolvePersonSelection, FieldPersonSelection } from '../../components/b2c/useFieldStaff';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CLeadsList.jsx pages 20 at a time. */
const PAGE_SIZE = 20;
const DASH = '—';

/** Mirrors the web BULK_COLUMNS constant so uploaders know the exact header order. */
const BULK_COLUMNS = 'StudentName, MobileNumber, Email, ParentName, ParentMobile, ParentEmail, Grade, Board, SchoolName, City, State, Pincode, Source, EnrollmentTimeline';

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// Web parity: stageTag map → theme tokens. New/ApplicationSent = neutral; wins = success; losses = danger.
const stageColor = (T: any, stage: string): string => {
  switch (stage) {
    case 'Converted': return T.success;
    case 'NotInterested':
    case 'Lost': return T.danger;
    case 'DocumentPending':
    case 'FollowUp': return T.warning;
    case 'Contacted':
    case 'Interested':
    case 'CounselingBooked':
    case 'CounselingDone': return T.accent;
    default: return T.sub; // New, ApplicationSent
  }
};

export const B2CLeadsListScreen = () => {
  const T = useAppTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  const role = (user as any)?.role;
  const isAdmin = role === 'B2CAdmin';
  // Web parity: canCreate / canUpload = ['B2CAdmin', 'Agent'].
  const canCreate = role === 'B2CAdmin' || role === 'Agent';
  const canUpload = role === 'B2CAdmin' || role === 'Agent';

  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [grade, setGrade] = useState('');
  const [board, setBoard] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Admin "view as" filter — web parity: B2CLeadsList.jsx's <PersonFilter>. This
  // screen is reachable by Agent/Counselor too, who never render the filter —
  // `enabled: isAdmin` skips the (B2CAdmin-only, otherwise-403) roster fetch for them.
  const { agents, counselors } = useFieldStaff(isAdmin);
  const [personVal, setPersonVal] = useState(''); // '' | 'a:<id>' | 'c:<id>'
  const person: FieldPersonSelection | null = useMemo(
    () => resolvePersonSelection(personVal, agents, counselors),
    [personVal, agents, counselors],
  );
  const personOptions = useMemo(() => buildPersonFilterOptions(agents, counselors), [agents, counselors]);

  // Every filter (view-as, stage, source, std, board) lives behind one "Filters" button —
  // edited as a draft inside the modal and only committed to the real (query-driving) state
  // on Apply, so typing "9" into Std doesn't fire a request per keystroke.
  const [showFilters, setShowFilters] = useState(false);
  const [openPerson, setOpenPerson] = useState(false);
  const [openStage, setOpenStage] = useState(false);
  const [openSource, setOpenSource] = useState(false);
  const [draftPersonVal, setDraftPersonVal] = useState('');
  const [draftStage, setDraftStage] = useState('');
  const [draftSource, setDraftSource] = useState('');
  const [draftGrade, setDraftGrade] = useState('');
  const [draftBoard, setDraftBoard] = useState('');
  const draftPerson = useMemo(
    () => resolvePersonSelection(draftPersonVal, agents, counselors),
    [draftPersonVal, agents, counselors],
  );
  const activeFilterCount = [personVal, stage, source, grade, board].filter(v => v !== '').length;

  const openFilters = () => {
    setDraftPersonVal(personVal); setDraftStage(stage); setDraftSource(source);
    setDraftGrade(grade); setDraftBoard(board);
    setOpenPerson(false); setOpenStage(false); setOpenSource(false);
    setShowFilters(true);
  };
  const applyFilters = () => {
    setPersonVal(draftPersonVal); setStage(draftStage); setSource(draftSource);
    setGrade(draftGrade); setBoard(draftBoard);
    setShowFilters(false);
  };
  const clearFilters = () => {
    setDraftPersonVal(''); setDraftStage(''); setDraftSource(''); setDraftGrade(''); setDraftBoard('');
  };

  // Bulk upload modal
  const [showBulk, setShowBulk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  const fetchLeads = useCallback(async (pg = 1) => {
    try {
      const res = await b2cLeadService.getLeads({
        page: pg, pageSize: PAGE_SIZE,
        search: search || undefined,
        stage: stage || undefined,
        source: source || undefined,
        grade: grade || undefined,
        board: board || undefined,
        agentId: person?.kind === 'agent' ? person.agentId : undefined,
        counselorId: person?.kind === 'counselor' ? person.counselorId : undefined,
      });
      setLeads(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch (err) {
      if (__DEV__) {
        console.error('[B2CLeadsListScreen] fetchLeads failed:', err);
      }
      setLeads([]); setTotalPages(1); setTotalCount(0);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [search, stage, source, grade, board, person]);

  // Refetch (reset to page 1) whenever the search/filters change.
  useEffect(() => { setLoading(true); setPage(1); fetchLeads(1); }, [fetchLeads]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); fetchLeads(p);
  };

  const onRefresh = () => { setRefreshing(true); fetchLeads(page); };

  const openDetail = (id: number) => nav.navigate('B2CLeadDetail', { leadId: id });

  const handleBulkUpload = async () => {
    try {
      const [file] = await pick({ type: [types.csv] });
      if (!file?.uri) return;
      setUploading(true);
      setBulkResult(null);
      const res = await b2cLeadService.bulkUpload({
        uri: file.uri,
        name: file.name || 'leads.csv',
        type: file.type || 'text/csv',
      });
      setBulkResult(res.data || null);
      setPage(1); setLoading(true); fetchLeads(1);
    } catch (err: any) {
      // Picker cancellation isn't an error we surface.
      if (err?.message?.toLowerCase?.().includes('cancel')) return;
      setBulkResult({ error: err?.response?.data?.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
      >
        {/* Title + bulk action */}
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: T.text }]} numberOfLines={1}>Student Leads</Text>
            <Text style={[s.subtitle, { color: T.sub }]}>{totalCount} total lead{totalCount === 1 ? '' : 's'}</Text>
          </View>
          {canUpload && (
            <Btn
              label="Bulk Upload"
              variant="secondary"
              small
              onPress={() => { setShowBulk(true); setBulkResult(null); }}
              icon={<Upload size={14} color={T.text} strokeWidth={ICON_STROKE} />}
            />
          )}
        </View>

        {/* Search + single Filters entry point — every filter (view-as, stage, source, std, board) lives in one modal */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={[s.searchRow, wide && { flexWrap: 'nowrap' }]}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, mobile, email…" style={{ flex: 1, minWidth: 180 }} />
            <Btn
              label={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
              variant="secondary"
              small
              onPress={openFilters}
              icon={<Filter size={14} color={T.text} strokeWidth={ICON_STROKE} />}
            />
          </View>

          {activeFilterCount > 0 && (
            <View style={s.chipRow}>
              {personVal !== '' && <FilterChip label={person?.name || 'View'} onRemove={() => setPersonVal('')} />}
              {stage !== '' && <FilterChip label={stage} onRemove={() => setStage('')} />}
              {source !== '' && <FilterChip label={source} onRemove={() => setSource('')} />}
              {grade !== '' && <FilterChip label={`Std: ${grade}`} onRemove={() => setGrade('')} />}
              {board !== '' && <FilterChip label={`Board: ${board}`} onRemove={() => setBoard('')} />}
            </View>
          )}
        </View>

        {isAdmin && person && (
          <Text style={[s.viewingNote, { color: T.sub }]}>
            Viewing <Text style={{ color: T.text, fontWeight: '700' }}>{person.name}</Text>'s leads
            {person.kind === 'agent' && person.isManager ? '  ·  Agent + Manager' : ''}
          </Text>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : leads.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No leads found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Try adjusting your search or filters.</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              {leads.map(lead => (
                <ListCard key={lead.id} onPress={() => openDetail(lead.id)} style={s.rowCard}>
                  <Avatar initials={initialsOf(lead.studentName)} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{lead.studentName}</Text>
                      <StatusBadge label={lead.stage} color={stageColor(T, lead.stage)} />
                    </View>
                    <View style={s.subRow}>
                      <Phone size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{lead.mobileNumber || DASH}</Text>
                      <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} style={{ marginLeft: 6 }} />
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{[lead.city, lead.state].filter(Boolean).join(', ') || DASH}</Text>
                    </View>
                    {(lead.grade || lead.board) && (
                      <View style={s.subRow}>
                        <GraduationCap size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                        <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                          {[lead.grade, lead.board].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    )}
                    <View style={s.rowFooter}>
                      <View style={s.agentWrap}>
                        <User size={10} color={lead.assignedAgentName ? T.sub : T.dim} strokeWidth={ICON_STROKE} />
                        <Text style={[s.sub, { color: lead.assignedAgentName ? T.sub : T.dim }]} numberOfLines={1}>
                          {lead.assignedAgentName || 'Unassigned'}
                        </Text>
                      </View>
                      <StatusBadge label={lead.source} color={T.info} />
                    </View>
                  </View>
                </ListCard>
              ))}
            </View>

            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>Showing {from}{DASH}{to} of {totalCount}</Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
        <View style={{ height: 84 }} />
      </ScrollView>

      {canCreate && (
        <View style={s.fabWrap}>
          <Fab label="New Lead" onPress={() => nav.navigate('B2CAddLead')}>
            <Plus size={22} color="#FFF" strokeWidth={2.4} />
          </Fab>
        </View>
      )}

      {/* Bulk upload modal (web parity: FileSpreadsheet columns + CSV picker + result) */}
      <FormModal
        visible={showBulk}
        title="Bulk Upload Leads"
        onClose={() => setShowBulk(false)}
        footer={
          <Btn
            label={uploading ? 'Uploading…' : 'Choose CSV & Upload'}
            onPress={handleBulkUpload}
            loading={uploading}
            disabled={uploading}
            icon={<Upload size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
            style={{ flex: 1 }}
          />
        }
      >
        <View style={{ gap: 14 }}>
          <View style={[s.infoBox, { backgroundColor: T.cardAlt, borderColor: T.line }]}>
            <View style={s.infoHead}>
              <FileSpreadsheet size={13} color={T.text} strokeWidth={ICON_STROKE} />
              <Text style={[s.infoTitle, { color: T.text }]}>CSV columns</Text>
            </View>
            <Text style={[s.infoTxt, { color: T.sub }]}>{BULK_COLUMNS}</Text>
            <Text style={[s.infoNote, { color: T.dim }]}>StudentName and MobileNumber are required. Duplicates and cap-exceeding rows are skipped and reported.</Text>
          </View>

          <Text style={[s.infoNote, { color: T.dim }]}>Leads will be added to you (max 50 active leads).</Text>

          {bulkResult?.error && (
            <View style={[s.alert, { backgroundColor: T.danger + '1A', borderColor: T.danger + '55' }]}>
              <Text style={[s.alertTxt, { color: T.danger }]}>{bulkResult.error}</Text>
            </View>
          )}
          {bulkResult && !bulkResult.error && (
            <View style={[s.alert, { backgroundColor: T.success + '1A', borderColor: T.success + '55' }]}>
              <Text style={[s.alertTxt, { color: T.success }]}>
                Added {bulkResult.successCount ?? 0} · skipped {bulkResult.hardDuplicateCount ?? 0} dup, {bulkResult.capBlockedCount ?? 0} over-cap, {bulkResult.errorCount ?? 0} error(s).
              </Text>
            </View>
          )}
        </View>
      </FormModal>

      {/* Filters modal — view-as, stage, source, std and board all live here together,
          edited as a draft and only applied (one refetch) when Apply is tapped. */}
      <FormModal
        visible={showFilters}
        title="Filters"
        onClose={() => setShowFilters(false)}
        footer={
          <>
            <Btn label="Clear all" variant="secondary" onPress={clearFilters} style={{ flex: 1 }} />
            <Btn label="Apply" onPress={applyFilters} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          {isAdmin && (
            <View>
              <Trigger
                label={draftPerson?.name || 'Everyone'}
                open={openPerson}
                onPress={() => { setOpenPerson(v => !v); setOpenStage(false); setOpenSource(false); }}
                icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
                style={{ width: '100%' }}
              />
              {openPerson && (
                <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={220} value={draftPersonVal}
                  onSelect={v => { setDraftPersonVal(v); setOpenPerson(false); }}
                  options={personOptions} />
              )}
            </View>
          )}

          <View>
            <Trigger
              label={draftStage || 'Stage'}
              open={openStage}
              onPress={() => { setOpenStage(v => !v); setOpenSource(false); setOpenPerson(false); }}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={{ width: '100%' }}
            />
            {openStage && (
              <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={220} value={draftStage}
                onSelect={v => { setDraftStage(v); setOpenStage(false); }}
                options={[{ label: 'All stages', value: '' }, ...B2C_LEAD_STAGES.map(x => ({ label: x, value: x }))]} />
            )}
          </View>

          <View>
            <Trigger
              label={draftSource || 'Source'}
              open={openSource}
              onPress={() => { setOpenSource(v => !v); setOpenStage(false); setOpenPerson(false); }}
              style={{ width: '100%' }}
            />
            {openSource && (
              <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={220} value={draftSource}
                onSelect={v => { setDraftSource(v); setOpenSource(false); }}
                options={[{ label: 'All sources', value: '' }, ...B2C_LEAD_SOURCES.map(x => ({ label: x, value: x }))]} />
            )}
          </View>

          <Input
            label="Std"
            value={draftGrade}
            onChangeText={setDraftGrade}
            placeholder="e.g. 9"
            left={<GraduationCap size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
          />
          <Input
            label="Board"
            value={draftBoard}
            onChangeText={setDraftBoard}
            placeholder="e.g. CBSE"
          />
        </View>
      </FormModal>
    </Screen>
  );
};

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 28, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },
  viewingNote: { fontSize: rf(12), fontWeight: '500', marginTop: -2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  agentWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
  fabWrap: { position: 'absolute', right: 18, bottom: 22 },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTitle: { fontSize: rf(12.5), fontWeight: '700' },
  infoTxt: { fontSize: rf(11.5), fontWeight: '500', lineHeight: 17 },
  infoNote: { fontSize: rf(11), fontWeight: '500', lineHeight: 16 },
  alert: { borderRadius: 12, borderWidth: 1, padding: 12 },
  alertTxt: { fontSize: rf(12), fontWeight: '600', lineHeight: 17 },
});

export default B2CLeadsListScreen;
