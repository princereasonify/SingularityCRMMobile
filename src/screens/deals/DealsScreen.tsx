import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput, useWindowDimensions,
} from 'react-native';
import { Plus, CheckCircle2, XCircle, Filter, Inbox } from 'lucide-react-native';
import { dealsApi } from '../../api/deals';
import { DealDto, UserDto } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errorMessage';
import {
  Btn, Segmented, Trigger, Dropdown, StatusBadge, Pagination, ListCard, FormModal, Field,
} from '../../components/crud';
import { ICON_STROKE } from '../../components/common/Icon';
import { APPROVAL_LABELS, APPROVER_ROLE, stageLabel } from '../../utils/constants';
import { rf, isTabletDevice } from '../../utils/responsive';
import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme, withAlpha, SOFT_TINT } from '../../theme';

/**
 * Deals — port of web's pages/common/Deals.jsx.
 *
 * One screen for every B2B role: the deals in your scope (GET /deals, server-scoped and
 * filterable by status) and, for approvers, an "Awaiting my decision" tab fed by
 * GET /deals/pending-approvals and narrowed client-side by canDecide(). Approve/reject
 * happens in the detail modal. This replaces the separate Deal Approvals screen — web has
 * no such page; the tab here is its equivalent.
 */

const PAGE_SIZE = 10;
const DASH = '—';
const PENDING = ['PendingZH', 'PendingRH', 'PendingSH'];
const LEVEL: Record<string, number> = { ZH: 1, RH: 2, SH: 3, SCA: 4 };

const rupees = (v?: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : DASH;

/** Web's status <Select>: '' = all; 'pending'/'approved' are server-side groups. */
const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Awaiting approval', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Draft', value: 'Draft' },
];

type Tab = 'queue' | 'all';

/**
 * Whether `user` may decide `deal` — mirrors DealService.ApproveDealAsync: a pending deal,
 * not on your own lead, and your level at or above the one it waits on (the server also
 * checks you manage the owner).
 */
function canDecide(deal: DealDto, user: UserDto | null): boolean {
  if (!PENDING.includes(deal.approvalStatus)) return false;
  if (String(deal.foId) === String(user?.id)) return false;
  const need = LEVEL[APPROVER_ROLE[deal.approvalStatus] || ''] || 99;
  return (LEVEL[user?.role || ''] || 0) >= need;
}

const statusColor = (status: string, T: AppTheme) => {
  const tone = APPROVAL_LABELS[status as keyof typeof APPROVAL_LABELS]?.tone;
  return tone === 'positive' ? T.success : tone === 'warn' ? T.warning : tone === 'negative' ? T.danger : T.dim;
};

const StatusTag = ({ status }: { status: string }) => {
  const T = useAppTheme();
  const label = APPROVAL_LABELS[status as keyof typeof APPROVAL_LABELS]?.label || status;
  return <StatusBadge label={label} color={statusColor(status, T)} />;
};

const DetailRow = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => {
  const T = useAppTheme();
  return (
    <View style={[s.bdRow, { borderBottomColor: T.line }]}>
      <Text style={[s.bdLabel, { color: strong ? T.accent : T.sub }, strong && s.bold]}>{label}</Text>
      <Text style={[s.bdValue, { color: strong ? T.accent : T.text }]}>{value}</Text>
    </View>
  );
};

const Meta = ({ label, value }: { label: string; value: string }) => {
  const T = useAppTheme();
  return (
    <View style={s.metaCell}>
      <Text style={[s.metaLabel, { color: T.dim }]}>{label}</Text>
      <Text style={[s.metaValue, { color: T.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
};

export const DealsScreen = ({ navigation }: any) => {
  const T = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const isApprover = ['ZH', 'RH', 'SH', 'SCA'].includes(user?.role || '');

  const [tab, setTab] = useState<Tab>(isApprover ? 'queue' : 'all');
  const [status, setStatus] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [deals, setDeals] = useState<DealDto[]>([]);
  const [total, setTotal] = useState(0);
  const [queue, setQueue] = useState<DealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal + decision state
  const [open, setOpen] = useState<DealDto | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const loadQueue = useCallback(() => {
    if (!isApprover) return Promise.resolve();
    return dealsApi.getPendingApprovals()
      .then((res) => setQueue((Array.isArray(res.data) ? res.data : []).filter((d) => canDecide(d, user))))
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load approvals.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApprover, user]);

  const loadAll = useCallback(() => {
    return dealsApi.getDeals({ page, pageSize: PAGE_SIZE, ...(status ? { status } : {}) })
      .then((res) => {
        setDeals(res.data?.items ?? []);
        setTotal(res.data?.totalCount ?? 0);
      })
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load deals.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadQueue(), loadAll()]).finally(() => setLoading(false));
  }, [loadQueue, loadAll]);

  // Coming back from Create Deal should show the new deal without a manual pull. The
  // first focus is the mount itself, already covered by the effect above.
  const seenFocus = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener?.('focus', () => {
      if (!seenFocus.current) { seenFocus.current = true; return; }
      loadQueue();
      loadAll();
    });
    return unsub;
  }, [navigation, loadQueue, loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadQueue(), loadAll()]).finally(() => setRefreshing(false));
  };

  const openDeal = (d: DealDto) => { setNotes(''); setBusy(null); setOpen(d); };

  const decide = async (approved: boolean) => {
    if (!open) return;
    if (!approved && !notes.trim()) { toast.warning('Add a note saying why the deal is rejected.'); return; }
    setBusy(approved ? 'approve' : 'reject');
    try {
      await dealsApi.approveDeal(open.id, approved, notes.trim() || null);
      toast.success(approved ? 'Deal approved — the lead is now Won.' : 'Deal rejected.');
      setOpen(null);
      loadQueue();
      loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not record the decision.'));
    } finally {
      setBusy(null);
    }
  };

  const list = tab === 'queue' ? queue : deals;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const actionable = !!open && canDecide(open, user);

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label || 'All statuses';

  const renderRow = (d: DealDto) => (
    <ListCard key={d.id} onPress={() => openDeal(d)} style={s.rowCard}>
      <View style={s.flex}>
        <View style={s.rowTop}>
          <View style={s.flex}>
            <Text style={[s.rowTitle, { color: T.text }]} numberOfLines={1}>{d.school}</Text>
            <Text style={[s.rowSub, { color: T.dim }]} numberOfLines={1}>
              {[d.city, d.foName].filter(Boolean).join(' · ') || DASH}
            </Text>
          </View>
          <StatusTag status={d.approvalStatus} />
        </View>
        <View style={s.rowFoot}>
          <Text style={[s.rowSub, { color: T.sub }]} numberOfLines={1}>
            {Number(d.discount || 0)}% off · {day(d.submittedAt || d.createdAt)}
          </Text>
          <Text style={[s.rowVal, { color: T.text }]}>{rupees(d.totalMoney)}</Text>
        </View>
      </View>
    </ListCard>
  );

  const rows: [string, React.ReactNode][] = open ? [
    ['Base price (per login)', rupees(open.basePrice)],
    ['Logins', String(open.totalLogins ?? DASH)],
    ['Licences', String(open.numberOfLicenses ?? open.totalLogins ?? DASH)],
    ['Subtotal', rupees(open.subtotal)],
    [`Discount (${Number(open.discount || 0)}%)`, `- ${rupees((open.subtotal || 0) - (open.amountWithoutGst || 0))}`],
    ['Amount without GST', rupees(open.amountWithoutGst)],
    ['GST (18%)', rupees(open.gstAmount)],
  ] : [];

  return (
    <View style={[s.safe, { backgroundColor: T.bg }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[T.accent]} tintColor={T.accent} />}
      >
        <View style={[s.header, wide && s.headerWide]}>
          <View style={s.flex}>
            <Text style={[s.title, { color: T.text }]}>Deals</Text>
            <Text style={[s.sub, { color: T.sub }]}>
              {isApprover ? 'Deals in your scope and the ones waiting for your decision' : 'Your deals and where each one stands'}
            </Text>
          </View>
          <Btn
            label="Create Deal"
            small
            onPress={() => navigation.navigate('CreateDeal')}
            icon={<Plus size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        {isApprover && (
          <Segmented<Tab>
            value={tab}
            onChange={(v) => { setTab(v); setPage(1); setStatusOpen(false); }}
            options={[
              { value: 'queue', label: `Awaiting my decision${queue.length ? ` (${queue.length})` : ''}` },
              { value: 'all', label: 'All deals' },
            ]}
          />
        )}

        {tab === 'all' && (
          <View>
            <Trigger
              label={statusLabel}
              open={statusOpen}
              onPress={() => setStatusOpen((o) => !o)}
              icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
            />
            {statusOpen && (
              <Dropdown
                style={s.ddFull}
                value={status}
                options={STATUS_OPTIONS}
                onSelect={(v) => { setStatus(v); setPage(1); setStatusOpen(false); }}
              />
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={T.accent} style={s.loader} />
        ) : list.length === 0 ? (
          <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
            <Inbox size={28} color={T.dim} strokeWidth={ICON_STROKE} />
            <Text style={[s.emptyTitle, { color: T.text }]}>
              {tab === 'queue' ? 'Nothing is waiting for your decision.' : 'No deals yet.'}
            </Text>
            {tab !== 'queue' && (
              <Text style={[s.emptyTxt, { color: T.dim }]}>Create a deal from a lead once its demo is done.</Text>
            )}
          </View>
        ) : (
          <View style={s.list}>{list.map(renderRow)}</View>
        )}

        {tab === 'all' && total > PAGE_SIZE && (
          <View style={s.pgRow}>
            <Text style={[s.sub, { color: T.dim }]}>{total} deals</Text>
            <Pagination page={page} pageCount={pageCount} onChange={(p) => { if (p >= 1 && p <= pageCount) setPage(p); }} />
          </View>
        )}
      </ScrollView>

      <FormModal
        visible={!!open}
        wide
        title={open?.school || 'Deal'}
        onClose={() => setOpen(null)}
        footer={actionable ? (
          <>
            <Btn
              label={busy === 'reject' ? 'Rejecting…' : 'Reject'}
              variant="secondary"
              onPress={() => decide(false)}
              disabled={!!busy}
              icon={<XCircle size={14} color={T.text} strokeWidth={ICON_STROKE} />}
              style={s.flex}
            />
            <Btn
              label={busy === 'approve' ? 'Approving…' : 'Approve'}
              onPress={() => decide(true)}
              disabled={!!busy}
              icon={<CheckCircle2 size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
              style={s.flex}
            />
          </>
        ) : undefined}
      >
        {open && (
          <View style={s.detail}>
            <View style={s.tagRow}>
              <StatusTag status={open.approvalStatus} />
              {!!open.leadStage && <StatusBadge label={`Lead: ${stageLabel(open.leadStage)}`} color={T.dim} />}
              {!!open.city && <Text style={[s.rowSub, { color: T.dim }]}>{open.city}</Text>}
            </View>

            <View style={s.metaGrid}>
              <Meta label="Owner" value={open.foName || DASH} />
              <Meta label="Submitted" value={day(open.submittedAt || open.createdAt)} />
              <Meta label="Billing" value={open.billingFrequency || open.paymentTerms || DASH} />
              <Meta label="Duration" value={open.duration || DASH} />
              <Meta label="Contract" value={`${day(open.contractStartDate)} – ${day(open.contractEndDate)}`} />
              {!!open.approverName && <Meta label="Decided by" value={open.approverName} />}
            </View>

            <View style={[s.breakdown, { borderColor: T.line }]}>
              {rows.map(([k, v]) => <DetailRow key={k} label={k} value={v} />)}
              <View style={[s.totalRow, { backgroundColor: withAlpha(T.accent, SOFT_TINT) }]}>
                <Text style={[s.totalLabel, { color: T.accent }]}>Total (incl. GST)</Text>
                <Text style={[s.totalValue, { color: T.accent }]}>{rupees(open.totalMoney)}</Text>
              </View>
            </View>

            {open.modules?.length > 0 && (
              <View style={s.tagRow}>
                {open.modules.map((m) => <StatusBadge key={m} label={m} color={T.accent} />)}
              </View>
            )}
            {!!open.notes && (
              <View>
                <Text style={[s.metaLabel, { color: T.dim }]}>Notes for approver</Text>
                <Text style={[s.noteTxt, { color: T.text }]}>{open.notes}</Text>
              </View>
            )}
            {!!open.approvalNotes && (
              <View>
                <Text style={[s.metaLabel, { color: T.dim }]}>Approver's note</Text>
                <Text style={[s.noteTxt, { color: T.text }]}>{open.approvalNotes}</Text>
              </View>
            )}

            {actionable && (
              <Field label="Note (required to reject)">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={1000}
                  placeholder="Reason or conditions…"
                  placeholderTextColor={T.dim}
                  style={[s.textarea, { backgroundColor: T.card, borderColor: T.line, color: T.text }]}
                />
              </Field>
            )}
          </View>
        )}
      </FormModal>
    </View>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '700' },
  scroll: { padding: 14, gap: 12, paddingBottom: 28 },
  scrollWide: { paddingHorizontal: 22 },
  header: { gap: 10 },
  headerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: rf(18), fontWeight: '700' },
  sub: { fontSize: rf(12.5), fontWeight: '500', marginTop: 2 },
  ddFull: { width: '100%' },
  loader: { marginTop: 48 },
  list: { gap: 8 },

  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  rowTitle: { fontSize: rf(14), fontWeight: '700' },
  rowSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 2, flexShrink: 1 },
  rowVal: { fontSize: rf(14), fontWeight: '800' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 40, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  detail: { gap: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  metaCell: { width: '50%', paddingRight: 8 },
  metaLabel: { fontSize: rf(11.5), fontWeight: '500', marginBottom: 2 },
  metaValue: { fontSize: rf(13), fontWeight: '600' },

  breakdown: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  bdRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bdLabel: { fontSize: rf(12.5), fontWeight: '500', flex: 1 },
  bdValue: { fontSize: rf(12.5), fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  totalLabel: { fontSize: rf(13), fontWeight: '700' },
  totalValue: { fontSize: rf(15), fontWeight: '800' },

  noteTxt: { fontSize: rf(13), fontWeight: '500', lineHeight: 19 },
  textarea: {
    minHeight: 72, borderRadius: 13, borderWidth: 1.5,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: rf(14), fontWeight: '500', textAlignVertical: 'top',
  },
});
