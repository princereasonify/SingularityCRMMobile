import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, useWindowDimensions,
  TouchableOpacity, ActivityIndicator, Alert, Linking, Clipboard, TextInput,
  AppState, AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, RefreshCw, Copy, ExternalLink, Eye, CreditCard, Send,
  WifiOff, AlertTriangle, CheckCircle2, XCircle, Clock,
} from 'lucide-react-native';

import { apiClient } from '../../api/client';
import { DateInput } from '../../components/common/DateInput';
import { SelectPicker } from '../../components/common/SelectPicker';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Input, Segmented, StatusBadge,
  Pagination, ListCard, Avatar, FormModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import { AppTheme } from '../../theme/appTheme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Payment Integration — hosted payment links for schools whose deal is Won.
 *
 * Web parity source: Sales_CRM_Web/src/pages/common/PaymentIntegration.jsx.
 *
 * VERIFIED against PaymentsController.cs — the only payment routes that exist are
 * eligible-schools / links / links/{id} / links (POST) / links/{id}/refresh, plus the
 * anonymous gateway callbacks. `src/api/payments.ts` declares getAll/create/getById/
 * getByDeal/verifyPayment/getDirectPayments/createDirectPayment against `/payments`,
 * `/payments/direct` etc. — NONE of those routes exist, so this screen previously 404'd
 * on every call. It now talks to the real endpoints through apiClient directly, because
 * payments.ts is shared with ScaPaymentsScreen/SCADashboard and is outside this task's
 * file scope. See the report: payments.ts needs the phantom endpoints removed.
 *
 * apiClient unwraps ApiResponse{success,data,message}, so `res.data` is the payload.
 */

/**
 * Server-side page size. `GET /payments/links` binds `[FromQuery] int page = 1,
 * [FromQuery] int limit = 20` and answers `new { items, total, page, limit }`, so the
 * server slices and we only ever hold one page. The previous approach fetched limit:50
 * with no page and paged client-side, which silently truncated any zone with more than
 * 50 links — the 51st row simply did not exist as far as the UI was concerned.
 */
const PAGE_SIZE = 10;
const DASH = '—';

/** Web's PaymentResponse polls 6× at 3s; mirrored here so both give up at the same point. */
const POLL_MAX = 6;
const POLL_INTERVAL_MS = 3000;

type StatusFilter = '' | 'pending' | 'paid' | 'failed';

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Failed', value: 'failed' },
];

/** PaymentLinkDto — SalesCRM.Core/DTOs/Payments. */
interface PaymentLink {
  id: number;
  schoolId: number;
  schoolName: string;
  orderId: string;
  amount: number;
  currency?: string;
  description?: string | null;
  dueDate: string;
  paymentUrl?: string | null;
  status: string;
  createdById: number;
  createdByName: string;
  createdAt: string;
}

/** EligibleSchoolDto — SalesCRM.Core/DTOs/Payments. */
interface EligibleSchool {
  schoolId: number;
  schoolName: string;
  city?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
}

/**
 * Status → spec token. Web: pending=blue, paid=green, failed=red. Mapped so no two
 * states share a hue — pending→info, paid→success, failed→danger.
 */
const statusColor = (T: AppTheme, st: string): string =>
  (({ pending: T.info, paid: T.success, failed: T.danger }) as Record<string, string>)[st] || T.dim;

const STATUS_LABELS: Record<string, string> = { pending: 'Pending', paid: 'Paid', failed: 'Failed' };
const statusLabel = (st: string) => STATUS_LABELS[st] || st;

const todayIso = () => new Date().toISOString().slice(0, 10);

const fmtCurrency = (v: number) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string) =>
  !d ? DASH : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (d?: string) =>
  !d
    ? DASH
    : new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

// ─── Create-link modal ────────────────────────────────────────────────────────
function CreateLinkModal({ schools, onClose, onCreated }: {
  schools: EligibleSchool[];
  onClose: () => void;
  /** `opened` is true only when the hosted page actually reached the browser — that is
   *  the moment the return-confirmation watch becomes meaningful. */
  onCreated: (created?: PaymentLink, opened?: boolean) => void;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [schoolId, setSchoolId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => schools.find(s => String(s.schoolId) === String(schoolId)),
    [schools, schoolId],
  );

  const handleCreate = async () => {
    if (!schoolId) { Alert.alert('School Required', 'Please select a school.'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid Amount', 'Amount must be greater than zero.'); return; }
    if (!dueDate) { Alert.alert('Due Date Required', 'Please choose a due date.'); return; }

    setSaving(true);
    try {
      // POST /payments/links — CreatePaymentLinkRequest { SchoolId, Amount, DueDate, Description }.
      const res = await apiClient.post<PaymentLink>('/payments/links', {
        schoolId: Number(schoolId),
        amount: amt,
        dueDate: new Date(dueDate).toISOString(),
        description: description.trim() || undefined,
      });
      const created: any = res.data;

      // Gateway flow, mirrored from web: the hosted payment page is opened as soon as
      // the link exists. The only change from before is that we now tell the screen
      // whether the browser actually took the URL, so it knows to watch for the return.
      if (created?.paymentUrl) {
        const canOpen = await Linking.canOpenURL(created.paymentUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(created.paymentUrl);
          onCreated(created, true);
        } else {
          onCreated(created, false);
          Alert.alert('Link Created', 'The payment link was created but could not be opened automatically.');
        }
      } else {
        onCreated(created, false);
        Alert.alert('Link Saved', 'Link saved, but the gateway response was incomplete.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to create payment link.');
      onCreated(undefined, false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      visible
      wide={wide}
      title="New Payment Link"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={saving ? 'Preparing…' : 'Pay Now'}
            onPress={handleCreate}
            loading={saving}
            disabled={saving}
            small
            icon={<Send size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <SelectPicker
          label="School (won deals only) *"
          placeholder="Select a school…"
          options={schools.map(sc => ({
            value: String(sc.schoolId),
            label: sc.schoolName + (sc.city ? ` — ${sc.city}` : ''),
          }))}
          value={schoolId}
          onChange={v => setSchoolId(String(v))}
          accentColor={T.accent}
        />
        {!!selected && (
          <Text style={[s.hint, { color: T.dim }]}>
            Will be sent to: {selected.contactEmail || selected.contactPhone || 'school admin'}
          </Text>
        )}

        <View style={wide ? s.row2 : s.col2}>
          <Input
            label="Amount (₹) *"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            containerStyle={wide ? { flex: 1 } : undefined}
          />
          <Field label="Due Date *" style={wide ? { flex: 1 } : undefined}>
            <DateInput value={dueDate} onChange={setDueDate} accentColor={T.accent} />
          </Field>
        </View>

        {/* Kit Input hard-codes height 46 — a multiline field needs Field + TextInput.
            maxLength 500 mirrors web's textarea cap. */}
        <Field label="Description (optional)">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Monthly platform fee — May"
              placeholderTextColor={T.dim}
              multiline
              maxLength={500}
              style={[s.textareaTxt, { color: T.text }]}
            />
          </View>
        </Field>
      </View>
    </FormModal>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  const T = useAppTheme();
  return (
    <View style={s.dRow}>
      <Text style={[s.dLabel, { color: T.text }]}>{label}</Text>
      <View style={s.dValWrap}>
        {typeof value === 'string' || typeof value === 'number'
          ? <Text style={[s.dVal, { color: T.sub }]}>{value === '' ? DASH : String(value)}</Text>
          : (value ?? <Text style={[s.dVal, { color: T.sub }]}>{DASH}</Text>)}
      </View>
    </View>
  );
}

function DetailModal({ link, refreshing, onRefresh, onClose }: {
  link: PaymentLink; refreshing: boolean; onRefresh: () => void; onClose: () => void;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const c = statusColor(T, link.status);
  const banner =
    link.status === 'paid' ? { text: 'Payment completed successfully.', icon: <CheckCircle2 size={15} color={c} strokeWidth={ICON_STROKE} /> }
      : link.status === 'failed' ? { text: 'Payment failed.', icon: <XCircle size={15} color={c} strokeWidth={ICON_STROKE} /> }
        : link.status === 'pending' ? { text: 'Payment pending.', icon: <Clock size={15} color={c} strokeWidth={ICON_STROKE} /> }
          : null;

  return (
    <FormModal
      visible
      wide={wide}
      title="Payment Link Details"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn
            label="Refresh Status"
            variant="secondary"
            onPress={onRefresh}
            loading={refreshing}
            disabled={refreshing}
            small
            icon={<RefreshCw size={14} color={T.text} strokeWidth={ICON_STROKE} />}
          />
          <Btn label="Back" variant="secondary" onPress={onClose} small />
        </>
      }
    >
      <View style={s.mForm}>
        {!!banner && (
          <View style={[s.banner, { backgroundColor: withAlpha(c, SOFT_TINT) }]}>
            {banner.icon}
            <Text style={[s.bannerTxt, { color: c }]}>{banner.text}</Text>
          </View>
        )}

        <View>
          <DetailRow label="ID" value={link.id} />
          <DetailRow label="School" value={link.schoolName || `School #${link.schoolId}`} />
          <DetailRow label="Order Id" value={link.orderId} />
          <DetailRow label="Amount" value={`${Number(link.amount || 0)} ${link.currency || 'INR'}`} />
          <DetailRow label="Due Date" value={fmtDate(link.dueDate)} />
          <DetailRow
            label="Status"
            value={<StatusBadge label={statusLabel(link.status)} color={c} />}
          />
          <DetailRow
            label="Payment link"
            value={
              link.paymentUrl ? (
                <TouchableOpacity onPress={() => Linking.openURL(link.paymentUrl!)} hitSlop={8}>
                  <Text style={[s.dLink, { color: T.accent }]}>Open</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
          <DetailRow label="Created" value={fmtDateTime(link.createdAt)} />
        </View>
      </View>
    </FormModal>
  );
}

// ─── Payment-return confirmation ──────────────────────────────────────────────
/** Live view of an order we are waiting on. Mirrors web PaymentResponse.jsx's `view`. */
interface ConfirmState {
  orderId: string;
  status: string;
  amount: number | null;
  currency: string;
  schoolName: string;
  /** Polling has stopped — either terminal or we ran out of attempts. */
  settled: boolean;
}

/**
 * The mobile counterpart of web's standalone /payment/response screen.
 *
 * Web gets a *browser redirect* back to itself, so it can be a route. Mobile cannot:
 * `Juspay:FrontendReturnUrl` is a single server-side config value pointing at the web
 * SPA, `CreatePaymentLinkRequest` has no returnUrl field to override it per-request,
 * and the app registers no URL scheme. So instead of a return route this is driven by
 * app-foreground polling — see the note on `beginConfirm`.
 */
function ConfirmModal({ view, onClose }: { view: ConfirmState; onClose: () => void }) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const paid = view.status === 'paid';
  const failed = view.status === 'failed';
  const tone = paid ? T.success : failed ? T.danger : T.info;

  const title = paid ? 'Payment Successful' : failed ? 'Payment Failed' : 'Confirming Payment…';
  const body = paid
    ? `${view.amount != null ? fmtCurrency(view.amount) : 'Payment'} received${view.schoolName ? ` from ${view.schoolName}` : ''}.`
    : failed
      ? 'We could not complete this payment. No amount has been charged.'
      : view.settled
        // Ran out of polls without a terminal answer — say so rather than spin forever.
        ? 'This is taking longer than usual. The status will update on this screen once the bank confirms.'
        : 'We are confirming your payment with the bank. This usually takes a few seconds.';

  return (
    <FormModal
      visible
      wide={wide}
      title="Payment Status"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn
            label="Done"
            onPress={onClose}
            disabled={!view.settled && !paid && !failed}
            small
          />
        </>
      }
    >
      <View style={s.cfWrap}>
        <View style={[s.cfIcon, { backgroundColor: withAlpha(tone, SOFT_TINT) }]}>
          {paid
            ? <CheckCircle2 size={34} color={tone} strokeWidth={ICON_STROKE} />
            : failed
              ? <XCircle size={34} color={tone} strokeWidth={ICON_STROKE} />
              : <ActivityIndicator size="large" color={tone} />}
        </View>
        <Text style={[s.cfTitle, { color: T.text }]}>{title}</Text>
        <Text style={[s.cfBody, { color: T.sub }]}>{body}</Text>
        {!!view.orderId && (
          <Text style={[s.cfOrder, { color: T.dim }]}>Order ID: {view.orderId}</Text>
        )}
      </View>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const PaymentsScreen = (_props: any) => {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  /** iPad always gets the table — never a card grid. Phones get list rows. */
  const table = isTabletDevice;

  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [schools, setSchools] = useState<EligibleSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<'none' | 'offline' | 'error'>('none');
  const [filter, setFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  /** Row count for the whole filtered set, from the server — not links.length. */
  const [total, setTotal] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<PaymentLink | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // GET /payments/eligible-schools → ApiResponse<List<EligibleSchoolDto>> (array)
      // GET /payments/links?status&page&limit → ApiResponse<object>.Ok(new { items, total, page, limit })
      // `status` is a bound [FromQuery] string? — undefined is dropped by axios, which is
      // what we want for "All". (An *unbound* key would be dropped by ASP.NET instead and
      // silently return unfiltered data; status/page/limit are all genuinely bound.)
      const params = { status: filter || undefined, page, limit: PAGE_SIZE };
      const [schoolsRes, linksRes] = await Promise.all([
        apiClient.get<EligibleSchool[]>('/payments/eligible-schools'),
        apiClient.get<any>('/payments/links', { params }),
      ]);
      setSchools((schoolsRes.data as any) || []);
      const list: PaymentLink[] = (linksRes.data as any)?.items ?? [];
      setLinks(list);
      setTotal(Number((linksRes.data as any)?.total ?? list.length));
      setError('none');

      // Auto-sync open rows from the gateway, exactly as web does, so a row that has
      // since been paid or failed shows its real state without a manual refresh.
      // Only this page's rows — that is all the user can currently see.
      const open = list.filter(p => p.status === 'pending');
      if (open.length > 0) {
        await Promise.allSettled(
          open.map(p => apiClient.post(`/payments/links/${p.id}/refresh`).catch(() => null)),
        );
        const updated = await apiClient.get<any>('/payments/links', { params });
        setLinks((updated.data as any)?.items ?? []);
        setTotal(Number((updated.data as any)?.total ?? list.length));
      }
    } catch (err: any) {
      setLinks([]);
      setSchools([]);
      setTotal(0);
      setError(err?.response ? 'error' : 'offline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Deleting/filtering can leave us stranded past the last page — walk back into range.
  useEffect(() => {
    if (!loading && page > 1 && links.length === 0 && total > 0) setPage(1);
  }, [loading, page, links.length, total]);

  // Keep the open detail modal in sync with the table underneath it.
  useEffect(() => {
    setViewing(prev => (prev ? links.find(l => l.id === prev.id) || prev : prev));
  }, [links]);

  // ── Payment-return confirmation ────────────────────────────────────────────
  /** The order whose hosted page we just sent the user to, if any. */
  const [pendingOrder, setPendingOrder] = useState<PaymentLink | null>(null);
  const [confirmView, setConfirmView] = useState<ConfirmState | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /**
   * Poll the order until it reaches a terminal state, exactly as web's PaymentResponse
   * does (6 attempts, 3s apart). Started when the app returns to the foreground after
   * we handed the user off to the hosted payment page.
   *
   * GET /payments/public/order-status is `[HttpGet("public/order-status")] [AllowAnonymous]`
   * and returns ApiResponse<PublicPaymentStatusDto>, which the apiClient interceptor
   * unwraps — so `res.data` is the DTO { orderId, amount, currency, status, paidAt, schoolName }.
   */
  const beginConfirm = useCallback((order: PaymentLink) => {
    stopPolling();
    pollCount.current = 0;
    setConfirmView({
      orderId: order.orderId,
      status: 'pending',
      amount: order.amount ?? null,
      currency: order.currency || 'INR',
      schoolName: order.schoolName || '',
      settled: false,
    });

    // Audit parity with web, which posts the return payload it was redirected with.
    // We have no redirect, so we log what we do know. QueryParams binds as
    // Dictionary<string,string> — every value must be a string.
    apiClient.post('/payments/public/return-log', {
      orderId: order.orderId,
      url: 'app://payments/return',
      queryParams: { source: 'mobile-app-foreground', resumedAt: new Date().toISOString() },
    }).catch(() => {});

    const tick = async () => {
      let dto: any = null;
      try {
        const res = await apiClient.get<any>('/payments/public/order-status', {
          params: { orderId: order.orderId },
        });
        dto = res.data;
      } catch {
        // Not synced yet, or offline — keep the current view and try again.
        dto = null;
      }

      if (dto) {
        setConfirmView(prev => prev && ({
          ...prev,
          status: dto.status || prev.status,
          amount: dto.amount ?? prev.amount,
          currency: dto.currency || prev.currency,
          schoolName: dto.schoolName || prev.schoolName,
        }));
      }

      const terminal = dto && (dto.status === 'paid' || dto.status === 'failed');
      if (!terminal && pollCount.current < POLL_MAX) {
        pollCount.current += 1;
        pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      setConfirmView(prev => prev && { ...prev, settled: true });
      setPendingOrder(null);
      fetchData(true);
    };

    tick();
  }, [stopPolling, fetchData]);

  // Foreground is our "return from the gateway" signal. The user leaves the app for the
  // browser and comes back; that transition is when the outcome is worth checking.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && /inactive|background/.test(prev) && pendingOrder) {
        beginConfirm(pendingOrder);
      }
    });
    return () => sub.remove();
  }, [pendingOrder, beginConfirm]);

  const handleRefreshStatus = async (id: number) => {
    setRefreshingId(id);
    try {
      await apiClient.post(`/payments/links/${id}/refresh`);
      await fetchData(true);
      Alert.alert('Status Refreshed', 'The latest status was fetched from the gateway.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to refresh status.');
    } finally {
      setRefreshingId(null);
    }
  };

  const copyLink = (url: string) => {
    // RN core Clipboard is deprecated but still shipped in 0.84 and needs no new dep.
    Clipboard.setString(url);
    Alert.alert('Link Copied', 'The payment link was copied to your clipboard.');
  };

  // Server-side now: `links` IS the current page, and `total` covers the whole set.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLinks = links;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
  };

  // ── row actions (web: View · Copy · Open · Refresh) ──
  const rowActions = (p: PaymentLink) => (
    <View style={s.actions}>
      <IconBtn kind="view" label="View details" onPress={() => setViewing(p)}>
        <Eye size={14} color={T.accent} strokeWidth={ICON_STROKE} />
      </IconBtn>
      {!!p.paymentUrl && (
        <>
          <IconBtn kind="edit" label="Copy link" onPress={() => copyLink(p.paymentUrl!)}>
            <Copy size={14} color={T.sub} strokeWidth={ICON_STROKE} />
          </IconBtn>
          <IconBtn kind="edit" label="Open link" onPress={() => Linking.openURL(p.paymentUrl!)}>
            <ExternalLink size={14} color={T.sub} strokeWidth={ICON_STROKE} />
          </IconBtn>
        </>
      )}
      <IconBtn kind="view" label="Refresh status" onPress={() => handleRefreshStatus(p.id)}>
        {refreshingId === p.id
          ? <ActivityIndicator size="small" color={T.accent} />
          : <RefreshCw size={14} color={T.accent} strokeWidth={ICON_STROKE} />}
      </IconBtn>
    </View>
  );

  // ── table (tablet) — web columns, 1:1 ──
  /**
   * Horizontally scrollable: with Actions fixed at 150pt, the seven flexible
   * columns shared only ~610pt on a narrow landscape iPad, squeezing Amount to
   * ~59pt so most currency figures truncated. TABLE_MIN_W keeps every column
   * readable and scrolls instead of cropping. Same pattern as PipelineScreen.
   */
  const renderTable = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tblScroll}
    >
    <View style={[s.tbl, s.tblMin, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        <Text style={[s.th, { color: T.dim }, s.cSchool]}>School</Text>
        <Text style={[s.th, { color: T.dim }, s.cOrder]}>Order ID</Text>
        <Text style={[s.th, { color: T.dim }, s.cAmt]}>Amount</Text>
        <Text style={[s.th, { color: T.dim }, s.cDue]}>Due Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        <Text style={[s.th, { color: T.dim }, s.cBy]}>Created By</Text>
        <Text style={[s.th, { color: T.dim }, s.cMade]}>Created</Text>
        <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>
      </View>

      {pageLinks.map(p => (
        <TouchableOpacity
          key={p.id}
          activeOpacity={0.7}
          onPress={() => setViewing(p)}
          style={[s.tr, { borderTopColor: T.line, borderTopWidth: 1 }]}
        >
          <View style={[s.cSchool, s.nameCell]}>
            <Avatar initials={initialsOf(p.schoolName)} />
            {/* flexShrink defaults to 0 in RN — without it a long school name refuses
                to shrink and pushes every column after it out of its header. */}
            <Text style={[s.tdName, { color: T.text }, s.cellTxt]} numberOfLines={1}>
              {p.schoolName || `School #${p.schoolId}`}
            </Text>
          </View>
          <Text style={[s.td, { color: T.sub }, s.cOrder]} numberOfLines={1}>{p.orderId || DASH}</Text>
          <Text style={[s.tdAmt, { color: T.text }, s.cAmt]} numberOfLines={1}>{fmtCurrency(p.amount)}</Text>
          <Text style={[s.td, { color: T.sub }, s.cDue]} numberOfLines={1}>{fmtDate(p.dueDate)}</Text>
          <View style={s.cStatus}>
            <StatusBadge label={statusLabel(p.status)} color={statusColor(T, p.status)} />
          </View>
          <Text style={[s.td, { color: T.sub }, s.cBy]} numberOfLines={1}>{p.createdByName || DASH}</Text>
          <Text style={[s.td, { color: T.dim }, s.cMade]} numberOfLines={1}>{fmtDate(p.createdAt)}</Text>
          <View style={s.cActions}>{rowActions(p)}</View>
        </TouchableOpacity>
      ))}
    </View>
    </ScrollView>
  );

  // ── list rows (phone) ──
  const renderRows = () => (
    <View style={{ gap: 8 }}>
      {pageLinks.map(p => (
        <ListCard key={p.id} onPress={() => setViewing(p)} style={s.rowCard}>
          <Avatar initials={initialsOf(p.schoolName)} />
          <View style={{ flex: 1 }}>
            <View style={s.rowTop}>
              <Text style={[s.tdName, { color: T.text, flex: 1 }]} numberOfLines={1}>
                {p.schoolName || `School #${p.schoolId}`}
              </Text>
              <Text style={[s.tdAmt, { color: T.text }]}>{fmtCurrency(p.amount)}</Text>
            </View>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{p.orderId || DASH}</Text>
            <View style={s.rowStats}>
              <StatusBadge label={statusLabel(p.status)} color={statusColor(T, p.status)} />
              <Text style={[s.statTxt, { color: T.dim }]}>Due {fmtDate(p.dueDate)}</Text>
            </View>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {[p.createdByName, fmtDate(p.createdAt)].filter(Boolean).join(' • ')}
            </Text>
            <View style={s.rowActions}>{rowActions(p)}</View>
          </View>
        </ListCard>
      ))}
    </View>
  );

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const renderBody = () => {
    if (loading) {
      return <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />;
    }
    if (error !== 'none') {
      return (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          {error === 'offline'
            ? <WifiOff size={34} color={T.dim} strokeWidth={ICON_STROKE} />
            : <AlertTriangle size={34} color={T.danger} strokeWidth={ICON_STROKE} />}
          <Text style={[s.emptyTitle, { color: T.text }]}>
            {error === 'offline' ? "You're offline" : 'Could not load payment data'}
          </Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            {error === 'offline'
              ? 'Reconnect and pull down to try again.'
              : 'Pull down to retry.'}
          </Text>
        </View>
      );
    }
    // Web's two distinct empty states, kept apart.
    if (schools.length === 0 && total === 0) {
      return (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <CreditCard size={34} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.emptyTitle, { color: T.text }]}>No schools with won deals yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>
            Once a lead is moved to the Won stage, the school will appear here.
          </Text>
        </View>
      );
    }
    if (total === 0) {
      return (
        <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
          <CreditCard size={34} color={T.dim} strokeWidth={ICON_STROKE} />
          <Text style={[s.emptyTitle, { color: T.text }]}>No payment links yet</Text>
          <Text style={[s.emptyTxt, { color: T.dim }]}>Tap "Create Link" to generate the first one.</Text>
        </View>
      );
    }
    return (
      <>
        {table ? renderTable() : renderRows()}
        {totalPages > 1 && (
          <View style={s.pgRow}>
            <Text style={[s.count, { color: T.dim }]}>
              Showing {from}{DASH}{to} of {total}
            </Text>
            <Pagination page={page} pageCount={totalPages} onChange={goToPage} />
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* No in-page title or hamburger — the topbar (native drawer header for
            RH/SH/SCA) already names the screen and carries the menu. Just the action. */}
        <View style={s.actionBar}>
          {/* Ungated, matching web: PaymentIntegration.jsx renders Create Link for every role. */}
          <Btn
            label="Create Link"
            small
            onPress={() => setShowForm(true)}
            disabled={schools.length === 0}
            icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </View>

        <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <Segmented<StatusFilter>
            value={filter}
            onChange={v => { setFilter(v); setPage(1); }}
            options={FILTERS}
            style={wide ? { width: 380 } : undefined}
          />
          <Text style={[s.count, { color: T.dim }]}>
            {total} link{total === 1 ? '' : 's'}
          </Text>
        </View>

        {renderBody()}
      </ScrollView>

      {showForm && (
        <CreateLinkModal
          schools={schools}
          onClose={() => setShowForm(false)}
          onCreated={(created, opened) => {
            setShowForm(false);
            // Arm the return watch only if the hosted page really opened — otherwise
            // there is no trip to the browser to come back from.
            if (opened && created?.orderId) setPendingOrder(created);
            setPage(1);
            fetchData(true);
          }}
        />
      )}

      {!!viewing && (
        <DetailModal
          link={viewing}
          refreshing={refreshingId === viewing.id}
          onRefresh={() => handleRefreshStatus(viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}

      {!!confirmView && (
        <ConfirmModal
          view={confirmView}
          onClose={() => { stopPolling(); setConfirmView(null); }}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  /** Just the primary action, right-aligned, now the title/subtitle are gone. */
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end' },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  count: { fontSize: rf(11.5), fontWeight: '600' },

  // table — .tbl r16 · .th cardAlt 11/700/.4 upper · .tr borderTop line · pad 12/16
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdAmt: { fontSize: rf(13.5), fontWeight: '800' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** Text inside a row-direction cell must shrink, or it overflows into the next column. */
  cellTxt: { flexShrink: 1, minWidth: 0 },
  cSchool: { flex: 2 },
  cOrder: { flex: 1.6 },
  cAmt: { flex: 1 },
  cDue: { flex: 1.1 },
  cStatus: { flex: 1 },
  cBy: { flex: 1.2 },
  cMade: { flex: 1.1 },
  /** 150pt Actions + readable minimums for the seven flexible columns. */
  tblMin: { minWidth: 1040 },
  tblScroll: { flexGrow: 1 },
  cActions: { width: 150 }, // header <Text> ignores alignItems — both stay left so the
                            // icons line up under the ACTIONS label (web parity)
  actions: { flexDirection: 'row', gap: 6 },

  // phone rows
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  rowActions: { flexDirection: 'row', gap: 6, marginTop: 9 },
  statTxt: { fontSize: rf(11), fontWeight: '600' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modals
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  hint: { fontSize: rf(11.5), fontWeight: '500', marginTop: -6 },
  textarea: { minHeight: 76, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 56 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  bannerTxt: { fontSize: rf(12.5), fontWeight: '600', flex: 1 },

  dRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 6 },
  dLabel: { width: 108, fontSize: rf(12.5), fontWeight: '700' },
  dValWrap: { flex: 1 },
  dVal: { fontSize: rf(12.5), fontWeight: '500' },
  dLink: { fontSize: rf(12.5), fontWeight: '700' },

  // confirmation modal
  cfWrap: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  cfIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cfTitle: { fontSize: rf(17), fontWeight: '800', textAlign: 'center' },
  // alignItems on the parent does nothing for text wrapping — textAlign is what centres it
  cfBody: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center', lineHeight: rf(18) },
  cfOrder: { fontSize: rf(11.5), fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
