import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Clock } from 'lucide-react-native';
import { ICON_STROKE } from '../../components/common/Icon';
import { Btn, Field, SearchBar, Segmented, Pagination, ListCard, Avatar, StatusBadge, FormModal } from '../../components/crud';
import { StatTile } from '../../components/ui';
import { b2cLeaveService } from '../../api/b2c/b2cLeaveService';
import { useToast } from '../../context/ToastContext';
import { useAppTheme } from '../../theme/useAppTheme';
import { rf } from '../../utils/responsive';

/** Web parity: B2CTeamApprovals.jsx — manager review queue for agents' leave requests. */
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
] as const;

interface TeamLeaveRow {
  id: number;
  userName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days?: number;
  status: string;
}

interface TeamSummary {
  pendingCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  totalRequests?: number;
}

const initialsOf = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Web: statusTag { Pending:'warn', Approved:'positive', Rejected:'negative' }
const statusColor = (status: string, T: any) =>
  status === 'Approved' ? T.success : status === 'Rejected' ? T.danger : T.warning;

export const B2CTeamApprovalsScreen = () => {
  const T = useAppTheme();
  const toast = useToast();

  const [rows, setRows] = useState<TeamLeaveRow[]>([]);
  const [summary, setSummary] = useState<TeamSummary>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('Pending');
  const [search, setSearch] = useState('');

  // Action modal: { row, type }
  const [action, setAction] = useState<{ row: TeamLeaveRow; type: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (pg = page, st = status) => {
    try {
      const res = await b2cLeaveService.getTeam({ page: pg, pageSize: PAGE_SIZE, status: st || undefined });
      const payload: any = res.data;
      setRows(payload?.items ?? []);
      setTotal(payload?.totalCount ?? 0);
      setSummary(payload?.summary ?? {});
    } catch {
      setRows([]); setTotal(0); setSummary({});
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [page, status]);

  useEffect(() => { setLoading(true); load(1, status); setPage(1); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p); setLoading(true); load(p, status);
  };

  const openAction = (row: TeamLeaveRow, type: 'approve' | 'reject') => {
    setAction({ row, type }); setNote(''); setError('');
  };

  const runAction = async () => {
    if (!action) return;
    setBusy(true); setError('');
    try {
      if (action.type === 'approve') await b2cLeaveService.teamApprove(action.row.id, note || undefined);
      else await b2cLeaveService.teamReject(action.row.id, note || undefined);
      setAction(null); setNote('');
      toast.success(action.type === 'approve' ? 'Leave approved' : 'Leave rejected');
      load(page, status);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Action failed');
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter(r => `${r.userName} ${r.leaveType}`.toLowerCase().includes(q))
    : rows;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(page, status); }} tintColor={T.accent} colors={[T.accent]} />
        }
      >
        <Text style={[s.subtitle, { color: T.sub }]}>Leave requests from your agents</Text>

        {/* KPI summary — 2×2 grid, full width */}
        <View style={s.statGrid}>
          <StatTile style={s.stat} label="Pending" value={summary.pendingCount ?? 0} icon={<Clock size={16} color={T.warning} strokeWidth={ICON_STROKE} />} tint={T.warning} />
          <StatTile style={s.stat} label="Approved" value={summary.approvedCount ?? 0} tint={T.success} />
          <StatTile style={s.stat} label="Rejected" value={summary.rejectedCount ?? 0} tint={T.danger} />
          <StatTile style={s.stat} label="Total" value={summary.totalRequests ?? 0} />
        </View>

        <Field label="Status">
          <Segmented
            value={status}
            options={STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
            onChange={v => setStatus(v)}
          />
        </Field>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by agent or type…" />

        {loading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : visible.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Text style={[s.emptyTitle, { color: T.text }]}>No leave requests</Text>
            <Text style={[s.emptyTxt, { color: T.dim }]}>
              {q ? 'No requests match your search.' : 'No leave requests from your team.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              {visible.map(l => {
                const isPending = l.status === 'Pending';
                return (
                  <ListCard key={l.id} style={{ alignItems: 'flex-start' }}>
                    <Avatar initials={initialsOf(l.userName)} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.name, { color: T.text, flex: 1 }]} numberOfLines={1}>{l.userName}</Text>
                        <StatusBadge label={l.status} color={statusColor(l.status, T)} />
                      </View>
                      <Text style={[s.sub, { color: T.sub }]} numberOfLines={1}>
                        {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                      </Text>
                      <Text style={[s.sub, { color: T.dim }]} numberOfLines={1}>
                        {l.leaveType} · {(l.days ?? 0)} day{(l.days ?? 0) === 1 ? '' : 's'}
                      </Text>
                      {isPending && (
                        <View style={s.actionRow}>
                          <Btn
                            small
                            variant="success"
                            label="Approve"
                            onPress={() => openAction(l, 'approve')}
                            icon={<Check size={14} color="#FFF" strokeWidth={2.4} />}
                            style={{ flex: 1 }}
                          />
                          <Btn
                            small
                            variant="dangerGhost"
                            label="Reject"
                            onPress={() => openAction(l, 'reject')}
                            icon={<X size={14} color={T.danger} strokeWidth={2.4} />}
                            style={{ flex: 1 }}
                          />
                        </View>
                      )}
                    </View>
                  </ListCard>
                );
              })}
            </View>
            {totalPages > 1 && !q && (
              <View style={s.pgRow}><Pagination page={page} pageCount={totalPages} onChange={goToPage} /></View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Approve / reject modal with optional note */}
      <FormModal
        visible={!!action}
        title={action?.type === 'approve' ? 'Approve leave' : 'Reject leave'}
        onClose={() => { setAction(null); setError(''); }}
        footer={
          <>
            <Btn label="Cancel" variant="secondary" onPress={() => { setAction(null); setError(''); }} disabled={busy} style={{ flex: 1 }} />
            <Btn
              label={busy ? 'Working…' : action?.type === 'approve' ? 'Approve' : 'Reject'}
              variant={action?.type === 'reject' ? 'danger' : 'success'}
              onPress={runAction}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          {!!error && (
            <View style={[s.errBox, { backgroundColor: T.danger + '1A', borderColor: T.danger }]}>
              <Text style={[s.errTxt, { color: T.danger }]}>{error}</Text>
            </View>
          )}
          {action && (
            <Text style={[s.sub, { color: T.sub }]}>
              {action.row.userName} · {action.row.leaveType} · {(action.row.days ?? 0)} day{(action.row.days ?? 0) === 1 ? '' : 's'}
            </Text>
          )}
          <Field label="Note (optional)">
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
          </Field>
        </View>
      </FormModal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  subtitle: { fontSize: rf(12.5), fontWeight: '500' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', minWidth: 140 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: rf(13.5), fontWeight: '700' },
  sub: { fontSize: rf(11.5), fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pgRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },
  errBox: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  errTxt: { fontSize: rf(12.5), fontWeight: '600' },
  textarea: { minHeight: 72, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 52 },
});
