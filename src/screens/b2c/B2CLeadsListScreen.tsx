import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Filter, Plus, Phone, MapPin, Upload, FileSpreadsheet, User, Users, GraduationCap, CalendarClock } from 'lucide-react-native';
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
import { AppTheme } from '../../theme';
import { appointmentLabel } from '../../utils/dates';
import { getErrorMessage } from '../../utils/errorMessage';
import { useResponsive, MIN_TAP, Responsive } from '../../hooks/useResponsive';

/** Web parity: B2CLeadsList.jsx pages 10 at a time. */
const PAGE_SIZE = 10;
const DASH = '—';

/**
 * Mirrors the web BULK_COLUMNS constant. CsvHelper maps by header NAME, not position, so the
 * order is free — but every BULK_REQUIRED header must be present and filled, because each one
 * feeds the Reasonify student + parent accounts the upload provisions. Kept in step with the
 * Require(...) calls in B2CLeadService.BulkUploadAsync.
 */
const BULK_REQUIRED = [
  'StudentName', 'MobileNumber', 'Email',
  'ParentName', 'ParentMobile', 'ParentEmail',
  'Board', 'Medium', 'Grade', 'SchoolName',
  'Nationality', 'Pincode',
  'StudentPassword', 'ParentPassword',
];
const BULK_OPTIONAL = ['City', 'State', 'Source', 'EnrollmentTimeline'];
const BULK_RULES = [
  "Board, Medium and Grade must match Reasonify's own lists by name.",
  'Student and parent emails must differ — each gets its own Reasonify login.',
  'Both passwords: 8-16 chars with an uppercase letter, a number and a special character.',
  'Duplicates and cap-exceeding rows are skipped; every rejected row is reported below.',
];

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const spaced = (v?: string | null) => (v ? v.replace(/([A-Z])/g, ' $1').trim() : '');

// Web parity: stageTag map → theme tokens. New/ApplicationSent = neutral; wins = success; losses = danger.
const stageColor = (T: AppTheme, stage: string): string => {
  switch (stage) {
    case 'Converted':
    case 'DemoDone': return T.success;
    case 'NotInterested':
    case 'Lost': return T.danger;
    case 'DocumentPending':
    case 'FollowUp': return T.warning;
    case 'Contacted':
    case 'Interested':
    case 'AppointmentBooked':
    case 'CounselingBooked':
    case 'CounselingDone': return T.accent;
    default: return T.sub; // New, ApplicationSent
  }
};

export const B2CLeadsListScreen = () => {
  const T = useAppTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const r = useResponsive();
  // Screen renders this list without its own ScrollView, so the home-indicator inset has to be
  // paid here — otherwise the FAB and the last row sit under it.
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(r, insets.bottom), [r, insets.bottom]);
  // Exact point widths, not percentages: in a wrapping row with a `gap`, N × (100/N)% always
  // overflows by the gaps and the last card silently drops onto its own line.
  // A phone gets one card per row; the tablet's extra width becomes columns rather than
  // 900pt-wide rows with a name floating in the middle of them.
  const listInnerW = Math.min(r.width, r.maxContentWidth) - r.gutter * 2;
  const cardWidth: number | '100%' = r.columns > 1
    ? Math.floor((listInnerW - r.gap * (r.columns - 1)) / r.columns)
    : '100%';

  const role = (user as any)?.role;
  const isAdmin = role === 'B2CAdmin';
  // Web parity: canCreate / canUpload = ['B2CAdmin', 'Agent'].
  const canCreate = role === 'B2CAdmin' || role === 'Agent';
  const canUpload = role === 'B2CAdmin' || role === 'Agent';

  const [leads, setLeads] = useState<B2CLeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  // Why the last load failed, or null. Distinguishes "no results" from "could not fetch".
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
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
  const [draftArea, setDraftArea] = useState('');
  const [draftPincode, setDraftPincode] = useState('');
  const [draftGrade, setDraftGrade] = useState('');
  const [draftBoard, setDraftBoard] = useState('');
  const draftPerson = useMemo(
    () => resolvePersonSelection(draftPersonVal, agents, counselors),
    [draftPersonVal, agents, counselors],
  );
  const activeFilterCount = [personVal, stage, source, area, pincode, grade, board].filter(v => v !== '').length;

  const openFilters = () => {
    setDraftPersonVal(personVal); setDraftStage(stage); setDraftSource(source);
    setDraftArea(area); setDraftPincode(pincode); setDraftGrade(grade); setDraftBoard(board);
    setOpenPerson(false); setOpenStage(false); setOpenSource(false);
    setShowFilters(true);
  };
  const applyFilters = () => {
    setPersonVal(draftPersonVal); setStage(draftStage); setSource(draftSource);
    setArea(draftArea.trim()); setPincode(draftPincode.trim());
    setGrade(draftGrade); setBoard(draftBoard);
    setShowFilters(false);
  };
  const clearFilters = () => {
    setDraftPersonVal(''); setDraftStage(''); setDraftSource('');
    setDraftArea(''); setDraftPincode(''); setDraftGrade(''); setDraftBoard('');
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
        area: area || undefined,
        pincode: pincode || undefined,
        grade: grade || undefined,
        board: board || undefined,
        agentId: person?.kind === 'agent' ? person.agentId : undefined,
        counselorId: person?.kind === 'counselor' ? person.counselorId : undefined,
      });
      setLeads(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
      setLoadError(null);
    } catch (err) {
      if (__DEV__) {
        console.error('[B2CLeadsListScreen] fetchLeads failed:', err);
      }
      // Clearing the list without recording why left the screen showing "No leads found —
      // try adjusting your search or filters", which is the one explanation that is certainly
      // wrong when the request failed. Keep the reason so the empty state can tell the truth.
      setLoadError(getErrorMessage(err, 'Could not load leads.'));
      setLeads([]); setTotalPages(1); setTotalCount(0);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [search, stage, source, area, pincode, grade, board, person]);

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
          <View style={{ flex: 1, minWidth: 0 }}>
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
              style={s.tap}
            />
          )}
        </View>

        {/* Search + single Filters entry point — every filter (view-as, stage, source, std, board) lives in one modal */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, mobile, email…" style={{ flex: 1, minWidth: 180 }} />
            <Btn
              label={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
              variant="secondary"
              small
              onPress={openFilters}
              icon={<Filter size={14} color={T.text} strokeWidth={ICON_STROKE} />}
              style={s.tap}
            />
          </View>

          {activeFilterCount > 0 && (
            <View style={s.chipRow}>
              {personVal !== '' && <FilterChip label={person?.name || 'View'} onRemove={() => setPersonVal('')} />}
              {stage !== '' && <FilterChip label={spaced(stage)} onRemove={() => setStage('')} />}
              {source !== '' && <FilterChip label={spaced(source)} onRemove={() => setSource('')} />}
              {area !== '' && <FilterChip label={area} onRemove={() => setArea('')} />}
              {pincode !== '' && <FilterChip label={pincode} onRemove={() => setPincode('')} />}
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
          <View style={[s.empty, { backgroundColor: T.card, borderColor: loadError ? T.danger + '55' : T.line }]}>
            <Text style={[s.emptyTitle, { color: loadError ? T.danger : T.text }]}>
              {loadError ? 'Could not load leads' : 'No leads found'}
            </Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>
              {loadError || 'Try adjusting your search or filters.'}
            </Text>
            {loadError && (
              <Btn
                label="Retry"
                small
                onPress={() => { setLoading(true); fetchLeads(page); }}
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {leads.map(lead => (
                <ListCard key={lead.id} onPress={() => openDetail(lead.id)} style={[s.rowCard, { width: cardWidth as any }]}>
                  <Avatar initials={initialsOf(lead.studentName)} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text style={[s.name, { color: T.text }]} numberOfLines={1}>{lead.studentName}</Text>
                      <StatusBadge label={spaced(lead.stage)} color={stageColor(T, lead.stage)} />
                    </View>
                    {/* Why the lead is at this stage, read straight off the row. Anyone scanning
                       this list is asking that question, and the answer used to be three taps
                       away inside the Update Stage dialog. */}
                    {!!lead.currentStageNote?.trim() && (
                      <Text style={[s.stageNote, { color: T.sub }]} numberOfLines={2}>
                        {lead.currentStageNote.trim()}
                      </Text>
                    )}
                    {!!lead.appointmentAt && (
                      <View style={s.subRow}>
                        <CalendarClock size={11} color={T.accent} strokeWidth={ICON_STROKE} />
                        <Text style={[s.appt, { color: T.accent }]} numberOfLines={1}>{appointmentLabel(lead.appointmentAt)}</Text>
                      </View>
                    )}
                    <View style={s.subRow}>
                      <Phone size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{lead.mobileNumber || DASH}</Text>
                      <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} style={{ marginLeft: 6 }} />
                      {/* Most specific place first, pincode last — it is the part that can
                         be dropped by truncation without losing the sense of the line. */}
                      <Text style={[s.sub, { color: T.dim, flexShrink: 1 }]} numberOfLines={1}>{[lead.area, lead.city, lead.pincode].filter(Boolean).join(', ') || DASH}</Text>
                    </View>
                    {(lead.grade || lead.board) && (
                      <View style={s.subRow}>
                        <GraduationCap size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                        <Text style={[s.sub, { color: T.dim, flexShrink: 1 }]} numberOfLines={1}>
                          {[lead.grade, lead.board].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    )}
                    <View style={s.rowFooter}>
                      <View style={s.agentWrap}>
                        <User size={10} color={lead.assignedAgentName ? T.sub : T.dim} strokeWidth={ICON_STROKE} />
                        <Text style={[s.sub, { color: lead.assignedAgentName ? T.sub : T.dim, flexShrink: 1 }]} numberOfLines={1}>
                          {lead.assignedAgentName || 'Unassigned'}
                        </Text>
                      </View>
                      <StatusBadge label={spaced(lead.source)} color={T.info} />
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
        {/* Clearance for the floating "New Lead" button so it never covers the last row. */}
        <View style={{ height: r.rs(84) + insets.bottom }} />
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
        wide={r.isTablet}
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
            <Text style={[s.chipGroupLabel, { color: T.text }]}>Required in every row</Text>
            <View style={s.chipWrap}>
              {BULK_REQUIRED.map(c => (
                <View key={c} style={[s.colChip, { backgroundColor: T.accent + '22' }]}>
                  <Text style={[s.colChipTxt, { color: T.accent }]}>{c}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.chipGroupLabel, { color: T.text, marginTop: 10 }]}>Optional</Text>
            <View style={s.chipWrap}>
              {BULK_OPTIONAL.map(c => (
                <View key={c} style={[s.colChip, { backgroundColor: T.card, borderWidth: 1, borderColor: T.line }]}>
                  <Text style={[s.colChipTxt, { color: T.dim }]}>{c}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 10, gap: 4 }}>
              {BULK_RULES.map(rule => (
                <Text key={rule} style={[s.infoNote, { color: T.dim }]}>{`•  ${rule}`}</Text>
              ))}
            </View>
          </View>

          <Text style={[s.infoNote, { color: T.dim }]}>Leads will be added to you (max 50 active leads).</Text>

          {bulkResult?.error && (
            <View style={[s.alert, { backgroundColor: T.danger + '1A', borderColor: T.danger + '55' }]}>
              <Text style={[s.alertTxt, { color: T.danger }]}>{bulkResult.error}</Text>
            </View>
          )}
          {bulkResult && !bulkResult.error && (() => {
            const added = bulkResult.successCount ?? 0;
            const tone = added > 0 ? T.success : T.warning;
            return (
              <View style={[s.alert, { backgroundColor: tone + '1A', borderColor: tone + '55' }]}>
                <Text style={[s.alertTxt, { color: tone }]}>
                  {added > 0 ? `${added} lead(s) added` : 'No leads were added'}
                </Text>
                <Text style={[s.infoNote, { color: T.sub, marginTop: 2 }]}>
                  Skipped {bulkResult.hardDuplicateCount ?? 0} duplicate, {bulkResult.capBlockedCount ?? 0} over-cap, {bulkResult.errorCount ?? 0} invalid.
                </Text>
              </View>
            );
          })()}

          {/* Which rows failed and why. With 14 required columns a bare count is useless —
             the uploader needs the row number and the offending column to fix the file. */}
          {bulkResult?.errors?.length > 0 && (
            <View style={[s.errBox, { borderColor: T.line }]}>
              <Text style={[s.errHead, { color: T.text, backgroundColor: T.cardAlt, borderBottomColor: T.line }]}>
                {bulkResult.errors.length} row(s) not imported
              </Text>
              <ScrollView style={{ maxHeight: r.height * 0.28 }} nestedScrollEnabled>
                {bulkResult.errors.map((e: any, i: number) => (
                  <View key={`${e.rowNumber}-${i}`} style={[s.errRow, { borderBottomColor: T.line }]}>
                    <Text style={[s.errRowHead, { color: T.text }]}>
                      Row {e.rowNumber}
                      {e.studentName ? <Text style={{ color: T.dim, fontWeight: '500' }}>{`  ·  ${e.studentName}`}</Text> : null}
                      {e.mobile ? <Text style={{ color: T.dim, fontWeight: '500' }}>{`  ·  ${e.mobile}`}</Text> : null}
                    </Text>
                    <Text style={[s.errRowTxt, { color: T.danger }]}>{e.reason}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </FormModal>

      {/* Filters modal — view-as, stage, source, std and board all live here together,
          edited as a draft and only applied (one refetch) when Apply is tapped. */}
      <FormModal
        visible={showFilters}
        title="Filters"
        wide={r.isTablet}
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
                <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={r.height * 0.3} value={draftPersonVal}
                  onSelect={v => { setDraftPersonVal(v); setOpenPerson(false); }}
                  options={personOptions} />
              )}
            </View>
          )}

          <View>
            <Trigger
              label={draftStage ? spaced(draftStage) : 'Stage'}
              open={openStage}
              onPress={() => { setOpenStage(v => !v); setOpenSource(false); setOpenPerson(false); }}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              style={{ width: '100%' }}
            />
            {openStage && (
              <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={r.height * 0.3} value={draftStage}
                onSelect={v => { setDraftStage(v); setOpenStage(false); }}
                options={[{ label: 'All stages', value: '' }, ...B2C_LEAD_STAGES.map(x => ({ label: spaced(x), value: x }))]} />
            )}
          </View>

          <View>
            <Trigger
              label={draftSource ? spaced(draftSource) : 'Source'}
              open={openSource}
              onPress={() => { setOpenSource(v => !v); setOpenStage(false); setOpenPerson(false); }}
              style={{ width: '100%' }}
            />
            {openSource && (
              <Dropdown style={{ width: '100%', marginTop: 6 }} maxHeight={r.height * 0.3} value={draftSource}
                onSelect={v => { setDraftSource(v); setOpenSource(false); }}
                options={[{ label: 'All sources', value: '' }, ...B2C_LEAD_SOURCES.map(x => ({ label: spaced(x), value: x }))]} />
            )}
          </View>

          {/* Matches area, city or the free-text address — most leads carry the place in
             City rather than Area, so "Ahmedabad" has to find all of them. */}
          <Input
            label="Area / city"
            value={draftArea}
            onChangeText={setDraftArea}
            placeholder="e.g. Ahmedabad"
            left={<MapPin size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
          />
          <Input
            label="Pincode"
            value={draftPincode}
            onChangeText={setDraftPincode}
            keyboardType="number-pad"
            placeholder="e.g. 380015"
          />
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

/** Live-metric styles. A module-level StyleSheet is evaluated once at import, so every size
 *  would stay frozen at the launch orientation — which is what clips an iPad after rotating. */
const makeStyles = (r: Responsive, bottomInset: number) => StyleSheet.create({
  chipGroupLabel: { fontSize: r.rf(11), fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  colChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  colChipTxt: { fontSize: r.rf(10.5), fontWeight: '600' },
  errBox: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  errHead: { fontSize: r.rf(11.5), fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  errRow: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  errRowHead: { fontSize: r.rf(11), fontWeight: '700' },
  errRowTxt: { fontSize: r.rf(11), fontWeight: '500', marginTop: 2, lineHeight: r.rf(15) },
  scroll: {
    padding: r.gutter, paddingBottom: r.rs(28), gap: r.gap,
    width: '100%', maxWidth: r.maxContentWidth, alignSelf: 'center',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: r.rf(22), fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500', marginTop: 2 },
  viewingNote: { fontSize: r.rf(12), fontWeight: '500', marginTop: -2 },
  card: { borderRadius: 16, borderWidth: 1, padding: r.rs(12), gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: r.rf(11.5), fontWeight: '600' },
  tap: { minHeight: MIN_TAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  agentWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  name: { fontSize: r.rf(13.5), fontWeight: '700', flex: 1, minWidth: 0 },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  stageNote: { fontSize: r.rf(11.5), fontWeight: '500', fontStyle: 'italic', lineHeight: r.rf(16) },
  appt: { fontSize: r.rf(11.5), fontWeight: '700', flexShrink: 1 },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: r.rs(46), alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
  fabWrap: { position: 'absolute', right: r.gutter, bottom: r.rs(22) + bottomInset },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoTitle: { fontSize: r.rf(12.5), fontWeight: '700' },
  infoNote: { fontSize: r.rf(11), fontWeight: '500', lineHeight: r.rf(16) },
  alert: { borderRadius: 12, borderWidth: 1, padding: 12 },
  alertTxt: { fontSize: r.rf(12), fontWeight: '600', lineHeight: r.rf(17) },
});

export default B2CLeadsListScreen;
