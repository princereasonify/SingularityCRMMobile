import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, CheckCheck, Clock } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  SearchBar, Segmented, Pagination, ListCard, Avatar, StatusBadge, Checkbox, Btn, FormModal,
} from '../../components/crud';
import { StatTile } from '../../components/ui';
import { b2cAllowanceService, B2CAllowanceClaim, B2CAllowanceSummary } from '../../api/b2c/b2cAllowanceService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { useResponsive, Responsive, gridCardWidth } from '../../hooks/useResponsive';

/**
 * Allowance Approvals (B2CAdmin only) — web parity: B2CAllowances.jsx, the admin claims-review
 * screen. `b2cAllowanceService.getClaims/approve/reject/bulkApprove` already matched the
 * backend exactly and had done so for a while — but no screen anywhere in the mobile app ever
 * called them, so a B2CAdmin could not approve, reject, or bulk-approve an agent's or
 * counselor's travel/visit allowance claim from mobile at all; they had to switch to web for
 * this one workflow. This screen closes that gap, built on the exact same pattern already
 * proven by B2CApprovalCenterScreen.tsx (leave approvals) and B2CTeamApprovalsScreen.tsx.
 */
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

const fmtRupee = (v?: number) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

export const B2CAllowanceApprovalsScreen = () => {
  const T = useAppTheme();
  const r = useResponsive();
  const toast = useToast();

  const [rows, setRows] = useState<B2CAllowanceClaim[]>([]);
  const [summary, setSummary] = useState<B2CAllowanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Pending');

  // Selection (bulk approve — pending rows only)
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Approve / reject action modal
  const [action, setAction] = useState<{ row: B2CAllowanceClaim; type: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async (pg = 1) => {
    try {
      const res = await b2cAllowanceService.getClaims({
        page: pg,
        pageSize: PAGE_SIZE,
        status: status || undefined,
      });
      const data = res.data;
      setRows(data?.items ?? []);
      setSummary(data?.summary ?? null);
      setTotalCount(data?.totalCount ?? 0);
      setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE)));
    } catch {
      setRows([]); setSummary(null); setTotalCount(0); setTotalPages(1);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true); setPage(1); setSelected(new Set()); fetchList(1);
  }, [fetchList]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); setSelected(new Set()); fetchList(p);
  };

  const reload = () => fetchList(page);

  // Client-side search on the current page (same convention as B2CApprovalCenterScreen).
  const visible = search.trim()
    ? rows.filter(row => (row.userName || '').toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const pendingIds = visible.filter(row => row.status === 'Pending').map(row => row.id);
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
      if (action.type === 'approve') await b2cAllowanceService.approve(action.row.id, note.trim() || undefined);
      else await b2cAllowanceService.reject(action.row.id, note.trim() || undefined);
      const wasApprove = action.type === 'approve';
      setAction(null); setNote('');
      toast.success(wasApprove ? 'Claim approved' : 'Claim rejected');
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
      await b2cAllowanceService.bulkApprove([...selected]);
      setSelected(new Set());
      toast.success(`Approved ${count} claim${count === 1 ? '' : 's'}`);
      reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not approve the selected claims.');
    } finally { setBusy(false); }
  };

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  // Two cards per row on a tablet, one on a phone — same rule every B2C list screen uses.
  const cardW = gridCardWidth(r, visible.length);

  const s = useMemo(() => makeStyles(r), [r]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={T.accent} colors={[T.accent]} />}
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Travel &amp; visit allowance claims from your agents and counselors</Text>

        {/* Summary tiles */}
        <View style={s.statRow}>
          <StatTile style={s.stat} label="Pending" value={summary?.pendingCount ?? 0} icon={<Clock size={16} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={s.stat} label="Pending Amt" value={fmtRupee(summary?.pendingAmount)} tint={T.warning} />
          <StatTile style={s.stat} label="Approved Amt" value={fmtRupee(summary?.approvedAmount)} tint={T.success} />
          <StatTile style={s.stat} label="Total Claims" value={summary?.totalClaims ?? totalCount ?? 0} />
        </View>

        {/* Filters */}
        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search by agent or counselor…" />

          <Segmented value={status} options={STATUS_OPTIONS} onChange={v => setStatus(v)} />

          <View style={s.countRow}>
            <Text style={[s.count, { color: T.dim }]}>{totalCount} claim{totalCount === 1 ? '' : 's'}</Text>
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
            <Text style={[s.emptyTxt, { color: T.dim }]}>Try adjusting the status filter.</Text>
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
                        {fmtDate(row.claimDate)} · {row.visitCount} visit{row.visitCount === 1 ? '' : 's'} · {row.distanceKm.toFixed(1)} km
                      </Text>
                      <Text style={[s.amount, { color: T.text }]}>{fmtRupee(row.amount)}</Text>
                      {!!row.notes && <Text style={[s.sub, { color: T.dim }]} numberOfLines={2}>{row.notes}</Text>}
                      {!isPending && !!row.reviewNote && (
                        <Text style={[s.sub, { color: T.dim }]} numberOfLines={2}>Review: {row.reviewNote}</Text>
                      )}
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
        title={action?.type === 'approve' ? 'Approve claim' : 'Reject claim'}
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
              {action.row.userName} · {fmtDate(action.row.claimDate)} · {fmtRupee(action.row.amount)}
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
 * Styles are a function of the live layout metrics, not a module-level constant — same
 * convention as every other B2C screen (see B2CApprovalCenterScreen.tsx for why).
 */
const makeStyles = (r: Responsive) => StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: r.gutter, gap: r.gap, maxWidth: r.maxContentWidth, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap, alignItems: 'flex-start' },
  subtitle: { fontSize: r.rf(12.5), fontWeight: '500' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: r.gap },
  stat: { flexGrow: 1, flexBasis: r.isTablet ? '22%' : '47%' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: r.rf(11.5), fontWeight: '600' },
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: r.rf(13.5), fontWeight: '700' },
  sub: { fontSize: r.rf(11.5), fontWeight: '500' },
  amount: { fontSize: r.rf(15), fontWeight: '800', marginTop: 2 },
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
