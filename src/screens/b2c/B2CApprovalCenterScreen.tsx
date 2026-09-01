import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Filter, Check, X, CheckCheck, Clock } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Trigger, Dropdown, Segmented, Pagination, ListCard, Avatar, StatusBadge, Checkbox, Btn, FormModal,
} from '../../components/crud';
import { StatTile } from '../../components/ui';
import { b2cLeaveService } from '../../api/b2c/b2cLeaveService';
import { b2cUserService } from '../../api/b2c/b2cUserService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive } from '../../hooks/useResponsive';

/** Web parity: B2CApprovalCenter.jsx — leave approvals only, pages 20 at a time. */
const PAGE_SIZE = 20;
const DASH = '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type StatusFilter = '' | 'Pending' | 'Approved' | 'Rejected';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
];

const fmtDate = (d?: string) => {
  if (!d) return DASH;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return DASH;
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

export const B2CApprovalCenterScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();

  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Pending');
  const [userId, setUserId] = useState('');
  const [openUser, setOpenUser] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Selection (bulk approve — pending rows only)
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Approve / reject action modal
  const [action, setAction] = useState<{ row: any; type: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    b2cUserService.getUsers({ page: 1, pageSize: 200 })
      .then(res => setUsers(res.data?.items ?? res.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const fetchList = useCallback(async (pg = 1) => {
    try {
      const res = await b2cLeaveService.getAll({
        page: pg,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        userId: userId || undefined,
      });
      setRows(res.data?.items ?? []);
      setSummary(res.data?.summary ?? {});
      setTotalCount(res.data?.totalCount ?? 0);
      setTotalPages(res.data?.totalPages ?? Math.max(1, Math.ceil((res.data?.totalCount ?? 0) / PAGE_SIZE)));
    } catch {
      setRows([]); setSummary({}); setTotalCount(0); setTotalPages(1);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status, userId]);

  useEffect(() => {
    setLoading(true); setPage(1); setSelected(new Set()); fetchList(1);
  }, [fetchList]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); setSelected(new Set()); fetchList(p);
  };

  const reload = () => fetchList(page);

  // Client-side search on the current page (web filters server-side by user;
  // the search box is a mobile convenience over the loaded rows).
  const visible = search.trim()
    ? rows.filter(row => (row.userName || '').toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const pendingIds = visible.filter(row => row.status === 'Pending').map(row => row.id as number);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selected.has(id));

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => setSelected(allPendingSelected ? new Set() : new Set(pendingIds));

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.type === 'approve') await b2cLeaveService.approve(action.row.id, note.trim() || undefined);
      else await b2cLeaveService.reject(action.row.id, note.trim() || undefined);
      const wasApprove = action.type === 'approve';
      setAction(null); setNote('');
      toast.success(wasApprove ? 'User approved' : 'User rejected');
      reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not complete the action.');
    } finally { setBusy(false); }
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const count = selected.size;
    try {
      await b2cLeaveService.bulkApprove([...selected]);
      setSelected(new Set());
      toast.success(`Approved ${count} users`);
      reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not approve the selected requests.');
    } finally { setBusy(false); }
  };

  const selectedUser = users.find(u => String(u.id) === userId);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  // Two cards per row on a tablet, one on a phone — these rows carry far too many fields
  // to survive as table columns. Width is computed rather than a percentage: `49%` twice
  // plus the gap overflows the row and silently collapses the grid back to one column.
  const cardW: number | '100%' = r.isTablet
    ? (Math.min(r.width, r.maxContentWidth) - r.gutter * 2 - r.gap) / 2
    : '100%';

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        {/* Summary tiles */}
        <View style={s.statRow}>
          <StatTile style={s.stat} label="Pending" value={summary.pendingCount ?? 0} icon={<Clock size={16} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={s.stat} label="Approved" value={summary.approvedCount ?? 0} tint={T.success} />
          <StatTile style={s.stat} label="Rejected" value={summary.rejectedCount ?? 0} tint={T.danger} />
          <StatTile style={s.stat} label="Total" value={summary.totalRequests ?? totalCount ?? 0} />
        </View>

        {/* Filters */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={s.searchRow}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search by user…" style={{ flex: 1, minWidth: 180 }} />
            <Trigger label={selectedUser ? selectedUser.name : 'All users'} open={openUser} onPress={() => setOpenUser(v => !v)} icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />} />
          </View>

          {openUser && (
            <Dropdown style={{ width: '100%' }} maxHeight={280} value={userId}
              onSelect={v => { setUserId(v); setOpenUser(false); }}
              options={[{ label: 'All users', value: '' }, ...users.map(u => ({ label: `${u.name}${u.role ? ` (${u.role})` : ''}`, value: String(u.id) }))]} />
          )}

          <Segmented value={status} options={STATUS_OPTIONS} onChange={v => setStatus(v)} />

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>{totalCount} request{totalCount === 1 ? '' : 's'}</Text>
            {selected.size > 0 && (
              <Btn label={`Approve selected (${selected.size})`} onPress={bulkApprove} loading={busy}
                icon={<CheckCheck size={14} color="#FFF" strokeWidth={ICON_STROKE} />} />
            )}
          </View>

          {pendingIds.length > 0 && (
            <Checkbox on={allPendingSelected} onToggle={toggleSelectAll} label="Select all pending" />
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : visible.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>Nothing to review here</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>Try adjusting the status or user filter.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {visible.map(row => {
                const isPending = row.status === 'Pending';
                return (
                  <ListCard key={row.id} style={[s.rowCard, { width: cardW }]}>
                    {isPending && (
                      <Checkbox on={selected.has(row.id)} onToggle={() => toggleSelect(row.id)} />
                    )}
                    <Avatar initials={initialsOf(row.userName)} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.name, { color: T.text }, { flex: 1 }]} numberOfLines={1}>{row.userName || DASH}</Text>
                        <StatusBadge label={row.status} color={statusColor(row.status, T)} />
                      </View>
                      {!!row.userRole && <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>{row.userRole}</Text>}
                      <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>
                        {row.leaveType || 'Leave'} · {row.days} day{row.days === 1 ? '' : 's'}
                      </Text>
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                        {fmtDate(row.fromDate)} {DASH} {fmtDate(row.toDate)}
                      </Text>
                      {!!row.reason && <Text style={[s.sub, { color: T.dim }]} numberOfLines={2}>{row.reason}</Text>}
                      {isPending && (
                        <View style={s.actionRow}>
                          <Btn label="Approve" variant="success" style={{ flex: 1 }}
                            onPress={() => { setAction({ row, type: 'approve' }); setNote(''); }}
                            icon={<Check size={14} color="#FFF" strokeWidth={ICON_STROKE} />} />
                          <Btn label="Reject" variant="dangerGhost" style={{ flex: 1 }}
                            onPress={() => { setAction({ row, type: 'reject' }); setNote(''); }}
                            icon={<X size={14} color={T.danger} strokeWidth={ICON_STROKE} />} />
                        </View>
                      )}
                    </View>
                  </ListCard>
                );
              })}
            </View>

            {totalPages > 1 && (
              <View style={s.pgRow}>
                <Text style={[s.count, { color: T.dim }]}>Showing {from}{DASH}{to} of {totalCount}</Text>
                <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Approve / reject modal with optional note */}
      <FormModal
        wide={r.isTablet}
        visible={!!action}
        title={action?.type === 'approve' ? 'Approve request' : 'Reject request'}
        onClose={() => { setAction(null); setNote(''); }}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => { setAction(null); setNote(''); }} disabled={busy} style={{ flex: 1 }} />
            <Btn
              label={busy ? 'Working…' : action?.type === 'approve' ? 'Approve' : 'Reject'}
              variant={action?.type === 'reject' ? 'danger' : 'success'}
              onPress={runAction}
              loading={busy}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {action && (
          <View style={{ gap: 12 }}>
            <Text style={[s.modalSummary, { color: T.sub }]}>
              {action.row.userName} · {action.row.leaveType || 'Leave'} · {action.row.days} day{action.row.days === 1 ? '' : 's'}
            </Text>
            <View style={{ gap: 7 }}>
              <Text style={[s.flabel, { color: T.text }]}>Note (optional)</Text>
              <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note…"
                  placeholderTextColor={T.dim}
                  multiline
                  style={[s.textareaTxt, { color: T.text }]}
                />
              </View>
            </View>
          </View>
        )}
      </FormModal>
    </SafeAreaView>
  );
};


/**
 * Styles are a function of the live layout metrics, not a module-level constant: a
 * `StyleSheet.create` evaluated at import freezes every font size and padding at the launch
 * orientation, which is what leaves an iPad clipped and overlapping after a rotation.
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  safe: { flex: 1 },
  // Gutter/gap follow the device; the cap keeps a full-bleed iPad line readable.
  scroll: { padding: r.gutter, gap: r.gap, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  stat: { flexGrow: 1, flexBasis: r.isTablet ? '22%' : '47%' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: r.rf(11.5), fontWeight: '600' },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: r.rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: r.rf(12.5), fontWeight: '500', textAlign: 'center' },
  modalSummary: { fontSize: r.rf(12.5), fontWeight: '500' },
  flabel: { fontSize: r.rf(12.5), fontWeight: '600' },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: r.rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
});

export default B2CApprovalCenterScreen;
