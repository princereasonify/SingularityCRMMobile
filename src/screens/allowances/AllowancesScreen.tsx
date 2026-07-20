import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, RefreshControl, Image, Linking,
  Platform, PermissionsAndroid, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check, X, Plus, Send, AlertTriangle, DollarSign, Paperclip,
  ExternalLink, FileText, Filter, WifiOff,
} from 'lucide-react-native';
import { launchCamera as _launchCamera, launchImageLibrary as _launchImageLibrary } from 'react-native-image-picker';

import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { trackingApi } from '../../api/tracking';
import { expenseClaimsApi } from '../../api/expenseClaims';
import { authApi } from '../../api/auth';
import { DateInput } from '../../components/common/DateInput';
import { ICON_STROKE } from '../../components/common/Icon';
import {
  Btn, IconBtn, Field, Checkbox, Segmented, Trigger, Dropdown,
  StatusBadge, FilterChip, Pagination, ListCard, Avatar, FormModal, ConfirmModal,
} from '../../components/crud';

import { useAppTheme } from '../../theme/useAppTheme';
import type { AppTheme } from '../../theme';
import { withAlpha, SOFT_TINT } from '../../theme';
import { rf, isTabletDevice } from '../../utils/responsive';

/**
 * Allowances — Travel Allowance + Expense Claims.
 *
 * Web parity source: Sales_CRM_Web/src/pages/common/Allowances.jsx.
 *
 * VERIFIED endpoints:
 *  · GET  /tracking/allowances?from&to&filterUserId  → ApiResponse<AllowanceSummaryResponseDto>
 *    (TrackingController.GetAllowances). NOTE the param is `filterUserId` — `trackingApi
 *    .getAllowances` sends `userId`, which the controller never binds, so the member
 *    filter silently did nothing. We call apiClient directly here with the real name.
 *  · PATCH /tracking/allowances/{id}                 → ApiResponse<AllowanceDto>
 *  · POST /tracking/allowances/bulk-approve          → ApiResponse<BulkApproveAllowanceResponseDto>
 *  · GET  /expense-claims/my?status&category&from&to → ApiResponse<List<ExpenseClaimDto>>
 *  · GET  /expense-claims/team?status&category&from&to → ApiResponse<List<ExpenseClaimDto>>
 *  · POST /expense-claims (multipart, IFormFile bill)
 *  · POST /expense-claims/{id}/approve · /{id}/reject · /bulk-approve
 */

const PAGE_SIZE = 10;
const DASH = '—';

const EXPENSE_CATEGORIES = [
  { value: 'HotelStay', label: 'Hotel / Stay' },
  { value: 'Food', label: 'Food' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Other', label: 'Other' },
];

type MainTab = 'travel' | 'expense';
type SubTab = 'my' | 'team';
type TStatus = 'all' | 'pending' | 'approved';
type EStatus = 'all' | 'Pending' | 'Approved' | 'Rejected';

/**
 * Category → token. Web: HotelStay purple · Food orange · Transport blue · Other grey.
 * The Sunstone ramp has no purple, so HotelStay takes info and Transport takes accent —
 * every category still resolves to a different hue.
 */
function categoryColor(T: AppTheme, category: string): string {
  switch (category) {
    case 'HotelStay': return T.info;
    case 'Food': return T.warning;
    case 'Transport': return T.accent;
    default: return T.dim;
  }
}

/** Status accent — pending → warning, approved → success, rejected → danger. */
function statusColor(T: AppTheme, status: string): string {
  if (status === 'Approved') return T.success;
  if (status === 'Rejected') return T.danger;
  return T.warning;
}

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}

const fmtCurrency = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fmtDate = (d?: string) =>
  !d ? DASH : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const initialsOf = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

// ─── Summary tiles ────────────────────────────────────────────────────────────
function SummaryRow({ total, approved, pending, totalLabel, wide }: {
  total: number; approved: number; pending: number; totalLabel: string; wide: boolean;
}) {
  const T = useAppTheme();
  const tiles = [
    { label: totalLabel, value: total, color: T.text, icon: <DollarSign size={16} color={T.info} strokeWidth={ICON_STROKE} />, tint: T.info },
    { label: 'Approved', value: approved, color: T.success, icon: <Check size={16} color={T.success} strokeWidth={ICON_STROKE} />, tint: T.success },
    { label: 'Pending', value: pending, color: T.warning, icon: <AlertTriangle size={16} color={T.warning} strokeWidth={ICON_STROKE} />, tint: T.warning },
  ];
  return (
    <View style={[sum.row, !wide && sum.rowNarrow]}>
      {tiles.map(t => (
        <View key={t.label} style={[sum.card, { backgroundColor: T.card, borderColor: T.line }]}>
          <View style={[sum.icon, { backgroundColor: withAlpha(t.tint, SOFT_TINT) }]}>{t.icon}</View>
          <View style={{ flex: 1 }}>
            <Text style={[sum.label, { color: T.dim }]} numberOfLines={1}>{t.label}</Text>
            <Text style={[sum.val, { color: t.color }]} numberOfLines={1}>{fmtCurrency(t.value)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const sum = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  rowNarrow: { flexWrap: 'wrap' },
  card: {
    flex: 1, minWidth: 150, borderRadius: 16, borderWidth: 1, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: rf(11), fontWeight: '600' },
  val: { fontSize: rf(15), fontWeight: '800', marginTop: 1, letterSpacing: -0.3 },
});

// ─── Expense form modal ───────────────────────────────────────────────────────
function ExpenseFormModal({ onClose, onSubmit, submitting }: {
  onClose: () => void; onSubmit: (f: any) => void; submitting: boolean;
}) {
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;

  const [expenseDate, setExpenseDate] = useState('');
  const [category, setCategory] = useState('HotelStay');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [billUri, setBillUri] = useState<string | null>(null);
  const [billName, setBillName] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState(false);

  // ── file-upload / permission code below is preserved verbatim — do not reshape ──
  const openCamera = async () => {
    if (Platform.OS === 'android') {
      try {
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (!already) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission Required',
              message: 'The app needs camera access to capture your bill.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Camera Permission Blocked',
              'Camera access is blocked. Please enable it in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return;
          }
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Camera access is required to capture bill photos.');
            return;
          }
        }
      } catch {
        Alert.alert('Error', 'Could not request camera permission.');
        return;
      }
    }

    _launchCamera(
      { mediaType: 'photo', quality: 0.8, saveToPhotos: false, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode === 'permission') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera access in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        if (res.errorCode === 'camera_unavailable') {
          Alert.alert('Camera Unavailable', 'No camera found on this device.');
          return;
        }
        if (res.errorCode) {
          Alert.alert('Camera Error', res.errorMessage ?? 'Could not open camera.');
          return;
        }
        const asset = res.assets?.[0];
        if (asset?.uri) {
          setBillUri(asset.uri);
          setBillName(asset.fileName ?? `bill_${Date.now()}.jpg`);
        }
      },
    );
  };

  const openPhotoLibrary = async () => {
    if (Platform.OS === 'android') {
      try {
        const permission = Number(Platform.Version) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        const already = await PermissionsAndroid.check(permission);
        if (!already) {
          const result = await PermissionsAndroid.request(permission, {
            title: 'Photo Library Permission Required',
            message: 'The app needs access to your photos to attach a bill.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          });
          if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Photo Permission Blocked',
              'Photo access is blocked. Please enable it in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return;
          }
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Photo library access is required to attach a bill.');
            return;
          }
        }
      } catch {
        Alert.alert('Error', 'Could not request photo library permission.');
        return;
      }
    }

    _launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, includeBase64: false },
      res => {
        if (res.didCancel) return;
        if (res.errorCode === 'permission') {
          Alert.alert(
            'Photo Permission Required',
            'Please enable photo library access in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        if (res.errorCode) {
          Alert.alert('Error', res.errorMessage ?? 'Could not open photo library.');
          return;
        }
        const asset = res.assets?.[0];
        if (asset?.uri) {
          setBillUri(asset.uri);
          setBillName(asset.fileName ?? `bill_${Date.now()}.jpg`);
        }
      },
    );
  };

  const handlePickBill = () => {
    Alert.alert('Attach Bill', 'Choose source', [
      { text: 'Camera', onPress: openCamera },
      { text: 'Photo Library', onPress: openPhotoLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  // ── end preserved upload block ──

  const handle = () => {
    if (!expenseDate || !amount) { Alert.alert('Validation', 'Date and amount are required.'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Validation', 'Enter a valid amount.'); return; }
    onSubmit({ expenseDate, category, amount: amt, description, billUri, billName });
  };

  const catLabel = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;

  return (
    <FormModal
      visible
      wide={wide}
      title="Submit Expense Claim"
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={submitting ? 'Submitting…' : 'Submit Claim'}
            onPress={handle}
            loading={submitting}
            disabled={submitting}
            small
            icon={<Send size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
          />
        </>
      }
    >
      <View style={s.mForm}>
        <View style={wide ? s.row2 : s.col2}>
          <Field label="Expense Date *" style={wide ? { flex: 1 } : undefined}>
            <DateInput value={expenseDate} onChange={setExpenseDate} accentColor={T.accent} />
          </Field>

          {/* A Trigger+Dropdown inside a form modal is a field, not a modal-as-picker. */}
          <Field label="Category *" style={wide ? { flex: 1, zIndex: 20 } : { zIndex: 20 }}>
            <Trigger label={catLabel} open={openCat} onPress={() => setOpenCat(v => !v)} />
            {openCat && (
              <Dropdown
                style={s.ddFull}
                value={category}
                onSelect={v => { setCategory(v); setOpenCat(false); }}
                options={EXPENSE_CATEGORIES}
              />
            )}
          </Field>
        </View>

        <Field label="Amount (₹) *">
          <View style={[s.inputBox, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={T.dim}
              keyboardType="numeric"
              style={[s.inputTxt, { color: T.text }]}
            />
          </View>
        </Field>

        {/* Kit Input hard-codes height 46 — a multiline field needs Field + TextInput. */}
        <Field label="Description (optional)">
          <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Brief description"
              placeholderTextColor={T.dim}
              multiline
              style={[s.textareaTxt, { color: T.text }]}
            />
          </View>
        </Field>

        <Field label="Upload Bill (optional)">
          <TouchableOpacity
            style={[s.billBtn, { backgroundColor: T.cardAlt, borderColor: T.line }]}
            onPress={handlePickBill}
            activeOpacity={0.8}
          >
            <Paperclip size={15} color={T.accent} strokeWidth={ICON_STROKE} />
            <Text style={[s.billTxt, { color: billName ? T.text : T.dim }]} numberOfLines={1}>
              {billName || 'Attach receipt / bill'}
            </Text>
            {!!billUri && (
              <TouchableOpacity onPress={() => { setBillUri(null); setBillName(null); }} hitSlop={10}>
                <X size={14} color={T.dim} strokeWidth={ICON_STROKE} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Field>
        {!!billUri && (
          <Image source={{ uri: billUri }} style={[s.billPreview, { borderColor: T.line }]} resizeMode="cover" />
        )}
      </View>
    </FormModal>
  );
}

// ─── Reject modal (reason required) ───────────────────────────────────────────
function RejectModal({ title, onClose, onReject, rejecting }: {
  title: string; onClose: () => void; onReject: (reason: string) => void; rejecting: boolean;
}) {
  const T = useAppTheme();
  const [reason, setReason] = useState('');
  return (
    <FormModal
      visible
      title={title}
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }} />
          <Btn label="Cancel" variant="secondary" onPress={onClose} small />
          <Btn
            label={rejecting ? 'Rejecting…' : 'Reject'}
            variant="danger"
            onPress={() => {
              if (!reason.trim()) { Alert.alert('Reason Required', 'Please provide a reason for rejection.'); return; }
              onReject(reason.trim());
            }}
            loading={rejecting}
            disabled={rejecting}
            small
          />
        </>
      }
    >
      <Field label="Reason *">
        <View style={[s.textarea, { backgroundColor: T.card, borderColor: T.line }]}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rejection (required)"
            placeholderTextColor={T.dim}
            multiline
            style={[s.textareaTxt, { color: T.text }]}
          />
        </View>
      </Field>
    </FormModal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export const AllowancesScreen = () => {
  const { user } = useAuth();
  const T = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wide = isTabletDevice && width > height;
  const table = isTabletDevice;

  const role = user?.role || 'FO';
  /** Web: `const isManager = user?.role !== 'FO'`. Matched exactly — never narrow this. */
  const isManager = role !== 'FO';
  /** AllowanceDto.UserId is an int and UserDto.Id is a number — strict === is safe. */
  const myUserId = user?.id;

  const { from: defaultFrom, to: defaultTo } = getMonthRange();
  const [mainTab, setMainTab] = useState<MainTab>('travel');

  // ── Travel state ──
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [tLoading, setTLoading] = useState(true);
  const [tError, setTError] = useState<'none' | 'offline' | 'error'>('none');
  const [tStatus, setTStatus] = useState<TStatus>('all');
  const [travTab, setTravTab] = useState<SubTab>('my');
  const [tUserFilter, setTUserFilter] = useState('');
  const [tSelected, setTSelected] = useState<Set<number>>(new Set());
  const [tPage, setTPage] = useState(1);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [tFiltersOpen, setTFiltersOpen] = useState(false);
  const [tOpenDd, setTOpenDd] = useState<'member' | null>(null);

  // ── Expense state ──
  const [expFrom, setExpFrom] = useState(defaultFrom);
  const [expTo, setExpTo] = useState(defaultTo);
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [teamExpenses, setTeamExpenses] = useState<any[]>([]);
  const [eLoading, setELoading] = useState(true);
  const [eError, setEError] = useState<'none' | 'offline' | 'error'>('none');
  const [eStatus, setEStatus] = useState<EStatus>('all');
  const [eCat, setECat] = useState('');
  const [expTab, setExpTab] = useState<SubTab>('my');
  const [ePage, setEPage] = useState(1);
  const [eSelected, setESelected] = useState<Set<number>>(new Set());
  const [eBulkApproving, setEBulkApproving] = useState(false);
  const [eFiltersOpen, setEFiltersOpen] = useState(false);
  const [eOpenDd, setEOpenDd] = useState<'cat' | null>(null);

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [rejectClaimId, setRejectClaimId] = useState<number | null>(null);
  const [rejectTravelId, setRejectTravelId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [confirmBulkTravel, setConfirmBulkTravel] = useState(false);
  const [confirmBulkExpense, setConfirmBulkExpense] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    authApi.getUsers().then(res => setTeamMembers(res.data || [])).catch(() => {});
  }, [isManager]);

  // ── Travel fetch ──
  const fetchTravel = useCallback(async (silent = false) => {
    if (!silent) setTLoading(true);
    try {
      // The controller binds `filterUserId` — NOT `userId`, which trackingApi sends and
      // the server silently drops. Called directly so the member filter actually works.
      const res = await apiClient.get<any>('/tracking/allowances', {
        params: {
          from: dateFrom,
          to: dateTo,
          filterUserId: tUserFilter ? Number(tUserFilter) : undefined,
        },
      });
      const data: any = res.data;
      setAllowances(data?.allowances || (Array.isArray(data) ? data : []));
      setTError('none');
      setTSelected(new Set());
    } catch (err: any) {
      setAllowances([]);
      setTError(err?.response ? 'error' : 'offline');
    } finally {
      setTLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, tUserFilter]);

  useEffect(() => { if (mainTab === 'travel') fetchTravel(); }, [fetchTravel, mainTab]);

  // ── Expense fetch ──
  const fetchExpenses = useCallback(async (silent = false) => {
    if (!silent) setELoading(true);
    try {
      // GetMyClaims/GetTeamClaims bind status, category, from, to — all four are real.
      const params: any = { from: expFrom, to: expTo };
      if (eStatus !== 'all') params.status = eStatus;
      if (eCat) params.category = eCat;
      const [myRes, teamRes] = await Promise.all([
        expenseClaimsApi.getMyClaims(params),
        isManager ? expenseClaimsApi.getTeamClaims(params) : Promise.resolve({ data: [] }),
      ]);
      setMyExpenses(myRes.data || []);
      setTeamExpenses((teamRes as any).data || []);
      setEError('none');
      setESelected(new Set());
    } catch (err: any) {
      setMyExpenses([]);
      setTeamExpenses([]);
      setEError(err?.response ? 'error' : 'offline');
    } finally {
      setELoading(false);
      setRefreshing(false);
    }
  }, [expFrom, expTo, eStatus, eCat, isManager]);

  useEffect(() => { if (mainTab === 'expense') fetchExpenses(); }, [fetchExpenses, mainTab]);

  // ── Travel derived ──
  // Web splits a manager's own rows from their team's; FOs only ever see their own.
  const allowancesForTab = useMemo(() => {
    if (!isManager) return allowances;
    return travTab === 'my'
      ? allowances.filter(a => a.userId === myUserId)
      : allowances.filter(a => a.userId !== myUserId);
  }, [allowances, isManager, travTab, myUserId]);

  const tFiltered = useMemo(() => allowancesForTab.filter(a => {
    if (tStatus === 'pending') return !a.approved;
    if (tStatus === 'approved') return a.approved;
    return true;
  }), [allowancesForTab, tStatus]);

  const tTotal = allowancesForTab.reduce((n: number, a: any) => n + (a.grossAmount || 0), 0);
  const tApproved = allowancesForTab.filter((a: any) => a.approved).reduce((n: number, a: any) => n + (a.grossAmount || 0), 0);
  const tPendingAmt = allowancesForTab.filter((a: any) => !a.approved).reduce((n: number, a: any) => n + (a.grossAmount || 0), 0);
  const tPendingRows = tFiltered.filter((a: any) => !a.approved);

  const tTotalPages = Math.max(1, Math.ceil(tFiltered.length / PAGE_SIZE));
  const tRows = useMemo(
    () => tFiltered.slice((tPage - 1) * PAGE_SIZE, tPage * PAGE_SIZE),
    [tFiltered, tPage],
  );
  useEffect(() => { setTPage(1); }, [tStatus, travTab, tUserFilter, dateFrom, dateTo]);

  // ── Expense derived ──
  const currentExpenses = expTab === 'my' ? myExpenses : teamExpenses;
  const eTotal = currentExpenses.reduce((n: number, e: any) => n + (e.amount || 0), 0);
  const eApprovedAmt = currentExpenses.filter((e: any) => e.status === 'Approved').reduce((n: number, e: any) => n + (e.amount || 0), 0);
  const ePendingAmt = currentExpenses.filter((e: any) => e.status === 'Pending').reduce((n: number, e: any) => n + (e.amount || 0), 0);
  const ePendingRows = currentExpenses.filter((e: any) => e.status === 'Pending');

  const eTotalPages = Math.max(1, Math.ceil(currentExpenses.length / PAGE_SIZE));
  const eRows = useMemo(
    () => currentExpenses.slice((ePage - 1) * PAGE_SIZE, ePage * PAGE_SIZE),
    [currentExpenses, ePage],
  );
  useEffect(() => { setEPage(1); }, [eStatus, eCat, expTab, expFrom, expTo]);

  // ── Travel actions ──
  const handleTravelApprove = async (id: number) => {
    try {
      await trackingApi.approveAllowance(id, { approved: true });
      fetchTravel(true);
    } catch { Alert.alert('Error', 'Failed to approve allowance.'); }
  };

  const handleTravelReject = async (reason: string) => {
    if (!rejectTravelId) return;
    setRejecting(true);
    try {
      await trackingApi.approveAllowance(rejectTravelId, { approved: false, remarks: reason });
      setRejectTravelId(null);
      fetchTravel(true);
      Alert.alert('Rejected', 'The travel allowance was rejected.');
    } catch { Alert.alert('Error', 'Failed to reject allowance.'); }
    finally { setRejecting(false); }
  };

  const handleBulkApproveTravel = async () => {
    setConfirmBulkTravel(false);
    if (tSelected.size === 0) return;
    setBulkApproving(true);
    try {
      const res: any = await trackingApi.bulkApproveAllowances({ ids: [...tSelected], approved: true });
      const count = res?.data?.count ?? tSelected.size;
      setTSelected(new Set());
      fetchTravel(true);
      Alert.alert('Approved', `${count} travel allowance${count === 1 ? '' : 's'} approved.`);
    } catch { Alert.alert('Error', 'Failed to bulk approve.'); }
    finally { setBulkApproving(false); }
  };

  const toggleTSelect = (id: number) =>
    setTSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleTSelectAll = () =>
    setTSelected(
      tSelected.size === tPendingRows.length && tPendingRows.length > 0
        ? new Set()
        : new Set(tPendingRows.map((a: any) => a.id)),
    );

  // ── Expense actions ──
  const handleSubmitExpense = async (form: any) => {
    setExpSubmitting(true);
    try {
      // ALWAYS multipart: the controller binds [FromForm], so a JSON body cannot
      // bind and a claim without a receipt used to fail outright. The `bill` part
      // is simply omitted when there is no file — same shape web posts.
      const fd = new FormData();
      fd.append('expenseDate', form.expenseDate);
      fd.append('category', form.category);
      fd.append('amount', String(form.amount));
      if (form.description) fd.append('description', form.description);
      if (form.billUri) {
        fd.append('bill', { uri: form.billUri, type: 'image/jpeg', name: form.billName || 'bill.jpg' } as any);
      }
      await expenseClaimsApi.createClaimWithBill(fd);
      setShowExpForm(false);
      fetchExpenses(true);
      Alert.alert('Claim Submitted', 'Your expense claim was submitted and is pending approval.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit the claim.');
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleExpenseApprove = async (id: number) => {
    try {
      await expenseClaimsApi.approveClaim(id);
      fetchExpenses(true);
    } catch { Alert.alert('Error', 'Failed to approve claim.'); }
  };

  const handleExpenseReject = async (reason: string) => {
    if (!rejectClaimId) return;
    setRejecting(true);
    try {
      await expenseClaimsApi.rejectClaim(rejectClaimId, { rejectionReason: reason });
      setRejectClaimId(null);
      fetchExpenses(true);
      Alert.alert('Rejected', 'The expense claim was rejected.');
    } catch { Alert.alert('Error', 'Failed to reject claim.'); }
    finally { setRejecting(false); }
  };

  const handleBulkApproveExpense = async () => {
    setConfirmBulkExpense(false);
    if (eSelected.size === 0) return;
    setEBulkApproving(true);
    try {
      const res: any = await expenseClaimsApi.bulkApprove({ ids: [...eSelected] });
      const count = res?.data?.count ?? eSelected.size;
      setESelected(new Set());
      fetchExpenses(true);
      Alert.alert('Approved', `${count} expense claim${count === 1 ? '' : 's'} approved.`);
    } catch { Alert.alert('Error', 'Failed to bulk approve.'); }
    finally { setEBulkApproving(false); }
  };

  const toggleESelect = (id: number) =>
    setESelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleESelectAll = () =>
    setESelected(
      eSelected.size === ePendingRows.length && ePendingRows.length > 0
        ? new Set()
        : new Set(ePendingRows.map((e: any) => e.id)),
    );

  // ── shared bits ──
  const memberOptions = useMemo(() => ([
    { label: 'All Team Members', value: '' },
    ...teamMembers
      .filter(m => m.id !== myUserId)
      .map(m => ({ label: `${m.name} (${m.role})`, value: String(m.id) })),
  ]), [teamMembers, myUserId]);

  const catOptions = [{ label: 'All Categories', value: '' }, ...EXPENSE_CATEGORIES];

  const stateCard = (title: string, msg: string, icon: React.ReactNode) => (
    <View style={[s.empty, { backgroundColor: T.card, borderColor: T.line }]}>
      {icon}
      <Text style={[s.emptyTitle, { color: T.text }]}>{title}</Text>
      <Text style={[s.emptyTxt, { color: T.dim }]}>{msg}</Text>
    </View>
  );

  const errorCard = (kind: 'offline' | 'error') =>
    stateCard(
      kind === 'offline' ? "You're offline" : 'Could not load data',
      kind === 'offline' ? 'Reconnect and pull down to try again.' : 'Pull down to retry.',
      kind === 'offline'
        ? <WifiOff size={34} color={T.dim} strokeWidth={ICON_STROKE} />
        : <AlertTriangle size={34} color={T.danger} strokeWidth={ICON_STROKE} />,
    );

  // ═══ TRAVEL ═══
  const travelActions = (a: any) => {
    if (a.approved) {
      return <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{a.approvedByName || ''}</Text>;
    }
    return (
      <View style={s.actions}>
        <IconBtn kind="view" label="Approve" onPress={() => handleTravelApprove(a.id)}>
          <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <IconBtn kind="del" label="Reject" onPress={() => setRejectTravelId(a.id)}>
          <X size={14} color={T.danger} strokeWidth={ICON_STROKE} />
        </IconBtn>
      </View>
    );
  };

  const fraudCell = (a: any) => {
    // Web renders the score when fraudScore > 0 OR isSuspicious; suspicious = danger,
    // merely-scored = warning. Distinct hues, never the same tier twice.
    if (!(a.fraudScore > 0 || a.isSuspicious)) {
      return <Text style={[s.td, { color: T.dim }]}>{DASH}</Text>;
    }
    return <StatusBadge label={String(a.fraudScore || 0)} color={a.isSuspicious ? T.danger : T.warning} />;
  };

  const showTravelChecks = isManager && travTab === 'team' && tPendingRows.length > 0;

  const renderTravelTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        {showTravelChecks && (
          <View style={s.cCheck}>
            <Checkbox
              on={tSelected.size === tPendingRows.length && tPendingRows.length > 0}
              onToggle={toggleTSelectAll}
            />
          </View>
        )}
        <Text style={[s.th, { color: T.dim }, s.cName]}>Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cRole]}>Role</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cDist]}>Distance</Text>
        <Text style={[s.th, { color: T.dim }, s.cRate]}>Rate</Text>
        <Text style={[s.th, { color: T.dim }, s.cAmt]}>Amount</Text>
        <Text style={[s.th, { color: T.dim }, s.cFraud]}>Fraud</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        {isManager && <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>}
      </View>

      {tRows.map((a: any) => (
        <View
          key={a.id}
          style={[
            s.tr,
            { borderTopColor: T.line, borderTopWidth: 1 },
            tSelected.has(a.id) && { backgroundColor: T.accentSoft },
          ]}
        >
          {showTravelChecks && (
            <View style={s.cCheck}>
              {!a.approved ? <Checkbox on={tSelected.has(a.id)} onToggle={() => toggleTSelect(a.id)} /> : <View />}
            </View>
          )}
          <View style={[s.cName, s.nameCell]}>
            <Avatar initials={initialsOf(a.userName)} />
            <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{a.userName || DASH}</Text>
          </View>
          <View style={s.cRole}>
            {a.role ? <StatusBadge label={a.role} color={T.info} /> : <Text style={[s.td, { color: T.dim }]}>{DASH}</Text>}
          </View>
          <Text style={[s.td, { color: T.sub }, s.cDate]} numberOfLines={1}>{fmtDate(a.allowanceDate)}</Text>
          <Text style={[s.td, { color: T.text }, s.cDist]} numberOfLines={1}>
            {a.distanceKm != null ? `${Number(a.distanceKm).toFixed(1)} km` : DASH}
          </Text>
          <Text style={[s.td, { color: T.dim }, s.cRate]} numberOfLines={1}>{fmtCurrency(a.ratePerKm)}/km</Text>
          <Text style={[s.tdAmt, { color: T.text }, s.cAmt]} numberOfLines={1}>{fmtCurrency(a.grossAmount)}</Text>
          <View style={s.cFraud}>{fraudCell(a)}</View>
          <View style={s.cStatus}>
            <StatusBadge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? T.success : T.warning} />
          </View>
          {isManager && <View style={s.cActions}>{travelActions(a)}</View>}
        </View>
      ))}
    </View>
  );

  const renderTravelRows = () => (
    <View style={{ gap: 8 }}>
      {tRows.map((a: any) => (
        <ListCard key={a.id} style={[s.rowCard, tSelected.has(a.id) && { borderColor: T.accent }]}>
          {showTravelChecks && !a.approved && (
            <Checkbox on={tSelected.has(a.id)} onToggle={() => toggleTSelect(a.id)} />
          )}
          <Avatar initials={initialsOf(a.userName)} />
          <View style={{ flex: 1 }}>
            <View style={s.rowTop}>
              <Text style={[s.tdName, { color: T.text, flex: 1 }]} numberOfLines={1}>{a.userName || DASH}</Text>
              <Text style={[s.tdAmt, { color: T.text }]}>{fmtCurrency(a.grossAmount)}</Text>
            </View>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>
              {[a.role, fmtDate(a.allowanceDate)].filter(Boolean).join(' • ')}
            </Text>
            <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={1}>
              {a.distanceKm != null ? `${Number(a.distanceKm).toFixed(1)} km` : DASH} @ {fmtCurrency(a.ratePerKm)}/km
            </Text>
            <View style={s.rowStats}>
              <StatusBadge label={a.approved ? 'Approved' : 'Pending'} color={a.approved ? T.success : T.warning} />
              {(a.fraudScore > 0 || a.isSuspicious) && (
                <StatusBadge
                  label={`Fraud ${a.fraudScore || 0}`}
                  color={a.isSuspicious ? T.danger : T.warning}
                />
              )}
            </View>
            {isManager && !a.approved && <View style={s.rowActions}>{travelActions(a)}</View>}
            {isManager && a.approved && !!a.approvedByName && (
              <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>Approved by {a.approvedByName}</Text>
            )}
          </View>
        </ListCard>
      ))}
    </View>
  );

  // ═══ EXPENSE ═══
  // Web gates the approve/reject column behind `isManager && expTab === 'team'` — the
  // checkbox column additionally needs pending rows to exist. Matched exactly.
  const showExpenseActionsCol = isManager && expTab === 'team';
  const showExpenseChecks = showExpenseActionsCol && ePendingRows.length > 0;

  const expenseActions = (e: any) => {
    if (e.status !== 'Pending') {
      return <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{e.actionedByName || ''}</Text>;
    }
    return (
      <View style={s.actions}>
        <IconBtn kind="view" label="Approve" onPress={() => handleExpenseApprove(e.id)}>
          <Check size={14} color={T.success} strokeWidth={ICON_STROKE} />
        </IconBtn>
        <IconBtn kind="del" label="Reject" onPress={() => setRejectClaimId(e.id)}>
          <X size={14} color={T.danger} strokeWidth={ICON_STROKE} />
        </IconBtn>
      </View>
    );
  };

  const billCell = (e: any) =>
    e.billUrl ? (
      <TouchableOpacity style={s.billLink} onPress={() => Linking.openURL(e.billUrl)} hitSlop={6}>
        <ExternalLink size={12} color={T.accent} strokeWidth={ICON_STROKE} />
        <Text style={[s.billLinkTxt, { color: T.accent }]}>View Bill</Text>
      </TouchableOpacity>
    ) : (
      <Text style={[s.td, { color: T.dim }]}>No bill</Text>
    );

  const renderExpenseTable = () => (
    <View style={[s.tbl, { backgroundColor: T.card, borderColor: T.line }]}>
      <View style={[s.tr, { backgroundColor: T.cardAlt }]}>
        {showExpenseChecks && (
          <View style={s.cCheck}>
            <Checkbox
              on={eSelected.size === ePendingRows.length && ePendingRows.length > 0}
              onToggle={toggleESelectAll}
            />
          </View>
        )}
        <Text style={[s.th, { color: T.dim }, s.cName]}>Name</Text>
        <Text style={[s.th, { color: T.dim }, s.cDate]}>Date</Text>
        <Text style={[s.th, { color: T.dim }, s.cCat]}>Category</Text>
        <Text style={[s.th, { color: T.dim }, s.cAmt]}>Amount</Text>
        <Text style={[s.th, { color: T.dim }, s.cBill]}>Bill</Text>
        <Text style={[s.th, { color: T.dim }, s.cDesc]}>Description</Text>
        <Text style={[s.th, { color: T.dim }, s.cStatus]}>Status</Text>
        {showExpenseActionsCol && <Text style={[s.th, { color: T.dim }, s.cActions]}>Actions</Text>}
      </View>

      {eRows.map((e: any) => (
        <View
          key={e.id}
          style={[
            s.tr,
            { borderTopColor: T.line, borderTopWidth: 1 },
            eSelected.has(e.id) && { backgroundColor: T.accentSoft },
          ]}
        >
          {showExpenseChecks && (
            <View style={s.cCheck}>
              {e.status === 'Pending' ? <Checkbox on={eSelected.has(e.id)} onToggle={() => toggleESelect(e.id)} /> : <View />}
            </View>
          )}
          <View style={[s.cName, s.nameCell]}>
            <Avatar initials={initialsOf(e.userName)} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tdName, { color: T.text }]} numberOfLines={1}>{e.userName || DASH}</Text>
              {expTab === 'team' && !!e.userRole && (
                <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{e.userRole}</Text>
              )}
            </View>
          </View>
          <Text style={[s.td, { color: T.sub }, s.cDate]} numberOfLines={1}>{fmtDate(e.expenseDate)}</Text>
          <View style={s.cCat}>
            <StatusBadge
              label={EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
              color={categoryColor(T, e.category)}
            />
          </View>
          <Text style={[s.tdAmt, { color: T.text }, s.cAmt]} numberOfLines={1}>{fmtCurrency(e.amount)}</Text>
          <View style={s.cBill}>{billCell(e)}</View>
          <Text style={[s.td, { color: T.sub }, s.cDesc]} numberOfLines={1}>{e.description || DASH}</Text>
          <View style={s.cStatus}>
            <StatusBadge label={e.status} color={statusColor(T, e.status)} />
            {!!e.rejectionReason && (
              <Text style={[s.tdSub, { color: T.danger }]} numberOfLines={1}>{e.rejectionReason}</Text>
            )}
          </View>
          {showExpenseActionsCol && <View style={s.cActions}>{expenseActions(e)}</View>}
        </View>
      ))}
    </View>
  );

  const renderExpenseRows = () => (
    <View style={{ gap: 8 }}>
      {eRows.map((e: any) => (
        <ListCard key={e.id} style={[s.rowCard, eSelected.has(e.id) && { borderColor: T.accent }]}>
          {showExpenseChecks && e.status === 'Pending' && (
            <Checkbox on={eSelected.has(e.id)} onToggle={() => toggleESelect(e.id)} />
          )}
          <Avatar initials={initialsOf(e.userName)} />
          <View style={{ flex: 1 }}>
            <View style={s.rowTop}>
              <Text style={[s.tdName, { color: T.text, flex: 1 }]} numberOfLines={1}>
                {e.userName || DASH}{expTab === 'team' && e.userRole ? ` (${e.userRole})` : ''}
              </Text>
              <Text style={[s.tdAmt, { color: T.text }]}>{fmtCurrency(e.amount)}</Text>
            </View>
            <Text style={[s.tdSub, { color: T.dim }]} numberOfLines={1}>{fmtDate(e.expenseDate)}</Text>
            <View style={s.rowStats}>
              <StatusBadge
                label={EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                color={categoryColor(T, e.category)}
              />
              <StatusBadge label={e.status} color={statusColor(T, e.status)} />
            </View>
            {!!e.description && (
              <Text style={[s.tdSub, { color: T.sub }]} numberOfLines={2}>{e.description}</Text>
            )}
            {!!e.rejectionReason && (
              <Text style={[s.tdSub, { color: T.danger }]} numberOfLines={2}>Rejected: {e.rejectionReason}</Text>
            )}
            {!!e.billUrl && <View style={{ marginTop: 5 }}>{billCell(e)}</View>}
            {showExpenseActionsCol && e.status === 'Pending' && (
              <View style={s.rowActions}>{expenseActions(e)}</View>
            )}
          </View>
        </ListCard>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[s.scroll, wide && s.scrollWide]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              mainTab === 'travel' ? fetchTravel(true) : fetchExpenses(true);
            }}
            colors={[T.accent]}
            tintColor={T.accent}
          />
        }
      >
        {/* Plain themed title block on T.bg — house pattern, no gradient hero. */}
        <View style={s.header}>
          <Text style={[s.title, { color: T.text }]}>Allowances</Text>
          <Text style={[s.sub, { color: T.dim }]}>
            {isManager ? 'Review and approve allowances for your team' : 'View your allowance history'}
          </Text>
        </View>

        <Segmented<MainTab>
          value={mainTab}
          onChange={setMainTab}
          style={wide ? { width: 340 } : undefined}
          options={[{ label: 'Travel Allowance', value: 'travel' }, { label: 'Expense Claims', value: 'expense' }]}
        />

        {/* ═══ TRAVEL ═══ */}
        {mainTab === 'travel' && (
          <>
            {/* Managers switch between their own and their team's — web parity. */}
            {isManager && (
              <Segmented<SubTab>
                value={travTab}
                onChange={v => { setTravTab(v); setTSelected(new Set()); }}
                style={wide ? { width: 300 } : undefined}
                options={[{ label: 'My Allowances', value: 'my' }, { label: 'Team Allowances', value: 'team' }]}
              />
            )}

            <SummaryRow total={tTotal} approved={tApproved} pending={tPendingAmt} totalLabel="Total" wide={wide} />

            <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
              <View style={s.ctrlRow}>
                <Segmented<TStatus>
                  value={tStatus}
                  onChange={setTStatus}
                  style={wide ? { width: 260 } : { flex: 1 }}
                  options={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }]}
                />
                <Trigger
                  label="Filters"
                  open={tFiltersOpen}
                  onPress={() => setTFiltersOpen(v => !v)}
                  icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
                />
                {isManager && travTab === 'team' && tPendingRows.length > 0 && (
                  <Btn
                    label={`Approve Selected (${tSelected.size})`}
                    variant="success"
                    small
                    disabled={tSelected.size === 0 || bulkApproving}
                    loading={bulkApproving}
                    onPress={() => setConfirmBulkTravel(true)}
                    icon={<Check size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  />
                )}
              </View>

              <View style={s.countRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  {tFiltered.length} allowance{tFiltered.length === 1 ? '' : 's'}
                </Text>
                {tUserFilter !== '' && (
                  <FilterChip
                    label={memberOptions.find(m => m.value === tUserFilter)?.label || 'Member'}
                    onRemove={() => setTUserFilter('')}
                  />
                )}
              </View>

              {tFiltersOpen && (
                <View style={[s.filters, { borderTopColor: T.line }, wide && s.filtersWide]}>
                  <Field label="From" style={wide ? { flex: 1 } : undefined}>
                    <DateInput value={dateFrom} onChange={setDateFrom} accentColor={T.accent} />
                  </Field>
                  <Field label="To" style={wide ? { flex: 1 } : undefined}>
                    <DateInput value={dateTo} onChange={setDateTo} accentColor={T.accent} />
                  </Field>
                  {isManager && travTab === 'team' && memberOptions.length > 1 && (
                    <Field label="Team Member" style={wide ? { flex: 1, zIndex: 10 } : { zIndex: 10 }}>
                      <Trigger
                        label={memberOptions.find(m => m.value === tUserFilter)?.label || 'All Team Members'}
                        open={tOpenDd === 'member'}
                        onPress={() => setTOpenDd(tOpenDd === 'member' ? null : 'member')}
                      />
                      {tOpenDd === 'member' && (
                        <Dropdown
                          style={s.ddFull}
                          maxHeight={220}
                          value={tUserFilter}
                          onSelect={v => { setTUserFilter(v); setTOpenDd(null); }}
                          options={memberOptions}
                        />
                      )}
                    </Field>
                  )}
                </View>
              )}
            </View>

            {tLoading ? (
              <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
            ) : tError !== 'none' ? (
              errorCard(tError)
            ) : tFiltered.length === 0 ? (
              stateCard(
                'No travel allowances',
                'Nothing recorded for the selected period.',
                <DollarSign size={34} color={T.dim} strokeWidth={ICON_STROKE} />,
              )
            ) : (
              <>
                {table ? renderTravelTable() : renderTravelRows()}
                {tTotalPages > 1 && (
                  <View style={s.pgRow}>
                    <Text style={[s.count, { color: T.dim }]}>
                      Showing {(tPage - 1) * PAGE_SIZE + 1}{DASH}{Math.min(tPage * PAGE_SIZE, tFiltered.length)} of {tFiltered.length}
                    </Text>
                    <Pagination page={tPage} pageCount={tTotalPages} onChange={setTPage} />
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ EXPENSE ═══ */}
        {mainTab === 'expense' && (
          <>
            <SummaryRow total={eTotal} approved={eApprovedAmt} pending={ePendingAmt} totalLabel="Total Claims" wide={wide} />

            <View style={s.subRow}>
              {isManager ? (
                <Segmented<SubTab>
                  value={expTab}
                  onChange={v => { setExpTab(v); setESelected(new Set()); }}
                  style={wide ? { width: 260 } : { flex: 1 }}
                  options={[{ label: 'My Claims', value: 'my' }, { label: 'Team Claims', value: 'team' }]}
                />
              ) : <View style={{ flex: 1 }} />}
              {expTab === 'my' && (
                <Btn
                  label="Submit Expense"
                  small
                  onPress={() => setShowExpForm(true)}
                  icon={<Plus size={15} color="#FFF" strokeWidth={ICON_STROKE} />}
                />
              )}
            </View>

            <View style={[s.card, { backgroundColor: T.card, borderColor: T.line }]}>
              <View style={s.ctrlRow}>
                <Segmented<EStatus>
                  value={eStatus}
                  onChange={setEStatus}
                  style={wide ? { width: 320 } : { flex: 1 }}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Pending', value: 'Pending' },
                    { label: 'Approved', value: 'Approved' },
                    { label: 'Rejected', value: 'Rejected' },
                  ]}
                />
                <Trigger
                  label="Filters"
                  open={eFiltersOpen}
                  onPress={() => setEFiltersOpen(v => !v)}
                  icon={<Filter size={14} color={T.sub} strokeWidth={ICON_STROKE} />}
                />
                {showExpenseActionsCol && ePendingRows.length > 0 && (
                  <Btn
                    label={`Approve Selected (${eSelected.size})`}
                    variant="success"
                    small
                    disabled={eSelected.size === 0 || eBulkApproving}
                    loading={eBulkApproving}
                    onPress={() => setConfirmBulkExpense(true)}
                    icon={<Check size={14} color="#FFF" strokeWidth={ICON_STROKE} />}
                  />
                )}
              </View>

              <View style={s.countRow}>
                <Text style={[s.count, { color: T.dim }]}>
                  {currentExpenses.length} claim{currentExpenses.length === 1 ? '' : 's'}
                </Text>
                {eCat !== '' && (
                  <FilterChip
                    label={catOptions.find(c => c.value === eCat)?.label || 'Category'}
                    onRemove={() => setECat('')}
                  />
                )}
              </View>

              {eFiltersOpen && (
                <View style={[s.filters, { borderTopColor: T.line }, wide && s.filtersWide]}>
                  <Field label="From" style={wide ? { flex: 1 } : undefined}>
                    <DateInput value={expFrom} onChange={setExpFrom} accentColor={T.accent} />
                  </Field>
                  <Field label="To" style={wide ? { flex: 1 } : undefined}>
                    <DateInput value={expTo} onChange={setExpTo} accentColor={T.accent} />
                  </Field>
                  <Field label="Category" style={wide ? { flex: 1, zIndex: 10 } : { zIndex: 10 }}>
                    <Trigger
                      label={catOptions.find(c => c.value === eCat)?.label || 'All Categories'}
                      open={eOpenDd === 'cat'}
                      onPress={() => setEOpenDd(eOpenDd === 'cat' ? null : 'cat')}
                    />
                    {eOpenDd === 'cat' && (
                      <Dropdown
                        style={s.ddFull}
                        value={eCat}
                        onSelect={v => { setECat(v); setEOpenDd(null); }}
                        options={catOptions}
                      />
                    )}
                  </Field>
                </View>
              )}
            </View>

            {eLoading ? (
              <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
            ) : eError !== 'none' ? (
              errorCard(eError)
            ) : currentExpenses.length === 0 ? (
              stateCard(
                'No expense claims found',
                expTab === 'my'
                  ? 'Submit a claim and it will appear here.'
                  : 'Your team has no claims for the selected period.',
                <FileText size={34} color={T.dim} strokeWidth={ICON_STROKE} />,
              )
            ) : (
              <>
                {table ? renderExpenseTable() : renderExpenseRows()}
                {eTotalPages > 1 && (
                  <View style={s.pgRow}>
                    <Text style={[s.count, { color: T.dim }]}>
                      Showing {(ePage - 1) * PAGE_SIZE + 1}{DASH}{Math.min(ePage * PAGE_SIZE, currentExpenses.length)} of {currentExpenses.length}
                    </Text>
                    <Pagination page={ePage} pageCount={eTotalPages} onChange={setEPage} />
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {showExpForm && (
        <ExpenseFormModal
          onClose={() => setShowExpForm(false)}
          onSubmit={handleSubmitExpense}
          submitting={expSubmitting}
        />
      )}

      {rejectClaimId !== null && (
        <RejectModal
          title="Reject Expense Claim"
          onClose={() => setRejectClaimId(null)}
          onReject={handleExpenseReject}
          rejecting={rejecting}
        />
      )}

      {rejectTravelId !== null && (
        <RejectModal
          title="Reject Travel Allowance"
          onClose={() => setRejectTravelId(null)}
          onReject={handleTravelReject}
          rejecting={rejecting}
        />
      )}

      <ConfirmModal
        visible={confirmBulkTravel}
        tone="success"
        title="Approve Allowances?"
        message={`${tSelected.size} travel allowance${tSelected.size === 1 ? '' : 's'} will be approved. This cannot be undone.`}
        icon={<Check size={24} color={T.success} strokeWidth={ICON_STROKE} />}
        confirmLabel="Approve"
        onConfirm={handleBulkApproveTravel}
        onCancel={() => setConfirmBulkTravel(false)}
      />

      <ConfirmModal
        visible={confirmBulkExpense}
        tone="success"
        title="Approve Claims?"
        message={`${eSelected.size} expense claim${eSelected.size === 1 ? '' : 's'} will be approved. This cannot be undone.`}
        icon={<Check size={24} color={T.success} strokeWidth={ICON_STROKE} />}
        confirmLabel="Approve"
        onConfirm={handleBulkApproveExpense}
        onCancel={() => setConfirmBulkExpense(false)}
      />
    </SafeAreaView>
  );
};

// ─── Styles (layout only — colour comes from the theme, inline) ───────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 14, gap: 12 },
  scrollWide: { paddingHorizontal: 22 },

  header: { gap: 2 },
  title: { fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: rf(12.5), fontWeight: '500' },

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  count: { fontSize: rf(11.5), fontWeight: '600' },
  filters: { borderTopWidth: 1, paddingTop: 12, gap: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'flex-start' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ddFull: { width: '100%' },

  // table
  tbl: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  th: { fontSize: rf(11), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  td: { fontSize: rf(13), fontWeight: '500' },
  tdName: { fontSize: rf(13.5), fontWeight: '700' },
  tdAmt: { fontSize: rf(13.5), fontWeight: '800' },
  tdSub: { fontSize: rf(11.5), fontWeight: '500', marginTop: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cCheck: { width: 26 },
  cName: { flex: 2 },
  cRole: { flex: 0.9 },
  cDate: { flex: 1.2 },
  cDist: { flex: 1 },
  cRate: { flex: 1.1 },
  cAmt: { flex: 1 },
  cFraud: { flex: 0.8 },
  cStatus: { flex: 1.1 },
  cCat: { flex: 1.2 },
  cBill: { flex: 1 },
  cDesc: { flex: 1.6 },
  cActions: { width: 76 }, // header <Text> ignores alignItems — both stay left so the
                           // icons line up under the ACTIONS label (web parity)
  actions: { flexDirection: 'row', gap: 6 },

  // phone rows
  rowCard: { alignItems: 'flex-start' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  rowActions: { flexDirection: 'row', gap: 6, marginTop: 9 },

  billLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  billLinkTxt: { fontSize: rf(12), fontWeight: '700' },

  pgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },

  empty: { borderRadius: 16, borderWidth: 1, paddingVertical: 46, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: rf(14), fontWeight: '700', textAlign: 'center' },
  emptyTxt: { fontSize: rf(12.5), fontWeight: '500', textAlign: 'center' },

  // modals
  mForm: { gap: 14 },
  row2: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col2: { gap: 14 },
  inputBox: { height: 46, borderRadius: 13, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  inputTxt: { flex: 1, fontSize: rf(14), fontWeight: '500', padding: 0 },
  textarea: { minHeight: 76, borderRadius: 13, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  textareaTxt: { fontSize: rf(14), fontWeight: '500', padding: 0, textAlignVertical: 'top', minHeight: 56 },
  billBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 13,
    paddingHorizontal: 14, paddingVertical: 13, borderStyle: 'dashed',
  },
  billTxt: { flex: 1, fontSize: rf(13), fontWeight: '500' },
  billPreview: { width: '100%', height: 160, borderRadius: 14, borderWidth: 1 },
});
