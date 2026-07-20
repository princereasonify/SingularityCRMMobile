import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  useWindowDimensions, Alert, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, X, Download, UserCheck, Filter, MapPin, Users } from 'lucide-react-native';
import messaging from '@react-native-firebase/messaging';
import RNShare from 'react-native-share';

import { requestFCMPermission } from '../../services/pushNotificationService';
import { leadsApi } from '../../api/leads';
import { LeadListDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Icon, ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, SearchBar, Segmented, Trigger, Dropdown,
  StatusBadge, FilterChip, Pagination, ListCard, Avatar, FormModal,
} from '../../components/crud';
import { STAGE_COLORS, STAGE_LABELS, getScoreColor } from '../../utils/constants';
import { formatCurrency, formatDate, formatRelativeDate, isOverdue } from '../../utils/formatting';
import { rf, isTabletDevice } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';

/** Web parity: the list pages 10 at a time and reports the server's real totalCount. */
const PAGE_SIZE = 10;

const FILTERS = ['All', 'Active', 'Hot', 'Won', 'Unassigned'] as const;
type LeadFilter = typeof FILTERS[number];

/** Web parity: the list/kanban toggle — kanban is the Pipeline screen, not a card grid. */
type ViewMode = 'list' | 'pipeline';

/** Web parity: the manager user-filter groups RH ▸ ZH ▸ FO under these labels. */
const ROLE_ORDER = ['RH', 'ZH', 'FO'];
const ROLE_LABEL: Record<string, string> = {
  FO: 'Field Officers',
  ZH: 'Zonal Heads',
  RH: 'Regional Heads',
};

const DASH = '—';

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

export const LeadsListScreen = ({ navigation, route }: any) => {
  const T = useAppTheme();
  const { user } = useAuth();
  const role = user?.role || 'FO';
  const isManager = role !== 'FO';
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const table = isTabletDevice;
  const myUserId = user?.id;

  /**
   * Manager user-filter, web parity (LeadsList.jsx):
   *   ''     → All in my scope   (no `userId` sent)
   *   'mine' → My leads only     (`userId` = my own id)
   *   '<id>' → that user's leads (`userId` = <id>)
   * LeadsController.GetLeads binds `[FromQuery] int? userId` — verified.
   *
   * The route param stays `foId` (TeamManagementScreen navigates with it) and
   * now only seeds the picker, so a manager can change it in-screen.
   */
  const [userFilter, setUserFilter] = useState<string>(
    route?.params?.foId ? String(route.params.foId) : '',
  );
  const [openUserDd, setOpenUserDd] = useState(false);

  const userIdFilter: number | undefined =
    userFilter === 'mine' ? myUserId : userFilter ? Number(userFilter) : undefined;

  const [leads, setLeads] = useState<LeadListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LeadFilter>('All');
  const [openFilter, setOpenFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Notification permission banner
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    messaging().hasPermission().then((status) => {
      const granted =
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL;
      if (!granted) setShowNotifBanner(true);
    }).catch(() => {});
  }, []);

  const handleEnableNotifications = async () => {
    try {
      await requestFCMPermission();
    } catch {}
    setShowNotifBanner(false);
  };

  // Assign modal
  const [fos, setFos] = useState<UserDto[]>([]);
  const [assignModal, setAssignModal] = useState<{ leadId: number; school: string; currentFoId?: number } | null>(null);
  const [selectedFoId, setSelectedFoId] = useState<string | number>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isManager) {
      leadsApi.getAssignableFOs().then((r) => setFos(Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [])).catch(() => {});
    }
  }, [isManager]);

  // The CRUD kit's Dropdown has no <optgroup>, so web's role grouping becomes a
  // role-ordered list with the group label appended to each name.
  const userFilterOptions = useMemo(() => {
    const rest = fos
      .filter(u => u.id !== myUserId)
      .sort((a, b) => {
        const d = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
        return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
      })
      .map(u => {
        const scope = (u as any).zone || (u as any).region;
        return {
          label: `${u.name}${scope ? ` (${scope})` : ''} · ${ROLE_LABEL[u.role] || u.role}`,
          value: String(u.id),
        };
      });
    return [
      { label: 'All in my scope', value: '' },
      { label: 'My leads only', value: 'mine' },
      ...rest,
    ];
  }, [fos, myUserId]);

  const userFilterLabel =
    userFilter === ''
      ? 'All in my scope'
      : userFilter === 'mine'
        ? 'My leads only'
        : fos.find(u => String(u.id) === userFilter)?.name || 'Selected user';

  const fetchLeads = useCallback(async (pg = 1) => {
    try {
      const stage = filter === 'Won' ? 'Won' : undefined;
      const res = await leadsApi.getLeads({ page: pg, pageSize: PAGE_SIZE, search: search || undefined, stage, userId: userIdFilter });
      const items = res.data?.items ?? [];
      let filtered = items;
      if (filter === 'Active') filtered = items.filter(l => !['Won', 'Lost'].includes(l.stage));
      // Legend everywhere reads ">70" but PipelineKanban uses `score >= 70` — keep
      // `>= 70` so the Hot filter and the Kanban's hot border agree. Web's
      // LeadsList.jsx still uses `> 70`; see the report for the change needed there.
      if (filter === 'Hot') filtered = items.filter(l => l.score >= 70);
      /**
       * "Unassigned" means "no FO assigned". LeadListDto.FoId is a NON-nullable
       * int (0 when unset), AssignedById is `int?` and means "who assigned it"
       * (null = self-created). Web filters `!lead.assignedById`, which is the
       * wrong semantic for this label — mobile keeps `!l.foId`.
       */
      if (filter === 'Unassigned') filtered = items.filter(l => !l.foId);
      setLeads(filtered);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotalCount(res.data?.totalCount ?? 0);
    } catch {
      setLeads([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filter, userIdFilter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchLeads(1);
  }, [fetchLeads]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    setLoading(true);
    fetchLeads(p);
  };

  const handleAssign = async () => {
    if (!selectedFoId || !assignModal) return;
    setAssigning(true);
    try {
      await leadsApi.assignLead(assignModal.leadId, Number(selectedFoId));
      setAssignModal(null);
      fetchLeads(page);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign lead');
    } finally {
      setAssigning(false);
    }
  };

  const handleExport = async () => {
    if (leads.length === 0) return;
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['School Name', 'City', 'Board', 'Assigned FO', 'Assigned By', 'Stage', 'Lead Score', 'Est. Value', 'Last Activity'];
    const rows = leads.map(l => [
      l.school, l.city, l.board, l.foName || '', l.assignedByName || '',
      STAGE_LABELS[l.stage] || l.stage, l.score, l.value,
      l.lastActivityDate ? formatDate(l.lastActivityDate) : '',
    ].map(esc).join(','));
    const csv = [head.map(esc).join(','), ...rows].join('\n');
    try {
      await RNShare.open({ title: 'Export Leads', subject: 'Leads Export', message: csv, failOnCancel: false });
    } catch (err: any) {
      if (err?.message !== 'User did not share') Alert.alert('Error', 'Failed to export leads');
    }
  };

  const openDetail = (id: number) => navigation.navigate('LeadDetail', { leadId: id });

  const openAssign = (lead: LeadListDto) => {
    setAssignModal({ leadId: lead.id, school: lead.school, currentFoId: lead.foId ?? undefined });
    setSelectedFoId('');
  };

  // ── row bits ──
  const scoreCell = (score: number) => (
    <View style={s.scoreCell}>
      <Text style={[s.scoreTxt, { color: getScoreColor(score) }]}>{score}</Text>
      <ProgressBar value={score} height={6} color={getScoreColor(score)} trackColor={T.cardAlt} style={s.scoreBar} />
    </View>
  );

  const rowActions = (lead: LeadListDto) => (
    <View style={s.actions}>
      {/* Web parity: LeadsList.jsx gates only the assign button behind isManager. */}
      {isManager && (
        <IconBtn kind="view" label="Assign / Reassign" onPress={() => openAssign(lead)}>
          <UserCheck size={14} color={T.accent} strokeWidth={ICON_STROKE} />
        </IconBtn>
      )}
      <Btn label="View" variant="soft" small onPress={() => openDetail(lead.id)} />
    </View>
  );

  // ── table (tablet) ──
  const renderTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cName]}>School Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cBoard]}>Board</Text>
        <Text style={[s.th, { color: T.dim }, s.cFo]}>Assigned FO</Text>
        <Text style={[s.th, { color: T.dim }, s.cStage]}>Stage</Text>
        <Text style={[s.th, { color: T.dim }, s.cScore]}>Lead Score</Text>
        <Text style={[s.th, { color: T.dim }, s.cValue]}>Est. Value</Text>
        <Text style={[s.th, { color: T.dim }, s.cAct]}>Last Activity</Text>
        {/* header <Text> ignores alignItems — keep the actions column left-aligned too */}
        <Text style={[s.th, { color: T.dim }, s.cActions]} />
      </View>

      {leads.map(lead => {
        const overdue = isOverdue(lead.lastActivityDate, 5) && !['Won', 'Lost'].includes(lead.stage);
        return (
          <TouchableOpacity
            key={lead.id}
            activeOpacity={0.7}
            onPress={() => openDetail(lead.id)}
            style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
          >
            <View style={[s.cName, s.nameCell]}>
              <Avatar initials={initialsOf(lead.school)} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{lead.school}</Text>
                <View style={s.subRow}>
                  <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                  <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{lead.city || DASH}</Text>
                </View>
              </View>
            </View>

            <View style={s.cBoard}>
              {lead.board ? <StatusBadge label={lead.board} color={T.info} /> : <Text style={[s.td, { color: T.dim }]}>{DASH}</Text>}
            </View>

            <View style={s.cFo}>
              <Text style={[s.td, { color: lead.foName ? T.text : T.dim }]} numberOfLines={1}>
                {lead.foName || 'Unassigned'}
              </Text>
              {!!lead.assignedByName && (
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>by {lead.assignedByName}</Text>
              )}
            </View>

            <View style={s.cStage}>
              <StatusBadge label={STAGE_LABELS[lead.stage] || lead.stage} color={STAGE_COLORS[lead.stage]} />
            </View>

            <View style={s.cScore}>{scoreCell(lead.score)}</View>

            <Text style={[s.tdName, { color: T.text }, s.cValue]} numberOfLines={1}>{formatCurrency(lead.value)}</Text>

            <Text
              style={[s.td, { color: overdue ? T.danger : T.sub }, overdue && s.bold, s.cAct]}
              numberOfLines={1}
            >
              {overdue ? '! ' : ''}{lead.lastActivityDate ? formatRelativeDate(lead.lastActivityDate) : DASH}
            </Text>

            <View style={s.cActions}>{rowActions(lead)}</View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {leads.map(lead => {
        const overdue = isOverdue(lead.lastActivityDate, 5) && !['Won', 'Lost'].includes(lead.stage);
        return (
          <ListCard key={lead.id} onPress={() => openDetail(lead.id)} style={s.rowCard}>
            <Avatar initials={initialsOf(lead.school)} />
            <View style={{ flex: 1, gap: 5 }}>
              <View style={s.rowTop}>
                <Text style={[s.tdName, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{lead.school}</Text>
                <StatusBadge label={STAGE_LABELS[lead.stage] || lead.stage} color={STAGE_COLORS[lead.stage]} />
              </View>

              <View style={s.subRow}>
                <MapPin size={10} color={T.dim} strokeWidth={ICON_STROKE} />
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
                  {[lead.city, lead.board].filter(Boolean).join(' • ') || DASH}
                </Text>
              </View>

              <Text style={[s.tdSub, { color: lead.foName ? T.sub : T.dim }]} numberOfLines={1}>
                {lead.foName || 'Unassigned'}{lead.assignedByName ? ` · by ${lead.assignedByName}` : ''}
              </Text>

              {scoreCell(lead.score)}

              <View style={s.rowFooter}>
                <Text style={[s.tdName, { color: T.text }]}>{formatCurrency(lead.value)}</Text>
                <Text style={[s.tdSub, { color: overdue ? T.danger : T.dim }, overdue && s.bold]}>
                  {overdue ? '! ' : ''}{lead.lastActivityDate ? formatRelativeDate(lead.lastActivityDate) : DASH}
                </Text>
              </View>

              <View style={s.rowActions}>{rowActions(lead)}</View>
            </View>
          </ListCard>
        );
      })}
    </View>
  );

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
            onRefresh={() => { setRefreshing(true); fetchLeads(page); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {showNotifBanner && (
          <View style={[s.notif, { backgroundColor: T.accent }]}>
            <Bell size={16} color="#FFF" strokeWidth={ICON_STROKE} />
            <Text style={s.notifTxt} numberOfLines={2}>
              Enable push notifications to stay updated on leads, deals, and approvals
            </Text>
            <TouchableOpacity style={s.notifBtn} onPress={handleEnableNotifications}>
              <Text style={[s.notifBtnTxt, { color: T.accent }]}>Enable</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNotifBanner(false)} hitSlop={8}>
              <X size={16} color="#FFF" strokeWidth={ICON_STROKE} />
            </TouchableOpacity>
          </View>
        )}

        {/* Header: view toggle + export */}
        <View style={[s.header, wide && s.headerWide]}>
          <Segmented<ViewMode>
            value="list"
            onChange={v => { if (v === 'pipeline') navigation.navigate('Pipeline'); }}
            style={wide ? { width: 200 } : undefined}
            options={[{ label: 'List', value: 'list' }, { label: 'Pipeline', value: 'pipeline' }]}
          />
          <View style={s.headerBtns}>
            <Btn
              label="Export"
              variant="secondary"
              small
              onPress={handleExport}
              icon={<Download size={14} color={T.text} strokeWidth={ICON_STROKE} />}
            />
          </View>
        </View>

        {/* Search + filter + count */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search by school, city, board, or contact..."
              style={{ flex: 1, minWidth: 180 }}
            />
            <Trigger
              label={filter === 'All' ? 'Filter' : filter}
              open={openFilter}
              onPress={() => { setOpenFilter(v => !v); setOpenUserDd(false); }}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
            {/* Web parity, verbatim gate: LeadsList.jsx uses `isManager = user.role !== 'FO'`. */}
            {isManager && (
              <Trigger
                label={userFilterLabel}
                open={openUserDd}
                onPress={() => { setOpenUserDd(v => !v); setOpenFilter(false); }}
                icon={<Users size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
              />
            )}
          </View>

          {openFilter && (
            <Dropdown<LeadFilter>
              style={{ width: '100%' }}
              value={filter}
              onSelect={v => { setFilter(v); setOpenFilter(false); }}
              options={FILTERS.map(f => ({ label: f, value: f }))}
            />
          )}

          {isManager && openUserDd && (
            <Dropdown
              style={{ width: '100%' }}
              maxHeight={260}
              value={userFilter}
              onSelect={v => { setUserFilter(v); setOpenUserDd(false); }}
              options={userFilterOptions}
            />
          )}

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>
              {totalCount} lead{totalCount === 1 ? '' : 's'} found
            </Text>
            {filter !== 'All' && <FilterChip label={filter} onRemove={() => setFilter('All')} />}
            {isManager && userFilter !== '' && (
              <FilterChip label={userFilterLabel} onRemove={() => setUserFilter('')} />
            )}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : leads.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Icon name="Leads" size={34} color={T.dim} />
            <Text style={[s.emptyTitle, { color: T.text }]}>No leads found</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Try adjusting your search or filters.</Text>
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

      {/* Assign / Reassign */}
      <FormModal
        visible={!!assignModal}
        title="Assign / Reassign Lead"
        onClose={() => setAssignModal(null)}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => setAssignModal(null)} style={{ flex: 1 }} />
            <Btn
              label={assigning ? 'Assigning...' : 'Assign'}
              onPress={handleAssign}
              loading={assigning}
              disabled={!selectedFoId || assigning}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={s.mForm}>
          <Text style={[s.mSub, { color: T.sub }]}>
            Assign <Text style={[s.mSubBold, { color: T.text }]}>{assignModal?.school}</Text> to a Field Officer:
          </Text>
          <SelectPicker
            label="Select Field Officer"
            options={fos.map((fo) => ({
              label: `${fo.name}${(fo as any).zone ? ` (${(fo as any).zone})` : ''}${fo.id === assignModal?.currentFoId ? ' (Current)' : ''}`,
              value: fo.id,
            }))}
            value={selectedFoId}
            onChange={(v) => setSelectedFoId(v)}
            accentColor={T.accent}
          />
        </View>
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  // table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line · pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  bold: { fontWeight: '700' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  cName: { flex: 2.4 },
  cBoard: { flex: 1 },
  cFo: { flex: 1.4 },
  cStage: { flex: 1.2 },
  cScore: { flex: 1.3 },
  cValue: { flex: 1.1 },
  cAct: { flex: 1.1 },
  cActions: { width: 108 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreTxt: { fontSize: rf(13), fontWeight: '700' },
  scoreBar: { flex: 1, maxWidth: 64 },

  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  notif: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  notifTxt: { flex: 1, color: '#FFF', fontSize: rf(12), fontWeight: '600' },
  notifBtn: { backgroundColor: '#FFF', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  notifBtnTxt: { fontSize: rf(12), fontWeight: '700' },

  mForm: { gap: 14 },
  mSub: { fontSize: rf(13), fontWeight: '500' },
  mSubBold: { fontWeight: '700' },
});
